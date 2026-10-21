// Enable a navigation item only after its destination page is implemented.
export const navigationItems = Object.freeze([
  { id: 'tasks', label: '待辦事項', href: null, available: false },
  { id: 'habits', label: '習慣打卡', href: null, available: false },
  { id: 'reading', label: '陪讀系統', href: null, available: false },
  { id: 'wallet', label: '錢包帳本', href: null, available: false },
  { id: 'companion', label: '我的夥伴', href: null, available: false },
  { id: 'profile', label: '我的資料', href: null, available: false },
  { id: 'chat', label: '聊天室', href: null, available: false },
  { id: 'settings', label: '設定', href: null, available: false },
].map(Object.freeze));

export function isCurrentRoute(href, locationURL) {
  if (!href) return false;
  const target = new URL(href, locationURL);
  const current = new URL(locationURL);
  const normalize = (path) => path.replace(/index\.html$/, '');
  return target.origin === current.origin && normalize(target.pathname) === normalize(current.pathname);
}

export function initializeNavigation({ undoManager, onUndoSuccess = () => {}, onBusyChange = () => {} }) {
  const desktopLinks = document.querySelector('#desktop-links');
  const mobileLinks = document.querySelector('#mobile-links');
  const toggle = document.querySelector('#navigation-toggle');
  const feedback = document.querySelector('#operation-status');
  const mobileBar = document.querySelector('.mobile-navigation');
  const undoButtons = [...document.querySelectorAll('[data-undo]')];
  let expanded = false;
  try { expanded = sessionStorage.getItem('life-system.navigation-expanded') === 'true'; } catch { /* Optional preference storage. */ }

  const revealCurrent = (nav) => {
    const current = nav.querySelector('[aria-current="page"]');
    if (current && nav.getClientRects().length) current.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const build = (nav) => {
    const list = document.createElement('div');
    list.className = 'navigation-list';
    navigationItems.forEach((item) => {
      const element = document.createElement(item.available ? 'a' : 'span');
      element.className = 'navigation-item';
      element.textContent = item.label;
      if (item.available) {
        element.href = item.href;
        if (isCurrentRoute(item.href, window.location.href)) element.setAttribute('aria-current', 'page');
        element.addEventListener('click', (event) => {
          // Clicking the current page does not reload and discard demo state.
          if (isCurrentRoute(item.href, window.location.href)) event.preventDefault();
        });
      } else {
        element.setAttribute('role', 'link');
        element.setAttribute('aria-disabled', 'true');
        element.tabIndex = 0;
        const unavailable = document.createElement('span');
        unavailable.className = 'navigation-unavailable';
        unavailable.textContent = '（未開放）';
        element.append(unavailable);
      }
      element.addEventListener('focus', () => element.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
      list.append(element);
    });
    nav.replaceChildren(list);
    revealCurrent(nav);
  };
  const refreshRoutes = () => { build(desktopLinks); build(mobileLinks); };
  refreshRoutes();
  window.addEventListener('popstate', refreshRoutes);
  window.addEventListener('pageshow', refreshRoutes);

  const setExpanded = () => {
    desktopLinks.hidden = !expanded;
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', expanded ? '收合導覽選項' : '展開導覽選項');
    if (expanded) revealCurrent(desktopLinks);
  };
  toggle.addEventListener('click', () => {
    expanded = !expanded;
    try { sessionStorage.setItem('life-system.navigation-expanded', String(expanded)); } catch { /* Preference is optional. */ }
    setExpanded();
  });
  setExpanded();
  undoManager.subscribe(({ available, busy }) => {
    undoButtons.forEach((button) => {
      button.disabled = !available;
      button.setAttribute('aria-busy', String(busy));
    });
    onBusyChange(busy);
  });
  undoButtons.forEach((button) => button.addEventListener('click', async () => {
    const result = await undoManager.undo();
    if (result.reason === 'unavailable') return;
    feedback.hidden = false;
    if (result.ok) {
      onUndoSuccess();
      feedback.textContent = `已撤銷「${result.label}」。`;
    } else {
      feedback.textContent = result.error?.message || '撤銷失敗，請重試。';
    }
  }));
  mobileBar.hidden = false;
  document.body.dataset.navigation = 'ready';
  const updateBarHeight = () => {
    document.documentElement.style.setProperty('--bottom-nav-height', `${mobileBar.getBoundingClientRect().height}px`);
  };
  new ResizeObserver(updateBarHeight).observe(mobileBar);
  updateBarHeight();
}
