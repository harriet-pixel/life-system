// Enable a navigation item only after its destination page is implemented.
export const navigationItems = Object.freeze([
  { id: 'home', label: '首頁', englishLabel: 'Home', href: new URL('../', import.meta.url).href, available: true },
  { id: 'tasks', label: '待辦事項', href: null, available: false },
  { id: 'habits', label: '習慣打卡', href: null, available: false },
  { id: 'reading', label: '陪讀系統', href: null, available: false },
  { id: 'wallet', label: '錢包帳本', href: null, available: false },
  { id: 'companion', label: '我的夥伴', href: null, available: false },
  { id: 'profile', label: '我的資料', englishLabel: 'My Profile', href: new URL('../profile.html', import.meta.url).href, available: true },
  { id: 'chat', label: '聊天室', href: null, available: false },
  { id: 'settings', label: '設定', englishLabel:'Settings', href: new URL('../settings.html', import.meta.url).href, available: true },
].map(Object.freeze));

export function isCurrentRoute(href, locationURL) {
  if (!href) return false;
  const target = new URL(href, locationURL);
  const current = new URL(locationURL);
  const normalize = (path) => path.replace(/index\.html$/, '');
  return target.origin === current.origin && normalize(target.pathname) === normalize(current.pathname);
}

export function initializeNavigation({ undoManager, onUndoSuccess = () => {}, onRedoSuccess = () => {}, onBusyChange = () => {} }) {
  const desktopLinks = document.querySelector('#desktop-links');
  const mobileLinks = document.querySelector('#mobile-links');
  const feedback=()=>document.querySelector('#operation-status');
  const mobileBar = document.querySelector('.mobile-navigation');
  const undoButtons = [...document.querySelectorAll('[data-undo]')];
  const redoButtons = undoButtons.map(undo => {
    const redo = undo.cloneNode(true); redo.removeAttribute('data-undo'); redo.setAttribute('data-redo','');
    redo.classList.replace('undo-button','redo-button');
    redo.querySelector('path').setAttribute('d','m15 5 6 6-6 6M21 11H11a7 7 0 0 0-7 7');
    redo.setAttribute('aria-label','目前沒有可恢復的操作'); redo.title='目前沒有可恢復的操作';
    undo.after(redo); return redo;
  });
  let pending = false;
  const revealCurrent = (nav) => {
    const current = nav.querySelector('[aria-current="page"]');
    if (current && nav.getClientRects().length) nav.scrollLeft=Math.max(0,current.offsetLeft-nav.clientWidth/2+current.offsetWidth/2);
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

      } else {
        element.setAttribute('role', 'link');
        element.setAttribute('aria-disabled', 'true');
        element.tabIndex = 0;
        const unavailable = document.createElement('span');
        unavailable.className = 'navigation-unavailable';
        unavailable.textContent = '（未開放）';
        element.append(unavailable);
      }
      element.addEventListener('focus',()=>{const rect=element.getBoundingClientRect(),outer=nav.getBoundingClientRect();const delta=rect.left<outer.left?rect.left-outer.left:rect.right>outer.right?rect.right-outer.right:0;if(delta)nav.scrollLeft+=delta;});
      list.append(element);
    });
    nav.replaceChildren(list);
    revealCurrent(nav);
  };
  build(desktopLinks);build(mobileLinks);
  const refreshRoutes=()=>{
    for(const nav of [desktopLinks,mobileLinks]){for(const link of nav.querySelectorAll('a')){if(isCurrentRoute(link.href,location.href))link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}revealCurrent(nav);}
    const currentItem=navigationItems.find(item=>item.available&&isCurrentRoute(item.href,location.href)),currentPage=document.querySelector('#current-page-name');
    if(currentPage){currentPage.hidden=false;currentPage.textContent=currentItem?`｜${currentItem.label} ${currentItem.englishLabel}`:'';}
  };
  refreshRoutes();

  desktopLinks.hidden = false;

  const refreshControls = () => {
    const {available,redoAvailable,busy,recoveryNotice} = undoManager.getState();
    if(recoveryNotice&&feedback()?.hidden){feedback().hidden=false;feedback().textContent=recoveryNotice;}
    for (const [buttons,enabled,action] of [[undoButtons,available,'撤銷'],[redoButtons,redoAvailable,'恢復']]) {
      buttons.forEach(button => {
        button.disabled = !enabled || pending || busy;
        const label = enabled ? `${action}最近一筆可${action}的資料操作` : `目前沒有可${action}的操作`;
        button.setAttribute('aria-label',label); button.title=label;
        button.setAttribute('aria-busy',String(pending || busy));
      });
    }
    onBusyChange(pending || busy);
  };
  undoManager.subscribe(refreshControls);
  for (const [buttons,method,onSuccess,action] of [[undoButtons,'undo',onUndoSuccess,'撤銷'],[redoButtons,'redo',onRedoSuccess,'恢復']]) {
    buttons.forEach(button => button.addEventListener('click',async()=>{
      if (pending || undoManager.getState().busy) return;
      pending=true;refreshControls();
      try {
        const result = await undoManager[method]();
        if (result.reason === 'unavailable') return;
        feedback().hidden=false;
        if (result.ok) { onSuccess();feedback().textContent=`已${action}「${result.label}」。`; }
        else feedback().textContent=result.error?.message || `${action}失敗，請重試。`;
      } catch(error) { feedback().hidden=false;feedback().textContent=error.message || `${action}失敗，請重試。`; }
      finally { pending=false;refreshControls(); }
    }));
  }
  mobileBar.hidden = false;
  document.body.dataset.navigation = 'ready';
  const updateBarHeight = () => {
    document.documentElement.style.setProperty('--bottom-nav-height', `${mobileBar.getBoundingClientRect().height}px`);
  };
  new ResizeObserver(updateBarHeight).observe(mobileBar);
  updateBarHeight();
  return {refreshRoutes,refreshControls};
}
