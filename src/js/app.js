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

  showConfirm(message) {
    return new Promise((resolve) => {
      try {
        console.log(`[showConfirm] message=${message}`);
        const overlay = document.createElement('div');
        overlay.className = 'custom-confirm-overlay';

        const box = document.createElement('div');
        box.className = 'custom-confirm-box';

        const text = document.createElement('p');
        text.textContent = message;

        const actions = document.createElement('div');
        actions.className = 'custom-confirm-actions';

        const btnCancel = document.createElement('button');
        btnCancel.className = 'btn btn-ghost';
        btnCancel.textContent = '취소';

        const btnConfirm = document.createElement('button');
        btnConfirm.className = 'btn btn-primary';
        btnConfirm.textContent = '확인';

        const cleanup = () => {
          overlay.remove();
          // Remove focus so keyboard wedge doesn't accidentally trigger an old button
          document.activeElement?.blur();
        };

        btnCancel.onclick = () => { console.log('Confirm Canceled'); cleanup(); resolve(false); };
        btnConfirm.onclick = () => { console.log('Confirm OK'); cleanup(); resolve(true); };

        actions.appendChild(btnCancel);
        actions.appendChild(btnConfirm);
        box.appendChild(text);
        box.appendChild(actions);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        console.log(`[showConfirm] DOM 구성 완료`);
      } catch (e) {
        console.error('showConfirm 에러:', e);
        resolve(false); // fallback
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
  }

  render() {
    const el = document.createElement('div');
    el.className = 'fade-in';
    el.style.cssText = 'display: flex; flex-direction: column; height: 100%; overflow: hidden;';
    el.innerHTML = `
      <div class="grid-4" style="margin-bottom: 16px; flex-shrink: 0;">
        <div class="stat-card cyan">
          <div class="card-icon">🕐</div>
          <div class="card-value" id="countClock" style="font-size: 32px;">--:--:--</div>
          <div class="card-label">현재 시각</div>
        </div>
        <div class="stat-card blue">
          <div class="card-icon">👥</div>
          <div class="card-value" id="countTotal">0</div>
          <div class="card-label">총 이용</div>
        </div>
        <div class="stat-card green" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div class="card-icon">🍚</div>
          <div class="card-value" style="font-size: 24px;">
            <span id="countNormal" style="color: var(--chart-green);">0</span>
            <span style="color: var(--text-muted); font-size: 14px; margin: 0 8px;">|</span>
            <span id="countPorridge" style="color: var(--chart-red);">0</span>
          </div>
          <div class="card-label">일반식 | 죽식</div>
          <!-- 일괄 죽식 토글 -->
          <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
            <span style="font-size: 11px; font-weight: 700; color: var(--chart-red);">일괄 죽식</span>
            <label class="switch" style="transform: scale(0.8);">
              <input type="checkbox" id="toggleAllPorridge">
              <span class="slider round"></span>
            </label>
          </div>
        </div>
        <div class="stat-card purple">
          <div class="card-icon">🎫</div>
          <div class="card-value" id="countTicket">0</div>
          <div class="card-label">식권</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 7fr 3fr; gap: 16px; flex: 1; min-height: 0;">
        <div style="background: var(--card-bg); border-radius: var(--radius-md); padding: 16px; display: flex; flex-direction: column; min-height: 0;">
          <h3 class="section-title" style="flex-shrink: 0;">오늘의 이용 현황</h3>
          <div id="usageList" style="flex: 1; overflow-y: auto; min-height: 0;"></div>
        </div>
        <div class="search-panel" style="display: flex; flex-direction: column; min-height: 0;">
          <h3 style="font-weight: 600; margin-bottom: 8px; flex-shrink: 0;">사용자 검색</h3>
          <div class="search-input-wrapper" style="flex-shrink: 0;">
            <span class="search-icon">🔍</span>
            <input class="input" id="countSearch" placeholder="번호 또는 이름 검색..." />
          </div>
          <div id="countSearchResults" class="search-results" style="flex: 1; overflow-y: auto; min-height: 0; margin-top: 8px;"></div>
        </div>
      </div>
    `;
    return el;
  }

  async afterRender() {
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
            await this._cancelEvent(eventId);
          } else if (action === 'change-menu') {
            await this._changeMenu(eventId, nextMenu);
          }
        } catch (error) {
          await window.api.showError('버튼 클릭 오류', error.message + '\n' + error.stack);
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

    // Global Keyboard Wedge Listener (Card Scanner)
    this._wedgeBuffer = '';
    this._wedgeTimeout = null;
    this._handleGlobalKeydown = async (e) => {
      if (e.key === 'Enter') {
        // If they pressed enter in the search field or completed a rapid scan
        const val = this._wedgeBuffer.trim() || searchInput.value.trim();
        if (val) {
          e.preventDefault();
          this._wedgeBuffer = '';
          searchInput.value = '';
          await this._processCheckIn(val);
        }
      } else if (e.key.length === 1) {
        // Only buffer rapid keystrokes (typical wedge scanner behavior: <50ms between keys)
        this._wedgeBuffer += e.key;
        clearTimeout(this._wedgeTimeout);
        this._wedgeTimeout = setTimeout(() => { this._wedgeBuffer = ''; }, 100);
      }
    };
    document.addEventListener('keydown', this._handleGlobalKeydown);
  }

  async _refreshData() {
    try {
      await this._updateStatsUIOnly();
      const events = await window.api.getTodayEvents();
      this._renderEvents(events);
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

    const html = `
      <div class="${cls}">
        <span class="time">${time}</span>
        <span class="name">${isTicket ? '🎫 식권' : `${event.number || ''} ${event.name || ''}`}</span>
        <div class="badge-col">${badge}</div>
        <div class="actions">
          ${actions}
        </div>
      </div>
    `;

    container.insertAdjacentHTML('afterbegin', html);
  }

  _renderEvents(events) {
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

    const html = displayEvents.slice(0, 50).map(event => {
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

      return `
        <div class="${cls}">
          <span class="time">${time}</span>
          <span class="name">${isTicket ? '🎫 식권' : `${event.number || ''} ${event.name || ''}`}</span>
          <div class="badge-col">${badge}</div>
          <div class="actions">
            ${actions}
          </div>
        </div>
      `;
    }).join('');

    const savedScrollTop = container.scrollTop;
    container.innerHTML = html;

    // 복원 시 약간의 딜레이를 주어 렌더링 후 스크롤이 적용되도록 함
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
      await window.api.showError('메뉴 변경 오류', e.message);
    }
  }

  async _cancelEvent(eventId) {
    try {
      console.log(`[_cancelEvent] Start for eventId=${eventId}`);
      const confirmed = await app.showConfirm('해당 사용자의 오늘자 이용 기록이 모두 삭제됩니다. 계속하시겠습니까?');
      console.log(`[_cancelEvent] Confirmed? ${confirmed}`);
      if (confirmed) {
        console.log(`[_cancelEvent] Calling API...`);
        const result = await window.api.cancelEventById(eventId);
        console.log(`[_cancelEvent] API Result:`, result);
        if (result && result.success === false) throw new Error(result.message);
        app.showToast('오늘자 전체 이용 기록이 취소되었습니다.', 'warning');
        await this._refreshData();
      }
    } catch (e) {
      console.error(`[_cancelEvent] 에러:`, e);
      await window.api.showError('체크인 취소 오류', e.message);
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
      <p style="color: var(--text-muted); font-size: 11px; padding: 4px 12px;">활성 사용자 ${users.length}명 — 클릭하여 체크인</p>
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

  async _processCheckIn(userNumber) {
    try {
      console.log(`[CountPage] 체크인 시도: userNumber=${userNumber}`);
      const user = await window.api.getUserByNumber(userNumber);
      console.log(`[CountPage] getUserByNumber 결과:`, user);
      if (!user) {
        console.warn(`[CountPage] 미등록 사용자: ${userNumber}`);
        window.app.showToast('등록되지 않은 사용자입니다', 'error');
        if (window.speechSynthesis) {
          const u = new SpeechSynthesisUtterance('등록되지 않은 사용자입니다');
          u.lang = 'ko-KR';
          window.speechSynthesis.speak(u);
        }
        return;
      }

      const isAllPorridge = document.getElementById('toggleAllPorridge')?.checked;
      const menuType = isAllPorridge ? '죽식' : '일반식';

      console.log(`[CountPage] checkIn 호출: userId=${user.id}, name=${user.name}, menuType=${menuType}`);
      const result = await window.api.checkIn(user.id, menuType, 'manual', null);
      console.log(`[CountPage] checkIn 결과:`, result);
      if (result.success) {
        if (result.isRecentDuplicate) {
          window.app.showToast(`${user.name}님 5분 이내 중복 시도입니다⚠️`, 'warning');
          if (window.speechSynthesis) {
            const u = new SpeechSynthesisUtterance(`${user.name}님 5분 이내 반복 수령 시도입니다`);
            u.lang = 'ko-KR';
            window.speechSynthesis.speak(u);
          }
          // DO NOT refresh data for recent duplicates
        } else {
          if (result.count > 1) {
            window.app.showToast(`${user.name}님 ${menuType} 중복입니다⚠️`, 'warning');
          } else {
            window.app.showToast(`${user.name}님 확인되었습니다`, 'success');
          }

          if (window.speechSynthesis) {
            const text = result.count > 1
              ? `${user.name}님 ${menuType} 중복입니다`
              : `${user.name}님 ${menuType} 첫 수령입니다`;
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'ko-KR';
            window.speechSynthesis.speak(u);
          }

          if (result.event) {
            this._appendSingleEventToUI(result.event, result.count > 1);
            await this._updateStatsUIOnly();
          } else {
            // 안전장치
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

    // Card Scanner Wedge Listener
    this._wedgeBuffer = '';
    this._wedgeTimeout = null;
    this._handleGlobalKeydown = async (e) => {
      // 모달이 열려있으면 웨지 무시
      if (document.querySelector('.modal-overlay')) return;

      if (e.key === 'Enter') {
        const val = this._wedgeBuffer.trim();
        if (val) {
          e.preventDefault();
          this._wedgeBuffer = '';
          await this._handleCardScan(val);
        }
      } else if (e.key.length === 1) {
        this._wedgeBuffer += e.key;
        clearTimeout(this._wedgeTimeout);
        this._wedgeTimeout = setTimeout(() => { this._wedgeBuffer = ''; }, 100);
      }
    };
    document.addEventListener('keydown', this._handleGlobalKeydown);

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
        const resp = await window.api.showMessage({
          type: 'warning',
          buttons: ['취소', '종결'],
          defaultId: 0,
          title: '사용자 종결',
          message: '이 사용자를 종결하시겠습니까?'
        });
        if (resp !== 1) return;
        result = await window.api.terminateUser(userId);
      } else if (action === 'reactivate') {
        result = await window.api.reactivateUser(userId);
      } else if (action === 'edit') {
        await this._showEditUserDialog(userId);
        return;
      }

      if (result && !result.success) {
        await window.api.showError('오류', result.message);
      }
      await this._loadUsers(document.getElementById('editSearch')?.value || '');
    } catch (e) {
      await window.api.showError('오류', e.message);
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
                  await window.api.showError('카드 변경 실패', result.message);
                }
              } catch (e) {
                await window.api.showError('오류', e.message);
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

    // prefillCard가 있으면 카드 필드에 pre-fill
    if (prefillCard) {
      document.getElementById('addCard').value = prefillCard;
    }

    overlay.querySelector('#addCardClear').addEventListener('click', () => {
      document.getElementById('addCard').value = '';
      document.getElementById('addCard').focus();
    });

    overlay.querySelector('#addCancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#addConfirm').addEventListener('click', async () => {
      const number = document.getElementById('addNumber').value.trim();
      const name = document.getElementById('addName').value.trim();
      const cardNumber = document.getElementById('addCard').value.trim();
      const notes = document.getElementById('addNotes').value.trim();
      if (!number || !name) {
        await window.api.showError('입력 오류', '번호와 이름은 필수입니다.');
        return;
      }

      // 카드 번호 중복 확인
      if (cardNumber) {
        const existingOwner = await window.api.getCardOwnerInfo(cardNumber);
        if (existingOwner) {
          const statusText = existingOwner.status === 'suspended' ? ' (일시정지)' : '';
          const resp = await window.api.showMessage({
            type: 'question',
            buttons: ['취소', '이전'],
            defaultId: 0,
            title: '카드 번호 중복',
            message: `이미 사용 중인 카드 번호입니다.\n\n현재 소유자: ${existingOwner.number} ${existingOwner.name}${statusText}\n\n이 카드를 새 사용자에게 이전하시겠습니까?`
          });
          if (resp !== 1) return;

          // 사용자 먼저 생성 (카드 없이)
          const createResult = await window.api.addUser(number, name, notes || null, null);
          if (!createResult.success) {
            await window.api.showError('추가 실패', createResult.message);
            return;
          }
          // 카드 이전
          const transferResult = await window.api.transferCard(cardNumber, createResult.userId, `신규 등록 시 이전 (#${number} ${name})`);
          if (!transferResult.success) {
            await window.api.showError('카드 이전 실패', transferResult.message);
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
        window.app.showToast('새 사용자가 추가되었습니다', 'success');
        await this._loadUsers();
      } else {
        await window.api.showError('추가 실패', result.message);
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
            <div style="display: flex; align-items: center; gap: 12px; background: var(--bg-medium); border-radius: var(--radius-sm); padding: 12px 16px;">
              <label class="switch">
                <input type="checkbox" id="editSuspended" ${user.status === 'suspended' ? 'checked' : ''}>
                <span class="slider"></span>
              </label>
              <span style="font-size: 13px;">일시정지 상태</span>
            </div>
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

    overlay.querySelector('#editCancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#editConfirm').addEventListener('click', async () => {
      const name = document.getElementById('editName').value.trim();
      const notes = document.getElementById('editNotes').value.trim();
      const newCardNumber = document.getElementById('editCard').value.trim();
      const isSuspended = document.getElementById('editSuspended').checked;

      // 1. 기본 정보 업데이트
      const result = await window.api.updateUser(userId, name, notes);
      if (!result.success) {
        await window.api.showError('수정 실패', result.message);
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
            const resp = await window.api.showMessage({
              type: 'question',
              buttons: ['취소', '이전'],
              defaultId: 0,
              title: '카드 번호 중복',
              message: `이미 사용 중인 카드 번호입니다.\n\n현재 소유자: ${existingOwner.number} ${existingOwner.name}${statusText}\n\n이 카드를 ${user.name}에게 이전하시겠습니까?`
            });
            if (resp !== 1) return;

            const transferResult = await window.api.transferCard(newCardNumber, userId, '사용자 정보 수정 중 이전');
            if (!transferResult.success) {
              await window.api.showError('카드 이전 실패', transferResult.message);
              return;
            }
          } else if (!existingOwner || existingOwner.id === userId) {
            // 재발급 처리
            const reissueResult = await window.api.reissueCard(userId, newCardNumber, '사용자 정보 수정 (재등록)');
            if (!reissueResult.success) {
              await window.api.showError('카드 재발급 실패', reissueResult.message);
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
    if (this._handleGlobalKeydown) {
      document.removeEventListener('keydown', this._handleGlobalKeydown);
    }
  }
}

/* ---- Special Remarks Page ---- */
class SpecialRemarksPage {
  render() {
    const el = document.createElement('div');
    el.className = 'fade-in';
    el.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
        <h2 class="section-title" style="margin: 0;">특이사항 관리</h2>
        <button class="btn btn-primary btn-sm" id="addRemarkBtn">+ 특이사항 추가</button>
      </div>
      <div id="remarksList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;"></div>
    `;
    return el;
  }

  async afterRender() {
    document.getElementById('addRemarkBtn').addEventListener('click', () => this._showAddDialog());
    await this._loadRemarks();
  }

  async _loadRemarks() {
    const container = document.getElementById('remarksList');
    if (!container) return;

    try {
      const remarks = await window.api.getAllSpecialRemarks();
      if (remarks.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 40px;">등록된 특이사항이 없습니다</p>';
        return;
      }

      const icons = { '알러지': '🌰', '휠체어': '♿', '채식': '🥗', '할랄': '☪', '저염식': '🧂', '당뇨': '💉', '기타': '🏷️' };

      // 각 특이사항 배정 인원 수 병렬 조회
      const userCounts = await Promise.all(
        remarks.map(r => window.api.getUsersForRemark(r.id).then(u => u.length).catch(() => 0))
      );

      container.innerHTML = remarks.map((r, i) => {
        const icon = icons[r.name] || '📌';
        const count = userCounts[i];
        return `
          <div class="stat-card remark-card" data-remark-id="${r.id}"
            style="background: var(--card-bg); text-align: left; padding: 0; cursor: pointer;
              border-radius: var(--radius-md); overflow: hidden; transition: transform 0.15s, box-shadow 0.15s;"
            onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(0,212,255,0.15)'"
            onmouseout="this.style.transform='';this.style.boxShadow=''">
            <!-- 카드 바디 -->
            <div style="padding: 18px 20px 14px;">
              <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;">
                <span style="font-size: 26px; line-height: 1; flex-shrink: 0;">${icon}</span>
                <span class="badge ${r.is_active ? 'badge-active' : 'badge-terminated'}" style="font-size: 10px; margin-top: 2px;">
                  ${r.is_active ? '활성' : '비활성'}
                </span>
              </div>
              <h3 style="font-size: 15px; font-weight: 700; margin: 10px 0 4px;">${r.name}</h3>
              <p style="color: var(--text-muted); font-size: 11px; margin: 0; min-height: 14px; line-height: 1.4;">
                ${r.description || ''}
              </p>
            </div>
            <!-- 카드 푸터 -->
            <div style="padding: 8px 20px; background: var(--bg-medium); border-top: 1px solid var(--divider);
              display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 12px; color: var(--text-muted);">👤</span>
              <span style="font-size: 12px; font-weight: 600; color: ${count > 0 ? 'var(--accent-cyan)' : 'var(--text-muted)'};">
                ${count}명 배정됨
              </span>
              <span style="margin-left: auto; font-size: 11px; color: var(--text-dim);">클릭하여 관리 →</span>
            </div>
          </div>
        `;
      }).join('');

      // 카드 클릭 → 상세 다이얼로그
      container.querySelectorAll('.remark-card').forEach(card => {
        card.addEventListener('click', () => {
          const remark = remarks.find(r => r.id === parseInt(card.dataset.remarkId));
          if (remark) this._showRemarkDetailDialog(remark);
        });
      });
    } catch (e) {
      container.innerHTML = `<p style="color: var(--error);">오류: ${e.message}</p>`;
    }
  }

  async _showRemarkDetailDialog(remark) {
    const icons = { '알러지': '🌰', '휠체어': '♿', '채식': '🥗', '할랄': '☪', '저염식': '🧂', '당뇨': '💉', '기타': '🏷️' };
    const icon = icons[remark.name] || '📌';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="width: 760px; max-width: 90vw; max-height: 85vh; display: flex; flex-direction: column; padding: 0; overflow: hidden;">

        <!-- 헤더 -->
        <div style="padding: 20px 24px 16px; border-bottom: 1px solid var(--divider); flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 28px; line-height: 1;">${icon}</span>
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <h3 style="margin: 0; font-size: 18px;">${remark.name}</h3>
                <span class="badge ${remark.is_active ? 'badge-active' : 'badge-terminated'}" style="font-size: 11px;">
                  ${remark.is_active ? '활성' : '비활성'}
                </span>
              </div>
              ${remark.description ? `<p style="margin: 4px 0 0; font-size: 12px; color: var(--text-muted);">${remark.description}</p>` : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button class="btn btn-ghost btn-sm" id="remarkEditBtn" style="font-size: 12px;">✏️ 수정</button>
              <button class="btn-icon" id="remarkDetailClose" title="닫기" style="font-size: 18px; color: var(--text-muted);">✕</button>
            </div>
          </div>
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

    const close = () => overlay.remove();
    overlay.querySelector('#remarkDetailClose').addEventListener('click', close);
    overlay.querySelector('#remarkDetailCloseBtn').addEventListener('click', close);

    overlay.querySelector('#remarkEditBtn').addEventListener('click', () => {
      this._showRemarkEditDialog(remark, async (updated) => {
        overlay.remove();
        await this._loadRemarks();
        // 수정된 내용으로 다이얼로그 다시 열기
        this._showRemarkDetailDialog(updated);
      });
    });

    overlay.querySelector('#remarkDeleteBtn').addEventListener('click', async () => {
      const resp = await window.api.showMessage({
        type: 'warning', buttons: ['취소', '삭제'], defaultId: 0,
        title: '특이사항 삭제', message: `"${remark.name}" 을(를) 삭제하시겠습니까?\n배정된 사용자 정보도 모두 해제됩니다.`
      });
      if (resp === 1) {
        await window.api.deleteSpecialRemark(remark.id);
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
        await window.api.showError('수정 실패', result.message);
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
      const result = await window.api.addSpecialRemark(name, overlay.querySelector('#remarkDesc').value.trim(), 0, null, null, 1);
      if (result.success) { overlay.remove(); await this._loadRemarks(); }
      else { await window.api.showError('추가 실패', result.message); }
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
  render() {
    const el = document.createElement('div');
    el.className = 'fade-in';
    el.innerHTML = `<div id="settingsContainer">로딩 중...</div>`;
    return el;
  }

  async afterRender() {
    try {
      const allSettings = await window.api.getAllSettings();
      const container = document.getElementById('settingsContainer');

      const groups = {
        '일반': ['dark_mode', 'duplicate_highlight_duration', 'max_search_results'],
        '하드웨어': ['com_port', 'baud_rate', 'scan_interval', 'card_debounce_time'],
        '음성 안내 (TTS)': ['tts_enabled', 'tts_rate', 'tts_volume', 'tts_anonymous', 'tts_read_normal', 'tts_read_porridge', 'tts_read_remarks', 'tts_read_duplicate'],
        '백업': ['auto_backup', 'backup_interval', 'max_backups'],
        '로깅': ['log_level', 'log_retention_days'],
      };

      const labels = {
        dark_mode: '다크 모드', duplicate_highlight_duration: '중복 강조 시간 (초)',
        max_search_results: '검색 결과 표시 개수', com_port: 'COM 포트',
        baud_rate: '전송 속도', scan_interval: '스캔 간격 (초)',
        card_debounce_time: '카드 중복 방지 시간 (초)', tts_enabled: 'TTS 활성화',
        tts_rate: 'TTS 속도', tts_volume: 'TTS 볼륨', tts_anonymous: '음성 익명화',
        tts_read_normal: '일반식 읽기', tts_read_porridge: '죽식 읽기',
        tts_read_remarks: '특이사항 읽기', tts_read_duplicate: '중복 이용 읽기',
        auto_backup: '자동 백업', backup_interval: '백업 주기',
        max_backups: '최대 백업 개수', log_level: '로그 레벨',
        log_retention_days: '로그 보관 기간 (일)',
      };

      const boolKeys = new Set(['dark_mode', 'tts_enabled', 'tts_anonymous', 'tts_read_normal', 'tts_read_porridge', 'tts_read_remarks', 'tts_read_duplicate', 'auto_backup']);

      let html = '';
      for (const [groupName, keys] of Object.entries(groups)) {
        html += `<div class="settings-group"><h3>${groupName}</h3>`;
        for (const key of keys) {
          const value = allSettings[key];
          const label = labels[key] || key;
          if (boolKeys.has(key)) {
            const checked = value === true || value === 1 || value === '1' || value === 'true';
            html += `
              <div class="setting-row">
                <span class="setting-label">${label}</span>
                <label class="switch">
                  <input type="checkbox" data-key="${key}" ${checked ? 'checked' : ''}>
                  <span class="slider"></span>
                </label>
              </div>
            `;
          } else {
            html += `
              <div class="setting-row">
                <span class="setting-label">${label}</span>
                <input class="input" style="width: 200px;" data-key="${key}" value="${value ?? ''}" />
              </div>
            `;
          }
        }
        html += '</div>';
      }

      container.innerHTML = html;

      // Event handlers
      container.querySelectorAll('input[data-key]').forEach(input => {
        const handler = async () => {
          const key = input.dataset.key;
          const value = input.type === 'checkbox' ? (input.checked ? '1' : '0') : input.value;
          await window.api.setSetting(key, value);
        };
        if (input.type === 'checkbox') {
          input.addEventListener('change', handler);
        } else {
          input.addEventListener('change', handler);
        }
      });
    } catch (e) {
      document.getElementById('settingsContainer').innerHTML = `<p style="color: var(--error);">설정 로드 실패: ${e.message}</p>`;
    }
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
        await window.api.showMessage({
          type: 'info',
          buttons: ['확인'],
          title: '초기 설정 완료',
          message: '초기 설정이 완료되었습니다.\n홈 페이지로 이동합니다.'
        });
        this.app.navigate('home');
      } else {
        await window.api.showError('설정 실패', result.error || '알 수 없는 오류');
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
let app;
document.addEventListener('DOMContentLoaded', () => {
  const oldLog = console.log;
  console.log = (...args) => {
    oldLog.apply(console, args);
    if (window.api && window.api.log) window.api.log('INFO', ...args);
  };
  const oldError = console.error;
  console.error = (...args) => {
    oldError.apply(console, args);
    if (window.api && window.api.log) window.api.log('ERROR', ...args);
  };

  app = new App();
  window.app = app; // expose to global scope for inline handlers
});
