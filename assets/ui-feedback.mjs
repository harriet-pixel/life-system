// One document controller for geometric tab indicators. Press feedback is CSS only.
let controller;
export function initializeUIFeedback(){
 if(controller)return controller;
 const states=new Map();let frame=0,pressed=null,pointer=null;
 const clearPress=()=>{pressed?.removeAttribute('data-pressed');pressed=null;pointer=null;};
 // Native touch :active can be deferred during scroll recognition. One passive
 // pointer delegate supplies the CSS state, without suppressing taps or scrolling.
 document.addEventListener('pointerdown',event=>{document.documentElement.dataset.pressPointer=event.pointerType==='mouse'?'mouse':'touch';if(event.pointerType==='mouse')return;clearPress();if(!event.isPrimary||event.button!==0)return;const button=event.target.closest?.('button');if(!button||button.disabled||button.matches('[role=tab],[aria-pressed],[role=checkbox],[role=radio],[aria-disabled=true]'))return;pressed=button;pointer=event.pointerId;button.setAttribute('data-pressed','');},{passive:true,capture:true});
 for(const name of ['pointerup','pointercancel'])document.addEventListener(name,event=>{if(event.pointerId===pointer)clearPress();},{passive:true,capture:true});
 document.addEventListener('pointermove',event=>{if(event.pointerType==='mouse'){if(document.documentElement.dataset.pressPointer!=='mouse')document.documentElement.dataset.pressPointer='mouse';return;}if(event.pointerId!==pointer||!pressed)return;const r=pressed.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)clearPress();},{passive:true,capture:true});
 document.addEventListener('keydown',event=>{if(event.key===' '||event.key==='Enter')document.documentElement.dataset.pressPointer='keyboard';},true);
 window.addEventListener('blur',clearPress);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearPress();});
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
 const resize=new ResizeObserver(schedule);
 function update(){frame=0;if(pressed&&(!pressed.isConnected||pressed.disabled||pressed.getAttribute('aria-disabled')==='true'))clearPress();
  for(const [list,state]of states)if(!list.isConnected){resize.unobserve(list);state.tabs.forEach(tab=>resize.unobserve(tab));states.delete(list);}
  for(const list of document.querySelectorAll('[role=tablist]')){
   let state=states.get(list);if(!state){state={tabs:new Set(),selected:null,visible:false,ownStyle:null};states.set(list,state);resize.observe(list);}
   const tabs=[...list.querySelectorAll('[role=tab]')].filter(t=>t.closest('[role=tablist]')===list);
   for(const tab of state.tabs)if(!tabs.includes(tab)){resize.unobserve(tab);state.tabs.delete(tab);}
   for(const tab of tabs)if(!state.tabs.has(tab)){state.tabs.add(tab);resize.observe(tab);}
   const selected=tabs.find(tab=>tab.getAttribute('aria-selected')==='true'&&!tab.hidden),r=list.getBoundingClientRect(),t=selected?.getBoundingClientRect();
   if(!selected||!r.width||!r.height||!t.width||!t.height||!selected.getClientRects().length){state.visible=false;continue;}
   const animate=state.visible&&state.selected!==null&&state.selected!==selected;
   const properties={'--tab-line-x':(t.left-r.left+list.scrollLeft-list.clientLeft)+'px','--tab-line-y':(t.bottom-r.top+list.scrollTop-list.clientTop-2)+'px','--tab-line-width':String(t.width)};
   const changed=Object.entries(properties).some(([name,value])=>list.style.getPropertyValue(name)!==value);if(changed||!state.visible||state.selected!==selected)properties['--tab-line-motion']=animate?'transform 200ms cubic-bezier(.22,1,.36,1)':'none';
   for(const [name,value]of Object.entries(properties))if(list.style.getPropertyValue(name)!==value)list.style.setProperty(name,value);
   state.ownStyle=list.getAttribute('style');list.setAttribute('data-sliding-tabs','');state.visible=true;state.selected=selected;
  }
 }
 // Ignore our own CSS variables. Never observe animation frames or intercept clicks.
 const observer=new MutationObserver(records=>{if(records.some(r=>r.type!=='attributes'||r.attributeName!=='style'||states.get(r.target)?.ownStyle!==r.target.getAttribute('style')))schedule();});
 observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-selected','hidden','open','class','style','data-font','disabled','aria-disabled']});
 window.addEventListener('resize',schedule,{passive:true});document.fonts?.addEventListener('loadingdone',schedule);window.visualViewport?.addEventListener('resize',schedule,{passive:true});
 document.addEventListener('scroll',event=>{if(event.target?.matches?.('[role=tablist]'))schedule();},true);
 update();controller={refresh:schedule};return controller;
}
