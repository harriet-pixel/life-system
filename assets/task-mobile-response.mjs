import {mountHomeCompanionFloat} from './home-companion-float.mjs?v=daily-polish-20261029';
import {dataStore} from './data.mjs?v=daily-polish-20261029';
// Presentation only: ephemeral local commits + their existing paired mock reply.
// Nothing is persisted or replayed on route restore, storage sync, Undo or Redo.
export function createMobileTaskResponse(root,context,{kind='tasks',selector='.tasks-dashboard>.companion'}={}){
 const companion=root.querySelector(selector),mobile=matchMedia('(width < 1024px)'),commits=new Map();
 let candidate=null,shown=null,frame,stableHeight=innerHeight,stableWidth=innerWidth;
 let floating;
 const hide=()=>{companion.classList.remove('is-floating-response');shown=null;floating?.hide();};
 const clear=()=>{candidate=null;commits.clear();hide();};
 floating=mountHomeCompanionFloat(root,context,{selector,greeting:false,onHide:hide});
 const valid=entry=>kind==='habits'?Boolean(entry&&(dataStore.getFields(['habits']).habits.records.some(r=>r.id===entry.id&&r.state!=='-')||dataStore.getFields(['habits']).habits.bonusRecords.some(r=>r.id===entry.id&&!r.cancelledAt))):Boolean(entry&&dataStore.getFields(['tasks']).tasks.completions.some(c=>c.id===entry.id&&!c.cancelledAt&&!c.retraction));
 const keyboard=()=>{const editable=document.activeElement?.matches('input:not([type=checkbox]):not([type=radio]),textarea,select,[contenteditable=true]'),v=window.visualViewport;if(Math.abs(innerWidth-stableWidth)>40||!editable){stableWidth=innerWidth;stableHeight=Math.max(innerHeight,v?.height??0);}return document.documentElement.dataset.keyboard==='open'||Boolean(editable&&stableHeight-Math.min(innerHeight,v?.height??innerHeight)>120);};
 const blocked=()=>!context.active||document.hidden||!mobile.matches||Boolean(document.querySelector('dialog[open]'))||keyboard();

 function refresh(){frame=0;if(blocked()){candidate=null;hide();return;}if(shown&&!shown.every(valid)){hide();}if(document.querySelector('.task-reward-text')){hide();return;}if(shown)return;if(!candidate)return;
  const entries=candidate.ids.map(id=>commits.get(id));if(entries.some(entry=>!entry))return;if(!entries.every(valid)){candidate=null;return;}
  // The shared view already applies dialogue/emotion together; do not regenerate.
  shown=entries;candidate=null;companion.classList.add('is-floating-response');floating.reply();
 }
 const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(refresh);};
 context.listen(document,'life-system:completion-presented',event=>{if(!context.active||!mobile.matches)return;commits.set(event.detail.actionId,event.detail.completion);if(commits.size>120)commits.delete(commits.keys().next().value);schedule();});
 context.listen(document,'life-system:action-succeeded',event=>{if(kind!=='habits'||event.detail.type!=='habit.checked-in')return;commits.set(event.detail.actionId,{id:event.detail.actionId});schedule();});
 context.listen(document,'life-system:recovery-succeeded',clear);context.listen(document,'visibilitychange',()=>{if(document.hidden)clear();});context.listen(window,'resize',schedule);context.listen(document.fonts,'loadingdone',schedule);context.listen(mobile,'change',clear);context.listen(document,'focusin',schedule);context.listen(document,'focusout',schedule);
 if(window.visualViewport){context.listen(window.visualViewport,'resize',schedule);context.listen(window.visualViewport,'scroll',schedule);}
 const observer=new MutationObserver(()=>{if(document.querySelector('dialog[open]')){candidate=null;hide();}schedule();});const observe=()=>{observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});observer.observe(document.documentElement,{attributes:true,attributeFilter:['style','data-font','data-keyboard']});};observe();context.onSuspend(()=>{observer.disconnect();cancelAnimationFrame(frame);clear();});context.onResume(observe);
 context.subscribe(dataStore,schedule,{changesOnly:true,keys:[]});
 return {reply(actions,replayed=false){if(replayed||!context.active||!mobile.matches)return;const ids=actions.filter(a=>a.type===(kind==='habits'?'habit.checked-in':'task.processing')).map(a=>a.actionId);candidate=ids.length?{ids}:null;hide();schedule();},state(value){if(value==='queued'||value==='cancelled'){candidate=null;hide();}}};
}
