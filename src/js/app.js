/**
 * 메인 앱 — SPA 라우터 + 사이드바 네비게이션
 * pages/main_window.py 이식
 */

// 페이지 모듈 (lazy import)
const pages = {};

class App {
  constructor() {
    this.currentPage = null;
    this.currentPageName = '';
    this.sidebarCollapsed = false;

    this._initSidebar();
    this._initClock();
    this._checkFirstRun();
  }

  async _checkFirstRun() {
    const isFirst = await window.api.isFirstRun();
    if (isFirst) {
      this.navigate('setup-wizard');
    } else {
      this.navigate('home');
    }
  }

  /* ---- Sidebar ---- */
  _initSidebar() {
    // Toggle
    document.getElementById('sidebarToggle').addEventListener('click', () => {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      document.getElementById('app').classList.toggle('sidebar-collapsed', this.sidebarCollapsed);
    });

    // Nav items
    document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.navigate(btn.dataset.page);
      });
    });
  }

  /* ---- Clock ---- */
  _initClock() {
    const update = () => {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const d = now.getDate();
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const dayName = days[now.getDay()];
      const h = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const sec = String(now.getSeconds()).padStart(2, '0');
      document.getElementById('clock').textContent = `${y}년 ${m}월 ${d}일 (${dayName}) ${h}:${min}:${sec}`;
    };
    update();
    setInterval(update, 1000);
  }

  /* ---- Navigation ---- */
  async navigate(pageName) {
    if (pageName === this.currentPageName) return;

    // Cleanup previous page
    if (this.currentPage && this.currentPage.cleanup) {
      this.currentPage.cleanup();
    }

    this.currentPageName = pageName;

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === pageName);
    });

    // Page titles
    const titles = {
      'home': '홈',
      'count': '실시간 현황',
      'edit': '사용자 관리',
      'special-remarks': '특이사항',
      'dashboard': '통계',
      'settings': '설정',
      'setup-wizard': '초기 설정'
    };
    document.getElementById('pageTitle').textContent = titles[pageName] || pageName;

    // Load page
    const content = document.getElementById('content');
    content.innerHTML = '<div class="page-loading"><div class="spinner"></div>로딩 중...</div>';

    try {
      const page = await this._loadPage(pageName);
      this.currentPage = page;
      content.innerHTML = '';
      content.appendChild(page.render());
      if (page.afterRender) page.afterRender();
    } catch (err) {
      content.innerHTML = `<div class="page-loading">페이지 로드 실패: ${err.message}</div>`;
      console.error('Page load error:', err);
    }

    this._updateStatus(`${titles[pageName] || pageName} 페이지`);
  }

  async _loadPage(pageName) {
    switch (pageName) {
      case 'home': return new HomePage();
      case 'count': return new CountPage();
      case 'edit': return new EditPage();
      case 'special-remarks': return new SpecialRemarksPage();
      case 'dashboard': return new DashboardPage();
      case 'settings': return new SettingsPage();
      case 'setup-wizard': return new SetupWizardPage(this);
      default: return new PlaceholderPage(pageName);
    }
  }

  _updateStatus(text) {
    document.getElementById('footerStatus').textContent = text;
  }

  showToast(message, type = 'success', duration = 3000) {
    try {
      console.log(`[showToast] message=${message}, type=${type}`);
      let container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.textContent = message;

      container.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    } catch (e) { console.error('showToast 에러:', e); }
  }

  /**
   * showConfirm - 커스텀 확인 다이얼로그
   * @param {string|object} msgOrOpts - 문자열이면 기본 확인 다이얼로그, 객체면 상세 옵션
   *   { title, message, detail, type: 'warning'|'danger'|'info', confirmText, cancelText }
   * @returns {Promise<boolean>}
   */
  showConfirm(msgOrOpts) {
    const opts = typeof msgOrOpts === 'string'
      ? { message: msgOrOpts }
      : msgOrOpts;
    const {
      title = '',
      message = '',
      detail = '',
      type = 'info',
      confirmText = '확인',
      cancelText = '취소',
    } = opts;

    return new Promise((resolve) => {
      try {
        const typeConfig = {
          info:    { icon: 'ℹ️', accent: 'var(--accent-cyan)', btnClass: 'btn-primary' },
          warning: { icon: '⚠️', accent: 'var(--warning)',     btnClass: 'btn-warning' },
          danger:  { icon: '🗑️', accent: 'var(--error)',       btnClass: 'btn-danger' },
        };
        const cfg = typeConfig[type] || typeConfig.info;

        const overlay = document.createElement('div');
        overlay.className = 'custom-dialog-overlay';
        overlay.innerHTML = `
          <div class="custom-dialog" style="border-top: 3px solid ${cfg.accent};">
            ${title ? `<div class="custom-dialog-header">
              <span class="custom-dialog-icon">${cfg.icon}</span>
              <h4 class="custom-dialog-title">${title}</h4>
            </div>` : ''}
            <div class="custom-dialog-body">
              <p class="custom-dialog-message">${message.replace(/\n/g, '<br>')}</p>
              ${detail ? `<p class="custom-dialog-detail">${detail.replace(/\n/g, '<br>')}</p>` : ''}
            </div>
            <div class="custom-dialog-actions">
              <button class="btn btn-ghost" id="dlgCancel">${cancelText}</button>
              <button class="btn ${cfg.btnClass}" id="dlgConfirm">${confirmText}</button>
            </div>
          </div>
        `;

        const cleanup = () => {
          overlay.remove();
          document.activeElement?.blur();
        };

        overlay.querySelector('#dlgCancel').onclick = () => { cleanup(); resolve(false); };
        overlay.querySelector('#dlgConfirm').onclick = () => { cleanup(); resolve(true); };

        document.body.appendChild(overlay);
      } catch (e) {
        console.error('showConfirm 에러:', e);
        resolve(false);
      }
    });
  }

  /**
   * showAlert - 커스텀 알림 다이얼로그 (확인 버튼만)
   * @param {string} title
   * @param {string} message
   * @param {'error'|'info'|'warning'} type
   * @returns {Promise<void>}
   */
  showAlert(title, message, type = 'error') {
    return new Promise((resolve) => {
      try {
        const typeConfig = {
          error:   { icon: '❌', accent: 'var(--error)' },
          warning: { icon: '⚠️', accent: 'var(--warning)' },
          info:    { icon: 'ℹ️', accent: 'var(--accent-cyan)' },
        };
        const cfg = typeConfig[type] || typeConfig.error;

        const overlay = document.createElement('div');
        overlay.className = 'custom-dialog-overlay';
        overlay.innerHTML = `
          <div class="custom-dialog" style="border-top: 3px solid ${cfg.accent};">
            <div class="custom-dialog-header">
              <span class="custom-dialog-icon">${cfg.icon}</span>
              <h4 class="custom-dialog-title">${title}</h4>
            </div>
            <div class="custom-dialog-body">
              <p class="custom-dialog-message">${message.replace(/\n/g, '<br>')}</p>
            </div>
            <div class="custom-dialog-actions">
              <button class="btn btn-primary" id="dlgOk">확인</button>
            </div>
          </div>
        `;

        const cleanup = () => {
          overlay.remove();
          document.activeElement?.blur();
        };

        overlay.querySelector('#dlgOk').onclick = () => { cleanup(); resolve(); };

        document.body.appendChild(overlay);
      } catch (e) {
        console.error('showAlert 에러:', e);
        resolve();
      }
    });
  }
}

/* ================================================================
   Pages
   ================================================================ */

/* ---- Home Page ---- */
class HomePage {
  render() {
    const el = document.createElement('div');
    el.className = 'fade-in';

    const hour = new Date().getHours();
    let greeting = '안녕하세요';
    if (hour >= 5 && hour < 12) greeting = '좋은 아침입니다';
    else if (hour >= 12 && hour < 18) greeting = '좋은 오후입니다';
    else if (hour >= 18 && hour < 22) greeting = '좋은 저녁입니다';

    const now = new Date();
    const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const dateStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 (${days[now.getDay()]})`;

    el.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h1 style="font-size: 32px; font-weight: 800;">${greeting}</h1>
        <p style="color: var(--text-muted); font-size: 16px; margin-top: 6px;">${dateStr}</p>
      </div>

      <div class="grid-3" id="homeStats">
        <div class="stat-card blue">
          <div class="card-icon">👥</div>
          <div class="card-value" id="homeTotal">–</div>
          <div class="card-label">총 이용자</div>
        </div>
        <div class="stat-card green">
          <div class="card-icon">🍚</div>
          <div class="card-value" id="homeNormal">–</div>
          <div class="card-label">일반식</div>
        </div>
        <div class="stat-card red">
          <div class="card-icon">🥣</div>
          <div class="card-value" id="homePorridge">–</div>
          <div class="card-label">죽식</div>
        </div>
      </div>

      <h2 class="section-title" style="margin-top: 32px;">빠른 접근</h2>
      <div class="grid-3">
        <div class="quick-btn" data-nav="count">
          <span class="icon">📊</span>
          <span class="title">실시간 현황</span>
          <span class="desc">오늘의 식사 수령 현황을 확인합니다</span>
        </div>
        <div class="quick-btn" data-nav="edit">
          <span class="icon">👥</span>
          <span class="title">사용자 관리</span>
          <span class="desc">사용자 등록, 수정, 삭제를 관리합니다</span>
        </div>
        <div class="quick-btn" data-nav="dashboard">
          <span class="icon">📈</span>
          <span class="title">통계</span>
          <span class="desc">이용 통계 및 분석 데이터를 확인합니다</span>
        </div>
      </div>
    `;
    return el;
  }

  async afterRender() {
    // Quick nav buttons
    document.querySelectorAll('.quick-btn[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => app.navigate(btn.dataset.nav));
    });

    // Load stats
    try {
      const stats = await window.api.getDailyStats();
      const total = (stats.normal || 0) + (stats.porridge || 0) + (stats.ticket || 0);
      document.getElementById('homeTotal').textContent = total;
      document.getElementById('homeNormal').textContent = stats.normal || 0;
      document.getElementById('homePorridge').textContent = stats.porridge || 0;
    } catch (e) {
      console.error('Stats load error:', e);
    }
  }

  cleanup() { }
}

/* ---- Count Page ---- */
class CountPage {
  constructor() {
    this._clockInterval = null;
    this._refreshInterval = null;
    this._lastScanDetails = new Map();
  }

  render() {
    const el = document.createElement('div');
    el.className = 'fade-in';
    el.style.cssText = 'display: flex; flex-direction: column; height: 100%; overflow: hidden;';
    el.innerHTML = `
      <div class="count-stats-row">
        <div class="stat-card cyan count-stat-clock">
          <div class="card-icon">🕐</div>
          <div class="card-value" id="countClock">--:--:--</div>
          <div class="card-label">현재 시각</div>
        </div>
        <div class="stat-card blue count-stat-total">
          <div class="card-icon">👥</div>
          <div class="card-value" id="countTotal">0</div>
          <div class="card-label">총 이용</div>
        </div>
        <div class="stat-card green count-stat-meal">
          <div class="meal-counts">
            <div class="meal-item">
              <span class="meal-value" id="countNormal">0</span>
              <span class="meal-label">일반식</span>
            </div>
            <span class="meal-divider">|</span>
            <div class="meal-item">
              <span class="meal-value porridge" id="countPorridge">0</span>
              <span class="meal-label">죽식</span>
            </div>
          </div>
          <div class="porridge-toggle-row">
            <span>일괄 죽식</span>
            <label class="switch" style="transform: scale(0.85);">
              <input type="checkbox" id="toggleAllPorridge">
              <span class="slider round"></span>
            </label>
          </div>
        </div>
        <div class="stat-card purple count-stat-ticket">
          <div class="ticket-header">🎫 식권</div>
          <div class="ticket-controls">
            <button id="ticketMinus" class="ticket-btn">−</button>
            <div class="card-value" id="countTicket">0</div>
            <button id="ticketPlus" class="ticket-btn ticket-btn-plus">+</button>
          </div>
        </div>
      </div>

      <div class="count-main-area">
        <div class="count-panel">
          <div class="count-panel-header">
            <h3>오늘의 이용 현황</h3>
            <span class="count-panel-badge" id="countListBadge">0</span>
          </div>
          <div id="usageList"></div>
        </div>
        <div class="count-panel">
          <div class="count-panel-header">
            <h3>사용자 체크인</h3>
          </div>
          <div class="count-search-body">
            <div class="count-search-input-wrap">
              <span class="search-icon">🔍</span>
              <input class="input" id="countSearch" placeholder="번호 또는 이름..." />
            </div>
            <div id="countSearchResults"></div>
          </div>
        </div>
      </div>
    `;
    return el;
  }

  async afterRender() {
    // 런타임 설정 적용
    try {
      const allSettings = await window.api.getAllSettings();
      // 글꼴 크기 (CSS 변수 적용)
      const fsMap = {
        ui_fs_title: '--fs-title', ui_fs_subtitle: '--fs-subtitle',
        ui_fs_body: '--fs-body', ui_fs_label: '--fs-label', ui_fs_small: '--fs-small',
        ui_fs_sidebar_brand: '--fs-sidebar-brand', ui_fs_sidebar_nav: '--fs-sidebar-nav',
        ui_fs_clock: '--fs-clock', ui_fs_footer: '--fs-footer',
        ui_fs_stat: '--fs-stat',
        ui_fs_count_clock: '--fs-count-clock', ui_fs_count_total: '--fs-count-total',
        ui_fs_count_meal: '--fs-count-meal', ui_fs_count_meal_label: '--fs-count-meal-label',
        ui_fs_card_time: '--fs-card-time', ui_fs_card_name: '--fs-card-name',
        ui_fs_card_remarks: '--fs-card-remarks',
        ui_fs_table_header: '--fs-table-header', ui_fs_table_body: '--fs-table-body',
        ui_fs_toast: '--fs-toast',
      };
      for (const [key, cssVar] of Object.entries(fsMap)) {
        const val = allSettings[key];
        if (val) document.documentElement.style.setProperty(cssVar, val + 'px');
      }
      // 식권 버튼 표시/숨김
      if (allSettings.ui_show_ticket_button === '0') {
        const ticketCard = document.querySelector('.stat-card.purple');
        if (ticketCard) ticketCard.style.display = 'none';
      }
    } catch (e) { /* fallback */ }

    // 식권 +/- 버튼
    document.getElementById('ticketPlus')?.addEventListener('click', async () => {
      try {
        const result = await window.api.addTicket();
        if (result.success) {
          if (result.event) {
            this._appendSingleEventToUI(result.event, false);
            await this._updateStatsUIOnly();
          } else {
            await this._refreshData();
          }
        }
      } catch (e) { app.showToast('식권 추가 오류: ' + e.message, 'error'); }
    });
    document.getElementById('ticketMinus')?.addEventListener('click', async () => {
      try {
        const result = await window.api.cancelLastTicket();
        if (result.success) {
          app.showToast('식권 1건 취소되었습니다', 'warning');
          await this._refreshData();
        } else {
          app.showToast(result.message || '취소할 식권이 없습니다', 'error');
        }
      } catch (e) { app.showToast('식권 취소 오류: ' + e.message, 'error'); }
    });

    // Event Delegation for Action Buttons (Attach immediately to avoid async race conditions)
    const usageListContainer = document.getElementById('usageList');
    if (usageListContainer) {
      usageListContainer.addEventListener('click', async (e) => {
        try {
          const btn = e.target.closest('button');
          if (!btn) return;

          const action = btn.dataset.action;
          const eventId = btn.dataset.eventId;
          const nextMenu = btn.dataset.menu;

          if (action === 'cancel') {
            const isTicket = !!btn.closest('.usage-card.ticket');
            await this._cancelEvent(eventId, isTicket);
          } else if (action === 'change-menu') {
            await this._changeMenu(eventId, nextMenu);
          }
        } catch (error) {
          await app.showAlert('버튼 클릭 오류', error.message);
        }
      });
    }

    // Clock
    const updateClock = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      const clockEl = document.getElementById('countClock');
      if (clockEl) clockEl.textContent = `${h}:${m}:${s}`;
    };
    updateClock();
    this._clockInterval = setInterval(updateClock, 1000);

    // Load stats + events
    await this._refreshData();

    // 초기 사용자 목록 로드 (검색 패널에 전체 활성 사용자 표시)
    await this._loadAllUsers();

    // Search
    const searchInput = document.getElementById('countSearch');
    let searchTimeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => this._doSearch(searchInput.value), 300);
    });

    // 시리얼 카드 리더기 IPC 수신
    cardLog.status('대기 중 (체크인 화면)');
    this._handleCardData = async (cardNumber) => {
      cardLog.scan(cardNumber, '체크인');
      await this._processCheckIn(cardNumber);
    };
    this._handleCardStatus = (status) => {
      if (status.connected) {
        cardLog.connected(status.port);
        window.app.showToast(`카드 리더기 연결됨 (${status.port})`, 'success', 2000);
      } else {
        const reason = status.error || '알 수 없는 오류';
        cardLog.disconnected(reason);
      }
    };
    window.api.cardReader.onData(this._handleCardData);
    window.api.cardReader.onStatus(this._handleCardStatus);

    // 검색창 Enter 키 지원 (수동 번호 입력)
    this._handleGlobalKeydown = async (e) => {
      if (e.key === 'Enter' && document.activeElement === searchInput) {
        const val = searchInput.value.trim();
        if (val) {
          e.preventDefault();
          searchInput.value = '';
          await this._processCheckIn(val);
        }
      }
    };
    document.addEventListener('keydown', this._handleGlobalKeydown);
  }

  async _refreshData() {
    try {
      await this._updateStatsUIOnly();
      const events = await window.api.getTodayEvents();
      await this._renderEvents(events);
    } catch (e) {
      console.error('Refresh error:', e);
    }
  }

  async _updateStatsUIOnly() {
    try {
      const stats = await window.api.getDailyStats();
      const total = (stats.normal || 0) + (stats.porridge || 0) + (stats.ticket || 0);
      const el = (id) => document.getElementById(id);
      if (el('countTotal')) el('countTotal').textContent = total;
      if (el('countNormal')) el('countNormal').textContent = stats.normal || 0;
      if (el('countPorridge')) el('countPorridge').textContent = stats.porridge || 0;
      if (el('countTicket')) el('countTicket').textContent = stats.ticket || 0;
      if (el('countListBadge')) el('countListBadge').textContent = total;
    } catch (e) {
      console.error('Stats UI update error:', e);
    }
  }

  _appendSingleEventToUI(event, isDuplicate) {
    const container = document.getElementById('usageList');
    if (!container) return;

    // Remove empty state message if it exists
    if (container.querySelector('p')) {
      container.innerHTML = '';
    }

    const time = event.created_at ? event.created_at.split(' ')[1]?.slice(0, 8) : '';
    const isTicket = event.input_method === 'ticket';

    // Add slide-in animation class for new items
    let cls = 'usage-card slide-in';
    if (isTicket) cls += ' ticket';

    const badge = event.menu_type === '죽식'
      ? '<span class="badge badge-porridge">🍚 죽식</span>'
      : event.menu_type === '일반식'
        ? '<span class="badge badge-normal">🍱 일반식</span>'
        : `<span class="badge">${event.menu_type || ''}</span>`;

    const nextMenu = event.menu_type === '죽식' ? '일반식' : '죽식';
    let actions = '';
    if (isTicket) {
      actions = `<button class="btn btn-ghost btn-sm" data-action="cancel" data-event-id="${event.id}">취소</button>`;
    } else {
      actions = `
        <button class="btn btn-ghost btn-sm" data-action="change-menu" data-event-id="${event.id}" data-menu="${nextMenu}">변경</button>
        <button class="btn btn-ghost btn-sm" data-action="cancel" data-event-id="${event.id}">취소</button>
      `;
    }

    const remarksRow = (!isTicket && event.special_remarks) ? `<div class="usage-card-remarks">⚠ ${event.special_remarks}</div>` : '';
    if (remarksRow) cls += ' has-remarks';

    const html = `
      <div class="${cls}">
        <span class="time">${time}</span>
        <span class="name">${isTicket ? '🎫 식권' : `${event.number || ''} ${event.name || ''}`}</span>
        <div class="badge-col">${badge}</div>
        <div class="actions">
          ${actions}
        </div>
        ${remarksRow}
      </div>
    `;

    container.insertAdjacentHTML('afterbegin', html);
  }

  async _renderEvents(events) {
    const container = document.getElementById('usageList');
    if (!container) return;

    if (!events || events.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 40px;">오늘의 이용 기록이 없습니다<br><span style="font-size: 12px;">우측 사용자 목록을 클릭하여 체크인하세요</span></p>';
      return;
    }

    const checkIns = events.filter(e => e.event_type === 'check_in');
    if (checkIns.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 40px;">오늘의 이용 기록이 없습니다<br><span style="font-size: 12px;">우측 사용자 목록을 클릭하여 체크인하세요</span></p>';
      return;
    }

    // 설정값 로드
    let listMax = 50;
    let showNumber = true;
    try {
      const allSettings = await window.api.getAllSettings();
      listMax = parseInt(allSettings.ui_usage_list_max || '50', 10) || 50;
      showNumber = allSettings.ui_show_user_number !== '0';
    } catch (e) { /* fallback */ }

    // 중복 검사 (예전 이벤트부터 카운트)
    const reversedEvents = [...checkIns].reverse();
    const duplicateMap = {};
    const countMap = {};

    reversedEvents.forEach(e => {
      if (e.input_method !== 'ticket') {
        const uid = e.user_id;
        countMap[uid] = (countMap[uid] || 0) + 1;
        if (countMap[uid] > 1) {
          duplicateMap[e.id] = true;
        }
      }
    });

    const displayEvents = reversedEvents.reverse();

    const html = displayEvents.slice(0, listMax).map(event => {
      const time = event.created_at ? event.created_at.split(' ')[1]?.slice(0, 8) : '';
      const isTicket = event.input_method === 'ticket';
      const isDuplicate = !!duplicateMap[event.id];

      let cls = 'usage-card';
      if (isTicket) cls += ' ticket';
      else if (isDuplicate) cls += ' duplicate';

      const badge = event.menu_type === '죽식'
        ? '<span class="badge badge-porridge">🍚 죽식</span>'
        : event.menu_type === '일반식'
          ? '<span class="badge badge-normal">🍱 일반식</span>'
          : `<span class="badge">${event.menu_type || ''}</span>`;

      const nextMenu = event.menu_type === '죽식' ? '일반식' : '죽식';
      let actions = '';
      if (isTicket) {
        actions = `<button class="btn btn-ghost btn-sm" data-action="cancel" data-event-id="${event.id}">취소</button>`;
      } else {
        actions = `
          <button class="btn btn-ghost btn-sm" data-action="change-menu" data-event-id="${event.id}" data-menu="${nextMenu}">변경</button>
          <button class="btn btn-ghost btn-sm" data-action="cancel" data-event-id="${event.id}">취소</button>
        `;
      }

      const nameDisplay = isTicket ? '🎫 식권' : (showNumber ? `${event.number || ''} ${event.name || ''}` : `${event.name || ''}`);
      const remarksRow = (!isTicket && event.special_remarks) ? `<div class="usage-card-remarks">⚠ ${event.special_remarks}</div>` : '';
      if (remarksRow) cls += ' has-remarks';

      return `
        <div class="${cls}">
          <span class="time">${time}</span>
          <span class="name">${nameDisplay}</span>
          <div class="badge-col">${badge}</div>
          <div class="actions">
            ${actions}
          </div>
          ${remarksRow}
        </div>
      `;
    }).join('');

    const savedScrollTop = container.scrollTop;
    container.innerHTML = html;

    setTimeout(() => {
      container.scrollTop = savedScrollTop;
    }, 0);
  }

  async _changeMenu(eventId, newMenu) {
    try {
      console.log(`[_changeMenu] Start for eventId=${eventId}, newMenu=${newMenu}`);
      const confirmed = await app.showConfirm(`메뉴를 '${newMenu}'(으)로 변경하시겠습니까?`);
      console.log(`[_changeMenu] Confirmed? ${confirmed}`);
      if (confirmed) {
        console.log(`[_changeMenu] Calling API...`);
        const result = await window.api.updateEventMenu(eventId, newMenu);
        console.log(`[_changeMenu] API Result:`, result);
        if (result && result.success === false) throw new Error(result.message);
        app.showToast('메뉴가 변경되었습니다.', 'info');
        await this._refreshData();
      }
    } catch (e) {
      console.error(`[_changeMenu] 에러:`, e);
      await app.showAlert('메뉴 변경 오류', e.message);
    }
  }

  async _cancelEvent(eventId, isTicket = false) {
    try {
      console.log(`[_cancelEvent] Start for eventId=${eventId}, isTicket=${isTicket}`);
      const confirmMsg = isTicket
        ? '식권 1건을 취소하시겠습니까?'
        : '해당 사용자의 오늘자 이용 기록이 모두 삭제됩니다. 계속하시겠습니까?';
      const confirmed = await app.showConfirm(confirmMsg);
      console.log(`[_cancelEvent] Confirmed? ${confirmed}`);
      if (confirmed) {
        console.log(`[_cancelEvent] Calling API...`);
        const result = await window.api.cancelEventById(eventId);
        console.log(`[_cancelEvent] API Result:`, result);
        if (result && result.success === false) throw new Error(result.message);
        const toastMsg = isTicket ? '식권 1건이 취소되었습니다.' : '오늘자 전체 이용 기록이 취소되었습니다.';
        app.showToast(toastMsg, 'warning');
        await this._refreshData();
      }
    } catch (e) {
      console.error(`[_cancelEvent] 에러:`, e);
      await app.showAlert('체크인 취소 오류', e.message);
    }
  }

  async _loadAllUsers() {
    const container = document.getElementById('countSearchResults');
    if (!container) return;
    try {
      const users = await window.api.searchUsers(null, 'active');
      this._renderUserList(container, users);
    } catch (e) {
      container.innerHTML = '<p style="color: var(--error); padding: 12px;">사용자 목록 로드 실패</p>';
    }
  }

  _renderUserList(container, users) {
    if (!users || users.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted); padding: 12px; text-align: center;">등록된 사용자가 없습니다</p>';
      return;
    }
    container.innerHTML = `
      <p style="color: var(--text-muted); font-size: 11px; padding: 6px 10px 4px; letter-spacing: 0.3px;">활성 사용자 ${users.length}명</p>
    ` + users.map(u => `
      <div class="search-result-item" data-number="${u.number}">
        <span class="number">${u.number}</span>
        <span class="name">${u.name}</span>
      </div>
    `).join('');

    container.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', async () => {
        const number = item.dataset.number;
        await this._processCheckIn(number);
      });
    });
  }

  async _doSearch(query) {
    const container = document.getElementById('countSearchResults');
    if (!container) return;
    if (!query || query.trim() === '') {
      // 검색어가 비면 전체 사용자 다시 표시
      await this._loadAllUsers();
      return;
    }
    try {
      const users = await window.api.searchUsers(query, 'active');
      if (users.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); padding: 12px;">검색 결과 없음</p>';
        return;
      }
      this._renderUserList(container, users);
    } catch (e) {
      container.innerHTML = '<p style="color: var(--error); padding: 12px;">검색 오류</p>';
    }
  }

  async _speak(text, { eventType = 'normal' } = {}) {
    if (!window.speechSynthesis) return;
    try {
      const allSettings = await window.api.getAllSettings();
      // 마스터 TTS on/off
      if (allSettings.tts_enabled === '0' || allSettings.tts_enabled === 'false') return;

      // eventType별 개별 on/off
      const gateMap = {
        normal: 'tts_read_normal',
        porridge: 'tts_read_porridge',
        duplicate: 'tts_read_duplicate',
        unregistered: 'tts_read_unregistered',
        recent_duplicate: 'tts_read_recent_duplicate',
        remarks: 'tts_read_remarks',
      };
      const gateKey = gateMap[eventType];
      if (gateKey && (allSettings[gateKey] === '0' || allSettings[gateKey] === 'false')) return;

      // 익명화 적용 (김바보→김*보, 김밥→김*, 남궁바보→남궁*보)
      if (allSettings.tts_anonymous === '1' || allSettings.tts_anonymous === 'true') {
        text = text.replace(/([가-힣]{1,2})([가-힣]+)님/g, (_, head, tail) => {
          if (tail.length === 1) return `${head}*님`;             // 2글자: 김밥→김*
          const masked = '*'.repeat(tail.length - 1) + tail.slice(-1); // 3글자+: 김바보→김*보
          return `${head}${masked}님`;
        });
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = parseFloat(allSettings.tts_rate || '150') / 150;
      utterance.volume = parseFloat(allSettings.tts_volume || '1.0');
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('TTS error:', e);
    }
  }

  async _processCheckIn(userNumber) {
    try {
      console.log(`[CountPage] 체크인 시도: userNumber=${userNumber}`);
      const allSettings = await window.api.getAllSettings();
      const autoClearMs = (parseFloat(allSettings.checkin_auto_clear_seconds || '3') * 1000);

      let user = await window.api.getUserByNumber(userNumber);
      console.log(`[CountPage] getUserByNumber 결과:`, user);
      if (!user) {
        user = await window.api.getUserByCardNumber(userNumber);
        console.log(`[CountPage] getUserByCardNumber 결과:`, user);
      }
      if (!user) {
        console.warn(`[CountPage] 미등록 사용자: ${userNumber}`);
        window.app.showToast('등록되지 않은 사용자입니다', 'error', autoClearMs);
        this._speak('등록되지 않은 사용자입니다', { eventType: 'unregistered' });
        return;
      }

      // 사용자별 쿨다운: scan_interval 이내 동일 사용자 연속 스캔 무시
      const scanInterval = parseFloat(allSettings.scan_interval || '0.5') * 1000;
      const now = Date.now();
      const lastScan = this._lastScanDetails.get(user.id);
      if (lastScan && (now - lastScan) < scanInterval) {
        console.log(`[CountPage] 사용자 ${user.id} 쿨다운 중 (${scanInterval}ms). 무시.`);
        return;
      }
      this._lastScanDetails.set(user.id, now);

      const isAllPorridge = document.getElementById('toggleAllPorridge')?.checked;
      const defaultMenu = allSettings.default_menu_type || '일반식';
      const menuType = isAllPorridge ? '죽식' : defaultMenu;

      console.log(`[CountPage] checkIn 호출: userId=${user.id}, name=${user.name}, menuType=${menuType}`);
      const result = await window.api.checkIn(user.id, menuType, 'manual', null);
      console.log(`[CountPage] checkIn 결과:`, result);
      if (result.success) {
        const dupWindow = result.duplicateWindowMinutes || 5;
        if (result.isRecentDuplicate) {
          window.app.showToast(`${user.name}님 ${dupWindow}분 이내 중복 시도입니다`, 'warning', autoClearMs);
          this._speak(`${user.name}님 ${dupWindow}분 이내 반복 수령 시도입니다`, { eventType: 'recent_duplicate' });
        } else {
          if (result.count > 1) {
            const customDupMsg = allSettings.tts_custom_duplicate_msg;
            window.app.showToast(`${user.name}님 ${menuType} 중복입니다`, 'warning', autoClearMs);
            this._speak(customDupMsg || `${user.name}님 ${menuType} 중복입니다`, { eventType: 'duplicate' });
          } else {
            const customMsg = allSettings.tts_custom_checkin_msg;
            const hasRemarks = user.special_remarks;
            if (hasRemarks) {
              window.app.showToast(`${user.name}님 확인 (⚠ ${user.special_remarks})`, 'success', autoClearMs);
              this._speak(`${user.name}님 ${menuType}, 특이사항 ${user.special_remarks}`, { eventType: 'remarks' });
            } else {
              window.app.showToast(`${user.name}님 확인되었습니다`, 'success', autoClearMs);
              const ttsEventType = menuType === '죽식' ? 'porridge' : 'normal';
              this._speak(customMsg || `${user.name}님 ${menuType} 첫 수령입니다`, { eventType: ttsEventType });
            }
          }

          if (result.event) {
            this._appendSingleEventToUI(result.event, result.count > 1);
            await this._updateStatsUIOnly();
          } else {
            await this._refreshData();
          }
        }
      } else {
        console.error(`[CountPage] checkIn 실패:`, result);
        window.app.showToast('체크인 처리 중 오류가 발생했습니다', 'error');
      }
    } catch (e) {
      console.error('Check-in error:', e);
    }
  }

  cleanup() {
    if (this._clockInterval) clearInterval(this._clockInterval);
    if (this._refreshInterval) clearInterval(this._refreshInterval);
    if (this._handleGlobalKeydown) {
      document.removeEventListener('keydown', this._handleGlobalKeydown);
    }
    this._lastScanDetails.clear();
    window.api.cardReader.offData();
    window.api.cardReader.offStatus();
  }
}

/* ---- Edit Page ---- */
class EditPage {
  constructor() {
    this._currentFilter = 'all';
    this._searchTimeout = null;
  }

  render() {
    const el = document.createElement('div');
    el.className = 'fade-in';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.height = '100%';
    el.innerHTML = `
      <div style="display: flex; gap: 12px; margin-bottom: 16px; align-items: center; flex-shrink: 0;">
        <div style="flex: 1; position: relative;">
          <input class="input" id="editSearch" placeholder="번호 또는 이름으로 검색..." style="padding-left: 40px;" />
          <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted);">🔍</span>
        </div>
        <div style="display: flex; gap: 4px;">
          <button class="btn btn-ghost btn-sm filter-btn active" data-filter="all">전체</button>
          <button class="btn btn-ghost btn-sm filter-btn" data-filter="active">활성</button>
          <button class="btn btn-ghost btn-sm filter-btn" data-filter="suspended">정지</button>
          <button class="btn btn-ghost btn-sm filter-btn" data-filter="terminated">종결</button>
        </div>
        <button class="btn btn-primary btn-sm" id="addUserBtn">+ 사용자 추가</button>
      </div>

      <div style="background: var(--card-bg); border-radius: var(--radius-md); overflow: hidden; flex: 1; display: flex; flex-direction: column; min-height: 0;">
        <div style="overflow-y: auto; flex: 1;">
          <table class="data-table" id="userTable">
            <thead>
              <tr>
                <th style="width: 100px;">번호</th>
                <th style="width: 200px;">이름</th>
                <th style="width: 160px;">카드번호</th>
                <th style="width: 100px;">상태</th>
                <th>비고</th>
                <th style="width: 120px;">관리</th>
              </tr>
            </thead>
            <tbody id="userTableBody">
              <tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">로딩 중...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    return el;
  }

  async afterRender() {
    // Search
    document.getElementById('editSearch').addEventListener('input', (e) => {
      clearTimeout(this._searchTimeout);
      this._searchTimeout = setTimeout(() => this._loadUsers(e.target.value), 300);
    });

    // Filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._currentFilter = btn.dataset.filter;
        this._loadUsers(document.getElementById('editSearch').value);
      });
    });

    // Add user
    document.getElementById('addUserBtn').addEventListener('click', () => this._showAddUserDialog());

    // 시리얼 카드 리더기 IPC 수신
    cardLog.status('대기 중 (편집 화면)');
    this._handleCardData = async (cardNumber) => {
      // 카드 입력 필드가 비어있는 모달이면 카드 번호 채우기 (재등록/신규등록)
      const editCardInput = document.getElementById('editCard');
      const addCardInput = document.getElementById('addCard');
      const activeCardInput = (editCardInput?.value === '' && editCardInput) || (addCardInput?.value === '' && addCardInput);
      if (activeCardInput) {
        activeCardInput.value = cardNumber;
        cardLog.status(`카드 인식 (입력 필드): ${cardNumber}`);
        return;
      }
      // 모달이 열려있으면 무시
      if (document.querySelector('.modal-overlay')) {
        cardLog.status(`인식됨 (모달 열려있어 무시): ${cardNumber}`);
        return;
      }
      cardLog.scan(cardNumber, '편집');
      try {
        await this._handleCardScan(cardNumber);
      } catch (e) {
        cardLog.error('_handleCardScan 오류', e);
      }
    };
    window.api.cardReader.onData(this._handleCardData);

    await this._loadUsers();
  }

  async _loadUsers(query = '') {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;

    try {
      const users = await window.api.searchUsers(query || null, this._currentFilter);
      if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">사용자가 없습니다</td></tr>';
        return;
      }

      tbody.innerHTML = users.map(u => {
        const statusBadge = u.status === 'active' ? '<span class="badge badge-active">활성</span>'
          : u.status === 'suspended' ? '<span class="badge badge-suspended">정지</span>'
            : '<span class="badge badge-terminated">종결</span>';

        return `
          <tr>
            <td style="font-weight: 700; color: var(--accent-cyan);">${u.number}</td>
            <td>${u.name}</td>
            <td style="font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary);">${u.card_number || '—'}</td>
            <td>${statusBadge}</td>
            <td style="color: var(--text-muted); font-size: 12px;">${u.notes || ''}</td>
            <td>
              <div style="display: flex; gap: 4px;">
                <button class="btn-icon" title="수정" data-action="edit" data-id="${u.id}">✏️</button>
                ${u.status === 'active' ? `<button class="btn-icon" title="일시정지" data-action="suspend" data-id="${u.id}">⏸️</button>` : ''}
                ${u.status === 'suspended' ? `<button class="btn-icon" title="재활성화" data-action="reactivate" data-id="${u.id}">▶️</button>` : ''}
                ${u.status !== 'terminated' ? `<button class="btn-icon" title="종결" data-action="terminate" data-id="${u.id}">🗑️</button>` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Action handlers
      tbody.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => this._handleAction(btn.dataset.action, parseInt(btn.dataset.id)));
      });

    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--error);">오류: ${e.message}</td></tr>`;
    }
  }

  async _handleAction(action, userId) {
    try {
      let result;
      if (action === 'suspend') {
        result = await window.api.suspendUser(userId);
      } else if (action === 'terminate') {
        const confirmed = await app.showConfirm({
          title: '사용자 종결',
          message: '이 사용자를 종결하시겠습니까?',
          type: 'warning',
          confirmText: '종결',
        });
        if (!confirmed) return;
        result = await window.api.terminateUser(userId);
      } else if (action === 'reactivate') {
        result = await window.api.reactivateUser(userId);
      } else if (action === 'edit') {
        await this._showEditUserDialog(userId);
        return;
      }

      if (result && !result.success) {
        await app.showAlert('오류', result.message);
      }
      await this._loadUsers(document.getElementById('editSearch')?.value || '');
    } catch (e) {
      await app.showAlert('오류', e.message);
    }
  }

  async _handleCardScan(cardNumber) {
    const owner = await window.api.getCardOwnerInfo(cardNumber);

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="min-width: 420px;">
        <h3>카드 스캔됨</h3>
        <div style="background: var(--bg-medium); border-radius: var(--radius-sm); padding: 12px 16px; margin-bottom: 16px;">
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">카드 번호</div>
          <div style="font-family: var(--font-mono); font-size: 16px; font-weight: 700; color: var(--accent-cyan);">${cardNumber}</div>
          ${owner ? `
            <div style="margin-top: 8px; font-size: 12px; color: var(--warning);">
              현재 소유자: ${owner.number} ${owner.name}${owner.status === 'suspended' ? ' (일시정지)' : ''}
            </div>` : `
            <div style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">등록되지 않은 카드</div>`}
        </div>
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">어떤 작업을 하시겠습니까?</p>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button class="btn btn-primary" id="scanAssign">기존 사용자 카드 변경</button>
          <button class="btn btn-ghost" id="scanAddUser">신규 사용자 등록</button>
          <button class="btn btn-ghost" id="scanCancel" style="color: var(--text-muted);">취소</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#scanAssign').addEventListener('click', () => {
      overlay.remove();
      this._showCardAssignDialog(cardNumber);
    });
    overlay.querySelector('#scanAddUser').addEventListener('click', () => {
      overlay.remove();
      this._showAddUserDialog(cardNumber);
    });
    overlay.querySelector('#scanCancel').addEventListener('click', () => overlay.remove());
  }

  _showCardAssignDialog(cardNumber) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="min-width: 480px;">
        <h3>기존 사용자 카드 변경</h3>
        <div style="background: var(--bg-medium); border-radius: var(--radius-sm); padding: 8px 12px; margin-bottom: 16px; font-size: 12px; color: var(--text-muted);">
          카드 번호: <span style="font-family: var(--font-mono); color: var(--accent-cyan);">${cardNumber}</span>
        </div>
        <div class="search-input-wrapper" style="margin-bottom: 12px;">
          <span class="search-icon">🔍</span>
          <input class="input" id="assignSearch" placeholder="번호 또는 이름으로 검색..." />
        </div>
        <div id="assignResults" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--divider); border-radius: var(--radius-sm);">
          <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 13px;">검색어를 입력하세요</div>
        </div>
        <div style="display: flex; justify-content: flex-end; margin-top: 16px;">
          <button class="btn btn-ghost" id="assignCancel">취소</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const searchInput = overlay.querySelector('#assignSearch');
    const resultsEl = overlay.querySelector('#assignResults');

    let searchTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = searchInput.value.trim();
      if (!q) {
        resultsEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 13px;">검색어를 입력하세요</div>';
        return;
      }
      searchTimer = setTimeout(async () => {
        try {
          const users = await window.api.searchUsers(q, 'all');
          if (users.length === 0) {
            resultsEl.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 13px;">검색 결과 없음</div>';
            return;
          }
          resultsEl.innerHTML = users.map(u => `
            <div class="assign-user-row" data-id="${u.id}" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--divider);">
              <div>
                <span style="font-weight: 700; color: var(--accent-cyan);">${u.number}</span>
                <span style="margin-left: 8px;">${u.name}</span>
                <span class="badge ${u.status === 'active' ? 'badge-active' : u.status === 'suspended' ? 'badge-suspended' : 'badge-terminated'}" style="margin-left: 8px; font-size: 10px;">${u.status === 'active' ? '활성' : u.status === 'suspended' ? '정지' : '종결'}</span>
              </div>
              <div style="font-size: 11px; font-family: var(--font-mono); color: var(--text-muted);">${u.card_number || '카드없음'}</div>
            </div>
          `).join('');

          resultsEl.querySelectorAll('.assign-user-row').forEach(row => {
            row.addEventListener('mouseenter', () => row.style.background = 'var(--bg-medium)');
            row.addEventListener('mouseleave', () => row.style.background = '');
            row.addEventListener('click', async () => {
              const targetUserId = parseInt(row.dataset.id);
              overlay.remove();
              try {
                const existingOwner = await window.api.getCardOwnerInfo(cardNumber);
                let result;
                if (existingOwner) {
                  result = await window.api.transferCard(cardNumber, targetUserId, `카드 변경 (${existingOwner.number} ${existingOwner.name} → #${targetUserId})`);
                } else {
                  result = await window.api.reissueCard(targetUserId, cardNumber, '카드 스캔으로 등록');
                }
                if (result.success) {
                  window.app.showToast('카드가 변경되었습니다', 'success');
                  await this._loadUsers(document.getElementById('editSearch')?.value || '');
                } else {
                  await app.showAlert('카드 변경 실패', result.message);
                }
              } catch (e) {
                await app.showAlert('오류', e.message);
              }
            });
          });
        } catch (e) {
          resultsEl.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--error); font-size: 13px;">오류: ${e.message}</div>`;
        }
      }, 300);
    });

    overlay.querySelector('#assignCancel').addEventListener('click', () => overlay.remove());


    searchInput.focus();
  }

  _showAddUserDialog(prefillCard = '') {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h3>사용자 추가</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 4px;">번호 *</label>
            <input class="input" id="addNumber" placeholder="사용자 번호" />
          </div>
          <div>
            <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 4px;">이름 *</label>
            <input class="input" id="addName" placeholder="사용자 이름" />
          </div>
          <div>
            <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 4px;">💳 카드 번호 (선택)</label>
            <div style="display: flex; gap: 8px;">
              <input class="input" id="addCard" placeholder="카드 번호" style="flex: 1;" />
              <button class="btn btn-ghost btn-sm" id="addCardClear" title="비우기" style="white-space: nowrap;">재등록</button>
            </div>
          </div>
          <div>
            <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 4px;">비고 (선택)</label>
            <input class="input" id="addNotes" placeholder="비고" />
          </div>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 20px; justify-content: flex-end;">
          <button class="btn btn-ghost" id="addCancel">취소</button>
          <button class="btn btn-primary" id="addConfirm">추가</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const addCardEl = overlay.querySelector('#addCard');
    const addNumberEl = overlay.querySelector('#addNumber');
    const addNameEl = overlay.querySelector('#addName');
    const addNotesEl = overlay.querySelector('#addNotes');

    // prefillCard가 있으면 카드 필드에 pre-fill
    if (prefillCard) addCardEl.value = prefillCard;

    overlay.querySelector('#addCardClear').addEventListener('click', () => {
      addCardEl.value = '';
      addCardEl.focus();
    });

    overlay.querySelector('#addCancel').addEventListener('click', () => overlay.remove());


    overlay.querySelector('#addConfirm').addEventListener('click', async () => {
      const number = addNumberEl.value.trim();
      const name = addNameEl.value.trim();
      const cardNumber = addCardEl.value.trim();
      const notes = addNotesEl.value.trim();
      if (!number || !name) {
        await app.showAlert('입력 오류', '번호와 이름은 필수입니다.', 'warning');
        return;
      }

      // 카드 번호 중복 확인
      if (cardNumber) {
        const existingOwner = await window.api.getCardOwnerInfo(cardNumber);
        if (existingOwner) {
          const statusText = existingOwner.status === 'suspended' ? ' (일시정지)' : '';
          const confirmed = await app.showConfirm({
            title: '카드 번호 중복',
            message: `이미 사용 중인 카드 번호입니다.\n\n현재 소유자: ${existingOwner.number} ${existingOwner.name}${statusText}\n\n이 카드를 새 사용자에게 이전하시겠습니까?`,
            type: 'warning',
            confirmText: '이전',
          });
          if (!confirmed) return;

          // 사용자 먼저 생성 (카드 없이)
          const createResult = await window.api.addUser(number, name, notes || null, null);
          if (!createResult.success) {
            await app.showAlert('추가 실패', createResult.message);
            return;
          }
          // 카드 이전
          const transferResult = await window.api.transferCard(cardNumber, createResult.userId, `신규 등록 시 이전 (#${number} ${name})`);
          if (!transferResult.success) {
            await app.showAlert('카드 이전 실패', transferResult.message);
            return;
          }
          overlay.remove();
          window.app.showToast('사용자가 추가되고 카드가 이전되었습니다', 'success');
          await this._loadUsers();
          return;
        }
      }

      const result = await window.api.addUser(number, name, notes || null, cardNumber || null);
      if (result.success) {
        overlay.remove();
        const toastMsg = result.message && result.message.includes('카드 추가 실패')
          ? result.message
          : '새 사용자가 추가되었습니다';
        window.app.showToast(toastMsg, result.message && result.message.includes('카드 추가 실패') ? 'warning' : 'success');
        await this._loadUsers();
      } else {
        await app.showAlert('추가 실패', result.message);
      }
    });
  }

  async _showEditUserDialog(userId) {
    const user = await window.api.getUserById(userId);
    if (!user) return;

    // 현재 활성 카드 조회
    const activeCard = await window.api.getActiveCard(userId);
    const currentCardNumber = activeCard ? activeCard.card_number : '';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="min-width: 480px;">
        <h3>사용자 수정 — ${user.number}</h3>
        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">${user.name} (#${user.number})</p>
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <!-- 기본 정보 -->
          <div style="border-bottom: 1px solid var(--divider); padding-bottom: 16px;">
            <div style="font-size: 13px; font-weight: 600; color: var(--accent-cyan); margin-bottom: 12px;">📋 기본 정보</div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              <div>
                <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 4px;">이름 *</label>
                <input class="input" id="editName" value="${user.name || ''}" />
              </div>
              <div>
                <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 4px;">비고</label>
                <input class="input" id="editNotes" value="${user.notes || ''}" />
              </div>
            </div>
          </div>

          <!-- 상태 관리 -->
          <div style="border-bottom: 1px solid var(--divider); padding-bottom: 16px;">
            <div style="font-size: 13px; font-weight: 600; color: var(--accent-cyan); margin-bottom: 12px;">⚙️ 상태 관리</div>
            ${user.status === 'terminated'
              ? `<div style="display: flex; align-items: center; gap: 12px; background: var(--bg-medium); border-radius: var(--radius-sm); padding: 12px 16px;">
                   <span style="font-size: 13px; color: var(--error);">종결 상태</span>
                   <button class="btn btn-ghost btn-sm" id="editReactivate" style="margin-left: auto; color: var(--success);">활성으로 복구</button>
                 </div>`
              : `<div style="display: flex; align-items: center; gap: 12px; background: var(--bg-medium); border-radius: var(--radius-sm); padding: 12px 16px;">
                   <label class="switch">
                     <input type="checkbox" id="editSuspended" ${user.status === 'suspended' ? 'checked' : ''}>
                     <span class="slider"></span>
                   </label>
                   <span style="font-size: 13px;">일시정지 상태</span>
                 </div>`
            }
          </div>

          <!-- 카드 관리 -->
          <div>
            <div style="font-size: 13px; font-weight: 600; color: var(--accent-cyan); margin-bottom: 12px;">💳 카드 관리</div>
            <div>
              <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 4px;">카드 번호</label>
              <div style="display: flex; gap: 8px;">
                <input class="input" id="editCard" value="${currentCardNumber}" style="flex: 1;" />
                <button class="btn btn-ghost btn-sm" id="editCardReissue" style="white-space: nowrap; color: var(--warning);">재등록</button>
              </div>
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 20px; justify-content: flex-end;">
          ${user.status === 'terminated' ? `<button class="btn btn-danger" id="editPurge" style="margin-right: auto;">즉시 영구 삭제</button>` : ''}
          <button class="btn btn-ghost" id="editCancel">취소</button>
          <button class="btn btn-primary" id="editConfirm">저장</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    let reissueMode = false;

    overlay.querySelector('#editCardReissue').addEventListener('click', () => {
      document.getElementById('editCard').value = '';
      document.getElementById('editCard').focus();
      reissueMode = true;
    });

    if (user.status === 'terminated') {
      overlay.querySelector('#editPurge').addEventListener('click', async () => {
        const confirmed = await app.showConfirm({
          title: '영구 삭제 확인',
          message: `[${user.number}] ${user.name}\n\n이 사용자의 모든 데이터(카드, 이벤트, 특이사항)를 영구적으로 삭제합니다.`,
          detail: '이 작업은 되돌릴 수 없습니다.',
          type: 'danger',
          confirmText: '영구 삭제',
        });
        if (!confirmed) return;
        const result = await window.api.purgeUser(userId);
        if (!result.success) {
          await app.showAlert('삭제 실패', result.message);
          return;
        }
        overlay.remove();
        window.app.showToast('사용자가 영구 삭제되었습니다', 'success');
        await this._loadUsers(document.getElementById('editSearch')?.value || '');
      });
    }

    if (user.status === 'terminated') {
      overlay.querySelector('#editReactivate').addEventListener('click', async () => {
        const confirmed = await app.showConfirm({
          title: '종결 복구 확인',
          message: `[${user.number}] ${user.name}\n\n이 사용자를 활성 상태로 복구하시겠습니까?`,
          type: 'info',
          confirmText: '복구',
        });
        if (!confirmed) return;
        const result = await window.api.reactivateUser(userId);
        if (!result.success) {
          await app.showAlert('복구 실패', result.message);
          return;
        }
        overlay.remove();
        window.app.showToast('사용자가 활성 상태로 복구되었습니다', 'success');
        await this._loadUsers(document.getElementById('editSearch')?.value || '');
      });
    }

    overlay.querySelector('#editCancel').addEventListener('click', () => overlay.remove());


    overlay.querySelector('#editConfirm').addEventListener('click', async () => {
      const name = document.getElementById('editName').value.trim();
      const notes = document.getElementById('editNotes').value.trim();
      const newCardNumber = document.getElementById('editCard').value.trim();
      const isSuspended = document.getElementById('editSuspended')?.checked ?? false;

      // 1. 기본 정보 업데이트
      const result = await window.api.updateUser(userId, name, notes);
      if (!result.success) {
        await app.showAlert('수정 실패', result.message);
        return;
      }

      // 2. 상태 변경
      if (isSuspended && user.status === 'active') {
        await window.api.suspendUser(userId);
      } else if (!isSuspended && user.status === 'suspended') {
        await window.api.reactivateUser(userId);
      }

      // 3. 카드 변경 처리
      if (reissueMode || newCardNumber !== currentCardNumber) {
        if (newCardNumber) {
          // 카드 번호 중복 확인 (본인 제외)
          const existingOwner = await window.api.getCardOwnerInfo(newCardNumber);
          if (existingOwner && existingOwner.id !== userId) {
            const statusText = existingOwner.status === 'suspended' ? ' (일시정지)' : '';
            const confirmed = await app.showConfirm({
              title: '카드 번호 중복',
              message: `이미 사용 중인 카드 번호입니다.\n\n현재 소유자: ${existingOwner.number} ${existingOwner.name}${statusText}\n\n이 카드를 ${user.name}에게 이전하시겠습니까?`,
              type: 'warning',
              confirmText: '이전',
            });
            if (!confirmed) return;

            const transferResult = await window.api.transferCard(newCardNumber, userId, '사용자 정보 수정 중 이전');
            if (!transferResult.success) {
              await app.showAlert('카드 이전 실패', transferResult.message);
              return;
            }
          } else if (!existingOwner || existingOwner.id === userId) {
            // 재발급 처리
            const reissueResult = await window.api.reissueCard(userId, newCardNumber, '사용자 정보 수정 (재등록)');
            if (!reissueResult.success) {
              await app.showAlert('카드 재발급 실패', reissueResult.message);
              return;
            }
          }
        } else {
          // 카드 번호를 비운 경우 - 카드 삭제
          await window.api.deleteCardsForUser(userId);
        }
      }

      overlay.remove();
      window.app.showToast('사용자 정보가 수정되었습니다', 'success');
      await this._loadUsers(document.getElementById('editSearch')?.value || '');
    });
  }

  cleanup() {
    clearTimeout(this._searchTimeout);
    window.api.cardReader.offData();
  }
}

/* ---- Special Remarks Page ---- */
class SpecialRemarksPage {
  constructor() {
    this._filter = 'all';
    this._allRemarks = [];
    this._userCounts = [];
    this._ACCENT_COLORS = ['#00d4ff','#a855f7','#00ff88','#ffa500','#ec4899','#3b82f6','#f59e0b','#10b981'];
    this._ICONS = { '알러지':'🌰','휠체어':'♿','채식':'🥗','할랄':'☪','저염식':'🧂','당뇨':'💉','기타':'🏷️' };
  }

  render() {
    const el = document.createElement('div');
    el.className = 'fade-in';
    el.innerHTML = `
      <!-- 헤더 -->
      <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px;">
        <div>
          <h2 class="section-title" style="margin: 0 0 10px;">특이사항 관리</h2>
          <div id="remarksSummary" style="display: flex; gap: 8px; flex-wrap: wrap;"></div>
        </div>
        <button class="btn btn-primary" id="addRemarkBtn">+ 특이사항 추가</button>
      </div>

      <!-- 필터 탭 -->
      <div style="display: flex; gap: 3px; margin-bottom: 20px; background: var(--bg-medium);
        border-radius: 10px; padding: 4px; width: fit-content;">
        <button class="r-tab r-tab-active" data-filter="all"
          style="background: var(--card-bg); border: none; border-radius: 7px; padding: 6px 16px;
            font-size: 13px; font-weight: 600; color: var(--text-primary); cursor: pointer;">전체</button>
        <button class="r-tab" data-filter="active"
          style="background: transparent; border: none; border-radius: 7px; padding: 6px 16px;
            font-size: 13px; font-weight: 500; color: var(--text-muted); cursor: pointer;">활성</button>
        <button class="r-tab" data-filter="inactive"
          style="background: transparent; border: none; border-radius: 7px; padding: 6px 16px;
            font-size: 13px; font-weight: 500; color: var(--text-muted); cursor: pointer;">비활성</button>
      </div>

      <!-- 카드 목록 -->
      <div id="remarksList"></div>
    `;
    return el;
  }

  async afterRender() {
    document.getElementById('addRemarkBtn').addEventListener('click', () => this._showAddDialog());

    document.querySelectorAll('.r-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.r-tab').forEach(b => {
          b.style.background = 'transparent';
          b.style.color = 'var(--text-muted)';
          b.style.fontWeight = '500';
        });
        btn.style.background = 'var(--card-bg)';
        btn.style.color = 'var(--text-primary)';
        btn.style.fontWeight = '600';
        this._filter = btn.dataset.filter;
        this._renderCards();
      });
    });

    await this._loadRemarks();
  }

  async _loadRemarks() {
    const container = document.getElementById('remarksList');
    if (!container) return;
    container.style.cssText = 'display: flex; align-items: center; justify-content: center; min-height: 200px;';
    container.innerHTML = `<div style="color: var(--text-muted); font-size: 13px;">불러오는 중...</div>`;
    try {
      this._allRemarks = await window.api.getAllSpecialRemarks();
      this._userCounts = await Promise.all(
        this._allRemarks.map(r => window.api.getUsersForRemark(r.id).then(u => u.length).catch(() => 0))
      );
      this._renderSummary();
      this._renderCards();
    } catch (e) {
      container.innerHTML = `<div style="color: var(--error); padding: 20px; font-size: 13px;">오류: ${e.message}</div>`;
    }
  }

  _renderSummary() {
    const el = document.getElementById('remarksSummary');
    if (!el) return;
    const total = this._allRemarks.length;
    const active = this._allRemarks.filter(r => r.is_active).length;
    const inactive = total - active;
    el.innerHTML = `
      <span style="background: var(--accent-cyan-dim); color: var(--accent-cyan);
        border-radius: 20px; padding: 3px 12px; font-size: 12px; font-weight: 600;">전체 ${total}</span>
      <span style="background: rgba(0,255,136,0.1); color: var(--success);
        border-radius: 20px; padding: 3px 12px; font-size: 12px; font-weight: 600;">활성 ${active}</span>
      ${inactive > 0 ? `<span style="background: rgba(255,68,68,0.1); color: var(--error);
        border-radius: 20px; padding: 3px 12px; font-size: 12px; font-weight: 600;">비활성 ${inactive}</span>` : ''}
    `;
  }

  _renderCards() {
    const container = document.getElementById('remarksList');
    if (!container) return;

    const filtered = this._filter === 'all' ? this._allRemarks
      : this._filter === 'active' ? this._allRemarks.filter(r => r.is_active)
      : this._allRemarks.filter(r => !r.is_active);

    if (filtered.length === 0) {
      container.style.cssText = 'display: flex; align-items: center; justify-content: center; min-height: 300px;';
      const msg = this._filter === 'all' ? '등록된 특이사항이 없습니다'
        : this._filter === 'active' ? '활성 특이사항이 없습니다'
        : '비활성 특이사항이 없습니다';
      const hint = this._filter === 'all' ? '우상단 버튼으로 특이사항을 추가하세요' : '';
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted);">
          <div style="font-size: 52px; margin-bottom: 16px; opacity: 0.2; line-height: 1;">⚠️</div>
          <div style="font-size: 15px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px;">${msg}</div>
          <div style="font-size: 13px;">${hint}</div>
        </div>
      `;
      return;
    }

    container.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; align-content: start;';
    container.innerHTML = filtered.map((r, i) => {
      const origIdx = this._allRemarks.indexOf(r);
      const count = this._userCounts[origIdx] ?? 0;
      const icon = this._ICONS[r.name] || '📌';
      const color = r.is_active ? this._ACCENT_COLORS[origIdx % this._ACCENT_COLORS.length] : '#555';
      return `
        <div class="remark-card" data-remark-id="${r.id}" data-color="${color}"
          style="background: var(--card-bg); border-radius: var(--radius-md);
            border: 1px solid var(--divider); border-left: 3px solid ${color};
            cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
            overflow: hidden; display: flex; flex-direction: column;
            opacity: ${r.is_active ? '1' : '0.55'};">
          <div style="padding: 16px 18px 12px; flex: 1;">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px;">
              <div style="width: 42px; height: 42px; border-radius: 10px;
                background: ${color}18; display: flex; align-items: center;
                justify-content: center; font-size: 20px; flex-shrink: 0;">${icon}</div>
              <span style="font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 20px;
                letter-spacing: 0.3px;
                background: ${r.is_active ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)'};
                color: ${r.is_active ? 'var(--success)' : 'var(--error)'};">
                ${r.is_active ? '● 활성' : '○ 비활성'}
              </span>
            </div>
            <div style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">${r.name}</div>
            <div style="font-size: 12px; color: var(--text-muted); line-height: 1.5; min-height: 18px;">
              ${r.description || '<span style="opacity:0.5;">설명 없음</span>'}
            </div>
            ${r.start_date || r.end_date ? `<div style="font-size: 11px; color: var(--text-dim); margin-top: 8px; display: flex; align-items: center; gap: 4px;">
              <span>📅</span><span>${r.start_date || '?'} ~ ${r.end_date || '?'}</span>
            </div>` : ''}
          </div>
          <div style="padding: 10px 18px; background: var(--bg-medium);
            border-top: 1px solid var(--divider);
            display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 13px;">👤</span>
              <span style="font-size: 13px; font-weight: 700;
                color: ${count > 0 ? color : 'var(--text-dim)'};">${count}명</span>
              <span style="font-size: 11px; color: var(--text-dim);">배정됨</span>
            </div>
            <span style="font-size: 11px; color: var(--text-dim);">관리 →</span>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.remark-card').forEach(card => {
      const color = card.dataset.color;
      card.addEventListener('mouseover', () => {
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = `0 6px 20px ${color}30`;
        card.style.borderColor = color;
      });
      card.addEventListener('mouseout', () => {
        card.style.transform = '';
        card.style.boxShadow = '';
        card.style.borderColor = 'var(--divider)';
        card.style.borderLeftColor = color;
      });
      card.addEventListener('click', () => {
        const remark = this._allRemarks.find(r => r.id === parseInt(card.dataset.remarkId));
        if (remark) this._showRemarkDetailDialog(remark);
      });
    });
  }

  async _showRemarkDetailDialog(remark) {
    const icon = this._ICONS[remark.name] || '📌';
    const origIdx = this._allRemarks.indexOf(remark);
    const accentColor = remark.is_active ? this._ACCENT_COLORS[origIdx % this._ACCENT_COLORS.length] : '#555';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="width: 760px; max-width: 90vw; max-height: 85vh; display: flex; flex-direction: column; padding: 0; overflow: hidden;">

        <!-- 헤더: 인라인 편집 -->
        <div style="padding: 18px 24px 14px; border-bottom: 1px solid var(--divider); flex-shrink: 0;
          border-top: 3px solid ${accentColor};">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 46px; height: 46px; border-radius: 12px; background: ${accentColor}18;
              display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">${icon}</div>
            <div style="flex: 1; min-width: 0;">
              <input id="inlineRemarkName" value="${remark.name}"
                style="background: transparent; border: none; border-bottom: 1px solid transparent;
                  color: var(--text-primary); font-size: 17px; font-weight: 700;
                  width: 100%; padding: 2px 4px; margin-bottom: 6px; outline: none; display: block;
                  transition: border-color 0.15s; border-radius: 0;"
                onfocus="this.style.borderBottomColor='${accentColor}'"
                onblur="this.style.borderBottomColor='transparent'" />
              <input id="inlineRemarkDesc" value="${remark.description || ''}" placeholder="설명 추가..."
                style="background: transparent; border: none; border-bottom: 1px solid transparent;
                  color: var(--text-muted); font-size: 12px; width: 100%; padding: 2px 4px;
                  outline: none; display: block; transition: border-color 0.15s; border-radius: 0;"
                onfocus="this.style.borderBottomColor='var(--border)'"
                onblur="this.style.borderBottomColor='transparent'" />
            </div>
            <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
              <label class="switch" style="margin: 0;">
                <input type="checkbox" id="inlineRemarkActive" ${remark.is_active ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
              <span id="inlineActiveLabel" style="font-size: 12px; font-weight: 600; min-width: 34px;
                color: ${remark.is_active ? 'var(--success)' : 'var(--text-muted)'};">
                ${remark.is_active ? '활성' : '비활성'}
              </span>
              <button id="inlineSaveBtn" disabled
                style="background: var(--success); color: #000; border: none; border-radius: var(--radius-sm);
                  padding: 6px 14px; font-size: 12px; font-weight: 700; cursor: not-allowed;
                  opacity: 0.25; transition: opacity 0.2s, transform 0.15s;">저장</button>
              <button class="btn-icon" id="remarkDetailClose" title="닫기"
                style="font-size: 18px; color: var(--text-muted);">✕</button>
            </div>
          </div>
        </div>

        <!-- 기간 설정 -->
        <div style="padding: 10px 24px; border-bottom: 1px solid var(--divider); flex-shrink: 0;
          display: flex; align-items: center; gap: 12px; background: var(--bg-medium);">
          <span style="font-size: 12px; font-weight: 600; color: var(--text-secondary); white-space: nowrap;">📅 기간</span>
          <input type="date" id="inlineRemarkStartDate" value="${remark.start_date || ''}"
            style="background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius-sm);
              color: var(--text-primary); padding: 4px 8px; font-size: 12px; outline: none;" />
          <span style="font-size: 12px; color: var(--text-muted);">~</span>
          <input type="date" id="inlineRemarkEndDate" value="${remark.end_date || ''}"
            style="background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius-sm);
              color: var(--text-primary); padding: 4px 8px; font-size: 12px; outline: none;" />
          <button id="inlineClearDates" style="background: none; border: 1px solid var(--border); border-radius: var(--radius-sm);
            color: var(--text-muted); padding: 4px 8px; font-size: 11px; cursor: pointer;">초기화</button>
        </div>

        <!-- 바디: 2-패널 -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; flex: 1; min-height: 0; overflow: hidden;">

          <!-- 왼쪽: 배정된 사용자 -->
          <div style="display: flex; flex-direction: column; border-right: 1px solid var(--divider); min-height: 0;">
            <div style="padding: 14px 20px 10px; flex-shrink: 0; display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">배정된 사용자</span>
              <span id="assignedCount" style="background: var(--accent-cyan-dim); color: var(--accent-cyan); border-radius: 10px; padding: 1px 8px; font-size: 11px; font-weight: 700;">0</span>
            </div>
            <div id="remarkUserList" style="flex: 1; overflow-y: auto; padding: 0 8px 8px;">
              <div style="text-align: center; padding: 40px 0; color: var(--text-muted); font-size: 13px;">로딩 중...</div>
            </div>
          </div>

          <!-- 오른쪽: 사용자 배정 -->
          <div style="display: flex; flex-direction: column; min-height: 0;">
            <div style="padding: 14px 20px 10px; flex-shrink: 0;">
              <span style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">사용자 추가</span>
              <div style="position: relative; margin-top: 10px;">
                <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 14px;">🔍</span>
                <input class="input" id="remarkAssignSearch" placeholder="번호 또는 이름 검색..."
                  style="padding-left: 34px; font-size: 13px;" />
              </div>
            </div>
            <div id="remarkAssignResults" style="flex: 1; overflow-y: auto; padding: 0 8px 8px;">
              <div style="text-align: center; padding: 40px 0; color: var(--text-muted); font-size: 13px;">로딩 중...</div>
            </div>
          </div>
        </div>

        <!-- 푸터 -->
        <div style="padding: 12px 24px; border-top: 1px solid var(--divider); flex-shrink: 0; display: flex; justify-content: space-between; align-items: center;">
          <button class="btn btn-ghost btn-sm" id="remarkDeleteBtn" style="color: var(--error);">이 특이사항 삭제</button>
          <button class="btn btn-ghost" id="remarkDetailCloseBtn">닫기</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const loadAssignedUsers = async () => {
      const listEl = overlay.querySelector('#remarkUserList');
      try {
        const users = await window.api.getUsersForRemark(remark.id);
        overlay.querySelector('#assignedCount').textContent = users.length;
        if (users.length === 0) {
          listEl.innerHTML = `
            <div style="text-align: center; padding: 40px 16px; color: var(--text-muted);">
              <div style="font-size: 28px; margin-bottom: 8px;">👤</div>
              <div style="font-size: 13px;">배정된 사용자 없음</div>
            </div>`;
          return;
        }
        listEl.innerHTML = users.map(u => `
          <div style="display: flex; justify-content: space-between; align-items: center;
            padding: 8px 12px; margin: 2px 0; border-radius: var(--radius-sm);
            background: var(--bg-medium);">
            <div>
              <span style="font-family: var(--font-mono); font-size: 12px; color: var(--accent-cyan); font-weight: 700;">${u.number}</span>
              <span style="margin-left: 8px; font-size: 13px;">${u.name}</span>
            </div>
            <button class="unassign-btn" data-uid="${u.user_id}"
              style="background: none; border: 1px solid var(--error); color: var(--error);
                border-radius: var(--radius-sm); padding: 2px 8px; font-size: 11px; cursor: pointer;
                transition: background 0.15s;"
              onmouseover="this.style.background='rgba(255,68,68,0.15)'"
              onmouseout="this.style.background='none'">해제</button>
          </div>
        `).join('');
        listEl.querySelectorAll('.unassign-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            await window.api.unassignRemark(parseInt(btn.dataset.uid), remark.id);
            await loadAssignedUsers();
            await loadAssignList(overlay.querySelector('#remarkAssignSearch').value.trim());
          });
        });
      } catch (e) {
        listEl.innerHTML = `<div style="color: var(--error); padding: 12px; font-size: 12px;">오류: ${e.message}</div>`;
      }
    };

    const renderAssignList = (users) => {
      const resultsEl = overlay.querySelector('#remarkAssignResults');
      if (users.length === 0) {
        resultsEl.innerHTML = `
          <div style="text-align: center; padding: 40px 16px; color: var(--text-muted);">
            <div style="font-size: 13px;">검색 결과 없음</div>
          </div>`;
        return;
      }
      resultsEl.innerHTML = users.map(u => `
        <div class="assign-row" data-uid="${u.id}"
          style="display: flex; justify-content: space-between; align-items: center;
            padding: 8px 12px; margin: 2px 0; border-radius: var(--radius-sm);
            background: var(--bg-medium); transition: background 0.15s; cursor: default;"
          onmouseover="this.style.background='var(--card-hover)'"
          onmouseout="this.style.background='var(--bg-medium)'">
          <div>
            <span style="font-family: var(--font-mono); font-size: 12px; color: var(--accent-cyan); font-weight: 700;">${u.number}</span>
            <span style="margin-left: 8px; font-size: 13px;">${u.name}</span>
          </div>
          <button class="btn btn-primary btn-sm assign-btn" data-uid="${u.id}"
            style="font-size: 11px; padding: 3px 12px;">+ 배정</button>
        </div>
      `).join('');
      resultsEl.querySelectorAll('.assign-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const uid = parseInt(btn.dataset.uid);
          const result = await window.api.assignRemark(uid, remark.id);
          if (result.success) {
            await loadAssignedUsers();
            await loadAssignList(overlay.querySelector('#remarkAssignSearch').value.trim());
          } else {
            window.app.showToast(result.message, 'error');
          }
        });
      });
    };

    const loadAssignList = async (q = '') => {
      try {
        const users = await window.api.searchUsers(q || null, 'active');
        renderAssignList(users);
      } catch (e) {
        const resultsEl = overlay.querySelector('#remarkAssignResults');
        resultsEl.innerHTML = `<div style="color: var(--error); padding: 12px; font-size: 12px;">오류: ${e.message}</div>`;
      }
    };

    await Promise.all([loadAssignedUsers(), loadAssignList()]);

    let searchTimer;
    overlay.querySelector('#remarkAssignSearch').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => loadAssignList(e.target.value.trim()), 300);
    });

    // ── 인라인 편집 ──
    const nameInput      = overlay.querySelector('#inlineRemarkName');
    const descInput      = overlay.querySelector('#inlineRemarkDesc');
    const activeChk      = overlay.querySelector('#inlineRemarkActive');
    const activeLabel    = overlay.querySelector('#inlineActiveLabel');
    const saveBtn        = overlay.querySelector('#inlineSaveBtn');
    const startDateInput = overlay.querySelector('#inlineRemarkStartDate');
    const endDateInput   = overlay.querySelector('#inlineRemarkEndDate');
    const clearDatesBtn  = overlay.querySelector('#inlineClearDates');

    const setDirty = (dirty) => {
      saveBtn.disabled = !dirty;
      saveBtn.style.opacity   = dirty ? '1' : '0.25';
      saveBtn.style.cursor    = dirty ? 'pointer' : 'not-allowed';
      saveBtn.style.transform = dirty ? 'scale(1.05)' : 'scale(1)';
    };
    const checkDirty = () => setDirty(
      nameInput.value.trim() !== remark.name
      || descInput.value.trim() !== (remark.description || '')
      || activeChk.checked !== !!remark.is_active
      || startDateInput.value !== (remark.start_date || '')
      || endDateInput.value !== (remark.end_date || '')
    );

    nameInput.addEventListener('input', checkDirty);
    descInput.addEventListener('input', checkDirty);
    startDateInput.addEventListener('change', checkDirty);
    endDateInput.addEventListener('change', checkDirty);
    clearDatesBtn.addEventListener('click', () => {
      startDateInput.value = '';
      endDateInput.value = '';
      checkDirty();
    });
    activeChk.addEventListener('change', () => {
      activeLabel.textContent = activeChk.checked ? '활성' : '비활성';
      activeLabel.style.color = activeChk.checked ? 'var(--success)' : 'var(--text-muted)';
      checkDirty();
    });

    saveBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      const sd = startDateInput.value || null;
      const ed = endDateInput.value || null;
      const result = await window.api.updateSpecialRemark(remark.id, name, descInput.value.trim(), activeChk.checked, sd, ed);
      if (result.success) {
        remark.name        = name;
        remark.description = descInput.value.trim();
        remark.is_active   = activeChk.checked ? 1 : 0;
        remark.start_date  = sd;
        remark.end_date    = ed;
        setDirty(false);
        await this._loadRemarks();
        window.app.showToast('저장됐습니다', 'success');
      } else {
        await app.showAlert('수정 실패', result.message);
      }
    });

    const close = () => overlay.remove();
    overlay.querySelector('#remarkDetailClose').addEventListener('click', close);
    overlay.querySelector('#remarkDetailCloseBtn').addEventListener('click', close);

    overlay.querySelector('#remarkDeleteBtn').addEventListener('click', async () => {
      const confirmed = await app.showConfirm({
        title: '특이사항 삭제',
        message: `"${remark.name}" 을(를) 삭제하시겠습니까?`,
        detail: '배정된 사용자 정보도 모두 해제됩니다.',
        type: 'danger',
        confirmText: '삭제',
      });
      if (confirmed) {
        const result = await window.api.deleteSpecialRemark(remark.id);
        if (result && result.success === false) {
          await app.showAlert('삭제 실패', result.message);
          return;
        }
        overlay.remove();
        await this._loadRemarks();
      }
    });
  }

  _showRemarkEditDialog(remark, onSaved) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="width: 400px;">
        <h3 style="margin-bottom: 4px;">특이사항 수정</h3>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 20px;">특이사항 정보를 수정합니다</p>
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 5px;">이름 *</label>
            <input class="input" id="editRemarkName" value="${remark.name}" />
          </div>
          <div>
            <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 5px;">설명</label>
            <input class="input" id="editRemarkDesc" value="${remark.description || ''}" placeholder="간단한 설명을 입력하세요" />
          </div>
          <div>
            <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 8px;">상태</label>
            <div style="display: flex; align-items: center; gap: 10px; background: var(--bg-medium); border-radius: var(--radius-sm); padding: 10px 14px;">
              <label class="switch">
                <input type="checkbox" id="editRemarkActive" ${remark.is_active ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
              <span style="font-size: 13px;" id="editRemarkActiveLabel">${remark.is_active ? '활성' : '비활성'}</span>
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 24px; justify-content: flex-end;">
          <button class="btn btn-ghost" id="editRemarkCancel">취소</button>
          <button class="btn btn-primary" id="editRemarkConfirm">저장</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const nameInput = overlay.querySelector('#editRemarkName');
    nameInput.focus();
    nameInput.select();

    // 토글 라벨 실시간 반영
    overlay.querySelector('#editRemarkActive').addEventListener('change', (e) => {
      overlay.querySelector('#editRemarkActiveLabel').textContent = e.target.checked ? '활성' : '비활성';
    });

    overlay.querySelector('#editRemarkCancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#editRemarkConfirm').addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      const desc = overlay.querySelector('#editRemarkDesc').value.trim();
      const isActive = overlay.querySelector('#editRemarkActive').checked;
      const result = await window.api.updateSpecialRemark(remark.id, name, desc, isActive);
      if (result.success) {
        overlay.remove();
        if (onSaved) onSaved({ ...remark, name, description: desc, is_active: isActive ? 1 : 0 });
      } else {
        await app.showAlert('수정 실패', result.message);
      }
    });

    overlay.querySelector('#editRemarkDesc').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') overlay.querySelector('#editRemarkConfirm').click();
    });
  }

  _showAddDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="width: 400px;">
        <h3 style="margin-bottom: 4px;">특이사항 추가</h3>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 20px;">새 특이사항 유형을 등록합니다</p>
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <div>
            <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 5px;">이름 *</label>
            <input class="input" id="remarkName" placeholder="예: 알러지, 당뇨, 채식 ..." />
          </div>
          <div>
            <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 5px;">설명 (선택)</label>
            <input class="input" id="remarkDesc" placeholder="간단한 설명을 입력하세요" />
          </div>
          <div>
            <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 5px;">기간 (선택)</label>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="date" class="input" id="remarkStartDate" style="flex: 1; font-size: 12px;" />
              <span style="font-size: 12px; color: var(--text-muted);">~</span>
              <input type="date" class="input" id="remarkEndDate" style="flex: 1; font-size: 12px;" />
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 24px; justify-content: flex-end;">
          <button class="btn btn-ghost" id="remarkCancel">취소</button>
          <button class="btn btn-primary" id="remarkConfirm">추가</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const nameInput = overlay.querySelector('#remarkName');
    nameInput.focus();

    overlay.querySelector('#remarkCancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#remarkConfirm').addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      const sd = overlay.querySelector('#remarkStartDate').value || null;
      const ed = overlay.querySelector('#remarkEndDate').value || null;
      const result = await window.api.addSpecialRemark(name, overlay.querySelector('#remarkDesc').value.trim(), 0, sd, ed, 1);
      if (result.success) { overlay.remove(); await this._loadRemarks(); }
      else { await app.showAlert('추가 실패', result.message); }
    });

    // Enter 키 제출
    overlay.querySelector('#remarkDesc').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') overlay.querySelector('#remarkConfirm').click();
    });
  }

  cleanup() { }
}

/* ---- Dashboard Page ---- */
class DashboardPage {
  constructor() {
    this._mode = 'monthly';
    this._lastRows = [];
    this._label = '';
  }

  render() {
    const el = document.createElement('div');
    el.className = 'fade-in';
    el.innerHTML = `
      <div style="background: var(--card-bg); border-radius: var(--radius-md); padding: 24px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
          <h3 class="section-title" style="margin: 0;">이용 현황</h3>
          <div style="display:flex; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden;">
            <button id="modeMonthly" style="padding: 5px 14px; font-size: 13px; border: none; background: var(--accent-cyan); color: #000; cursor: pointer;">월간</button>
            <button id="modeWeekly" style="padding: 5px 14px; font-size: 13px; border: none; background: var(--bg-medium); color: var(--text-secondary); cursor: pointer;">주간</button>
          </div>
          <div id="dashDateInput"></div>
          <button id="dashDownloadBtn" class="btn" style="padding: 6px 16px; margin-left: auto; background: var(--bg-medium); border: 1px solid var(--border); color: var(--text-secondary);">CSV 다운로드</button>
        </div>
        <div id="statsTableWrap" style="color: var(--text-muted);">로딩 중...</div>
      </div>
    `;
    return el;
  }

  async afterRender() {
    document.getElementById('modeMonthly').addEventListener('click', () => this._setMode('monthly'));
    document.getElementById('modeWeekly').addEventListener('click', () => this._setMode('weekly'));
    document.getElementById('dashDownloadBtn').addEventListener('click', () => this._downloadCSV());
    this._renderDateInput();
    await this._loadTable();
  }

  _renderDateInput() {
    const wrap = document.getElementById('dashDateInput');
    if (this._mode === 'monthly') {
      const curMonth = new Date().toISOString().slice(0, 7);
      wrap.innerHTML = `<input type="month" id="dashPicker" value="${curMonth}" style="padding: 6px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-medium); color: var(--text-primary); font-size: 14px;">`;
    } else {
      const curWeek = this._getCurrentWeekValue();
      wrap.innerHTML = `<input type="week" id="dashPicker" value="${curWeek}" style="padding: 6px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-medium); color: var(--text-primary); font-size: 14px;">`;
    }
    document.getElementById('dashPicker').addEventListener('change', () => this._loadTable());
  }

  _setMode(mode) {
    this._mode = mode;
    const btnMonthly = document.getElementById('modeMonthly');
    const btnWeekly = document.getElementById('modeWeekly');
    if (mode === 'monthly') {
      btnMonthly.style.background = 'var(--accent-cyan)'; btnMonthly.style.color = '#000';
      btnWeekly.style.background = 'var(--bg-medium)'; btnWeekly.style.color = 'var(--text-secondary)';
    } else {
      btnWeekly.style.background = 'var(--accent-cyan)'; btnWeekly.style.color = '#000';
      btnMonthly.style.background = 'var(--bg-medium)'; btnMonthly.style.color = 'var(--text-secondary)';
    }
    this._renderDateInput();
    this._loadTable();
  }

  _getCurrentWeekValue() {
    const now = new Date();
    const day = now.getDay() || 7;
    const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
    const year = mon.getFullYear();
    // ISO week number
    const jan4 = new Date(year, 0, 4);
    const startW1 = new Date(jan4); startW1.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1));
    const week = Math.round((mon - startW1) / 604800000) + 1;
    return `${year}-W${String(week).padStart(2, '0')}`;
  }

  _weekToRange(weekValue) {
    const [yearStr, wStr] = weekValue.split('-W');
    const year = parseInt(yearStr), week = parseInt(wStr);
    const jan4 = new Date(year, 0, 4);
    const startW1 = new Date(jan4); startW1.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1));
    const monday = new Date(startW1); monday.setDate(startW1.getDate() + (week - 1) * 7);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const fmt = d => d.toISOString().slice(0, 10);
    const mmdd = d => `${d.getMonth()+1}/${d.getDate()}`;
    return { start: fmt(monday), end: fmt(sunday), label: `${year}년 ${week}주차 (${mmdd(monday)}~${mmdd(sunday)})` };
  }

  _getDateRange() {
    const val = document.getElementById('dashPicker')?.value;
    if (!val) return null;
    if (this._mode === 'monthly') {
      const [y, m] = val.split('-');
      const last = new Date(+y, +m, 0).getDate();
      return { start: `${val}-01`, end: `${val}-${String(last).padStart(2,'0')}`, label: `${y}년 ${m}월` };
    } else {
      return this._weekToRange(val);
    }
  }

  async _loadTable() {
    const wrap = document.getElementById('statsTableWrap');
    const range = this._getDateRange();
    if (!range) return;
    wrap.innerHTML = '<span style="color:var(--text-muted)">로딩 중...</span>';
    try {
      const rows = this._mode === 'monthly'
        ? await window.api.getMonthlyStats(document.getElementById('dashPicker').value)
        : await window.api.getPeriodStats(range.start, range.end);
      this._lastRows = rows || [];
      this._label = range.label;
      if (!rows || rows.length === 0) {
        wrap.innerHTML = '<span style="color:var(--text-muted)">해당 기간에 이용 데이터가 없습니다.</span>';
        return;
      }
      const totals = rows.reduce((a, r) => ({ t: a.t + r.total_count, n: a.n + r.normal_count, p: a.p + r.porridge_count }), { t: 0, n: 0, p: 0 });
      wrap.innerHTML = `
        <div style="overflow-x: auto;">
          <table class="data-table" style="width: 100%;">
            <thead><tr>
              <th style="width:60px">번호</th><th>이름</th><th style="width:100px">총 이용</th><th style="width:100px">일반식</th><th style="width:100px">죽식</th>
            </tr></thead>
            <tbody>
              ${rows.map(r => `<tr><td>${r.number}</td><td>${r.name}</td><td style="text-align:center">${r.total_count}</td><td style="text-align:center">${r.normal_count}</td><td style="text-align:center">${r.porridge_count}</td></tr>`).join('')}
            </tbody>
            <tfoot><tr style="font-weight:600; border-top: 2px solid var(--border);">
              <td colspan="2" style="text-align:center">합계 (${rows.length}명)</td>
              <td style="text-align:center">${totals.t}</td><td style="text-align:center">${totals.n}</td><td style="text-align:center">${totals.p}</td>
            </tr></tfoot>
          </table>
        </div>
      `;
    } catch (e) {
      wrap.innerHTML = `<span style="color:var(--error)">오류: ${e.message}</span>`;
    }
  }

  _downloadCSV() {
    if (!this._lastRows || this._lastRows.length === 0) return;
    const BOM = '\uFEFF';
    const header = '번호,이름,총 이용,일반식,죽식';
    const body = this._lastRows.map(r => `${r.number},${r.name},${r.total_count},${r.normal_count},${r.porridge_count}`).join('\n');
    const blob = new Blob([BOM + header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `이용현황_${this._label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  cleanup() { }
}

/* ---- Settings Page ---- */
class SettingsPage {
  constructor() {
    this._activeGroup = 'general';
    this._allSettings = {};
    this._searchQuery = '';
  }

  _getConfig() {
    const groups = [
      {
        id: 'general', icon: '⚙️', name: '일반', color: '#00d4ff',
        desc: '기본 동작 및 표시 설정',
        keys: ['dark_mode', 'duplicate_highlight_duration', 'max_search_results', 'max_search_results_chosung'],
      },
      {
        id: 'checkin', icon: '✅', name: '체크인', color: '#00ff88',
        desc: '체크인 판정 및 효과 설정',
        keys: ['duplicate_window_minutes', 'checkin_auto_clear_seconds', 'default_menu_type', 'checkin_sound_enabled', 'checkin_sound_duplicate'],
      },
      {
        id: 'tts', icon: '🔊', name: '음성 안내', color: '#a855f7',
        desc: 'TTS 음성 출력 세부 설정',
        keys: ['tts_enabled', 'tts_rate', 'tts_volume', 'tts_anonymous', 'tts_read_normal', 'tts_read_porridge', 'tts_read_remarks', 'tts_read_duplicate', 'tts_read_unregistered', 'tts_read_recent_duplicate', 'tts_custom_checkin_msg', 'tts_custom_duplicate_msg'],
      },
      {
        id: 'display', icon: '🖥️', name: '화면 표시', color: '#ec4899',
        desc: '화면 레이아웃 및 UI 설정',
        keys: [
          'ui_fs_title', 'ui_fs_subtitle', 'ui_fs_body', 'ui_fs_label', 'ui_fs_small',
          'ui_fs_sidebar_brand', 'ui_fs_sidebar_nav', 'ui_fs_clock', 'ui_fs_footer',
          'ui_fs_stat',
          'ui_fs_count_clock', 'ui_fs_count_total', 'ui_fs_count_meal', 'ui_fs_count_meal_label',
          'ui_fs_card_time', 'ui_fs_card_name', 'ui_fs_card_remarks',
          'ui_fs_table_header', 'ui_fs_table_body', 'ui_fs_toast',
          'ui_fullscreen_on_start', 'ui_show_user_number', 'ui_usage_list_max', 'ui_show_ticket_button'
        ],
      },
      {
        id: 'hardware', icon: '🔌', name: '하드웨어', color: '#ffa500',
        desc: '카드 리더기 및 장치 설정',
        keys: ['com_port', 'baud_rate', 'scan_interval', 'card_debounce_time'],
      },
      {
        id: 'backup', icon: '💾', name: '백업', color: '#3b82f6',
        desc: '자동 백업 및 보관 설정',
        keys: ['auto_backup', 'backup_interval', 'max_backups'],
      },
      {
        id: 'export', icon: '📤', name: '내보내기', color: '#f59e0b',
        desc: 'CSV 내보내기 옵션',
        keys: ['export_include_ticket', 'export_encoding'],
      },
      {
        id: 'logging', icon: '📋', name: '로깅', color: '#6b7280',
        desc: '로그 기록 및 보관 설정',
        keys: ['log_level', 'log_retention_days'],
      },
    ];

    const meta = {
      dark_mode:                  { label: '다크 모드',              desc: '어두운 테마 사용', type: 'bool' },
      duplicate_highlight_duration:{ label: '중복 강조 시간',        desc: '중복 이용 강조 표시 시간 (초)', type: 'number', unit: '초' },
      max_search_results:          { label: '검색 결과 수',          desc: '검색 시 표시할 최대 결과 수', type: 'number', unit: '건' },
      max_search_results_chosung:  { label: '초성 검색 결과 수',     desc: '초성 검색 시 표시할 최대 결과 수', type: 'number', unit: '건' },
      duplicate_window_minutes:    { label: '중복 판정 시간',        desc: '이 시간 이내 재체크인은 중복으로 차단됩니다', type: 'number', unit: '분' },
      checkin_auto_clear_seconds:  { label: '알림 표시 시간',        desc: '체크인 후 토스트 알림이 사라지는 시간', type: 'number', unit: '초' },
      default_menu_type:           { label: '기본 식사 유형',        desc: '일괄 죽식 꺼짐 시 기본 메뉴', type: 'select', options: [['일반식','일반식'],['죽식','죽식']] },
      checkin_sound_enabled:       { label: '체크인 효과음',         desc: '체크인 성공 시 효과음 재생', type: 'bool' },
      checkin_sound_duplicate:     { label: '중복 경고음',           desc: '중복 체크인 시 경고음 재생', type: 'bool' },
      tts_enabled:                 { label: 'TTS 활성화',           desc: '음성 안내 마스터 스위치', type: 'bool' },
      tts_rate:                    { label: '음성 속도',            desc: '읽기 속도 (기본 150)', type: 'range', min: 50, max: 300, step: 10 },
      tts_volume:                  { label: '음성 볼륨',            desc: '출력 볼륨 (0.0 ~ 1.0)', type: 'range', min: 0, max: 1, step: 0.1 },
      tts_anonymous:               { label: '음성 익명화',          desc: '이름 중간을 마스킹 (김바보→김*보)', type: 'bool' },
      tts_read_normal:             { label: '일반식 안내',           desc: '일반식 체크인 시 음성 안내', type: 'bool' },
      tts_read_porridge:           { label: '죽식 안내',            desc: '죽식 체크인 시 음성 안내', type: 'bool' },
      tts_read_remarks:            { label: '특이사항 안내',         desc: '특이사항 있는 이용자 안내', type: 'bool' },
      tts_read_duplicate:          { label: '중복 안내',            desc: '당일 중복 이용 시 안내', type: 'bool' },
      tts_read_unregistered:       { label: '미등록자 안내',         desc: '미등록 카드/번호 입력 시 안내', type: 'bool' },
      tts_read_recent_duplicate:   { label: '단시간 중복 안내',      desc: '판정 시간 내 재시도 시 안내', type: 'bool' },
      tts_custom_checkin_msg:      { label: '체크인 멘트',          desc: '비워두면 기본 멘트 사용', type: 'text', placeholder: '예: {name}님 환영합니다' },
      tts_custom_duplicate_msg:    { label: '중복 멘트',            desc: '비워두면 기본 멘트 사용', type: 'text', placeholder: '예: {name}님 이미 수령하셨습니다' },
      ui_fs_title:                 { label: '페이지 제목',           desc: '상단 헤더의 페이지 이름 (예: "홈", "실시간 현황", "설정")', type: 'number', unit: 'px', defaultValue: '26' },
      ui_fs_subtitle:              { label: '부제목 / 섹션 제목',    desc: '모달 제목, 설정 그룹 제목 (예: "화면 표시", "백업")', type: 'number', unit: 'px', defaultValue: '20' },
      ui_fs_body:                  { label: '본문 (기본)',           desc: '일반 텍스트, 버튼, 입력 필드 등 기본 글꼴', type: 'number', unit: 'px', defaultValue: '14' },
      ui_fs_label:                 { label: '라벨',                desc: '설정 항목 이름, 카드 하단 라벨 (예: "오늘 이용", "죽식")', type: 'number', unit: 'px', defaultValue: '14' },
      ui_fs_small:                 { label: '보조 텍스트',           desc: '설정 설명글, 버튼 작은 글씨, 버전 등 회색 보조 텍스트', type: 'number', unit: 'px', defaultValue: '12' },
      ui_fs_sidebar_brand:         { label: '사이드바 — 앱 이름',    desc: '좌측 사이드바 상단 "경로식당" 제목', type: 'number', unit: 'px', defaultValue: '20' },
      ui_fs_sidebar_nav:           { label: '사이드바 — 메뉴',       desc: '좌측 사이드바 메뉴 항목 (예: "홈", "실시간 현황")', type: 'number', unit: 'px', defaultValue: '15' },
      ui_fs_clock:                 { label: '헤더 시계',             desc: '상단 오른쪽 현재 시각 표시', type: 'number', unit: 'px', defaultValue: '16' },
      ui_fs_footer:                { label: '하단 푸터',             desc: '화면 최하단 상태 표시줄 텍스트', type: 'number', unit: 'px', defaultValue: '11' },
      ui_fs_stat:                  { label: '홈 — 통계 숫자',        desc: '홈 페이지 카드의 큰 숫자 (예: 이용자 수 "127")', type: 'number', unit: 'px', defaultValue: '42' },
      ui_fs_count_clock:           { label: '현황 — 시계',           desc: '실시간 현황 상단 시계 숫자', type: 'number', unit: 'px', defaultValue: '28' },
      ui_fs_count_total:           { label: '현황 — 총 이용자 수',    desc: '실시간 현황 상단 총 이용자 큰 숫자', type: 'number', unit: 'px', defaultValue: '44' },
      ui_fs_count_meal:            { label: '현황 — 식사 유형 숫자',  desc: '실시간 현황 일반식/죽식 숫자', type: 'number', unit: 'px', defaultValue: '30' },
      ui_fs_count_meal_label:      { label: '현황 — 식사 유형 라벨',  desc: '실시간 현황 "일반식", "죽식" 라벨', type: 'number', unit: 'px', defaultValue: '10' },
      ui_fs_card_time:             { label: '현황 카드 — 시간',      desc: '이용 현황 카드의 체크인 시간 (예: "12:34")', type: 'number', unit: 'px', defaultValue: '12' },
      ui_fs_card_name:             { label: '현황 카드 — 이름',      desc: '이용 현황 카드의 이용자 이름', type: 'number', unit: 'px', defaultValue: '13' },
      ui_fs_card_remarks:          { label: '현황 카드 — 특이사항',   desc: '이용 현황 카드 하단의 특이사항 메모', type: 'number', unit: 'px', defaultValue: '11' },
      ui_fs_table_header:          { label: '테이블 — 헤더',         desc: '사용자 관리 등 테이블 상단 컬럼명', type: 'number', unit: 'px', defaultValue: '11' },
      ui_fs_table_body:            { label: '테이블 — 본문',         desc: '사용자 관리 등 테이블 내용 텍스트', type: 'number', unit: 'px', defaultValue: '13' },
      ui_fs_toast:                 { label: '알림 메시지',           desc: '상단 토스트 알림 텍스트 (체크인 성공 등)', type: 'number', unit: 'px', defaultValue: '16' },
      ui_fullscreen_on_start:      { label: '시작 시 전체 화면',     desc: '앱 실행 시 자동 전체 화면 (재시작 필요)', type: 'bool' },
      ui_show_user_number:         { label: '번호 표시',            desc: '이용 현황 목록에 사용자 번호 표시', type: 'bool' },
      ui_usage_list_max:           { label: '현황 표시 수',          desc: '실시간 현황에 표시할 최대 이벤트 수', type: 'number', unit: '건' },
      ui_show_ticket_button:       { label: '식권 버튼',            desc: '식권 통계 카드 표시 여부', type: 'bool' },
      com_port:                    { label: 'COM 포트',             desc: '카드 리더기 시리얼 포트', type: 'text', placeholder: 'COM3' },
      baud_rate:                   { label: '전송 속도',            desc: '시리얼 통신 속도', type: 'select', options: [['9600','9600'],['19200','19200'],['38400','38400'],['115200','115200']] },
      scan_interval:               { label: '스캔 간격',            desc: '동일 사용자 연속 스캔 무시 시간', type: 'number', unit: '초' },
      card_debounce_time:          { label: '중복 인식 방지',        desc: '연속 카드 인식 차단 시간', type: 'number', unit: '초' },
      auto_backup:                 { label: '자동 백업',            desc: '주기적 자동 백업 활성화', type: 'bool' },
      backup_interval:             { label: '백업 주기',            desc: '자동 백업 실행 주기', type: 'select', options: [['daily','매일'],['weekly','매주'],['monthly','매월']] },
      max_backups:                 { label: '최대 백업 수',          desc: '오래된 백업 자동 삭제 기준', type: 'number', unit: '개' },
      export_include_ticket:       { label: '식권 포함',            desc: 'CSV 내보내기 시 식권 데이터 포함', type: 'bool' },
      export_encoding:             { label: 'CSV 인코딩',           desc: '내보내기 파일 문자 인코딩', type: 'select', options: [['UTF-8','UTF-8'],['EUC-KR','EUC-KR']] },
      log_level:                   { label: '로그 레벨',            desc: '기록할 로그의 최소 심각도', type: 'select', options: [['DEBUG','DEBUG'],['INFO','INFO'],['WARNING','WARNING'],['ERROR','ERROR']] },
      log_retention_days:          { label: '로그 보관 기간',        desc: '오래된 로그 자동 삭제 기준', type: 'number', unit: '일' },
    };

    return { groups, meta };
  }

  render() {
    const el = document.createElement('div');
    el.className = 'fade-in';
    el.style.cssText = 'display: flex; height: 100%; overflow: hidden; gap: 0;';
    el.innerHTML = `
      <!-- 좌측 내비게이션 -->
      <div class="s-nav">
        <div class="s-nav-search">
          <span class="s-nav-search-icon">🔍</span>
          <input class="s-nav-search-input" id="settingsSearch" placeholder="설정 검색..." />
        </div>
        <div class="s-nav-list" id="settingsNavList"></div>
        <div class="s-nav-footer">
          <div class="s-nav-version" id="settingsVersion"></div>
        </div>
      </div>
      <!-- 우측 콘텐츠 -->
      <div class="s-content" id="settingsContent">
        <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);">로딩 중...</div>
      </div>
    `;
    return el;
  }

  async afterRender() {
    try {
      this._allSettings = await window.api.getAllSettings();
      const { groups } = this._getConfig();

      // 버전 표시
      try {
        const ver = await window.api.getVersion();
        const verEl = document.getElementById('settingsVersion');
        if (verEl) verEl.textContent = `v${ver}`;
      } catch (e) { /* skip */ }

      // 내비게이션 렌더링
      this._renderNav(groups);

      // 첫 그룹 활성화
      this._switchGroup(groups[0].id);

      // 검색
      document.getElementById('settingsSearch').addEventListener('input', (e) => {
        this._searchQuery = e.target.value.trim().toLowerCase();
        if (this._searchQuery) {
          this._renderSearchResults();
        } else {
          this._switchGroup(this._activeGroup);
        }
      });
    } catch (e) {
      document.getElementById('settingsContent').innerHTML =
        `<div style="padding:40px;color:var(--error);">설정 로드 실패: ${e.message}</div>`;
    }
  }

  _renderNav(groups) {
    const nav = document.getElementById('settingsNavList');
    nav.innerHTML = groups.map(g => {
      const count = g.keys.length;
      return `
        <div class="s-nav-item ${g.id === this._activeGroup ? 's-nav-item-active' : ''}" data-group="${g.id}">
          <span class="s-nav-item-icon" style="background: ${g.color}15; color: ${g.color};">${g.icon}</span>
          <div class="s-nav-item-text">
            <span class="s-nav-item-name">${g.name}</span>
            <span class="s-nav-item-count">${count}</span>
          </div>
        </div>
      `;
    }).join('');

    nav.querySelectorAll('.s-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        document.getElementById('settingsSearch').value = '';
        this._searchQuery = '';
        this._switchGroup(item.dataset.group);
      });
    });
  }

  _switchGroup(groupId) {
    this._activeGroup = groupId;
    const { groups, meta } = this._getConfig();
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    // 네비 활성 표시 갱신
    document.querySelectorAll('.s-nav-item').forEach(el => {
      el.classList.toggle('s-nav-item-active', el.dataset.group === groupId);
    });

    const content = document.getElementById('settingsContent');
    content.innerHTML = `
      <div class="s-panel">
        <div class="s-panel-header">
          <div class="s-panel-icon" style="background: ${group.color}15; color: ${group.color};">${group.icon}</div>
          <div>
            <h2 class="s-panel-title">${group.name}</h2>
            <p class="s-panel-desc">${group.desc}</p>
          </div>
        </div>
        <div class="s-panel-body">
          ${this._renderSettingRows(group.keys, meta)}
        </div>
      </div>
    `;

    this._bindHandlers(content);
  }

  _renderSearchResults() {
    const { groups, meta } = this._getConfig();
    const q = this._searchQuery;
    const matched = [];

    for (const g of groups) {
      for (const key of g.keys) {
        const m = meta[key];
        if (!m) continue;
        const haystack = `${m.label} ${m.desc} ${key}`.toLowerCase();
        if (haystack.includes(q)) {
          matched.push({ key, group: g });
        }
      }
    }

    const content = document.getElementById('settingsContent');

    if (matched.length === 0) {
      content.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-muted);gap:12px;">
          <span style="font-size:36px;opacity:0.3;">🔍</span>
          <span style="font-size:14px;">"${this._searchQuery}"에 대한 검색 결과가 없습니다</span>
        </div>
      `;
      return;
    }

    // 그룹별로 묶기
    const byGroup = {};
    for (const m of matched) {
      if (!byGroup[m.group.id]) byGroup[m.group.id] = { group: m.group, keys: [] };
      byGroup[m.group.id].keys.push(m.key);
    }

    let html = `<div class="s-panel"><div class="s-panel-header">
      <div class="s-panel-icon" style="background:rgba(0,212,255,0.1);color:var(--accent-cyan);">🔍</div>
      <div>
        <h2 class="s-panel-title">검색 결과</h2>
        <p class="s-panel-desc">${matched.length}개 항목 찾음</p>
      </div>
    </div><div class="s-panel-body">`;

    for (const { group, keys } of Object.values(byGroup)) {
      html += `<div class="s-search-group-label" style="color:${group.color};">${group.icon} ${group.name}</div>`;
      html += this._renderSettingRows(keys, meta);
    }

    html += '</div></div>';
    content.innerHTML = html;
    this._bindHandlers(content);
  }

  _renderSettingRows(keys, meta) {
    let html = '';
    for (const key of keys) {
      const m = meta[key];
      if (!m) continue;
      const value = this._allSettings[key] ?? m.defaultValue ?? undefined;
      html += `<div class="s-row" data-setting-key="${key}">`;
      html += `<div class="s-row-info"><div class="s-row-label">${m.label}</div><div class="s-row-desc">${m.desc}</div></div>`;
      html += `<div class="s-row-control">${this._renderControl(key, m, value)}</div>`;
      html += `</div>`;
    }
    return html;
  }

  _renderControl(key, m, value) {
    if (m.type === 'bool') {
      const checked = value === true || value === 1 || value === '1' || value === 'true';
      return `
        <label class="switch">
          <input type="checkbox" data-key="${key}" ${checked ? 'checked' : ''}>
          <span class="slider round"></span>
        </label>
      `;
    }
    if (m.type === 'select') {
      const opts = m.options.map(([val, lbl]) =>
        `<option value="${val}" ${(value ?? '') === val ? 'selected' : ''}>${lbl}</option>`
      ).join('');
      return `<select class="s-select" data-key="${key}">${opts}</select>`;
    }
    if (m.type === 'range') {
      const num = parseFloat(value ?? m.min);
      return `
        <div class="s-range-wrap">
          <input type="range" class="s-range" data-key="${key}" min="${m.min}" max="${m.max}" step="${m.step}" value="${num}" />
          <span class="s-range-value" id="rv_${key}">${num}</span>
        </div>
      `;
    }
    if (m.type === 'number') {
      return `
        <div class="s-number-wrap">
          <input type="number" class="s-input-number" data-key="${key}" value="${value ?? ''}" />
          ${m.unit ? `<span class="s-unit">${m.unit}</span>` : ''}
        </div>
      `;
    }
    // text
    return `<input type="text" class="s-input-text" data-key="${key}" value="${value ?? ''}" placeholder="${m.placeholder || ''}" />`;
  }

  _bindHandlers(container) {
    container.querySelectorAll('[data-key]').forEach(el => {
      const save = async () => {
        const key = el.dataset.key;
        let value;
        if (el.type === 'checkbox') value = el.checked ? '1' : '0';
        else if (el.type === 'range') value = el.value;
        else value = el.value;

        this._allSettings[key] = value;
        await window.api.setSetting(key, value);

        // 글꼴 크기 즉시 반영
        const _fsMap = {
          ui_fs_title: '--fs-title', ui_fs_subtitle: '--fs-subtitle',
          ui_fs_body: '--fs-body', ui_fs_label: '--fs-label', ui_fs_small: '--fs-small',
          ui_fs_sidebar_brand: '--fs-sidebar-brand', ui_fs_sidebar_nav: '--fs-sidebar-nav',
          ui_fs_clock: '--fs-clock', ui_fs_footer: '--fs-footer',
          ui_fs_stat: '--fs-stat',
          ui_fs_count_clock: '--fs-count-clock', ui_fs_count_total: '--fs-count-total',
          ui_fs_count_meal: '--fs-count-meal', ui_fs_count_meal_label: '--fs-count-meal-label',
          ui_fs_card_time: '--fs-card-time', ui_fs_card_name: '--fs-card-name',
          ui_fs_card_remarks: '--fs-card-remarks',
          ui_fs_table_header: '--fs-table-header', ui_fs_table_body: '--fs-table-body',
          ui_fs_toast: '--fs-toast',
        };
        if (_fsMap[key] && value) {
          document.documentElement.style.setProperty(_fsMap[key], value + 'px');
        }

        // 저장 피드백 애니메이션
        const row = el.closest('.s-row');
        if (row) {
          row.classList.add('s-row-saved');
          setTimeout(() => row.classList.remove('s-row-saved'), 600);
        }
      };

      if (el.type === 'checkbox') {
        el.addEventListener('change', save);
      } else if (el.type === 'range') {
        el.addEventListener('input', () => {
          const display = document.getElementById(`rv_${el.dataset.key}`);
          if (display) display.textContent = el.value;
        });
        el.addEventListener('change', save);
      } else {
        el.addEventListener('change', save);
      }
    });
  }

  cleanup() { }
}

/* ---- Setup Wizard Page ---- */
class SetupWizardPage {
  constructor(appInstance) {
    this.app = appInstance;
  }

  render() {
    const el = document.createElement('div');
    el.className = 'fade-in';
    el.innerHTML = `
      <div class="wizard-container">
        <h1>경로식당 관리 시스템</h1>
        <p class="subtitle">초기 설정을 시작하겠습니다</p>
        <div class="wizard-step">
          <p class="step-title">📁 데이터 저장 경로 선택</p>
          <p style="color: var(--text-secondary); margin-bottom: 20px;">데이터베이스와 백업 파일이 저장될 폴더를 선택하세요.</p>
          <div style="display: flex; gap: 8px;">
            <input class="input" id="wizardPath" placeholder="경로를 선택하세요" readonly style="flex: 1;" />
            <button class="btn btn-ghost" id="wizardBrowse">찾아보기</button>
          </div>
          <button class="btn btn-primary" id="wizardComplete" style="margin-top: 24px; width: 100%;" disabled>설정 완료</button>
        </div>
      </div>
    `;
    return el;
  }

  afterRender() {
    document.getElementById('wizardBrowse').addEventListener('click', async () => {
      const folder = await window.api.selectFolder();
      if (folder) {
        document.getElementById('wizardPath').value = folder;
        document.getElementById('wizardComplete').disabled = false;
      }
    });

    document.getElementById('wizardComplete').addEventListener('click', async () => {
      const basePath = document.getElementById('wizardPath').value;
      if (!basePath) return;

      const btn = document.getElementById('wizardComplete');
      btn.disabled = true;
      btn.textContent = '설정 중...';

      const result = await window.api.createDatabase(basePath);
      if (result.success) {
        await app.showAlert('초기 설정 완료', '초기 설정이 완료되었습니다.\n홈 페이지로 이동합니다.', 'info');
        this.app.navigate('home');
      } else {
        await app.showAlert('설정 실패', result.error || '알 수 없는 오류');
        btn.disabled = false;
        btn.textContent = '설정 완료';
      }
    });
  }

  cleanup() { }
}

/* ---- Placeholder ---- */
class PlaceholderPage {
  constructor(name) { this.name = name; }
  render() {
    const el = document.createElement('div');
    el.innerHTML = `<div class="page-loading">${this.name} 페이지 (구현 예정)</div>`;
    return el;
  }
  cleanup() { }
}

/* ================================================================
   Initialize
   ================================================================ */
// ==================== 카드 리더기 웹 콘솔 로거 ====================
// DevTools 필터 박스에 "[카드리더기]" 입력 시 해당 로그만 표시됨
// Verbose 탭에서 상태 로그, Info 탭에서 인식 로그 분리 가능
const cardLog = (() => {
  const TAG   = '[카드리더기]';
  const STYLE_TAG    = 'background:#0e7490;color:#fff;border-radius:3px;padding:1px 6px;font-weight:bold;';
  const STYLE_LABEL  = 'color:#22d3ee;font-weight:bold;';
  const STYLE_VALUE  = 'color:#f0f9ff;';
  const STYLE_RESET  = '';

  return {
    status(msg) {
      // Verbose 레벨 — DevTools 필터에서 "Verbose" 체크 시 표시
      console.debug(`%c${TAG}%c 상태 %c${msg}`, STYLE_TAG, STYLE_LABEL, STYLE_RESET);
    },
    connected(port) {
      console.info(`%c${TAG}%c 연결됨 %c${port}`, STYLE_TAG, STYLE_LABEL, STYLE_VALUE);
    },
    disconnected(reason) {
      console.warn(`%c${TAG}%c 연결 끊김 %c${reason || ''}`, STYLE_TAG, STYLE_LABEL, STYLE_RESET);
    },
    scan(cardNumber, context) {
      // 카드 인식 시 접을 수 있는 그룹으로 표시
      console.groupCollapsed(`%c${TAG}%c 카드 인식 %c${cardNumber}%c  (${context})`, STYLE_TAG, STYLE_LABEL, STYLE_VALUE, STYLE_RESET);
      console.debug('카드번호:', cardNumber);
      console.debug('컨텍스트:', context);
      console.debug('시각:', new Date().toLocaleTimeString('ko-KR'));
      console.groupEnd();
    },
    result(cardNumber, result) {
      if (result && result.success === false) {
        console.warn(`%c${TAG}%c 처리 실패 %c${cardNumber} → ${result.message}`, STYLE_TAG, STYLE_LABEL, STYLE_RESET);
      } else {
        console.debug(`%c${TAG}%c 처리 완료 %c${cardNumber}`, STYLE_TAG, STYLE_LABEL, STYLE_VALUE);
      }
    },
    error(msg, err) {
      console.error(`%c${TAG}%c 오류: ${msg}`, STYLE_TAG, STYLE_RESET, err || '');
    },
  };
})();

/* ============================================================
   Web Console — 앱 내 로그 뷰어
   ============================================================ */
class WebConsole {
  constructor() {
    this.entries = [];
    this.maxEntries = 1000;
    this.filterLevel = 'ALL';
    this.logLevelSetting = 'DEBUG';
    this.LEVELS = { DEBUG: 0, INFO: 1, WARNING: 2, ERROR: 3, CRITICAL: 4 };
    this._isLogging = false;

    this._el = document.getElementById('webConsole');
    this._body = document.getElementById('webConsoleBody');
    this._filterSelect = document.getElementById('webConsoleFilter');

    this._initUI();
    this._interceptConsole();
    this._listenMainProcess();
    this._loadLogLevel();
  }

  _initUI() {
    // 토글 버튼 (footer)
    document.getElementById('footerConsoleBtn').addEventListener('click', () => this.toggle());
    // 닫기 버튼
    document.getElementById('webConsoleToggle').addEventListener('click', () => this.toggle());
    // 지우기
    document.getElementById('webConsoleClear').addEventListener('click', () => this.clear());
    // 필터
    this._filterSelect.addEventListener('change', (e) => {
      this.filterLevel = e.target.value;
      this._rerender();
    });
  }

  toggle() {
    this._el.classList.toggle('collapsed');
  }

  clear() {
    this.entries = [];
    this._body.innerHTML = '';
  }

  async _loadLogLevel() {
    try {
      const level = await window.api.getSetting('log_level', 'DEBUG');
      this.logLevelSetting = level || 'DEBUG';
    } catch (e) { /* default DEBUG */ }
  }

  _interceptConsole() {
    const self = this;
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;
    const origDebug = console.debug;

    console.log = function (...args) {
      origLog.apply(console, args);
      if (!self._isLogging) {
        if (window.api && window.api.log) window.api.log('INFO', ...args);
        self.addEntry('INFO', self._argsToString(args), 'renderer');
      }
    };
    console.warn = function (...args) {
      origWarn.apply(console, args);
      if (!self._isLogging) {
        if (window.api && window.api.log) window.api.log('WARNING', ...args);
        self.addEntry('WARNING', self._argsToString(args), 'renderer');
      }
    };
    console.error = function (...args) {
      origError.apply(console, args);
      if (!self._isLogging) {
        if (window.api && window.api.log) window.api.log('ERROR', ...args);
        self.addEntry('ERROR', self._argsToString(args), 'renderer');
      }
    };
    console.debug = function (...args) {
      origDebug.apply(console, args);
      if (!self._isLogging) {
        self.addEntry('DEBUG', self._argsToString(args), 'renderer');
      }
    };
  }

  _listenMainProcess() {
    if (window.api && window.api.onLogEntry) {
      window.api.onLogEntry((entry) => {
        this.addEntry(entry.level, entry.message, entry.source || 'main', entry.timestamp);
      });
    }
  }

  _argsToString(args) {
    return args.map(a => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' ');
  }

  addEntry(level, message, source, timestamp) {
    // %c 스타일 구문 제거
    message = message.replace(/%c/g, '');

    const lvl = (level || 'INFO').toUpperCase();
    const ts = timestamp || new Date().toISOString().replace('T', ' ').slice(0, 19);

    // 설정 기반 레벨 필터링
    if ((this.LEVELS[lvl] ?? 0) < (this.LEVELS[this.logLevelSetting] ?? 0)) return;

    const entry = { level: lvl, message, source: source || '', timestamp: ts };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) this.entries.shift();

    // UI 필터 통과 시 렌더링
    if (this._passesFilter(entry)) {
      this._renderEntry(entry);
    }
  }

  _passesFilter(entry) {
    if (this.filterLevel === 'ALL') return true;
    return (this.LEVELS[entry.level] ?? 0) >= (this.LEVELS[this.filterLevel] ?? 0);
  }

  _renderEntry(entry) {
    this._isLogging = true;
    const div = document.createElement('div');
    div.className = `log-entry log-${entry.level}`;
    div.innerHTML =
      `<span class="log-time">${entry.timestamp.slice(11)}</span>` +
      `<span class="log-level">${entry.level}</span>` +
      `<span class="log-source">[${entry.source}]</span>` +
      `<span class="log-msg">${this._escapeHtml(entry.message)}</span>`;
    this._body.appendChild(div);

    // 자동 스크롤
    this._body.scrollTop = this._body.scrollHeight;
    this._isLogging = false;
  }

  _escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  _rerender() {
    this._body.innerHTML = '';
    for (const entry of this.entries) {
      if (this._passesFilter(entry)) this._renderEntry(entry);
    }
  }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
  window.webConsole = new WebConsole();
  app = new App();
  window.app = app; // expose to global scope for inline handlers
});
