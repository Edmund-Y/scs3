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
    ` + users.slice(0, 100).map(u => `
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
    el.innerHTML = `
      <div style="display: flex; gap: 12px; margin-bottom: 16px; align-items: center;">
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

      <div style="background: var(--card-bg); border-radius: var(--radius-md); overflow: hidden;">
        <div style="overflow-y: auto; max-height: calc(100vh - 260px);">
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

  _showAddUserDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h3>사용자 추가</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 4px;">번호</label>
            <input class="input" id="addNumber" placeholder="사용자 번호" />
          </div>
          <div>
            <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 4px;">이름</label>
            <input class="input" id="addName" placeholder="사용자 이름" />
          </div>
          <div>
            <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 4px;">비고</label>
            <input class="input" id="addNotes" placeholder="비고 (선택)" />
          </div>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 20px; justify-content: flex-end;">
          <button class="btn btn-ghost" id="addCancel">취소</button>
          <button class="btn btn-primary" id="addConfirm">추가</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#addCancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#addConfirm').addEventListener('click', async () => {
      const number = document.getElementById('addNumber').value.trim();
      const name = document.getElementById('addName').value.trim();
      const notes = document.getElementById('addNotes').value.trim();
      if (!number || !name) {
        await window.api.showError('입력 오류', '번호와 이름은 필수입니다.');
        return;
      }
      const result = await window.api.addUser(number, name, notes || null);
      if (result.success) {
        overlay.remove();
        await this._loadUsers();
      } else {
        await window.api.showError('추가 실패', result.message);
      }
    });
  }

  async _showEditUserDialog(userId) {
    const user = await window.api.getUserById(userId);
    if (!user) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h3>사용자 수정 — ${user.number}</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 4px;">이름</label>
            <input class="input" id="editName" value="${user.name || ''}" />
          </div>
          <div>
            <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 4px;">비고</label>
            <input class="input" id="editNotes" value="${user.notes || ''}" />
          </div>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 20px; justify-content: flex-end;">
          <button class="btn btn-ghost" id="editCancel">취소</button>
          <button class="btn btn-primary" id="editConfirm">저장</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#editCancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#editConfirm').addEventListener('click', async () => {
      const name = document.getElementById('editName').value.trim();
      const notes = document.getElementById('editNotes').value.trim();
      const result = await window.api.updateUser(userId, name, notes);
      if (result.success) {
        overlay.remove();
        await this._loadUsers();
      } else {
        await window.api.showError('수정 실패', result.message);
      }
    });
  }

  cleanup() {
    clearTimeout(this._searchTimeout);
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

      container.innerHTML = remarks.map(r => {
        const icon = icons[r.name] || '📌';
        return `
          <div class="stat-card" style="background: var(--card-bg); text-align: left; padding: 20px; cursor: pointer;" data-remark-id="${r.id}">
            <div style="display: flex; justify-content: space-between; align-items: start;">
              <div>
                <span style="font-size: 24px;">${icon}</span>
                <h3 style="font-size: 16px; font-weight: 600; margin-top: 8px;">${r.name}</h3>
                ${r.description ? `<p style="color: var(--text-muted); font-size: 12px; margin-top: 4px;">${r.description}</p>` : ''}
              </div>
              <button class="btn-icon delete-remark" data-id="${r.id}" title="삭제">🗑️</button>
            </div>
            <div style="margin-top: 8px;">
              <span class="badge ${r.is_active ? 'badge-active' : 'badge-terminated'}">${r.is_active ? '활성' : '비활성'}</span>
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.delete-remark').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const resp = await window.api.showMessage({
            type: 'warning', buttons: ['취소', '삭제'], defaultId: 0,
            title: '특이사항 삭제', message: '이 특이사항을 삭제하시겠습니까?'
          });
          if (resp === 1) {
            await window.api.deleteSpecialRemark(parseInt(btn.dataset.id));
            await this._loadRemarks();
          }
        });
      });
    } catch (e) {
      container.innerHTML = `<p style="color: var(--error);">오류: ${e.message}</p>`;
    }
  }

  _showAddDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h3>특이사항 추가</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <input class="input" id="remarkName" placeholder="이름 (예: 알러지)" />
          <input class="input" id="remarkDesc" placeholder="설명 (선택)" />
        </div>
        <div style="display: flex; gap: 8px; margin-top: 20px; justify-content: flex-end;">
          <button class="btn btn-ghost" id="remarkCancel">취소</button>
          <button class="btn btn-primary" id="remarkConfirm">추가</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#remarkCancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#remarkConfirm').addEventListener('click', async () => {
      const name = document.getElementById('remarkName').value.trim();
      if (!name) { await window.api.showError('오류', '이름을 입력하세요.'); return; }
      const result = await window.api.addSpecialRemark(name, document.getElementById('remarkDesc').value.trim(), 0, null, null, 1);
      if (result.success) { overlay.remove(); await this._loadRemarks(); }
      else { await window.api.showError('추가 실패', result.message); }
    });
  }

  cleanup() { }
}

/* ---- Dashboard Page ---- */
class DashboardPage {
  render() {
    const el = document.createElement('div');
    el.className = 'fade-in';
    el.innerHTML = `
      <div class="grid-4" id="dashStats" style="margin-bottom: 24px;"></div>
      <div style="background: var(--card-bg); border-radius: var(--radius-md); padding: 24px;">
        <h3 class="section-title">사용자 현황</h3>
        <div id="dashContent" style="color: var(--text-muted);">로딩 중...</div>
      </div>
    `;
    return el;
  }

  async afterRender() {
    try {
      const stats = await window.api.getUserStatistics();
      document.getElementById('dashStats').innerHTML = `
        <div class="stat-card blue">
          <div class="card-value">${stats.total || 0}</div>
          <div class="card-label">전체 사용자</div>
        </div>
        <div class="stat-card green">
          <div class="card-value">${stats.active || 0}</div>
          <div class="card-label">활성</div>
        </div>
        <div class="stat-card" style="background: var(--card-bg);">
          <div class="card-value" style="color: var(--warning);">${stats.suspended || 0}</div>
          <div class="card-label">일시정지</div>
        </div>
        <div class="stat-card red">
          <div class="card-value">${stats.terminated || 0}</div>
          <div class="card-label">종결</div>
        </div>
      `;
      document.getElementById('dashContent').textContent = '통계 대시보드가 로드되었습니다. (차트 기능은 추후 업데이트)';
    } catch (e) {
      document.getElementById('dashContent').textContent = `오류: ${e.message}`;
    }
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
