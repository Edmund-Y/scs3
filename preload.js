/**
 * 프리로드 스크립트 — Renderer ↔ Main 프로세스 IPC 브릿지
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // --- 앱 ---
  log: (level, ...args) => ipcRenderer.send('console-log', level, ...args),
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
  addUser: (num, name, notes, cardNumber) => ipcRenderer.invoke('db:addUser', num, name, notes, cardNumber),
  updateUser: (id, name, notes) => ipcRenderer.invoke('db:updateUser', id, name, notes),
  suspendUser: (id) => ipcRenderer.invoke('db:suspendUser', id),
  terminateUser: (id) => ipcRenderer.invoke('db:terminateUser', id),
  reactivateUser: (id) => ipcRenderer.invoke('db:reactivateUser', id),

  // --- 카드 ---
  addCard: (uid, cn) => ipcRenderer.invoke('db:addCard', uid, cn),
  deactivateCard: (cid, reason) => ipcRenderer.invoke('db:deactivateCard', cid, reason),
  getActiveCard: (uid) => ipcRenderer.invoke('db:getActiveCard', uid),
  getCardHistory: (uid) => ipcRenderer.invoke('db:getCardHistory', uid),
  getCardOwnerInfo: (cn) => ipcRenderer.invoke('db:getCardOwnerInfo', cn),
  reissueCard: (uid, cn, reason) => ipcRenderer.invoke('db:reissueCard', uid, cn, reason),
  transferCard: (cn, targetUid, reason) => ipcRenderer.invoke('db:transferCard', cn, targetUid, reason),
  deleteCardsForUser: (uid) => ipcRenderer.invoke('db:deleteCardsForUser', uid),

  // --- 체크인/이벤트 ---
  checkIn: (uid, menu, method, notes) => ipcRenderer.invoke('db:checkIn', uid, menu, method, notes),
  cancelCheckIn: (uid) => ipcRenderer.invoke('db:cancelCheckIn', uid),
  cancelEventById: (eid) => ipcRenderer.invoke('db:cancelEventById', eid),
  updateEventMenu: (eid, m) => ipcRenderer.invoke('db:updateEventMenu', eid, m),
  getDailyStats: () => ipcRenderer.invoke('db:getDailyStats'),
  getTodayEvents: () => ipcRenderer.invoke('db:getTodayEvents'),
  getUserTodayCount: (uid) => ipcRenderer.invoke('db:getUserTodayCount', uid),
  getTicketUser: () => ipcRenderer.invoke('db:getTicketUser'),
  addTicket: () => ipcRenderer.invoke('db:addTicket'),
  cancelLastTicket: () => ipcRenderer.invoke('db:cancelLastTicket'),

  // --- 특이사항 ---
  getAllSpecialRemarks: () => ipcRenderer.invoke('db:getAllSpecialRemarks'),
  addSpecialRemark: (...a) => ipcRenderer.invoke('db:addSpecialRemark', ...a),
  updateSpecialRemark: (id, name, desc, isActive) => ipcRenderer.invoke('db:updateSpecialRemark', id, name, desc, isActive),
  deleteSpecialRemark: (id) => ipcRenderer.invoke('db:deleteSpecialRemark', id),
  getUsersForRemark: (id) => ipcRenderer.invoke('db:getUsersForRemark', id),
  assignRemark: (uid, rid) => ipcRenderer.invoke('db:assignRemark', uid, rid),
  unassignRemark: (uid, rid) => ipcRenderer.invoke('db:unassignRemark', uid, rid),

  // --- 통계 ---
  getUserStatistics: () => ipcRenderer.invoke('db:getUserStatistics'),
  getMonthlyStats: (ym) => ipcRenderer.invoke('db:getMonthlyStats', ym),
  getPeriodStats: (s, e) => ipcRenderer.invoke('db:getPeriodStats', s, e),
  getDailyRangeStats: (s, e) => ipcRenderer.invoke('db:getDailyRangeStats', s, e),
  getAllUsersWeekdayUsage: (s, e) => ipcRenderer.invoke('db:getAllUsersWeekdayUsage', s, e),
  getDeletedUsers: (s) => ipcRenderer.invoke('db:getDeletedUsers', s),

  // --- 설정 ---
  getSetting: (k, d) => ipcRenderer.invoke('settings:get', k, d),
  setSetting: (k, v) => ipcRenderer.invoke('settings:set', k, v),
  getAllSettings: () => ipcRenderer.invoke('settings:getAll'),

  // --- 다이얼로그 ---
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  showError: (t, m) => ipcRenderer.invoke('dialog:showError', t, m),
  showMessage: (o) => ipcRenderer.invoke('dialog:showMessage', o),

  // --- 초기 설정 ---
  createDatabase: (bp) => ipcRenderer.invoke('setup:createDatabase', bp),
});
