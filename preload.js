/**
 * 프리로드 스크립트 — Renderer ↔ Main 프로세스 IPC 브릿지
 */
const { contextBridge, ipcRenderer } = require('electron');

// DB 업데이트 결과를 자동 로깅하는 래퍼: success:false 시 콘솔에 에러 출력
function dbInvoke(channel, ...args) {
  return ipcRenderer.invoke(channel, ...args).then(result => {
    if (result && result.success === false) {
      console.error(`[DB 실패] ${channel}`, result.message || result, '\n인자:', JSON.stringify(args));
    }
    return result;
  }).catch(err => {
    console.error(`[DB 오류] ${channel}`, err.message || err, '\n인자:', JSON.stringify(args));
    throw err;
  });
}

contextBridge.exposeInMainWorld('api', {
  // --- 앱 ---
  log: (level, ...args) => ipcRenderer.send('console-log', level, ...args),
  onLogEntry: (cb) => ipcRenderer.on('log:entry', (_, entry) => cb(entry)),
  isFirstRun: () => ipcRenderer.invoke('app:isFirstRun'),
  getBasePath: () => ipcRenderer.invoke('app:getBasePath'),
  saveBasePath: (p) => ipcRenderer.invoke('app:saveBasePath', p),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // --- 사용자 ---
  getUsers: (opts) => ipcRenderer.invoke('db:getUsers', opts),
  searchUsers: (q, f) => ipcRenderer.invoke('db:searchUsers', q, f),
  searchUsersPaginated: (q, f, p, s) => ipcRenderer.invoke('db:searchUsersPaginated', q, f, p, s),
  getUserById: (id) => ipcRenderer.invoke('db:getUserById', id),
  getUserByNumber: (n) => ipcRenderer.invoke('db:getUserByNumber', n),
  getUserByCardNumber: (c) => ipcRenderer.invoke('db:getUserByCardNumber', c),
  addUser: (num, name, notes, cardNumber) => dbInvoke('db:addUser', num, name, notes, cardNumber),
  updateUser: (id, name, notes) => dbInvoke('db:updateUser', id, name, notes),
  suspendUser: (id) => dbInvoke('db:suspendUser', id),
  terminateUser: (id) => dbInvoke('db:terminateUser', id),
  reactivateUser: (id) => dbInvoke('db:reactivateUser', id),

  // --- 카드 ---
  addCard: (uid, cn) => dbInvoke('db:addCard', uid, cn),
  deactivateCard: (cid, reason) => dbInvoke('db:deactivateCard', cid, reason),
  getActiveCard: (uid) => ipcRenderer.invoke('db:getActiveCard', uid),
  getCardHistory: (uid) => ipcRenderer.invoke('db:getCardHistory', uid),
  getCardOwnerInfo: (cn) => ipcRenderer.invoke('db:getCardOwnerInfo', cn),
  reissueCard: (uid, cn, reason) => dbInvoke('db:reissueCard', uid, cn, reason),
  transferCard: (cn, targetUid, reason) => dbInvoke('db:transferCard', cn, targetUid, reason),
  deleteCardsForUser: (uid) => dbInvoke('db:deleteCardsForUser', uid),

  // --- 체크인/이벤트 ---
  checkIn: (uid, menu, method, notes) => dbInvoke('db:checkIn', uid, menu, method, notes),
  cancelCheckIn: (uid) => dbInvoke('db:cancelCheckIn', uid),
  cancelEventById: (eid) => dbInvoke('db:cancelEventById', eid),
  updateEventMenu: (eid, m) => dbInvoke('db:updateEventMenu', eid, m),
  getDailyStats: () => ipcRenderer.invoke('db:getDailyStats'),
  getTodayEvents: () => ipcRenderer.invoke('db:getTodayEvents'),
  getUserTodayCount: (uid) => ipcRenderer.invoke('db:getUserTodayCount', uid),
  getTicketUser: () => ipcRenderer.invoke('db:getTicketUser'),
  addTicket: () => dbInvoke('db:addTicket'),
  cancelLastTicket: () => dbInvoke('db:cancelLastTicket'),

  // --- 특이사항 ---
  getAllSpecialRemarks: () => ipcRenderer.invoke('db:getAllSpecialRemarks'),
  addSpecialRemark: (...a) => dbInvoke('db:addSpecialRemark', ...a),
  updateSpecialRemark: (id, name, desc, isActive, startDate, endDate) => dbInvoke('db:updateSpecialRemark', id, name, desc, isActive, startDate, endDate),
  deleteSpecialRemark: (id) => dbInvoke('db:deleteSpecialRemark', id),
  getUsersForRemark: (id) => ipcRenderer.invoke('db:getUsersForRemark', id),
  assignRemark: (uid, rid) => dbInvoke('db:assignRemark', uid, rid),
  unassignRemark: (uid, rid) => dbInvoke('db:unassignRemark', uid, rid),

  // --- 통계 ---
  getUserStatistics: () => ipcRenderer.invoke('db:getUserStatistics'),
  getMonthlyStats: (ym) => ipcRenderer.invoke('db:getMonthlyStats', ym),
  getMonthlyDetailStats: (ym) => ipcRenderer.invoke('db:getMonthlyDetailStats', ym),
  getPeriodStats: (s, e) => ipcRenderer.invoke('db:getPeriodStats', s, e),
  getDailyRangeStats: (s, e) => ipcRenderer.invoke('db:getDailyRangeStats', s, e),
  getAllUsersWeekdayUsage: (s, e) => ipcRenderer.invoke('db:getAllUsersWeekdayUsage', s, e),
  getDeletedUsers: (s) => ipcRenderer.invoke('db:getDeletedUsers', s),
  purgeUser: (userId) => ipcRenderer.invoke('db:purgeUser', userId),

  // --- 설정 ---
  getSetting: (k, d) => ipcRenderer.invoke('settings:get', k, d),
  setSetting: (k, v) => ipcRenderer.invoke('settings:set', k, v),
  getAllSettings: () => ipcRenderer.invoke('settings:getAll'),

  // --- 메일 ---
  sendMail: (opts) => ipcRenderer.invoke('mail:send', opts),
  testMail: () => ipcRenderer.invoke('mail:test'),

  // --- 다이얼로그 ---
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  showError: (t, m) => ipcRenderer.invoke('dialog:showError', t, m),
  showMessage: (o) => ipcRenderer.invoke('dialog:showMessage', o),

  // --- 초기 설정 ---
  createDatabase: (bp) => ipcRenderer.invoke('setup:createDatabase', bp),

  // --- 카드 리더기 ---
  cardReader: {
    listPorts: () => ipcRenderer.invoke('card-reader:listPorts'),
    connect: (port, baud) => ipcRenderer.invoke('card-reader:connect', port, baud),
    disconnect: () => ipcRenderer.invoke('card-reader:disconnect'),
    isConnected: () => ipcRenderer.invoke('card-reader:isConnected'),
    onData: (cb) => ipcRenderer.on('card-reader:data', (_, card) => cb(card)),
    onStatus: (cb) => ipcRenderer.on('card-reader:status', (_, status) => cb(status)),
    offData: () => ipcRenderer.removeAllListeners('card-reader:data'),
    offStatus: () => ipcRenderer.removeAllListeners('card-reader:status'),
  },
});
