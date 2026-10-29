// Main content tabs only. Native vertical and nested horizontal scrolling win.
export function initializeTabSwipe(){let gesture=null,suppressUntil=0,suppressRoot=null;const mobile=()=>matchMedia('(max-width:1023px)').matches;
 function listFor(target){
  const root=target.closest('[data-page-view]');if(!root||target.closest('dialog,.mobile-navigation,textarea,select,[contenteditable],[data-no-tab-swipe],input:not([type=checkbox]):not([type=radio])'))return null;
  const lists=[...root.querySelectorAll('[role=tablist]')].filter(l=>!l.closest('dialog,[role=tabpanel]'));
  const direct=target.closest('[role=tablist]');if(direct&&!lists.includes(direct))return null;
  const owner=direct??lists.find(list=>[...list.querySelectorAll('[role=tab]')].some(tab=>{const id=tab.getAttribute('aria-controls');if(!id)return false;const panel=root.querySelector('#'+CSS.escape(id));return panel?.contains(target);})||target.closest('.activity-region,.home-grid,.task-workspace,.task-panel-stack,#habit-panel-stack,.habit-upper-content,#habit-lower-flex,.settings-content'));
  if(!owner)return null;
  for(let e=target;e&&e!==root;e=e.parentElement){const style=getComputedStyle(e);if(e!==owner&&e.scrollWidth>e.clientWidth+2&&/(auto|scroll)/.test(style.overflowX))return null;}
  return owner;
 }
 function start(target,id,x,y){if(!mobile()||document.querySelector('dialog[open]'))return null;const list=listFor(target);if(!list)return null;return {id,list,x,y,selected:list.querySelector('[aria-selected=true]'),time:performance.now(),vertical:false};}
 function finish(g,x,y){if(!g||g.vertical||!mobile()||performance.now()-g.time>900||!g.list.isConnected||g.selected!==g.list.querySelector('[aria-selected=true]')||!getSelection().isCollapsed)return;const dx=x-g.x,dy=y-g.y;if(Math.abs(dx)<48||Math.abs(dx)<Math.abs(dy)*1.6)return;const tabs=[...g.list.querySelectorAll('[role=tab]')].filter(t=>t.closest('[role=tablist]')===g.list&&!t.disabled&&!t.hidden),index=tabs.indexOf(g.selected),next=index+(dx<0?1:-1);suppressUntil=performance.now()+400;suppressRoot=g.list.closest('[data-page-view]');if(next>=0&&next<tabs.length)tabs[next].click();}
 document.addEventListener('pointerdown',e=>{suppressUntil=0;suppressRoot=null;if(e.pointerType==='mouse'||!e.isPrimary||e.button!==0)return;gesture=start(e.target,e.pointerId,e.clientX,e.clientY);},{passive:true});
 document.addEventListener('pointermove',e=>{if(gesture?.id!==e.pointerId)return;if(Math.abs(e.clientY-gesture.y)>12&&Math.abs(e.clientY-gesture.y)>Math.abs(e.clientX-gesture.x))gesture.vertical=true;},{passive:true});
 document.addEventListener('pointerup',e=>{const g=gesture;gesture=null;if(g?.id===e.pointerId)finish(g,e.clientX,e.clientY);},{passive:true});
 let touch=null;document.addEventListener('touchstart',e=>{suppressUntil=0;suppressRoot=null;gesture=null;const t=e.touches[0];touch=e.touches.length===1?start(e.target,t.identifier,t.clientX,t.clientY):null;},{passive:true});
 document.addEventListener('touchmove',e=>{if(!touch||e.touches.length!==1){touch=null;return;}const t=e.touches[0],dx=Math.abs(t.clientX-touch.x),dy=Math.abs(t.clientY-touch.y);if(dy>12&&dy>dx)touch.vertical=true;if(!touch.vertical&&dx>12&&dx>dy*1.6&&e.cancelable)e.preventDefault();},{passive:false});
 document.addEventListener('touchend',e=>{const g=touch;touch=null;const t=[...e.changedTouches].find(t=>t.identifier===g?.id);if(t)finish(g,t.clientX,t.clientY);},{passive:true});document.addEventListener('touchcancel',()=>{touch=null;},{passive:true});
 document.addEventListener('pointercancel',()=>{gesture=null;},{passive:true});document.addEventListener('life-system:route-ready',()=>{gesture=null;touch=null;suppressUntil=0;suppressRoot=null;});document.addEventListener('click',e=>{if(e.isTrusted&&performance.now()<suppressUntil&&suppressRoot?.contains(e.target)){e.preventDefault();e.stopImmediatePropagation();}},true);
}
