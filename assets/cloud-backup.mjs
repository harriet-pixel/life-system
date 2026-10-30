import {preserveBeforeRestore,listArchives} from './storage-vault.mjs?v=wallet-20261031';
import {getSyncRuntime} from './cloud-sync-status.mjs?v=wallet-20261031';
import {dataStore} from './data.mjs?v=wallet-20261031';
import {withBackup,restoreBackup,downloadBlob,yieldBackupWork} from './backup.mjs?v=wallet-20261031';
import {registerImageReferenceSource,documentImageReferences} from './image-references.mjs?v=wallet-20261031';
import {driveAuth,getDriveState,uploadDriveBackup,listDriveBackups,downloadDriveBackup,deleteDriveBackup} from './google-drive.mjs?v=wallet-20261031';
import {backupWarning,confirmOlderBackup,validTime} from './cloud-backup-policy.mjs?v=wallet-20261031';
import {cloudBackupIdentity} from './cloud-backup-display.mjs?v=wallet-20261031';
export const BACKUP_LIMIT=20;
export const newestBackups=files=>[...files].sort((a,b)=>(Date.parse(b.createdTime??b.appProperties?.backupTime)||0)-(Date.parse(a.createdTime??a.appProperties?.backupTime)||0)||b.id.localeCompare(a.id));
export function obsoleteBackups(files){files=files.filter(f=>!f.appProperties?.lifeSystemSyncVersion&&f.appProperties?.backupStatus!=='pending');if(files.some(f=>!Number.isFinite(Date.parse(f.createdTime??f.appProperties?.backupTime))))throw new Error('無法確認雲端備份時間，已停止清理較舊版本。');return newestBackups(files).slice(BACKUP_LIMIT);}
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const comparableDocument=d=>{const {revision,undoHistory,history,...x}=d;return JSON.stringify(canonical(x));};
// Same canonical bytes as the synchronous change comparison, but large
// manual-backup hashes yield between bounded batches. No data is mutated.
export async function canonicalBackupJSON(value,{budgetMs=8,yieldWork=yieldBackupWork}={}){
 let visits=0;
 function* build(v){
  let result=v;
  if(Array.isArray(v)){result=[];for(const child of v)result.push(yield* build(child));}
  else if(v&&typeof v==='object'){const entries=[];for(const key of Object.keys(v).sort())entries.push([key,yield* build(v[key])]);result=Object.fromEntries(entries);}
  if(++visits%64===0)yield;
  return result;
 }
 const steps=build(value);let start=performance.now(),step;
 while(!(step=steps.next()).done)if(performance.now()-start>=budgetMs){await yieldWork();start=performance.now();}
 return JSON.stringify(step.value);
}
async function digestCanonical(value){const text=await canonicalBackupJSON(value);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
let singleton;
export function getCloudBackup(){if(singleton)return singleton;
 const dirtyKey='life-system.cloud-backup-dirty.v1',metaKey='life-system.cloud-backup-time.v1';
 const dirty=()=>{try{const n=Number(localStorage.getItem(dirtyKey));return Number.isSafeInteger(n)&&n>0?n:0;}catch{return 0;}};
 const readMeta=()=>{try{const m=JSON.parse(localStorage.getItem(metaKey));return m&&Number.isSafeInteger(m.revision)?m:null;}catch{return null;}};
 const writeMeta=m=>{localStorage.setItem(metaKey,JSON.stringify(m));};
 const listeners=new Set(),queue=[];let busy=false,suppressed=false,release,holding=false;
 let state={message:'雲端備份僅於手動點擊「上傳雲端」後執行；上傳驗證成功後保留最近20筆完整備份。',pending:0,busy:false,warning:null,dueAt:null};
 const emit=message=>{state={...state,message:message??state.message,pending:dirty()?1:queue.length,busy,dueAt:null};for(const fn of listeners){try{fn({...state});}catch{}}};
 const protect=()=>{if(holding||!queue.length)return;holding=true;navigator.locks.request('life-system.cloud-backup-pending.v1',{mode:'shared'},()=>new Promise(resolve=>{release=()=>{resolve();release=null;holding=false;};if(!queue.length)release();}));};
 const unlock=()=>{if(!queue.length)release?.();};
 registerImageReferenceSource('待上傳雲端備份',()=>queue.flatMap(job=>[...documentImageReferences(job.document,{raw:true})]),{transient:false});
 try{sessionStorage.removeItem('life-system.drive-sync-session.v1');const key='life-system.drive-sync.v1',old=JSON.parse(localStorage.getItem(key)||'null');if(old?.version===1&&old.enabled===true)localStorage.setItem(key,JSON.stringify({...old,enabled:false}));}catch{}
 const hashDocument=async doc=>{const {revision,undoHistory,history,...content}=doc;return digestCanonical(content);};
 function enqueue(doc,{changed=false,manual=false}={}){if(suppressed)return;const meta=readMeta();const updatedAt=changed?new Date().toISOString():meta?.updatedAt??null;const dueAt=null;writeMeta({...meta,revision:doc.revision,updatedAt,dueAt});localStorage.setItem(dirtyKey,String(doc.revision));if(manual){queue.splice(0,queue.length,{document:structuredClone(doc),updatedAt,uploaded:false});protect();}state.warning=null;emit('本地已儲存；請手動點擊「上傳雲端」備份。');}
 async function upload(job){if(!job.uploaded){const {revision,...fullDocument}=job.document;const snapshotHash=await digestCanonical(fullDocument);const hash=await hashDocument(job.document),latest=newestBackups(await listDriveBackups())[0],warning=backupWarning(job.updatedAt,latest,hash);if(latest?.appProperties?.snapshotHash===snapshotHash){job.uploaded=true;const meta=readMeta();writeMeta({...meta,lastBackupAt:latest.appProperties?.backupTime??latest.createdTime??null,uploadedHash:hash});return;}if(warning){state.warning={...warning,fileId:latest.id};emit(warning.message);if(!await confirmOlderBackup(warning))throw Object.assign(new Error('已取消上傳，本地資料保留。'),{older:true});const current=newestBackups(await listDriveBackups())[0];if(cloudBackupIdentity(current??{})!==cloudBackupIdentity(latest))throw Object.assign(new Error('確認期間雲端版本已變更，請重新備份。'),{older:true});}
 dataStore.refresh();if(dataStore.getFields(['revision']).revision!==job.document.revision)throw Object.assign(new Error('確認期間本地資料已更新，請重新備份；本地資料保留。'),{older:true});
 const captured=await withBackup(dataStore,'',(blob,payload)=>({blob,payload}),{snapshot:job.document});const verified=await uploadDriveBackup(captured.blob,captured.payload,{dataUpdatedAt:job.updatedAt,dataHash:hash,snapshotHash});job.verifiedId=verified.id;job.uploaded=true;const meta=readMeta();writeMeta({...meta,lastBackupAt:captured.payload.createdAt,uploadedHash:hash});state.warning=null;}
 if(job.verifiedId){const files=await listDriveBackups();if(!newestBackups(files).slice(0,BACKUP_LIMIT).some(f=>f.id===job.verifiedId))throw new Error('無法確認新備份位於保留版本中，已停止清理。');for(const file of obsoleteBackups(files))await deleteDriveBackup(file.id);}}
 async function flush(){if(busy||!queue.length||!getDriveState().connected||!navigator.onLine||suppressed)return;busy=true;let completed=false;emit('正在上傳雲端備份…');try{await navigator.locks.request('life-system.cloud-backup-upload.v1',async()=>{while(queue.length&&getDriveState().connected&&navigator.onLine&&!suppressed){const job=queue[0];await upload(job);if(queue[0]===job)queue.shift();if(dirty()<=job.document.revision){localStorage.removeItem(dirtyKey);const meta=readMeta();if(meta)writeMeta({...meta,dueAt:null});}unlock();emit('雲端備份已更新；上傳驗證成功後保留最近20筆完整備份。');}});completed=!dirty()&&!queue.length;}catch(error){emit('雲端備份未完成：'+error.message);queue.length=0;unlock();}finally{queue.length=0;busy=false;unlock();emit();}return completed;}
 let prior=comparableDocument(dataStore.get());dataStore.subscribeCommits((doc,operation)=>{const next=comparableDocument(doc);if(next===prior)return;prior=next;if(operation===null&&getSyncRuntime()?.enabled&&getSyncRuntime().getState().busy)return;enqueue(doc,{changed:true});},{omit:['history','undoHistory']});
 driveAuth.subscribe(auth=>emit(auth.connected?'Google已連接；請手動點擊「上傳雲端」備份。':'Google尚未連接或授權已過期；本地資料保留。'));
 window.addEventListener('storage',event=>{if(event.key===dirtyKey||event.key===metaKey)emit();});
 singleton={async downloadPreserved(){const latest=(await listArchives()).filter(a=>a.kind==='before-restore'&&a.main).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];if(!latest)throw new Error('尚無還原前保護副本。');return withBackup(dataStore,'',blob=>downloadBlob(blob,'Life system 還原前本地備份.life-backup.json'),{snapshot:JSON.parse(latest.main)});},subscribe(fn){listeners.add(fn);fn({...state});return()=>listeners.delete(fn);},getState:()=>({...state}),getMetadata:()=>({...readMeta(),pending:Boolean(dirty()),lastSyncAt:null}),hasPendingChanges:()=>Boolean(dirty()),setLocalDataTime:updatedAt=>{const meta=readMeta();if(meta){writeMeta({...meta,updatedAt});if(queue[0])queue[0].updatedAt=updatedAt;}},noteSynchronized:updatedAt=>{const meta=readMeta(),doc=dataStore.get();writeMeta({...meta,revision:doc.revision,updatedAt:validTime(updatedAt)!==null?updatedAt:null,dueAt:null});localStorage.removeItem(dirtyKey);emit();},backupNow:async({automatic=false}={})=>{if(automatic)throw new Error('目前僅提供手動備份。');if(!getDriveState().connected)throw new Error('請先連接 Google Drive。');if(busy)throw new Error('雲端備份正在處理，請稍後再試。');if(!navigator.onLine)throw new Error('目前離線；請連線後重新點擊「上傳雲端」。');dataStore.refresh();enqueue(dataStore.get(),{manual:true});const completed=await flush();if(!completed||dirty()||queue.length)throw new Error(state.message);},list:async()=>newestBackups(await listDriveBackups()),async prepareVersion(versionId=null){if(busy)throw new Error('雲端備份正在處理，請完成後再還原。');const files=newestBackups(await listDriveBackups()),file=versionId?files.find(f=>f.id===versionId):files[0];if(!file)throw new Error(versionId?'所選雲端版本已不存在，請重新選擇。':'尚無可還原的雲端備份。');if(!Number.isFinite(Date.parse(file.createdTime??file.appProperties?.backupTime)))throw new Error('無法確認備份時間，已停止還原。');return {file,blob:await downloadDriveBackup(file)};},async prepareLatest(){return singleton.prepareVersion();},async restore(prepared,revision,{dataUpdatedAt=null}={}){const runtime=getSyncRuntime();if(runtime?.enabled&&runtime.pending())throw new Error('本地尚有未同步或未備份變更，請先上傳後再還原。');const applyLocal=async(document=prepared.payload.document,synchronized=false)=>{suppressed=true;try{await restoreBackup(dataStore,{...prepared,payload:{...prepared.payload,document}},revision,{beforeReplace:()=>preserveBeforeRestore(localStorage,revision),...(synchronized?{replaceDocument:doc=>dataStore.replaceSynchronized(doc,revision)}:{})});const doc=dataStore.get();prior=comparableDocument(doc);queue.length=0;localStorage.removeItem(dirtyKey);writeMeta({revision:doc.revision,updatedAt:validTime(dataUpdatedAt)!==null?dataUpdatedAt:null,dueAt:null});state.warning=null;unlock();emit('已還原雲端資料。');}finally{suppressed=false;}};if(runtime?.enabled)return runtime.restore(prepared,revision,{dataUpdatedAt,applyLocal:doc=>applyLocal(doc,true)});return applyLocal();},flush};return singleton;
}
