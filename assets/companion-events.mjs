import {DAILY_OPERATIONS} from './daily-events.mjs?v=backup-chat-20261031';
import {dataStore} from './data.mjs?v=backup-chat-20261031';
let singleton;const operations=new Map();
function shared(){if(singleton)return singleton;const views=new Set();let version=0,timer,pending=[],reply=null,actions=[],imports=[],cancelRequest=null,viewEpoch=0;const walletCancels=new Set();
 const state=value=>views.forEach(v=>v.onStateChange?.(value));
 const cancel=()=>{viewEpoch++;for(const stop of walletCancels)stop();walletCancels.clear();cancelRequest?.();cancelRequest=null;version++;clearTimeout(timer);pending=[];imports=[];state('cancelled');};
 const controller={cancelPending:cancel,invalidateAction:cancel};
 dataStore.subscribeCommits((document,operation)=>{
  if(!views.size||!operation||!DAILY_OPERATIONS.includes(operation.type))return;
  if(operation.type==='wallet.spent'){
   if(!document.companion?.characters.some(c=>c.characterId===document.companion.activeCharacterId&&!c.archived))return;
   const token=++version,epoch=viewEpoch;state('queued');void import('./daily-events.mjs?v=backup-chat-20261031').then(async module=>{const event=module.formalDailyEvents(operation,document)[0];if(!event)return;state('generating');const runtime=await import('./reply-runtime.mjs?v=backup-chat-20261031');let stop=null;const value=await runtime.dailyResponse(dataStore,event,{valid:()=>views.size>0&&epoch===viewEpoch,onCancel:fn=>{if(stop)walletCancels.delete(stop);stop=fn;if(fn)walletCancels.add(fn);}});if(value&&token===version){views.forEach(v=>v.render?.(value,[{type:'wallet.spent',actionId:event.sourceId,dailyEvent:event}],{replayed:false,daily:true}));state('ready');}}).catch(()=>state('fallback'));return;
  }
  imports.push({operation,document});if(imports.length>10)imports.shift();cancelRequest?.();cancelRequest=null;const token=++version;state('queued');
  void import('./daily-events.mjs?v=backup-chat-20261031').then(module=>{
   if(token!==version||!views.size)return;const events=imports.splice(0).flatMap(o=>module.formalDailyEvents(o.operation,o.document));if(!events.length)return;pending.push(...events);clearTimeout(timer);timer=setTimeout(async()=>{
    const batch=pending;pending=[];const selected=batch.find(e=>e.eventType==='achievement.unlocked')??batch.at(-1);if(!selected)return;state('generating');
    const mapped=batch.filter(e=>e.domain!=='achievement').map(e=>{const operation=[...operations].find(([,v])=>v.completionId===e.sourceId);return {type:e.domain==='task'?'task.processing':e.domain==='change'?'life.changed':'habit.checked-in',actionId:operation?.[0]??e.sourceId,label:'正式生活事件',dailyEvent:e};});
    try{const runtime=await import('./reply-runtime.mjs?v=backup-chat-20261031');const value=await runtime.dailyResponse(dataStore,selected,{valid:()=>token===version&&views.size>0,batch,onCancel:fn=>{if(token===version)cancelRequest=fn;}});if(!value||token!==version)return;
     reply=value;actions=mapped;views.forEach(v=>v.render?.(reply,actions,{replayed:false,daily:true}));state('ready');
    }catch{if(token===version&&module.validDailySource(dataStore.get(),selected)){reply={dialogue:'慢慢來，依照自己的步調繼續就好。',emotion:'neutral',characterId:selected.characterId,characterCreatedAt:selected.characterCreatedAt,daily:true};views.forEach(v=>v.render?.(reply,mapped,{replayed:false,daily:true}));state('fallback');}}
   },450);
  }).catch(()=>state('fallback'));
 },{keys:['revision','companion','replyLibrary']});

 singleton={controller,subscribe(view){views.add(view);return()=>{views.delete(view);if(!views.size)cancel();};}};return singleton;
}
export function createSharedCompanionView(options,context){const source=shared();context.subscribe({subscribe:()=>source.subscribe(options)},()=>{});return {cancelPending:()=>source.controller.cancelPending()};}
export function beginCompletionCompanion(ticket,token){operations.set(token,{taskId:ticket.taskId,date:ticket.date});if(operations.size>120)operations.delete(operations.keys().next().value);}
export function finishCompletionCompanion(token,completion){if(operations.has(token))operations.get(token).completionId=completion.id;}
export function invalidateCompletionCompanion(token){operations.delete(token);shared().controller.cancelPending();}
export function cancelSharedCompanion(){shared().controller.cancelPending();}
