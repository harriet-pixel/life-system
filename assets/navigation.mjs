import {setOperationNotice} from './operation-notice.mjs?v=mobile-daily-20261028';
const navigationIcons={companion:'<circle cx="9" cy="7" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 4a3 3 0 0 1 0 6m2 4a6 6 0 0 1 3 5v2"/>',habits:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M7 2v4m10-4v4M3 9h18m-14 6 3 3 7-6"/>',home:'<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z"/>',tasks:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="m6 10 2 2 3-4m2 3h5M6 16h12"/>',profile:'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',settings:'<path d="m9 3 1-2h4l1 2 2 1h2l2 4-1 2v3l1 2-2 4h-2l-2 1-1 2h-4l-1-2-2-1H5l-2-4 1-2v-3L3 8l2-4h2Z"/><circle cx="12" cy="11.5" r="3"/>'};
// Enable a navigation item only after its destination page is implemented.
export const navigationItems = Object.freeze([
  { id: 'home', label: '首頁', englishLabel: 'Home', href: new URL('../', import.meta.url).href, available: true },
  { id: 'tasks', label: '待辦事項', englishLabel:'Tasks', href: new URL('../tasks.html',import.meta.url).href, available: true },
  { id: 'habits', label: '習慣打卡', englishLabel:'Habits', href: new URL('../habits.html',import.meta.url).href, available: true },
  { id: 'companion', label: '夥伴', englishLabel:'Companion', href: new URL('../companion.html',import.meta.url).href, available: true },
  { id: 'profile', label: '我的資料', englishLabel: 'My Profile', href: new URL('../profile.html', import.meta.url).href, available: true },
  { id: 'settings', label: '設定', englishLabel:'Settings', href: new URL('../settings.html', import.meta.url).href, available: true },
  { id: 'wallet', label: '錢包帳本', href: null, available: false },
  { id: 'reading', label: '陪讀系統', href: null, available: false },
].map(Object.freeze));

export function isCurrentRoute(href, locationURL) {
  if (!href) return false;
  const target = new URL(href, locationURL);
  const current = new URL(locationURL);
  const normalize = (path) => path.replace(/index\.html$/, '');
  return target.origin === current.origin && normalize(target.pathname) === normalize(current.pathname);
}

export function initializeNavigation({ onCloudRestore=()=>{}, undoManager, onUndoSuccess = () => {}, onRedoSuccess = () => {}, onBusyChange = () => {} }) {
  const desktopLinks = document.querySelector('#desktop-links');
  const mobileLinks = document.querySelector('#mobile-links');
  const feedback=()=>document.querySelector('#operation-status');
  const mobileBar = document.querySelector('.mobile-navigation');
  const undoButtons = [...document.querySelectorAll('[data-undo]')];
  const cloudButtons=undoButtons.map(undo=>{const button=undo.cloneNode(true);button.removeAttribute('data-undo');button.setAttribute('data-cloud-restore','');button.classList.replace('undo-button','cloud-restore-button');button.disabled=false;button.setAttribute('aria-label','雲端備份與還原');button.title='雲端備份與還原';button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M7 18H6a4 4 0 0 1-1-8 7 7 0 0 1 13-2 5 5 0 0 1 0 10h-1M12 11v10m-4-4 4 4 4-4"/></svg>';button.onclick=onCloudRestore;undo.after(button);return button;});
  const redoButtons=()=>[...document.querySelectorAll('[data-redo]')];
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
        if(navigationIcons[item.id]){element.classList.add('navigation-icon-item');element.setAttribute('aria-label',item.label);element.title=item.label;const label=document.createElement('span');label.className='sr-only';label.textContent=item.label;element.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+navigationIcons[item.id]+'</svg>';element.append(label);}
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
  for(const nav of [desktopLinks,mobileLinks])nav.addEventListener('wheel',event=>{
    if(event.ctrlKey||event.metaKey||event.deltaX!==0||!event.deltaY||nav.scrollWidth<=nav.clientWidth+1)return;
    event.preventDefault();
    const scale=event.deltaMode===1?(parseFloat(getComputedStyle(nav).lineHeight)||20):event.deltaMode===2?nav.clientWidth:1;
    nav.scrollLeft+=event.deltaY*scale;
  },{passive:false});
  const refreshRoutes=()=>{
    for(const nav of [desktopLinks,mobileLinks]){for(const link of nav.querySelectorAll('a')){if(isCurrentRoute(link.href,location.href))link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}revealCurrent(nav);}
    const currentItem=navigationItems.find(item=>item.available&&isCurrentRoute(item.href,location.href)),currentPage=document.querySelector('#current-page-name');
    if(currentPage){currentPage.hidden=false;currentPage.textContent=currentItem?`｜${currentItem.label} ${currentItem.englishLabel}`:'';}
  };
  refreshRoutes();

  desktopLinks.hidden = false;

  const refreshControls = () => {
    const {available,redoAvailable,busy,recoveryNotice} = undoManager.getState();
    if(recoveryNotice&&feedback()?.hidden){setOperationNotice(feedback(),recoveryNotice);}
    for (const [buttons,enabled,action] of [[undoButtons,available,'撤銷'],[redoButtons(),redoAvailable,'恢復']]) {
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
  async function perform(method,onSuccess,action){if(pending||undoManager.getState().busy)return;pending=true;refreshControls();try{const result=await undoManager[method]();if(result.ok){document.dispatchEvent(new CustomEvent('life-system:recovery-succeeded'));onSuccess();setOperationNotice(feedback(),`已${action}「${result.label}」。`);}else if(result.reason!=='unavailable')setOperationNotice(feedback(),result.error?.message||`${action}失敗，請重試。`);}catch(error){setOperationNotice(feedback(),error.message);}finally{pending=false;refreshControls();}}
  undoButtons.forEach(button=>button.onclick=()=>perform('undo',onUndoSuccess,'撤銷'));
  document.addEventListener('click',event=>{if(event.target.closest('[data-redo]'))void perform('redo',onRedoSuccess,'恢復');});
  mobileBar.hidden = false;
  document.body.dataset.navigation = 'ready';
  const updateBarHeight = () => {
    document.documentElement.style.setProperty('--bottom-nav-height', `${mobileBar.getBoundingClientRect().height}px`);
  };
  new ResizeObserver(updateBarHeight).observe(mobileBar);
  updateBarHeight();
  return {refreshRoutes,refreshControls};
}
