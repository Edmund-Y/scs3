/**
 * 데이터베이스 관리 모듈 (sql.js 기반)
 * core/database.py 이식
 */

const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

class DatabaseManager {
  constructor(basePath, logger) {
    this.basePath = basePath;
    this.dbPath = path.join(basePath, 'Data', 'users.db');
    this.logger = logger;
    this.db = null;
    this.sqljs = null;
    this._saveTimer = null;
    this._savePending = false;
  }

  async initialize() {
    this.sqljs = await initSqlJs();
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new this.sqljs.Database(buffer);
    } else {
      this.db = new this.sqljs.Database();
    }
    await this.createTables();
    this._ensureIndices();
  }

  _save() {
    this._savePending = true;
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._flushSave();
    }, 2000);
  }

  _flushSave() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    if (!this._savePending || !this.db) return;
    this._savePending = false;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.dbPath, buffer);
  }

  _ensureIndices() {
    try {
      this.db.run('CREATE INDEX IF NOT EXISTS idx_users_number_int ON users(CAST(number AS INTEGER))');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_users_number ON users(number)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_cards_user_active ON cards(user_id, deactivated_at)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_cards_issued_at ON cards(issued_at)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at)');
      this.db.run('CREATE INDEX IF NOT EXISTS idx_events_date_type_user ON events(created_at, event_type, user_id)');
    } catch (e) {
      // 테이블이 아직 없을 수 있음 (최초 실행)
    }
  }

  close() {
    if (this.db) {
      this._flushSave();
      this.db.close();
      this.db = null;
    }
  }

  // ==================== 유틸리티 ====================

  _kstNow() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
  }

  _kstToday() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  _queryAll(sql, params = []) {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  _queryOne(sql, params = []) {
    const results = this._queryAll(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  _run(sql, params = []) {
    try {
      this.db.run(sql, params);
      this._lastInsertRowId = this._fetchLastInsertRowId();
      this._save();
    } catch (e) {
      console.error(`[DB:_run] SQL 실행 실패:`, e.message, '\nSQL:', sql, '\nParams:', JSON.stringify(params));
      throw e;
    }
  }

  _fetchLastInsertRowId() {
    const stmt = this.db.prepare('SELECT last_insert_rowid() as id');
    stmt.step();
    const row = stmt.getAsObject();
    stmt.free();
    return row.id;
  }

  _getLastInsertRowId() {
    return this._lastInsertRowId;
  }

  _upsertCard(userId, cardNumber) {
    const existing = this._queryOne(
      `SELECT id FROM cards WHERE card_number = ?`, [cardNumber]
    );
    if (existing) {
      this._run(
        `UPDATE cards SET user_id = ?, deactivated_at = NULL, reissue_reason = NULL,
         issued_at = datetime('now','localtime') WHERE id = ?`,
        [userId, existing.id]
      );
    } else {
      this._run(`INSERT INTO cards (user_id, card_number) VALUES (?, ?)`, [userId, cardNumber]);
    }
  }

  // ==================== 테이블 생성 ====================

  async createTables() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number TEXT NOT NULL,
        name TEXT NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'active',
        deleted_at TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        card_number TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        issued_at TEXT DEFAULT (datetime('now','localtime')),
        deactivated_at TEXT,
        reissue_reason TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        menu_type TEXT,
        input_method TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS special_remarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        display_order INTEGER DEFAULT 0,
        start_date TEXT,
        end_date TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS user_special_remarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        remark_id INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (remark_id) REFERENCES special_remarks(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT,
        category TEXT DEFAULT 'general',
        description TEXT,
        updated_at TEXT
      )
    `);

    // 기본 설정값 삽입
    const defaults = [
      ['first_run_completed', '0', 'system', '최초 실행 완료 여부'],
      ['db_version', '3.0.0', 'system', '데이터베이스 버전'],
      ['dark_mode', '1', 'general', '다크 모드 활성화'],
      ['duplicate_highlight_duration', '3', 'general', '중복 이용 강조 시간 (초)'],
      ['scan_interval', '0.5', 'hardware', '스캔 간격 (초)'],
      ['card_debounce_time', '0.3', 'hardware', '카드 중복 인식 방지 시간 (초)'],
      ['com_port', 'COM3', 'hardware', '카드 리더기 COM 포트'],
      ['baud_rate', '9600', 'hardware', '카드 리더기 전송 속도'],
      ['tts_enabled', '1', 'tts', 'TTS 활성화'],
      ['tts_rate', '150', 'tts', 'TTS 속도'],
      ['tts_volume', '1.0', 'tts', 'TTS 볼륨'],
      ['tts_anonymous', '0', 'tts', '음성 익명화'],
      ['tts_read_normal', '1', 'tts', '일반식 TTS 읽기'],
      ['tts_read_porridge', '1', 'tts', '죽식 TTS 읽기'],
      ['tts_read_remarks', '1', 'tts', '특이사항 TTS 읽기'],
      ['tts_read_duplicate', '1', 'tts', '중복 이용 TTS 읽기'],
      ['auto_backup', '1', 'backup', '자동 백업 활성화'],
      ['backup_interval', 'daily', 'backup', '백업 주기'],
      ['max_backups', '30', 'backup', '최대 백업 개수'],
      ['log_level', 'INFO', 'logging', '로그 레벨'],
      ['log_retention_days', '30', 'logging', '로그 보관 기간 (일)'],
      ['max_search_results', '30', 'general', '검색 결과 표시 개수'],
      ['max_search_results_chosung', '100', 'general', '초성 검색 결과 표시 개수'],
      // 체크인 동작
      ['duplicate_window_minutes', '5', 'checkin', '중복 판정 시간 (분)'],
      ['checkin_auto_clear_seconds', '3', 'checkin', '체크인 알림 표시 시간 (초)'],
      ['default_menu_type', '일반식', 'checkin', '기본 식사 유형'],
      ['checkin_sound_enabled', '1', 'checkin', '체크인 효과음'],
      ['checkin_sound_duplicate', '1', 'checkin', '중복 경고음'],
      // TTS 확장
      ['tts_read_unregistered', '1', 'tts', '미등록자 안내 읽기'],
      ['tts_read_recent_duplicate', '1', 'tts', '단시간 중복 안내 읽기'],
      ['tts_custom_checkin_msg', '', 'tts', '체크인 사용자 정의 멘트'],
      ['tts_custom_duplicate_msg', '', 'tts', '중복 사용자 정의 멘트'],
      // 화면 표시
      ['ui_font_size', '14', 'display', '기본 글꼴 크기 (px)'],
      ['ui_fullscreen_on_start', '0', 'display', '시작 시 전체 화면'],
      ['ui_show_user_number', '1', 'display', '이용 현황에 번호 표시'],
      ['ui_usage_list_max', '50', 'display', '이용 현황 표시 개수'],
      ['ui_show_ticket_button', '1', 'display', '식권 버튼 표시'],
      // 데이터/내보내기
      ['export_include_ticket', '1', 'export', '내보내기에 식권 포함'],
      ['export_encoding', 'UTF-8', 'export', 'CSV 인코딩'],
      // SMTP 메일
      ['smtp_provider', 'gmail', 'email', '메일 서비스 (gmail/naver/daum)'],
      ['smtp_user', '', 'email', 'SMTP 사용자'],
      ['smtp_pass', '', 'email', 'SMTP 비밀번호'],
      ['smtp_default_to', '', 'email', '기본 수신자 이메일'],
    ];

    for (const [key, value, category, desc] of defaults) {
      this.db.run(
        `INSERT OR IGNORE INTO app_settings (key, value, category, description) VALUES (?, ?, ?, ?)`,
        [key, value, category, desc]
      );
    }

    // TICKET 사용자 생성
    this.db.run(
      `INSERT OR IGNORE INTO users (number, name, notes) VALUES ('TICKET', '식권구매', '시스템 사용자 - 당일 식권 체크인을 위한 익명 계정')`
    );

    this._ensureIndices();
    this._save();
  }

  // ==================== 사용자 CRUD ====================

  addUser(number, name, notes, cardNumber) {
    try {
      const existing = this._queryOne(
        `SELECT id, status FROM users WHERE number = ? AND status IN ('active', 'suspended')`,
        [number]
      );
      if (existing) {
        const statusKr = existing.status === 'active' ? '활성' : '일시정지';
        return { success: false, message: `이미 존재하는 번호입니다 (${statusKr} 상태): ${number}`, userId: null };
      }

      this._run(`INSERT INTO users (number, name, notes) VALUES (?, ?, ?)`, [number, name, notes || null]);
      const userId = this._getLastInsertRowId();
      console.log(`[addUser] 새 사용자 생성 완료: userId=${userId}, number=${number}`);

      // 카드 번호가 있으면 카드 추가
      if (cardNumber) {
        const cardResult = this.addCard(userId, cardNumber);
        if (!cardResult.success) {
          return { success: true, message: `사용자는 추가되었으나 카드 추가 실패: ${cardResult.message}`, userId };
        }
      }

      return { success: true, message: '사용자 추가 성공', userId };
    } catch (e) {
      return { success: false, message: `사용자 추가 실패: ${e.message}`, userId: null };
    }
  }

  updateUser(userId, name, notes) {
    try {
      const user = this._queryOne(`SELECT number FROM users WHERE id = ?`, [userId]);
      if (!user) return { success: false, message: '사용자를 찾을 수 없습니다' };
      if (user.number === 'TICKET') return { success: false, message: '시스템 사용자(TICKET)는 수정할 수 없습니다' };

      const updates = [];
      const params = [];
      if (name !== undefined && name !== null) { updates.push('name = ?'); params.push(name); }
      if (notes !== undefined && notes !== null) { updates.push('notes = ?'); params.push(notes); }
      if (updates.length === 0) return { success: false, message: '수정할 내용이 없습니다' };

      params.push(userId);
      this._run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
      return { success: true, message: '사용자 수정 성공' };
    } catch (e) {
      return { success: false, message: `사용자 수정 실패: ${e.message}` };
    }
  }

  suspendUser(userId) {
    try {
      const user = this._queryOne(`SELECT number, status FROM users WHERE id = ?`, [userId]);
      if (!user) return { success: false, message: '사용자를 찾을 수 없습니다' };
      if (user.number === 'TICKET') return { success: false, message: '시스템 사용자(TICKET)는 일시정지할 수 없습니다' };
      if (user.status === 'suspended') return { success: false, message: '이미 일시정지된 사용자입니다' };
      if (user.status === 'terminated') return { success: false, message: '종결된 사용자는 일시정지할 수 없습니다' };

      this._run(`UPDATE users SET status = 'suspended', deleted_at = ? WHERE id = ?`, [this._kstNow(), userId]);
      return { success: true, message: '사용자 일시정지 성공' };
    } catch (e) {
      return { success: false, message: `사용자 일시정지 실패: ${e.message}` };
    }
  }

  terminateUser(userId) {
    try {
      const user = this._queryOne(`SELECT number, status FROM users WHERE id = ?`, [userId]);
      if (!user) return { success: false, message: '사용자를 찾을 수 없습니다' };
      if (user.number === 'TICKET') return { success: false, message: '시스템 사용자(TICKET)는 종결할 수 없습니다' };
      if (user.status === 'terminated') return { success: false, message: '이미 종결된 사용자입니다' };

      this._run(`UPDATE users SET status = 'terminated', deleted_at = ? WHERE id = ?`, [this._kstNow(), userId]);
      return { success: true, message: '사용자 종결 성공 (번호 재사용 가능)' };
    } catch (e) {
      return { success: false, message: `사용자 종결 실패: ${e.message}` };
    }
  }

  reactivateUser(userId) {
    try {
      const user = this._queryOne(`SELECT status FROM users WHERE id = ?`, [userId]);
      if (!user) return { success: false, message: '사용자를 찾을 수 없습니다' };
      if (user.status === 'active') return { success: false, message: '이미 활성 상태입니다' };

      this._run(`UPDATE users SET status = 'active', deleted_at = NULL WHERE id = ?`, [userId]);
      return { success: true, message: '사용자 재활성화 성공' };
    } catch (e) {
      return { success: false, message: `사용자 재활성화 실패: ${e.message}` };
    }
  }

  searchUsers(query, statusFilter = 'all') {
    return this._queryAll(`
      SELECT u.*,
        (SELECT card_number FROM cards c WHERE c.user_id = u.id AND c.deactivated_at IS NULL ORDER BY c.issued_at DESC, c.id DESC LIMIT 1) as card_number
      FROM users u
      WHERE u.number != 'TICKET'
      AND (? = 'all' OR u.status = ?)
      AND (? IS NULL OR ? = '' OR LOWER(u.number) LIKE '%' || LOWER(?) || '%' OR LOWER(u.name) LIKE '%' || LOWER(?) || '%')
      ORDER BY CAST(u.number AS INTEGER), u.number
    `, [statusFilter, statusFilter, query || null, query || null, query || null, query || null]);
  }

  searchUsersPaginated(query, statusFilter = 'all', page = 1, pageSize = 50) {
    const offset = (page - 1) * pageSize;
    const totalRow = this._queryOne(`
      SELECT COUNT(*) as total FROM users u
      WHERE u.number != 'TICKET'
      AND (? = 'all' OR u.status = ?)
      AND (? IS NULL OR ? = '' OR LOWER(u.number) LIKE '%' || LOWER(?) || '%' OR LOWER(u.name) LIKE '%' || LOWER(?) || '%')
    `, [statusFilter, statusFilter, query || null, query || null, query || null, query || null]);
    const total = totalRow ? totalRow.total : 0;

    const users = this._queryAll(`
      SELECT u.*,
        (SELECT card_number FROM cards c WHERE c.user_id = u.id AND c.deactivated_at IS NULL ORDER BY c.issued_at DESC, c.id DESC LIMIT 1) as card_number
      FROM users u
      WHERE u.number != 'TICKET'
      AND (? = 'all' OR u.status = ?)
      AND (? IS NULL OR ? = '' OR LOWER(u.number) LIKE '%' || LOWER(?) || '%' OR LOWER(u.name) LIKE '%' || LOWER(?) || '%')
      ORDER BY CAST(u.number AS INTEGER), u.number
      LIMIT ? OFFSET ?
    `, [statusFilter, statusFilter, query || null, query || null, query || null, query || null, pageSize, offset]);

    return { users, total };
  }

  getUserById(userId) {
    const user = this._queryOne(`SELECT * FROM users WHERE id = ?`, [userId]);
    if (!user) return null;
    // 특이사항 포함
    const remarks = this._queryAll(`
      SELECT sr.name, sr.start_date, sr.end_date, sr.is_active
      FROM user_special_remarks usr JOIN special_remarks sr ON usr.remark_id = sr.id
      WHERE usr.user_id = ?
    `, [userId]);
    const active = remarks.filter(r => r.is_active).map(r => r.name);
    user.special_remarks = active.length > 0 ? active.join(', ') : null;
    user.special_remarks_details = { active, expired: remarks.filter(r => !r.is_active).map(r => r.name) };
    return user;
  }

  getUserByNumber(number) {
    const user = this._queryOne(`SELECT * FROM users WHERE number = ? AND status IN ('active', 'suspended')`, [number]);
    if (!user) return null;
    const remarks = this._queryAll(`
      SELECT sr.name, sr.start_date, sr.end_date, sr.is_active
      FROM user_special_remarks usr JOIN special_remarks sr ON usr.remark_id = sr.id
      WHERE usr.user_id = ?
    `, [user.id]);
    const active = remarks.filter(r => r.is_active).map(r => r.name);
    user.special_remarks = active.length > 0 ? active.join(', ') : null;
    user.special_remarks_details = { active, expired: remarks.filter(r => !r.is_active).map(r => r.name) };
    return user;
  }

  getUserByCardNumber(cardNumber) {
    return this._queryOne(`
      SELECT u.* FROM users u JOIN cards c ON u.id = c.user_id
      WHERE c.card_number = ? AND c.deactivated_at IS NULL AND u.status IN ('active', 'suspended')
    `, [cardNumber]);
  }

  getTicketUser() {
    let user = this._queryOne(`SELECT * FROM users WHERE number = 'TICKET' AND status IN ('active', 'suspended')`);
    if (!user) {
      this._run(`INSERT INTO users (number, name, notes) VALUES ('TICKET', '식권구매', '시스템 사용자')`);
      user = this._queryOne(`SELECT * FROM users WHERE number = 'TICKET'`);
    }
    return user;
  }

  getUserStatistics() {
    const row = this._queryOne(`
      SELECT COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) as active,
        COALESCE(SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END), 0) as suspended,
        COALESCE(SUM(CASE WHEN status = 'terminated' THEN 1 ELSE 0 END), 0) as terminated
      FROM users WHERE number != 'TICKET'
    `);
    return row || { total: 0, active: 0, suspended: 0, terminated: 0 };
  }

  getDeletedUsers(search) {
    let sql = `SELECT u.id, u.number, u.name, u.notes, u.status, u.deleted_at, u.created_at
      FROM users u WHERE u.status = 'terminated' AND u.number != 'TICKET'`;
    const params = [];
    if (search) {
      sql += ` AND (u.number LIKE ? OR u.name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ` ORDER BY u.deleted_at DESC, CAST(u.number AS INTEGER), u.number`;
    return this._queryAll(sql, params);
  }

  // ==================== 카드 CRUD ====================

  addCard(userId, cardNumber) {
    try {
      const existing = this._queryOne(`SELECT id, user_id FROM cards WHERE card_number = ? AND deactivated_at IS NULL`, [cardNumber]);
      if (existing) return { success: false, message: `이미 사용 중인 카드 번호입니다: ${cardNumber}`, cardId: null };

      console.log(`[addCard] userId=${userId}, cardNumber=${cardNumber}`);
      const user = this._queryOne(`SELECT id, deleted_at FROM users WHERE id = ?`, [userId]);
      console.log(`[addCard] user lookup result:`, JSON.stringify(user));
      if (!user || user.deleted_at !== null) return { success: false, message: '사용자를 찾을 수 없습니다', cardId: null };

      this._upsertCard(userId, cardNumber);
      const cardId = this._getLastInsertRowId();
      return { success: true, message: '카드 추가 성공', cardId };
    } catch (e) {
      return { success: false, message: `카드 추가 실패: ${e.message}`, cardId: null };
    }
  }

  deactivateCard(cardId, reason) {
    try {
      this._run(`UPDATE cards SET deactivated_at = datetime('now','localtime'), reissue_reason = ? WHERE id = ?`, [reason, cardId]);
      return { success: true, message: '카드 비활성화 성공' };
    } catch (e) {
      return { success: false, message: `카드 비활성화 실패: ${e.message}` };
    }
  }

  getActiveCard(userId) {
    return this._queryOne(`SELECT * FROM cards WHERE user_id = ? AND deactivated_at IS NULL ORDER BY issued_at DESC LIMIT 1`, [userId]);
  }

  getCardHistory(userId) {
    return this._queryAll(`SELECT id, user_id, card_number, is_active, created_at, deactivated_at FROM cards WHERE user_id = ? ORDER BY created_at DESC`, [userId]);
  }

  getCardOwnerInfo(cardNumber) {
    return this._queryOne(`
      SELECT u.id, u.number, u.name, u.status
      FROM users u JOIN cards c ON u.id = c.user_id
      WHERE c.card_number = ? AND c.deactivated_at IS NULL AND u.status IN ('active', 'suspended')
    `, [cardNumber]);
  }

  reissueCard(userId, newCardNumber, reason = '카드 재발급') {
    try {
      // 새 카드가 다른 사용자의 활성 카드로 이미 등록된 경우 차단
      const conflict = this._queryOne(
        `SELECT c.id, u.number, u.name FROM cards c JOIN users u ON c.user_id = u.id
         WHERE c.card_number = ? AND c.deactivated_at IS NULL AND c.user_id != ?`,
        [newCardNumber, userId]
      );
      if (conflict) {
        return { success: false, message: `이미 다른 사용자(${conflict.number} ${conflict.name})에게 등록된 카드입니다: ${newCardNumber}` };
      }

      // 기존 활성 카드 비활성화
      const oldCards = this._queryAll(
        `SELECT id FROM cards WHERE user_id = ? AND deactivated_at IS NULL`, [userId]
      );
      for (const card of oldCards) {
        this._run(
          `UPDATE cards SET deactivated_at = datetime('now','localtime'), reissue_reason = ? WHERE id = ?`,
          [reason, card.id]
        );
      }
      // 새 카드 추가
      this._upsertCard(userId, newCardNumber);
      return { success: true, message: '카드가 재발급되었습니다' };
    } catch (e) {
      return { success: false, message: `카드 재발급 실패: ${e.message}` };
    }
  }

  transferCard(cardNumber, targetUserId, reason = '카드 이전') {
    try {
      const ownerInfo = this.getCardOwnerInfo(cardNumber);
      if (!ownerInfo) return { success: false, message: '카드의 현재 소유자를 찾을 수 없습니다' };
      if (ownerInfo.id === targetUserId) return { success: false, message: '자기 자신에게 카드를 이전할 수 없습니다' };

      // 기존 소유자의 해당 카드 비활성화
      const oldCard = this._queryOne(
        `SELECT id FROM cards WHERE user_id = ? AND card_number = ? AND deactivated_at IS NULL`,
        [ownerInfo.id, cardNumber]
      );
      if (oldCard) {
        this._run(
          `UPDATE cards SET deactivated_at = datetime('now','localtime'), reissue_reason = ? WHERE id = ?`,
          [`카드 이전: ${reason}`, oldCard.id]
        );
      }

      // 대상 사용자의 기존 활성 카드 비활성화
      const targetOldCards = this._queryAll(
        `SELECT id FROM cards WHERE user_id = ? AND deactivated_at IS NULL`, [targetUserId]
      );
      for (const card of targetOldCards) {
        this._run(
          `UPDATE cards SET deactivated_at = datetime('now','localtime'), reissue_reason = ? WHERE id = ?`,
          ['카드 이전으로 교체', card.id]
        );
      }

      // 새 소유자에게 카드 배정
      this._upsertCard(targetUserId, cardNumber);
      return { success: true, message: '카드가 성공적으로 이전되었습니다' };
    } catch (e) {
      return { success: false, message: `카드 이전 실패: ${e.message}` };
    }
  }

  // 종결 사용자 영구 삭제 (카드, 이벤트, 특이사항 포함)
  purgeUser(userId) {
    try {
      const user = this._queryOne(`SELECT status FROM users WHERE id = ?`, [userId]);
      if (!user) return { success: false, message: '사용자를 찾을 수 없습니다' };
      if (user.status !== 'terminated') return { success: false, message: '종결된 사용자만 영구 삭제할 수 있습니다' };

      this._run(`DELETE FROM cards WHERE user_id = ?`, [userId]);
      this._run(`DELETE FROM events WHERE user_id = ?`, [userId]);
      this._run(`DELETE FROM user_special_remarks WHERE user_id = ?`, [userId]);
      this._run(`DELETE FROM users WHERE id = ?`, [userId]);
      return { success: true };
    } catch (e) {
      return { success: false, message: `영구 삭제 실패: ${e.message}` };
    }
  }

  // 종결일로부터 1년 이상 지난 종결자 자동 영구 삭제
  purgeExpiredUsers() {
    try {
      const expired = this._queryAll(
        `SELECT id FROM users WHERE status = 'terminated' AND deleted_at IS NOT NULL
         AND date(deleted_at) <= date('now', '-1 year')`
      );
      for (const u of expired) {
        this.purgeUser(u.id);
      }
      return { success: true, count: expired.length };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  deleteCardsForUser(userId) {
    try {
      this._run(`DELETE FROM cards WHERE user_id = ?`, [userId]);
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  // ==================== 이벤트/체크인 ====================

  checkIn(userId, menuType, inputMethod, notes, duplicateWindowMinutes = 5) {
    try {
      console.log(`[DB:checkIn] userId=${userId}, menuType=${menuType}, inputMethod=${inputMethod}, dupWindow=${duplicateWindowMinutes}`);

      // N분 이내 중복 체크
      const recentCheckin = this._queryOne(`
        SELECT id FROM events
        WHERE user_id = ?
          AND event_type = 'check_in'
          AND created_at >= datetime('now', 'localtime', '-' || ? || ' minutes')
      `, [userId, duplicateWindowMinutes]);

      if (recentCheckin) {
        console.log(`[DB:checkIn] ${duplicateWindowMinutes}분 이내 중복 시도 차단: userId=${userId}`);
        const today = this._kstToday();
        const countRow = this._queryOne(`
          SELECT COUNT(*) as count FROM events
          WHERE user_id = ? AND event_type = 'check_in'
          AND created_at BETWEEN ? AND ?
        `, [userId, today + ' 00:00:00', today + ' 23:59:59']);
        return { success: true, count: countRow ? countRow.count : 1, isRecentDuplicate: true, duplicateWindowMinutes, message: `${duplicateWindowMinutes}분 이내 중복입니다.` };
      }

      this._run(`INSERT INTO events (user_id, event_type, menu_type, input_method, notes) VALUES (?, 'check_in', ?, ?, ?)`,
        [userId, menuType, inputMethod, notes || null]);

      const insertRow = this._queryOne(`SELECT last_insert_rowid() as id`);
      const newId = insertRow.id;

      // 새로 삽입된 이벤트 조회 (이름, 번호 포함)
      const eventInfo = this._queryOne(`
        SELECT e.*, u.number, u.name,
        (SELECT GROUP_CONCAT(sr.name, ', ')
         FROM user_special_remarks usr
         JOIN special_remarks sr ON usr.remark_id = sr.id
         WHERE usr.user_id = e.user_id AND sr.is_active = 1) as special_remarks
        FROM events e JOIN users u ON e.user_id = u.id
        WHERE e.id = ?
      `, [newId]);

      // 오늘 이 사용자의 체크인 횟수
      const today = this._kstToday();
      const countRow = this._queryOne(`
        SELECT COUNT(*) as count FROM events
        WHERE user_id = ? AND event_type = 'check_in'
        AND created_at BETWEEN ? AND ?
      `, [userId, today + ' 00:00:00', today + ' 23:59:59']);

      const count = countRow ? countRow.count : 1;
      console.log(`[DB:checkIn] 성공 - count=${count}`);
      return { success: true, count, event: eventInfo };
    } catch (e) {
      console.error(`[DB:checkIn] 실패:`, e.message);
      return { success: false, count: 0, error: e.message };
    }
  }

  addTicket() {
    try {
      let ticketUser = this._queryOne(`SELECT * FROM users WHERE number = 'TICKET'`);
      if (!ticketUser) {
        this._run(`INSERT INTO users (number, name, notes) VALUES ('TICKET', '식권구매', '시스템 사용자')`);
        ticketUser = this._queryOne(`SELECT * FROM users WHERE number = 'TICKET'`);
      }
      this._run(`INSERT INTO events (user_id, event_type, menu_type, input_method) VALUES (?, 'check_in', '식권', 'ticket')`, [ticketUser.id]);
      const insertRow = this._queryOne(`SELECT last_insert_rowid() as id`);
      const eventInfo = this._queryOne(`SELECT e.*, u.number, u.name FROM events e JOIN users u ON e.user_id = u.id WHERE e.id = ?`, [insertRow.id]);
      const today = this._kstToday();
      const countRow = this._queryOne(`SELECT COUNT(*) as count FROM events WHERE user_id = ? AND event_type = 'check_in' AND created_at BETWEEN ? AND ?`, [ticketUser.id, today + ' 00:00:00', today + ' 23:59:59']);
      return { success: true, count: countRow ? countRow.count : 1, event: eventInfo };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  cancelLastTicket() {
    try {
      const ticketUser = this._queryOne(`SELECT id FROM users WHERE number = 'TICKET'`);
      if (!ticketUser) return { success: false, message: '식권 사용자를 찾을 수 없습니다.' };
      const today = this._kstToday();
      const lastEvent = this._queryOne(`
        SELECT id FROM events
        WHERE user_id = ? AND event_type = 'check_in' AND input_method = 'ticket'
          AND created_at BETWEEN ? AND ?
        ORDER BY id DESC LIMIT 1
      `, [ticketUser.id, today + ' 00:00:00', today + ' 23:59:59']);
      if (!lastEvent) return { success: false, message: '취소할 식권 기록이 없습니다.' };
      this._run(`UPDATE events SET event_type = 'cancel' WHERE id = ?`, [lastEvent.id]);
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  cancelCheckIn(userId) {
    try {
      const today = this._kstToday();
      this._run(`
        UPDATE events SET event_type = 'cancel'
        WHERE user_id = ? AND event_type = 'check_in'
        AND created_at BETWEEN ? AND ?
      `, [userId, today + ' 00:00:00', today + ' 23:59:59']);
      return { success: true, message: '체크인 취소 성공' };
    } catch (e) {
      return { success: false, message: `체크인 취소 실패: ${e.message}` };
    }
  }

  cancelEventById(eventId) {
    try {
      console.log(`[DB:cancelEventById] eventId=${eventId}`);

      // 1. 해당 이벤트의 user_id, input_method 찾기
      const eventRow = this._queryOne(`SELECT user_id, input_method FROM events WHERE id = ?`, [eventId]);
      if (!eventRow) {
        throw new Error('이벤트를 찾을 수 없습니다.');
      }

      // 식권은 단일 건만 취소 (같은 TICKET 유저를 공유하므로 전체 취소하면 안 됨)
      if (eventRow.input_method === 'ticket') {
        console.log(`[DB:cancelEventById] 식권 단일 취소 진행: eventId=${eventId}`);
        this._run(`
          UPDATE events
          SET event_type = 'cancel'
          WHERE id = ?
            AND event_type = 'check_in'
        `, [eventId]);
        console.log(`[DB:cancelEventById] 식권 단일 취소 성공`);
        return { success: true, message: '식권 1건 취소 성공' };
      }

      const userId = eventRow.user_id;

      // 2. 해당 유저의 오늘자 모든 check_in 이벤트를 취소 처리
      console.log(`[DB:cancelEventById] 당일 전체 취소 진행: userId=${userId}`);
      const today = this._kstToday();
      this._run(`
        UPDATE events
        SET event_type = 'cancel'
        WHERE user_id = ?
          AND event_type = 'check_in'
          AND created_at BETWEEN ? AND ?
      `, [userId, today + ' 00:00:00', today + ' 23:59:59']);

      console.log(`[DB:cancelEventById] 당일 전체 취소 성공`);
      return { success: true, message: '당일 전체 취소 성공' };
    } catch (e) {
      console.error(`[DB:cancelEventById] 에러:`, e.message);
      return { success: false, message: `취소 실패: ${e.message}` };
    }
  }

  updateEventMenu(eventId, menuType) {
    try {
      console.log(`[DB:updateEventMenu] eventId=${eventId}, menuType=${menuType}`);
      this._run(`UPDATE events SET menu_type = ? WHERE id = ?`, [menuType, eventId]);
      console.log(`[DB:updateEventMenu] 성공`);
      return { success: true, message: '메뉴 변경 성공' };
    } catch (e) {
      console.error(`[DB:updateEventMenu] 에러:`, e.message);
      return { success: false, message: `변경 실패: ${e.message}` };
    }
  }

  getDailyStats() {
    const today = this._kstToday();
    const dayStart = today + ' 00:00:00';
    const dayEnd = today + ' 23:59:59';
    console.log(`[DB:getDailyStats] today=${today}`);
    const row = this._queryOne(`
      WITH user_final_menu AS (
        SELECT user_id, input_method,
          (SELECT menu_type FROM events e2
           WHERE e2.user_id = e.user_id AND e2.event_type = 'check_in' AND e2.input_method != 'ticket'
           AND e2.created_at BETWEEN ? AND ? ORDER BY e2.created_at ASC LIMIT 1) as final_menu
        FROM events e
        WHERE e.created_at BETWEEN ? AND ? AND event_type = 'check_in' AND input_method != 'ticket'
        GROUP BY user_id
        UNION ALL
        SELECT user_id, input_method, 'ticket' as final_menu
        FROM events WHERE created_at BETWEEN ? AND ? AND event_type = 'check_in' AND input_method = 'ticket'
      )
      SELECT COUNT(*) as total,
        SUM(CASE WHEN final_menu = '일반식' THEN 1 ELSE 0 END) as normal,
        SUM(CASE WHEN final_menu = '죽식' THEN 1 ELSE 0 END) as porridge,
        SUM(CASE WHEN final_menu = 'ticket' THEN 1 ELSE 0 END) as ticket
      FROM user_final_menu
    `, [dayStart, dayEnd, dayStart, dayEnd, dayStart, dayEnd]);
    console.log(`[DB:getDailyStats] result=`, JSON.stringify(row));
    return row || { total: 0, normal: 0, porridge: 0, ticket: 0 };
  }

  getTodayEvents() {
    const today = this._kstToday();
    console.log(`[DB:getTodayEvents] today=${today}`);
    const events = this._queryAll(`
      SELECT e.*, u.number, u.name,
        (SELECT GROUP_CONCAT(sr.name, ', ')
         FROM user_special_remarks usr
         JOIN special_remarks sr ON usr.remark_id = sr.id
         WHERE usr.user_id = e.user_id AND sr.is_active = 1) as special_remarks
      FROM events e JOIN users u ON e.user_id = u.id
      WHERE e.created_at BETWEEN ? || ' 00:00:00' AND ? || ' 23:59:59'
      AND u.deleted_at IS NULL
      ORDER BY e.created_at DESC
    `, [today, today]);
    console.log(`[DB:getTodayEvents] ${events.length}건 조회됨`);
    return events;
  }

  getUserTodayCount(userId) {
    const today = this._kstToday();
    const row = this._queryOne(`
      SELECT COUNT(*) as count FROM events
      WHERE user_id = ? AND event_type = 'check_in'
      AND created_at BETWEEN ? AND ?
    `, [userId, today + ' 00:00:00', today + ' 23:59:59']);
    return row ? row.count : 0;
  }

  // ==================== 특이사항 ====================

  getAllSpecialRemarks() {
    return this._queryAll(`SELECT id, name, description, display_order, start_date, end_date, is_active, created_at FROM special_remarks ORDER BY display_order, name`);
  }

  addSpecialRemark(name, description, displayOrder, startDate, endDate, isActive) {
    try {
      const existing = this._queryOne(`SELECT id FROM special_remarks WHERE name = ?`, [name]);
      if (existing) return { success: false, message: `이미 존재하는 특이사항입니다: ${name}` };

      this._run(`INSERT INTO special_remarks (name, description, display_order, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, description, displayOrder || 0, startDate || null, endDate || null, isActive !== undefined ? isActive : 1]);
      return { success: true, message: '특이사항 추가 성공' };
    } catch (e) {
      return { success: false, message: `특이사항 추가 실패: ${e.message}` };
    }
  }

  updateSpecialRemark(remarkId, name, description, isActive, startDate, endDate) {
    try {
      const existing = this._queryOne(`SELECT id FROM special_remarks WHERE name = ? AND id != ?`, [name, remarkId]);
      if (existing) return { success: false, message: `이미 존재하는 이름입니다: ${name}` };
      this._run(`UPDATE special_remarks SET name = ?, description = ?, is_active = ?, start_date = ?, end_date = ? WHERE id = ?`,
        [name, description || null, isActive ? 1 : 0, startDate || null, endDate || null, remarkId]);
      return { success: true, message: '특이사항 수정 성공' };
    } catch (e) {
      return { success: false, message: `특이사항 수정 실패: ${e.message}` };
    }
  }

  deleteSpecialRemark(remarkId) {
    try {
      this._run(`DELETE FROM user_special_remarks WHERE remark_id = ?`, [remarkId]);
      this._run(`DELETE FROM special_remarks WHERE id = ?`, [remarkId]);
      return { success: true, message: '특이사항 삭제 성공' };
    } catch (e) {
      return { success: false, message: `특이사항 삭제 실패: ${e.message}` };
    }
  }

  getUsersForRemark(remarkId) {
    return this._queryAll(`
      SELECT u.id as user_id, u.number, u.name
      FROM user_special_remarks usr JOIN users u ON usr.user_id = u.id
      WHERE usr.remark_id = ? AND u.deleted_at IS NULL
      ORDER BY CAST(u.number AS INTEGER), u.number
    `, [remarkId]);
  }

  assignRemark(userId, remarkId) {
    try {
      const existing = this._queryOne(`SELECT id FROM user_special_remarks WHERE user_id = ? AND remark_id = ?`, [userId, remarkId]);
      if (existing) return { success: false, message: '이미 배정되어 있습니다' };
      this._run(`INSERT INTO user_special_remarks (user_id, remark_id) VALUES (?, ?)`, [userId, remarkId]);
      return { success: true, message: '특이사항 배정 성공' };
    } catch (e) {
      return { success: false, message: `배정 실패: ${e.message}` };
    }
  }

  unassignRemark(userId, remarkId) {
    try {
      this._run(`DELETE FROM user_special_remarks WHERE user_id = ? AND remark_id = ?`, [userId, remarkId]);
      return { success: true, message: '특이사항 해제 성공' };
    } catch (e) {
      return { success: false, message: `해제 실패: ${e.message}` };
    }
  }

  // ==================== 통계 ====================

  getMonthlyStats(yearMonth) {
    return this._queryAll(`
      WITH daily_user_menu AS (
        SELECT user_id, DATE(created_at) as event_date,
          CASE
            WHEN SUM(CASE WHEN event_type = 'cancel' THEN 1 ELSE 0 END) >= SUM(CASE WHEN event_type = 'check_in' THEN 1 ELSE 0 END) THEN NULL
            ELSE COALESCE(MAX(CASE WHEN event_type = 'menu_change' THEN menu_type END), MAX(CASE WHEN event_type = 'check_in' THEN menu_type END))
          END as final_menu
        FROM events WHERE strftime('%Y-%m', created_at) = ? GROUP BY user_id, DATE(created_at)
      ),
      user_monthly_stats AS (
        SELECT user_id, COUNT(*) as total_count,
          SUM(CASE WHEN final_menu = '일반식' THEN 1 ELSE 0 END) as normal_count,
          SUM(CASE WHEN final_menu = '죽식' THEN 1 ELSE 0 END) as porridge_count
        FROM daily_user_menu WHERE final_menu IS NOT NULL GROUP BY user_id
      )
      SELECT ums.user_id, u.number, u.name, ums.total_count, ums.normal_count, ums.porridge_count
      FROM user_monthly_stats ums JOIN users u ON ums.user_id = u.id
      WHERE u.deleted_at IS NULL ORDER BY ums.total_count DESC, CAST(u.number AS INTEGER), u.number
    `, [yearMonth]);
  }

  getMonthlyDetailStats(yearMonth) {
    return this._queryAll(`
      WITH daily_user_menu AS (
        SELECT user_id, DATE(created_at) as event_date,
          CASE
            WHEN SUM(CASE WHEN event_type = 'cancel' THEN 1 ELSE 0 END) >= SUM(CASE WHEN event_type = 'check_in' THEN 1 ELSE 0 END) THEN NULL
            ELSE COALESCE(
              MAX(CASE WHEN event_type = 'menu_change' THEN menu_type END),
              MAX(CASE WHEN event_type = 'check_in' THEN menu_type END)
            )
          END as final_menu,
          (SELECT input_method FROM events e2
           WHERE e2.user_id = e.user_id AND DATE(e2.created_at) = DATE(e.created_at)
           AND e2.event_type = 'check_in' AND e2.input_method != 'ticket'
           ORDER BY e2.created_at ASC LIMIT 1) as input_method
        FROM events e
        WHERE strftime('%Y-%m', created_at) = ?
          AND input_method != 'ticket'
        GROUP BY user_id, DATE(created_at)
      )
      SELECT d.user_id, u.number, u.name, d.event_date, d.final_menu, d.input_method
      FROM daily_user_menu d
      JOIN users u ON d.user_id = u.id
      WHERE u.deleted_at IS NULL AND d.final_menu IS NOT NULL
      ORDER BY CAST(u.number AS INTEGER), u.number, d.event_date
    `, [yearMonth]);
  }

  getPeriodDetailStats(startDate, endDate) {
    return this._queryAll(`
      WITH daily_user_menu AS (
        SELECT user_id, DATE(created_at) as event_date,
          CASE
            WHEN SUM(CASE WHEN event_type = 'cancel' THEN 1 ELSE 0 END) >= SUM(CASE WHEN event_type = 'check_in' THEN 1 ELSE 0 END) THEN NULL
            ELSE COALESCE(
              MAX(CASE WHEN event_type = 'menu_change' THEN menu_type END),
              MAX(CASE WHEN event_type = 'check_in' THEN menu_type END)
            )
          END as final_menu,
          (SELECT input_method FROM events e2
           WHERE e2.user_id = e.user_id AND DATE(e2.created_at) = DATE(e.created_at)
           AND e2.event_type = 'check_in' AND e2.input_method != 'ticket'
           ORDER BY e2.created_at ASC LIMIT 1) as input_method
        FROM events e
        WHERE DATE(created_at) BETWEEN ? AND ?
          AND input_method != 'ticket'
        GROUP BY user_id, DATE(created_at)
      )
      SELECT d.user_id, u.number, u.name, d.event_date, d.final_menu, d.input_method
      FROM daily_user_menu d
      JOIN users u ON d.user_id = u.id
      WHERE u.deleted_at IS NULL AND d.final_menu IS NOT NULL
      ORDER BY CAST(u.number AS INTEGER), u.number, d.event_date
    `, [startDate, endDate]);
  }

  getPeriodStats(startDate, endDate) {
    return this._queryAll(`
      WITH daily_user_menu AS (
        SELECT user_id, DATE(created_at) as event_date,
          CASE
            WHEN SUM(CASE WHEN event_type = 'cancel' THEN 1 ELSE 0 END) >= SUM(CASE WHEN event_type = 'check_in' THEN 1 ELSE 0 END) THEN NULL
            ELSE COALESCE(MAX(CASE WHEN event_type = 'menu_change' THEN menu_type END), MAX(CASE WHEN event_type = 'check_in' THEN menu_type END))
          END as final_menu
        FROM events WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY user_id, DATE(created_at)
      ),
      user_period_stats AS (
        SELECT user_id, COUNT(*) as total_count,
          SUM(CASE WHEN final_menu = '일반식' THEN 1 ELSE 0 END) as normal_count,
          SUM(CASE WHEN final_menu = '죽식' THEN 1 ELSE 0 END) as porridge_count
        FROM daily_user_menu WHERE final_menu IS NOT NULL GROUP BY user_id
      )
      SELECT ups.user_id, u.number, u.name, ups.total_count, ups.normal_count, ups.porridge_count
      FROM user_period_stats ups JOIN users u ON ups.user_id = u.id
      WHERE u.deleted_at IS NULL ORDER BY ups.total_count DESC, CAST(u.number AS INTEGER), u.number
    `, [startDate, endDate]);
  }

  getDailyRangeStats(startDate, endDate) {
    return this._queryAll(`
      WITH daily_user_menu AS (
        SELECT user_id, DATE(created_at) as event_date,
          CASE
            WHEN SUM(CASE WHEN event_type = 'cancel' THEN 1 ELSE 0 END) >= SUM(CASE WHEN event_type = 'check_in' THEN 1 ELSE 0 END) THEN NULL
            ELSE COALESCE(MAX(CASE WHEN event_type = 'menu_change' THEN menu_type END), MAX(CASE WHEN event_type = 'check_in' THEN menu_type END))
          END as final_menu
        FROM events WHERE DATE(created_at) BETWEEN ? AND ? GROUP BY user_id, DATE(created_at)
      )
      SELECT event_date as date,
        COUNT(*) as total,
        SUM(CASE WHEN final_menu = '일반식' THEN 1 ELSE 0 END) as normal,
        SUM(CASE WHEN final_menu = '죽식' THEN 1 ELSE 0 END) as porridge
      FROM daily_user_menu WHERE final_menu IS NOT NULL
      GROUP BY event_date ORDER BY event_date
    `, [startDate, endDate]);
  }

  getOperatingDays(startDate, endDate) {
    return this._queryAll(`
      SELECT DISTINCT DATE(created_at) as op_date
      FROM events
      WHERE event_type = 'check_in'
        AND DATE(created_at) BETWEEN ? AND ?
      ORDER BY op_date
    `, [startDate, endDate]);
  }

  getAllUsersWeekdayUsage(startDate, endDate) {
    return this._queryAll(`
      SELECT u.id, u.number, u.name, COUNT(DISTINCT DATE(e.created_at)) as used_days
      FROM users u
      LEFT JOIN events e ON u.id = e.user_id AND e.event_type = 'check_in'
        AND DATE(e.created_at) BETWEEN ? AND ?
        AND CAST(strftime('%w', e.created_at) AS INTEGER) BETWEEN 1 AND 5
      WHERE u.status = 'active' AND u.deleted_at IS NULL AND u.number != 'TICKET'
      GROUP BY u.id, u.number, u.name
    `, [startDate, endDate]);
  }
}

module.exports = { DatabaseManager };
