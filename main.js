/**
 * 경로식당 이용자 관리 프로그램
 * Electron 메인 프로세스
 */

const { app, BrowserWindow, ipcMain, dialog, safeStorage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

// 날짜/주 입력 달력의 시작 요일을 월요일로 설정 (한국 로케일)
app.commandLine.appendSwitch('lang', 'ko-KR');

// 모듈 임포트
const { DatabaseManager } = require('./src/modules/database');
const { ConfigManager } = require('./src/modules/config');
const { SettingsManager } = require('./src/modules/settings');
const { Logger } = require('./src/modules/logger');
const { TimeUtils } = require('./src/modules/time-utils');

let mainWindow = null;
let db = null;
let config = null;
let settings = null;
let logger = null;

// ==================== 시리얼 카드 리더기 ====================
let serialPort = null;
let serialParser = null;
let cardDebounceTimer = null;
let lastCardNumber = null;
let reconnectTimer = null;
let intentionalClose = false;
let lastComPort = null;
let lastBaudRate = null;

function scheduleReconnect(delayMs = 5000) {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (!lastComPort || !lastBaudRate) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (!intentionalClose && (!serialPort || !serialPort.isOpen)) {
      logger.info(`카드 리더기 재연결 시도: ${lastComPort}`);
      startCardReader(lastComPort, lastBaudRate);
    }
  }, delayMs);
}

function startCardReader(comPort, baudRate) {
  intentionalClose = false;
  lastComPort = comPort;
  lastBaudRate = baudRate;
  stopCardReader(false);

  const { SerialPort } = require('serialport');
  const { ReadlineParser } = require('@serialport/parser-readline');

  logger.info(`카드 리더기 연결 시도: ${comPort} (${baudRate} baud)`);

  try {
    serialPort = new SerialPort({ path: comPort, baudRate: parseInt(baudRate, 10) });
    serialParser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    serialPort.on('open', () => {
      logger.info(`카드 리더기 연결 성공: ${comPort}`);
      if (mainWindow) mainWindow.webContents.send('card-reader:status', { connected: true, port: comPort });
    });

    serialParser.on('data', (data) => {
      // 제어문자 제거
      const card = data.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (!card) return;

      // 디바운스: 동일 카드 0.3초 이내 재입력 무시
      const debounceMs = settings ? parseInt(settings.get('card_debounce_time', '0.3') * 1000) : 300;
      if (card === lastCardNumber && cardDebounceTimer) return;
      lastCardNumber = card;
      clearTimeout(cardDebounceTimer);
      cardDebounceTimer = setTimeout(() => { lastCardNumber = null; }, debounceMs);

      logger.info(`카드 읽기: ${card}`);
      if (mainWindow) mainWindow.webContents.send('card-reader:data', card);
    });

    serialPort.on('error', (err) => {
      logger.error(`카드 리더기 오류: ${err.message}`);
      if (mainWindow) mainWindow.webContents.send('card-reader:status', { connected: false, error: err.message });
      if (!intentionalClose) scheduleReconnect();
    });

    serialPort.on('close', () => {
      logger.info('카드 리더기 연결 끊김');
      if (mainWindow) mainWindow.webContents.send('card-reader:status', { connected: false });
      if (!intentionalClose) scheduleReconnect();
    });

  } catch (err) {
    logger.error(`카드 리더기 시작 실패: ${err.message}`);
    if (mainWindow) mainWindow.webContents.send('card-reader:status', { connected: false, error: err.message });
  }
}

function stopCardReader(isIntentional = true) {
  if (isIntentional) {
    intentionalClose = true;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (serialPort && serialPort.isOpen) {
    try { serialPort.close(); } catch (e) {}
  }
  serialPort = null;
  serialParser = null;
}

// 포트 목록 조회
async function listSerialPorts() {
  const { SerialPort } = require('serialport');
  try {
    const ports = await SerialPort.list();
    return ports.map(p => ({ path: p.path, manufacturer: p.manufacturer || '', friendlyName: p.friendlyName || '' }));
  } catch (e) {
    return [];
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 800,
    icon: path.join(__dirname, '..', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'default',
    autoHideMenuBar: true,
  });

  // 완전 메뉴 비활성화
  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // 준비 완료 시 표시
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();

    // 시작 시 전체 화면 설정 적용
    if (settings) {
      const fullscreen = settings.get('ui_fullscreen_on_start', '0');
      if (fullscreen === '1' || fullscreen === 'true') {
        mainWindow.setFullScreen(true);
      }
    }
  });

  mainWindow.on('closed', () => {
    if (logger) logger.setWindow(null);
    mainWindow = null;
  });
}

/**
 * 앱 초기화
 */
async function initializeApp() {
  // 1. 설정 관리자 초기화 (AppData config.json)
  config = new ConfigManager();

  // 패키징된 앱인 경우 설치 경로를 데이터 경로로 자동 설정
  if (app.isPackaged) {
    const installDir = path.dirname(process.execPath);
    config.saveBasePath(installDir);
  }

  // 2. 로거 초기화
  logger = new Logger(config);

  logger.info('='.repeat(60));
  logger.info(`경로식당 이용자 관리 프로그램 v${app.getVersion()} 시작 (Electron)`);
  logger.info('='.repeat(60));

  // 3. 최초 실행 확인
  const isFirstRun = config.isFirstRun();

  if (isFirstRun) {
    logger.info('최초 실행 감지 - 설정 마법사 실행');
  } else {
    // 4. 데이터베이스 연결
    const basePath = config.getBasePath();
    if (!basePath) {
      logger.error('base_path가 설정되지 않음');
      dialog.showErrorBox('설정 오류', '데이터 경로가 설정되지 않았습니다.\n초기 설정을 다시 실행하세요.');
      app.quit();
      return;
    }

    try {
      db = new DatabaseManager(basePath, logger);
      await db.initialize();
      logger.info(`데이터베이스 연결 성공: ${basePath}`);

      // 5. 설정 관리자 (DB 기반)
      settings = new SettingsManager(db, logger);

      // 기존 평문 SMTP 비밀번호 암호화 마이그레이션
      for (const ek of ENCRYPTED_KEYS) {
        const raw = settings.get(ek, '');
        if (raw && typeof raw === 'string' && !raw.startsWith(ENC_PREFIX)) {
          settings.set(ek, encryptValue(raw));
        }
      }

      // 6. 카드 리더기 시작
      const comPort = settings.get('com_port', 'COM3');
      const baudRate = settings.get('baud_rate', '9600');
      startCardReader(comPort, baudRate);

      // 7. 종결 후 1년 경과 사용자 자동 영구 삭제 (시작 시 + 매일 자정)
      const runPurge = () => {
        const result = db.purgeExpiredUsers();
        if (result.count > 0) logger.info(`[자동 삭제] 종결 1년 경과 사용자 ${result.count}명 영구 삭제`);
      };
      runPurge();
      const msUntilMidnight = () => {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        return midnight - now;
      };
      setTimeout(function schedulePurge() {
        runPurge();
        setInterval(runPurge, 24 * 60 * 60 * 1000);
      }, msUntilMidnight());
    } catch (err) {
      logger.error(`데이터베이스 연결 실패: ${err.message}`);
      dialog.showErrorBox('치명적 오류', `데이터베이스 연결에 실패했습니다:\n${err.message}`);
      app.quit();
      return;
    }
  }

  // 6. 윈도우 생성
  createWindow();
  if (logger) logger.setWindow(mainWindow);

  // 7. 자동 업데이트 설정
  setupAutoUpdater();
}

// ==================== IPC 핸들러 ====================

// --- 로깅 브릿지 ---
ipcMain.on('console-log', (event, level, ...args) => {
  if (level === 'ERROR') {
    console.error(`[Renderer ERROR]`, ...args);
  } else {
    console.log(`[Renderer INFO]`, ...args);
  }
});

// --- 앱 상태 ---
ipcMain.handle('app:isFirstRun', () => config.isFirstRun());
ipcMain.handle('app:getBasePath', () => config.getBasePath());
ipcMain.handle('app:saveBasePath', (_, basePath) => config.saveBasePath(basePath));
ipcMain.handle('app:getVersion', () => app.getVersion());

// --- 데이터베이스 ---

// 사용자 CRUD
ipcMain.handle('db:getUsers', (_, opts) => {
  return db.searchUsers(opts?.query, opts?.statusFilter || 'all');
});

ipcMain.handle('db:searchUsers', (_, query, statusFilter) => {
  return db.searchUsers(query, statusFilter);
});

ipcMain.handle('db:searchUsersPaginated', (_, query, statusFilter, page, pageSize) => {
  return db.searchUsersPaginated(query, statusFilter, page, pageSize);
});

ipcMain.handle('db:getUserById', (_, userId) => db.getUserById(userId));
ipcMain.handle('db:getUserByNumber', (_, number) => db.getUserByNumber(number));
ipcMain.handle('db:getUserByCardNumber', (_, cardNumber) => db.getUserByCardNumber(cardNumber));

ipcMain.handle('db:addUser', (_, number, name, notes, cardNumber) => db.addUser(number, name, notes, cardNumber));
ipcMain.handle('db:updateUser', (_, userId, name, notes) => db.updateUser(userId, name, notes));
ipcMain.handle('db:suspendUser', (_, userId) => db.suspendUser(userId));
ipcMain.handle('db:terminateUser', (_, userId) => db.terminateUser(userId));
ipcMain.handle('db:reactivateUser', (_, userId) => db.reactivateUser(userId));

// 카드 CRUD
ipcMain.handle('db:addCard', (_, userId, cardNumber) => db.addCard(userId, cardNumber));
ipcMain.handle('db:deactivateCard', (_, cardId, reason) => db.deactivateCard(cardId, reason));
ipcMain.handle('db:getActiveCard', (_, userId) => db.getActiveCard(userId));
ipcMain.handle('db:getCardHistory', (_, userId) => db.getCardHistory(userId));
ipcMain.handle('db:getCardOwnerInfo', (_, cardNumber) => db.getCardOwnerInfo(cardNumber));
ipcMain.handle('db:reissueCard', (_, userId, newCardNumber, reason) => db.reissueCard(userId, newCardNumber, reason));
ipcMain.handle('db:transferCard', (_, cardNumber, targetUserId, reason) => db.transferCard(cardNumber, targetUserId, reason));
ipcMain.handle('db:deleteCardsForUser', (_, userId) => db.deleteCardsForUser(userId));
ipcMain.handle('db:purgeUser', (_, userId) => db.purgeUser(userId));
ipcMain.handle('db:purgeExpiredUsers', () => db.purgeExpiredUsers());

// 이벤트/체크인
ipcMain.handle('db:checkIn', (_, userId, menuType, inputMethod, notes) => {
  const dupWindow = settings ? parseInt(settings.get('duplicate_window_minutes', '5'), 10) : 5;
  return db.checkIn(userId, menuType, inputMethod, notes, dupWindow);
});
ipcMain.handle('db:cancelCheckIn', (_, userId) => db.cancelCheckIn(userId));
ipcMain.handle('db:cancelEventById', (_, eventId) => db.cancelEventById(eventId));
ipcMain.handle('db:updateEventMenu', (_, eventId, menuType) => db.updateEventMenu(eventId, menuType));
ipcMain.handle('db:getDailyStats', () => db.getDailyStats());
ipcMain.handle('db:getTodayEvents', () => db.getTodayEvents());
ipcMain.handle('db:getUserTodayCount', (_, userId) => db.getUserTodayCount(userId));
ipcMain.handle('db:getTicketUser', () => db.getTicketUser());
ipcMain.handle('db:addTicket', () => db.addTicket());
ipcMain.handle('db:cancelLastTicket', () => db.cancelLastTicket());

// 특이사항
ipcMain.handle('db:getAllSpecialRemarks', () => db.getAllSpecialRemarks());
ipcMain.handle('db:addSpecialRemark', (_, name, desc, order, start, end, active) => {
  return db.addSpecialRemark(name, desc, order, start, end, active);
});
ipcMain.handle('db:updateSpecialRemark', (_, id, name, desc, isActive, startDate, endDate) => db.updateSpecialRemark(id, name, desc, isActive, startDate, endDate));
ipcMain.handle('db:deleteSpecialRemark', (_, remarkId) => db.deleteSpecialRemark(remarkId));
ipcMain.handle('db:getUsersForRemark', (_, remarkId) => db.getUsersForRemark(remarkId));
ipcMain.handle('db:assignRemark', (_, userId, remarkId) => db.assignRemark(userId, remarkId));
ipcMain.handle('db:unassignRemark', (_, userId, remarkId) => db.unassignRemark(userId, remarkId));

// 통계
ipcMain.handle('db:getUserStatistics', () => db.getUserStatistics());
ipcMain.handle('db:getMonthlyStats', (_, yearMonth) => db.getMonthlyStats(yearMonth));
ipcMain.handle('db:getPeriodStats', (_, startDate, endDate) => {
  return db.getPeriodStats(startDate, endDate);
});
ipcMain.handle('db:getDailyRangeStats', (_, startDate, endDate) => {
  return db.getDailyRangeStats(startDate, endDate);
});
ipcMain.handle('db:getAllUsersWeekdayUsage', (_, startDate, endDate) => {
  return db.getAllUsersWeekdayUsage(startDate, endDate);
});

// 삭제된 사용자
ipcMain.handle('db:getDeletedUsers', (_, search) => db.getDeletedUsers(search));

// --- 설정 ---
const ENCRYPTED_KEYS = ['smtp_pass'];
const ENC_PREFIX = 'enc:';

function encryptValue(plain) {
  if (!plain || !safeStorage.isEncryptionAvailable()) return plain;
  const buf = safeStorage.encryptString(String(plain));
  return ENC_PREFIX + buf.toString('base64');
}

function decryptValue(stored) {
  if (!stored || typeof stored !== 'string' || !stored.startsWith(ENC_PREFIX)) return stored;
  try {
    const buf = Buffer.from(stored.slice(ENC_PREFIX.length), 'base64');
    return safeStorage.decryptString(buf);
  } catch {
    return stored;
  }
}

ipcMain.handle('settings:get', (_, key, defaultValue) => {
  if (!settings) return defaultValue;
  const val = settings.get(key, defaultValue);
  if (ENCRYPTED_KEYS.includes(key)) return decryptValue(val);
  return val;
});
ipcMain.handle('settings:set', (_, key, value) => {
  if (!settings) return false;
  if (ENCRYPTED_KEYS.includes(key) && value) return settings.set(key, encryptValue(value));
  return settings.set(key, value);
});
ipcMain.handle('settings:getAll', () => {
  if (!settings) return {};
  const all = settings.getAll();
  for (const key of ENCRYPTED_KEYS) {
    if (all[key]) all[key] = decryptValue(all[key]);
  }
  return all;
});

// --- 다이얼로그 ---
ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '데이터 저장 경로 선택'
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('dialog:showError', (_, title, message) => {
  dialog.showErrorBox(title, message);
});

ipcMain.handle('dialog:showMessage', async (_, options) => {
  const result = await dialog.showMessageBox(mainWindow, options);
  return result.response;
});

// --- 초기 설정 ---
ipcMain.handle('setup:createDatabase', async (_, basePath) => {
  try {
    config.saveBasePath(basePath);

    // Data 디렉토리 생성
    const dataDir = path.join(basePath, 'Data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // DB 생성
    db = new DatabaseManager(basePath, logger);
    await db.initialize();
    await db.createTables();

    // 설정 관리자 초기화
    settings = new SettingsManager(db, logger);

    logger.info('초기 데이터베이스 생성 완료');
    return { success: true };
  } catch (err) {
    logger.error(`데이터베이스 생성 실패: ${err.message}`);
    return { success: false, error: err.message };
  }
});

// ==================== 메일 발송 IPC ====================

ipcMain.handle('mail:send', async (_, opts) => {
  try {
    const nodemailer = require('nodemailer');
    const host = settings.get('smtp_host', '');
    const port = parseInt(settings.get('smtp_port', '587'), 10);
    const user = settings.get('smtp_user', '');
    const pass = decryptValue(settings.get('smtp_pass', ''));

    if (!host || !user || !pass) {
      return { success: false, message: 'SMTP 설정이 완료되지 않았습니다. 설정 페이지에서 SMTP 정보를 입력하세요.' };
    }

    const transporter = nodemailer.createTransport({
      host, port, secure: port === 465,
      auth: { user, pass },
    });

    const mailOptions = {
      from: user,
      to: opts.to,
      subject: opts.subject || '이용현황',
      text: opts.body || '',
      attachments: opts.csvContent ? [{
        filename: opts.csvFilename || 'data.csv',
        content: Buffer.from(opts.csvContent, 'utf-8'),
        contentType: 'text/csv',
      }] : [],
    };

    await transporter.sendMail(mailOptions);
    logger.info(`메일 발송 성공: ${opts.to}`);
    return { success: true };
  } catch (err) {
    logger.error(`메일 발송 실패: ${err.message}`);
    return { success: false, message: err.message };
  }
});

ipcMain.handle('mail:test', async () => {
  try {
    const nodemailer = require('nodemailer');
    const host = settings.get('smtp_host', '');
    const port = parseInt(settings.get('smtp_port', '587'), 10);
    const user = settings.get('smtp_user', '');
    const pass = decryptValue(settings.get('smtp_pass', ''));

    if (!host || !user || !pass) {
      return { success: false, message: 'SMTP 설정이 완료되지 않았습니다.' };
    }

    const transporter = nodemailer.createTransport({
      host, port, secure: port === 465,
      auth: { user, pass },
    });

    await transporter.verify();
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

// ==================== 카드 리더기 IPC ====================

ipcMain.handle('card-reader:listPorts', async () => listSerialPorts());

ipcMain.handle('card-reader:connect', (_, comPort, baudRate) => {
  startCardReader(comPort, baudRate);
  return { success: true };
});

ipcMain.handle('card-reader:disconnect', () => {
  stopCardReader();
  return { success: true };
});

ipcMain.handle('card-reader:isConnected', () => {
  return serialPort && serialPort.isOpen;
});

// ==================== 자동 업데이트 ====================

function setupAutoUpdater() {
  if (!app.isPackaged) return; // 개발 환경에서는 스킵

  autoUpdater.autoDownload = false; // 사용자 확인 후 다운로드
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    logger.info(`업데이트 가능: v${info.version}`);

    // 이 버전을 건너뛰기로 선택했으면 무시
    if (config.getSkippedVersion() === info.version) {
      logger.info(`업데이트 v${info.version} 건너뛰기 설정됨 - 무시`);
      return;
    }

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '업데이트 알림',
      message: `새 버전이 있습니다 (v${info.version})`,
      detail: '지금 다운로드 하시겠습니까?',
      buttons: ['다운로드', '나중에', '이 버전 건너뛰기'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.downloadUpdate();
      } else if (response === 2) {
        config.setSkippedVersion(info.version);
        logger.info(`업데이트 v${info.version} 건너뛰기 저장됨`);
      }
    });
  });

  autoUpdater.on('update-not-available', () => {
    logger.info('최신 버전입니다.');
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    if (mainWindow) {
      mainWindow.setProgressBar(progress.percent / 100);
      mainWindow.setTitle(`경로식당 - 업데이트 다운로드 중... ${percent}%`);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) {
      mainWindow.setProgressBar(-1);
      mainWindow.setTitle('경로식당');
    }
    logger.info(`업데이트 다운로드 완료: v${info.version}`);
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '업데이트 준비 완료',
      message: `v${info.version} 다운로드가 완료되었습니다.\n지금 재시작하여 설치하시겠습니까?`,
      buttons: ['재시작 후 설치', '나중에'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        stopCardReader();
        if (db) db.close();
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    logger.error(`업데이트 오류: ${err.message}`);
  });

  // 앱 시작 5초 후 업데이트 확인 (초기화 완료 대기)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      logger.error(`업데이트 확인 실패: ${err.message}`);
    });
  }, 5000);
}

// IPC: 수동 업데이트 확인
ipcMain.handle('app:checkForUpdates', async () => {
  if (!app.isPackaged) return { available: false, reason: 'dev' };
  try {
    const result = await autoUpdater.checkForUpdates();
    return { available: !!result?.updateInfo };
  } catch (err) {
    return { available: false, error: err.message };
  }
});

// ==================== 앱 라이프사이클 ====================

app.whenReady().then(initializeApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopCardReader();
    if (db) {
      db.close();
    }
    if (logger) {
      logger.info('프로그램 종료');
      logger.info('='.repeat(60));
    }
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
