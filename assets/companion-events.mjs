import {createCompanionController,generateMockReply} from './companion.mjs?v=cloud-backup-20261026';
import {recordTaskTiming} from './task-diagnostics.mjs?v=cloud-backup-20261026';
import {occurrence} from './tasks-model.mjs?v=cloud-backup-20261026';
import {dataStore} from './data.mjs?v=cloud-backup-20261026';
let singleton;const operations=new Map();
function validAction(action){if(action.type!=='task.processing')return true;const operation=operations.get(action.actionId);if(!operation)return false;const tasks=dataStore.get().tasks;if(operation.completionId)return tasks.completions.some(c=>c.id===operation.completionId&&!c.cancelledAt);const task=tasks.definitions.find(t=>t.id===operation.taskId);const o=task&&occurrence(tasks,task,operation.date);return Boolean(task&&!task.deleted&&task.version===operation.taskVersion&&(!o||o.status==='pending'));}
function shared(){
 if(singleton)return singleton;
 const views=new Set();let reply,state,replyActions=[];
 const controller=createCompanionController({isActionValid:validAction,generate:async(...args)=>{const start=performance.now();try{const result=await generateMockReply(...args);recordTaskTiming('companion',start);return result;}catch(error){recordTaskTiming('companion',start,'failed');throw error;}},fallback:()=>({dialogue:'回應暫時無法產生；請依事件目前狀態繼續操作。',emotion:'neutral'}),render:(value,actions)=>{reply=value;replyActions=actions;views.forEach(v=>v.render?.(value,actions,{replayed:false}));},onStateChange:value=>{state=value;views.forEach(v=>v.onStateChange?.(value));}});
 document.addEventListener('life-system:recovery-succeeded',()=>controller.cancelPending());
 document.addEventListener('life-system:action-succeeded',event=>controller.recordSuccess(event.detail));
 singleton={controller,subscribe(view){views.add(view);if(reply&&replyActions.every(validAction))view.render?.(reply,replyActions,{replayed:true});if(state&&(!reply||replyActions.every(validAction)))view.onStateChange?.(state);return()=>views.delete(view);}};return singleton;
}
export function createSharedCompanionView(options,context){const source=shared();context.subscribe({subscribe:()=>source.subscribe(options)},()=>{});return {cancelPending:()=>source.controller.cancelPending()};}
export function beginCompletionCompanion(ticket,token){operations.set(token,{taskId:ticket.taskId,taskVersion:ticket.taskVersion,date:ticket.date});if(operations.size>120){const old=[...operations].find(([,o])=>o.completionId);if(old)operations.delete(old[0]);}shared().controller.recordSuccess({type:'task.processing',actionId:token,label:`正在處理「${ticket.name}」`,brief:ticket.brief??''});}
export function finishCompletionCompanion(token,completion){if(operations.has(token))operations.get(token).completionId=completion.id;}
export function invalidateCompletionCompanion(token){operations.delete(token);shared().controller.invalidateAction(token);}
