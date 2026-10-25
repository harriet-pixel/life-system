import {dataStore} from './data.mjs?v=task-density-18';
// Presentation only: ephemeral local commits + their existing paired mock reply.
// Nothing is persisted or replayed on route restore, storage sync, Undo or Redo.
export function createMobileTaskResponse(root,context){
 const companion=root.querySelector('.tasks-dashboard>.companion'),mobile=matchMedia('(width < 1024px)'),commits=new Map();
 const close=document.createElement('button');close.type='button';close.className='task-response-close';close.setAttribute('aria-label','關閉夥伴回應');close.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m6 6 12 12M18 6 6 18"/></svg>';companion.querySelector('.dialogue-bubble').append(close);
 let candidate=null,shown=null,timer,frame,stableHeight=innerHeight,stableWidth=innerWidth;
 const hide=()=>{clearTimeout(timer);companion.classList.remove('is-floating-response');shown=null;};
 const clear=()=>{candidate=null;commits.clear();hide();};close.onclick=()=>{candidate=null;hide();};
 const valid=entry=>Boolean(entry&&dataStore.get().tasks.completions.some(c=>c.id===entry.id&&!c.cancelledAt&&!c.retraction));
 const keyboard=()=>{const editable=document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]),textarea,select,[contenteditable=true]'),v=window.visualViewport;if(Math.abs(innerWidth-stableWidth)>40||!editable){stableWidth=innerWidth;stableHeight=Math.max(innerHeight,v?.height??0);}return document.documentElement.dataset.keyboard==='open'||Boolean(editable&&stableHeight-Math.min(innerHeight,v?.height??innerHeight)>120);};
 const blocked=()=>!context.active||document.hidden||!mobile.matches||Boolean(document.querySelector('dialog[open]'))||keyboard();
 function position(){const v=window.visualViewport,left=v?.offsetLeft??0,top=v?.offsetTop??0,width=Math.max(0,Math.min((v?.width??innerWidth)+left,document.documentElement.getBoundingClientRect().right)-left),height=v?.height??innerHeight,zoom=companion.currentCSSZoom??(Number.parseFloat(getComputedStyle(document.documentElement).zoom)||1),nav=document.querySelector('.mobile-navigation'),navRect=nav?.getBoundingClientRect(),bottom=Math.min(top+height,navRect&&navRect.height&&navRect.top<top+height?navRect.top:top+height)-60;companion.style.setProperty('--response-width',Math.min(480,width-24)/zoom+'px');companion.style.setProperty('--response-left',(left+Math.max(12,(width-Math.min(480,width-24))/2))/zoom+'px');companion.style.setProperty('--response-max-height',Math.max(0,bottom-top-12)/zoom+'px');companion.style.setProperty('--response-top',Math.max(top+12,bottom-companion.getBoundingClientRect().height)/zoom+'px');}
 function refresh(){frame=0;if(blocked()){candidate=null;hide();return;}if(shown&&!shown.every(valid)){hide();}if(document.querySelector('.task-reward-text')){hide();return;}if(shown){position();return;}if(!candidate)return;
  const entries=candidate.ids.map(id=>commits.get(id));if(entries.some(entry=>!entry))return;if(!entries.every(valid)){candidate=null;return;}
  // The shared view already applies dialogue/emotion together; do not regenerate.
  shown=entries;candidate=null;companion.classList.add('is-floating-response');position();timer=setTimeout(hide,4000);
 }
 const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(refresh);};
 context.listen(document,'life-system:completion-presented',event=>{if(!context.active||!mobile.matches)return;commits.set(event.detail.actionId,event.detail.completion);if(commits.size>120)commits.delete(commits.keys().next().value);schedule();});
 context.listen(document,'life-system:recovery-succeeded',clear);context.listen(document,'visibilitychange',()=>{if(document.hidden)clear();});context.listen(window,'resize',schedule);context.listen(document.fonts,'loadingdone',schedule);context.listen(mobile,'change',clear);context.listen(document,'focusin',schedule);context.listen(document,'focusout',schedule);
 if(window.visualViewport){context.listen(window.visualViewport,'resize',schedule);context.listen(window.visualViewport,'scroll',schedule);}
 const observer=new MutationObserver(()=>{if(document.querySelector('dialog[open]')){candidate=null;hide();}schedule();});const observe=()=>{observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});observer.observe(document.documentElement,{attributes:true,attributeFilter:['style','data-font','data-keyboard']});};observe();context.onSuspend(()=>{observer.disconnect();cancelAnimationFrame(frame);clear();});context.onResume(observe);
 context.subscribe(dataStore,schedule,{changesOnly:true});
 return {reply(actions,replayed=false){if(replayed||!context.active||!mobile.matches)return;const ids=actions.filter(a=>a.type==='task.processing').map(a=>a.actionId);candidate=ids.length?{ids}:null;hide();schedule();},state(value){if(value==='queued'||value==='cancelled'){candidate=null;hide();}}};
}
