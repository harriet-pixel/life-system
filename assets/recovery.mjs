import {walletMatches,applyWalletSnapshot} from './wallet-recovery.mjs?v=restore-images-20261031';
import {applyAffinityPlan} from './affinity-model.mjs?v=restore-images-20261031';
// One policy for startup, replay, mutations, image references and backups.
export const RECOVERY_LIMIT=15, DAY=86400000, HISTORY_VERSION=1;
const shortKeys=new Set(['profile','photo','avatar','photoEdit','avatarEdit','portraits','currentPortraitId','settings']);
const longKeys=new Set(['stats','activities','tasks','habits','wallet']);
const ordered=v=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;
const equal=(a,b)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b));
export function recoveryLifetime(record){
 const keys=Object.keys(record.after??{}).filter(k=>!equal(record.before?.[k],record.after[k]));
 if(!keys.length||keys.some(k=>!shortKeys.has(k)&&!longKeys.has(k)))return 0;
 // History preferences are system settings, never reversible actions.
 if(keys.length===1&&keys[0]==='settings'&&equal(record.before?.settings?.appearance,record.after.settings?.appearance))return 0;
 return keys.some(k=>shortKeys.has(k))?DAY:7*DAY;
}
export const expiresAt=record=>Date.parse(record.time)+recoveryLifetime(record);
export const undoCandidate=records=>[...records].reverse().find(r=>!r.undone);
export const redoCandidate=records=>records.filter(r=>r.undone&&r.redoable===true&&Number.isSafeInteger(r.undoOrder)).sort((a,b)=>b.undoOrder-a.undoOrder)[0];
export function expectedMatches(state,record,redo=false){
 const expected=redo?record.before:record.after;
 return Object.keys(expected??{}).every(k=>k==='wallet'?walletMatches(state.wallet,expected.wallet):k==='settings'&&record.type==='appearance.update'?equal(state.settings.appearance,expected.settings.appearance):equal(state[k],expected[k]));
}
export function applySnapshot(state,record,redo=false,options={}){
 if(record.affinityPlan)applyAffinityPlan(state,record.affinityPlan,{redo,time:options.time??record.time,operationId:options.operationId??record.id+(redo?':redo':':undo')});
 for(const [key,value]of Object.entries(redo?record.after:record.before)){
  if(key==='wallet')applyWalletSnapshot(state.wallet,value);
  else if(key==='settings'&&record.type==='appearance.update')state.settings={...state.settings,appearance:structuredClone(value.appearance)};
  else state[key]=structuredClone(value);
 }
}
export function actionMetadata(record){
 return {id:record.id,time:record.time,type:record.type??'legacy.unknown',label:record.label??'既有操作',target:record.target??'user',fields:record.fields??[],delta:{experience:record.delta?.experience??0,level:record.delta?.level??0,currency:record.delta?.currency??0,abilities:(record.delta?.abilities??[]).map(a=>({id:a.id,value:a.value}))},undone:Boolean(record.undone),undoneAt:record.undoneAt??null};
}
export function maintainRecovery(document,now=Date.now()){
 const doc=structuredClone(document);
 if(doc.historyVersion!==undefined&&doc.historyVersion!==HISTORY_VERSION)throw new Error('不支援的歷史資料版本，原資料已保留。');
 if(doc.historyVersion===undefined){
  // Original success timestamps are retained. Unknown keys or missing snapshots
  // have no provable lifetime; preserve metadata but do not invent recovery.
  if(doc.history.every(r=>!Object.hasOwn(r,'redoable'))){
   const latest=Math.max(0,...doc.history.map(r=>Date.parse(r.time))),probe=structuredClone(doc);
   const candidates=doc.history.filter(r=>r.undone&&r.before&&r.after&&Date.parse(r.undoneAt)>latest).sort((a,b)=>Date.parse(b.undoneAt)-Date.parse(a.undoneAt));
   for(const [index,r]of candidates.entries()){if(!expectedMatches(probe,r,true))break;r.redoable=true;r.undoOrder=-index;applySnapshot(probe,r,true);}
  }
  doc.undoHistory=doc.history.filter(r=>r.before&&r.after&&r.type!=='history.settings');
  doc.history=doc.history.filter(r=>r.type!=='history.settings').map(actionMetadata);
  doc.historyVersion=HISTORY_VERSION;
 }
 const chronological=records=>records.map((r,index)=>({r,index})).sort((a,b)=>(Date.parse(a.r.time)-Date.parse(b.r.time))||a.index-b.index).map(x=>x.r);
 // Enforce the operation-count boundary before time filtering: expiration must
 // never make an older operation outside the latest 15 recoverable again.
 const recent=new Set(chronological(doc.history).slice(-RECOVERY_LIMIT).map(r=>r.id));
 let records=chronological(doc.undoHistory).filter(r=>recent.has(r.id)&&recoveryLifetime(r)>0&&Number.isFinite(Date.parse(r.time))&&Date.parse(r.time)<=now&&expiresAt(r)>now&&(!r.undone||r.redoable===true));
 const retained=new Set();let blocked=false;
 // Prove the entire available chain in advance. Stop at the first conflict;
 // independently expired snapshots are never applied to bridge a missing link.
 for(const redo of [false,true]){
  const probe=structuredClone(doc),remaining=[...records];
  while(true){const r=redo?redoCandidate(remaining):undoCandidate(remaining);if(!r)break;
   if(!expectedMatches(probe,r,redo)){blocked=true;break;}
   try{applySnapshot(probe,r,redo);}catch{blocked=true;break;}
   retained.add(r.id);remaining.splice(remaining.indexOf(r),1);
  }
 }
 doc.undoHistory=records.filter(r=>retained.has(r.id));
 return {document:doc,blocked};
}
