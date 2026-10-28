import {dataStore} from './data.mjs?v=sync-live-20261028';
let singleton;const operations=new Map();
function shared(){if(singleton)return singleton;const views=new Set();let version=0,timer,pending=[],reply=null,actions=[];
 const state=value=>views.forEach(v=>v.onStateChange?.(value));
 const cancel=()=>{version++;clearTimeout(timer);pending=[];state('cancelled');};
 const controller={cancelPending:cancel,invalidateAction:cancel};
 dataStore.subscribeCommits((document,operation)=>{
  if(!views.size||!operation||!['task.completed','task.completed.batch','habit.check','habit.bonus'].includes(operation.type))return;
  const token=++version;state('queued');
  void import('./daily-events.mjs?v=sync-live-20261028').then(module=>{
   if(token!==version||!views.size)return;const events=module.formalDailyEvents(operation,document);if(!events.length)return;pending.push(...events);clearTimeout(timer);timer=setTimeout(async()=>{
    const batch=pending;pending=[];const selected=batch.find(e=>e.eventType==='achievement.unlocked')??batch.at(-1);if(!selected)return;state('generating');
    const mapped=batch.filter(e=>e.domain!=='achievement').map(e=>{const operation=[...operations].find(([,v])=>v.completionId===e.sourceId);return {type:e.domain==='task'?'task.processing':'habit.checked-in',actionId:operation?.[0]??e.sourceId,label:'正式生活事件'};});
    try{const runtime=await import('./reply-runtime.mjs?v=sync-live-20261028');const value=await runtime.dailyResponse(dataStore,selected,{valid:()=>token===version&&views.size>0});if(!value||token!==version)return;
     reply=value;actions=mapped;views.forEach(v=>v.render?.(reply,actions,{replayed:false,daily:true}));state('ready');
    }catch{if(token===version&&module.validDailySource(dataStore.get(),selected)){reply={dialogue:'慢慢來，依照自己的步調繼續就好。',emotion:'neutral',characterId:selected.characterId,characterCreatedAt:selected.characterCreatedAt,daily:true};views.forEach(v=>v.render?.(reply,mapped,{replayed:false,daily:true}));state('fallback');}}
   },450);
  }).catch(()=>state('fallback'));
 });
 document.addEventListener('life-system:recovery-succeeded',cancel);
 singleton={controller,subscribe(view){views.add(view);return()=>{views.delete(view);if(!views.size)cancel();};}};return singleton;
}
export function createSharedCompanionView(options,context){const source=shared();context.subscribe({subscribe:()=>source.subscribe(options)},()=>{});return {cancelPending:()=>source.controller.cancelPending()};}
export function beginCompletionCompanion(ticket,token){operations.set(token,{taskId:ticket.taskId,date:ticket.date});if(operations.size>120)operations.delete(operations.keys().next().value);}
export function finishCompletionCompanion(token,completion){if(operations.has(token))operations.get(token).completionId=completion.id;}
export function invalidateCompletionCompanion(token){operations.delete(token);shared().controller.cancelPending();}
export function cancelSharedCompanion(){shared().controller.cancelPending();}
