import {validateWalletSnapshot} from './wallet-recovery.mjs?v=backup-chat-20261031';
import {emptyWallet,validateWallet,validateWalletEvidence} from './wallet-model.mjs?v=backup-chat-20261031';
import {normalizeStats} from './abilities.mjs?v=backup-chat-20261031';
// JSON object member order is not part of the schema (Drive records are canonicalized).
const sortedJSON=value=>JSON.stringify((function sort(v){return Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;})(value));
import {validateReplyManifest} from './characters-model.mjs?v=backup-chat-20261031';
import {validateRoleImageAssets} from './character-image-integrity.mjs?v=backup-chat-20261031';
import {validateAffinity,emptyAffinity} from './affinity-model.mjs?v=backup-chat-20261031';
import {validateCharacters,emptyCharacters} from './characters-model.mjs?v=backup-chat-20261031';
import {emptyHabits,validateHabits} from './habits-model.mjs?v=backup-chat-20261031';
import {emptyTasks,validateTasks,deletionEvidence} from './tasks-model.mjs?v=backup-chat-20261031';
import {maintainRecovery,RECOVERY_LIMIT,actionMetadata} from './recovery.mjs?v=backup-chat-20261031';
import {validateNewPassword,validateRestorePassword,validateProfileFields} from './validation.mjs?v=backup-chat-20261031';
import {ABILITIES} from './abilities.mjs?v=backup-chat-20261031';
import {maintenance} from './coordination.mjs?v=backup-chat-20261031';
import {inspectImages,documentImageReferences} from './image-references.mjs?v=backup-chat-20261031';
import {stageImageAssets,isImageReference,listImageAssets} from './image-store.mjs?v=backup-chat-20261031';
import {normalizeSettings} from './settings-model.mjs?v=backup-chat-20261031';
export const MAX_FILE_BYTES=150*1024*1024, MAX_CONTENT_BYTES=100*1024*1024, MAX_IMAGES=2000;
const encoder=new TextEncoder(), decoder=new TextDecoder('utf-8',{fatal:true});
const FORMAT='Life system backup', VERSION=1;
// Yield only explicit, potentially large backup work; keep the maintenance
// lock so another tab cannot change the captured data between these steps.
export const yieldBackupWork=()=>globalThis.scheduler?.yield?globalThis.scheduler.yield():new Promise(resolve=>setTimeout(resolve,0));
export const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
const b64=bytes=>{let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);};
function unb64(text,max=MAX_FILE_BYTES) {
  if(typeof text!=='string'||text.length>Math.ceil(max/3)*4||text.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(text))throw new Error('備份編碼或大小不正確。');
  const bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));if(bytes.length>max)throw new Error('備份超過大小限制。');return bytes;
}
function check(condition,message='備份結構驗證失敗。'){if(!condition)throw Object.assign(new Error(message),{code:'schema'});}
const topKeys=['revision','statsRulesVersion','profile','photo','avatar','photoEdit','avatarEdit','portraits','currentPortraitId','activities','stats','history','settings'];
const legacyKeys=[...topKeys,'tasks','habits','companion','affinity','replyLibrary','wallet'];topKeys.push('historyVersion','undoHistory','tasks','habits','companion','affinity','replyLibrary','wallet');
const editKeys=legacyKeys.filter(k=>!['revision','history','statsRulesVersion'].includes(k));
function safeObject(value,depth=0) {
  check(depth<40,'備份結構過深。');
  if(value&&typeof value==='object')for(const [key,child] of Object.entries(value)){
    check(!['__proto__','constructor','prototype'].includes(key)&&!/(?:access.?token|refresh.?token|client.?secret|password|api.?key|authorization|credential|connection.?state|^(?:token|secret|connected|connection|key)$)/i.test(key),'備份含不支援或認證欄位。');safeObject(child,depth+1);
  }
}
function validCrop(crop){return crop&&typeof crop==='object'&&['left','top','width','height'].every(k=>typeof crop[k]==='number'&&Number.isFinite(crop[k]))&&crop.left>=0&&crop.top>=0&&crop.width>0&&crop.height>0;}
function validateFields(value,full=false,legacy=false) {
  check(value&&typeof value==='object'&&!Array.isArray(value),'完整資料／復原快照必須是物件。');
  check(Object.keys(value).every(k=>(full?(legacy?legacyKeys:topKeys):editKeys).includes(k)),'備份含未知資料欄位，請使用相符版本。');
  if(full){const missing=(legacy?legacyKeys:topKeys).filter(k=>!['tasks','habits','companion','affinity','replyLibrary','wallet'].includes(k)&&!Object.hasOwn(value,k));check(!missing.length,'完整資料缺少必要欄位：'+missing.join('、')); check(value.statsRulesVersion===2,'不支援的數值規則版本。');}
  if(Object.hasOwn(value,'profile')){validateProfileFields(value.profile,undefined,{reading:true});check(value.profile&&['name','age','gender','bio','boundaries','motto'].every(k=>typeof value.profile[k]==='string'));check(value.profile.age===''||(/^\d+$/.test(value.profile.age)&&Number.isSafeInteger(Number(value.profile.age))));}
  if(Object.hasOwn(value,'stats')){
    const s=value.stats;if(Object.hasOwn(s,'currencyEarned'))check(Number.isSafeInteger(s.currencyEarned)&&s.currencyEarned>=0,'累積貨幣格式不正確。');check(s&&['experience','currency','level'].every(k=>Number.isSafeInteger(s[k])&&s[k]>=(k==='experience'?100:k==='level'?1:0))&&Array.isArray(s.abilities)&&s.abilities.length===5,'數值資料的等級、經驗、貨幣或五項能力格式不正確。');
    check(s.abilities.every((a,i)=>a.id===ABILITIES[i].id&&a.name===ABILITIES[i].name&&Number.isSafeInteger(a.value)&&a.value>=0),'備份結構：五項能力的ID、名稱、順序或整數值不正確。');
    check(new Set(s.abilities.map(a=>a.id)).size===5);
  }
  if(Object.hasOwn(value,'replyLibrary'))validateReplyManifest(value.replyLibrary,value.companion);
  if(Object.hasOwn(value,'affinity'))validateAffinity(value.affinity,value.companion);
  if(Object.hasOwn(value,'companion'))validateCharacters(value.companion);
  if(Object.hasOwn(value,'habits'))validateHabits(value.habits);
  if(Object.hasOwn(value,'tasks'))validateTasks(value.tasks);
  if(Object.hasOwn(value,'wallet')){if(!full&&value.wallet?.snapshotVersion===1){const s=validateWalletSnapshot(value.wallet);validateWallet({...emptyWallet(),stateId:s.stateId,lastChange:s.lastChange,[s.collection]:s.value===null?{}:{[s.id]:s.value}});}else validateWallet(value.wallet);}
  if(Object.hasOwn(value,'activities'))check(value.activities&&typeof value.activities==='object'&&!Array.isArray(value.activities)&&Object.values(value.activities).every(v=>typeof v==='boolean'));
  if(Object.hasOwn(value,'portraits'))check(Array.isArray(value.portraits)&&value.portraits.length<=6&&new Set(value.portraits.map(p=>p.id)).size===value.portraits.length&&value.portraits.every(p=>typeof p.id==='string'&&isImageReference(p.image)&&(p.source===undefined||p.source===null||isImageReference(p.source))&&(p.crop===undefined||p.crop===null||validCrop(p.crop))));
  for(const key of ['photo','avatar'])if(Object.hasOwn(value,key))check(value[key]===null||isImageReference(value[key]));
  for(const key of ['photoEdit','avatarEdit'])if(Object.hasOwn(value,key))check(value[key]===null||(value[key]&&typeof value[key]==='object'&&(value[key].source===undefined||value[key].source===null||isImageReference(value[key].source))&&validCrop(value[key].crop)));
  if(Object.hasOwn(value,'currentPortraitId'))check(value.currentPortraitId===null||typeof value.currentPortraitId==='string');
  if(Object.hasOwn(value,'settings')){const normalized=normalizeSettings(value.settings);check(sortedJSON(normalized.appearance)===sortedJSON(value.settings.appearance),'備份設定格式不正確。');if(Object.hasOwn(value.settings,'ai'))check(sortedJSON(normalized.ai)===sortedJSON(value.settings.ai),'AI 備份僅可含服務商與模型偏好。');if(!legacy)check(!Object.hasOwn(value.settings,'history'),'備份含舊版歷史設定。');}
}
function validateRecord(r,doc,{snapshot=false,legacy=false}={}){
 check(typeof r.id==='string'&&typeof r.time==='string'&&(!snapshot||legacy||Number.isFinite(Date.parse(r.time)))&&['type','label','target'].every(k=>typeof r[k]==='string')&&Array.isArray(r.fields)&&r.fields.every(k=>typeof k==='string')&&typeof r.undone==='boolean','行動紀錄的ID、時間、類型或狀態格式不正確。');
 check(r.delta&&Array.isArray(r.delta.abilities)&&r.delta.abilities.every(a=>typeof a.id==='string'&&Number.isFinite(a.value)),'行動紀錄的能力差額格式不正確。');
 for(const k of ['experience','currency','level'])check(Number.isFinite(r.delta[k]),'行動紀錄的數值差額不是有限數字。');
 if(r.undone)check(Number.isFinite(Date.parse(r.undoneAt)),'Undo 時間格式不正確。');
 if(snapshot){
  if(r.redoable)check(r.undone&&Number.isSafeInteger(r.undoOrder)&&r.undoOrder<=doc.revision,'Redo 紀錄的狀態、排序或資料版本不一致。');
  if(r.affinityPlan){check(doc.affinity?.version===1&&Array.isArray(r.affinityPlan));for(const p of r.affinityPlan)check(typeof p.sourceKey==='string'&&typeof p.origin==='string'&&[p.before,p.after].every(s=>s&&Number.isSafeInteger(s.quantity)&&s.quantity>=0&&(s.characterId===null||doc.companion?.characters.some(c=>c.characterId===s.characterId)||doc.companion?.deletedCharacterIds.includes(s.characterId))));}
  validateFields(r.before,false,legacy);validateFields(r.after,false,legacy);check(Object.keys(r.before).length>0&&JSON.stringify(Object.keys(r.before).sort())===JSON.stringify(Object.keys(r.after).sort()),'復原快照前後欄位不一致或為空。');
 }else check(Object.keys(r).every(k=>['id','time','type','label','target','fields','delta','undone','undoneAt'].includes(k)),'行動紀錄不可包含個人資料或圖片快照。');
}
export function validateDocument(doc,{legacy=false}={}){
 safeObject(doc);validateFields(doc,true,legacy);
 if(doc.wallet)validateWalletEvidence(doc);
 check(Number.isSafeInteger(doc.revision)&&doc.revision>=0&&Array.isArray(doc.history),'完整資料的版本或行動紀錄格式不正確。');
 check(new Set(doc.history.map(r=>r.id)).size===doc.history.length);
 if(legacy){check(doc.history.length<=50);doc.history.forEach(r=>validateRecord(r,doc,{snapshot:true,legacy:true}));}
 else{
  check(doc.historyVersion===1&&Array.isArray(doc.undoHistory)&&doc.undoHistory.length<=RECOVERY_LIMIT,'復原紀錄版本、格式或筆數不正確。');
  doc.history.forEach((r,i)=>{try{validateRecord(r,doc);}catch(e){throw Object.assign(new Error('行動紀錄第'+(i+1)+'筆：'+e.message),{code:'schema'});}});
  check(new Set(doc.undoHistory.map(r=>r.id)).size===doc.undoHistory.length);
  for(const r of doc.undoHistory){validateRecord(r,doc,{snapshot:true});const meta=doc.history.find(m=>m.id===r.id);check(meta&&sortedJSON(actionMetadata(r))===sortedJSON(meta),'復原紀錄與行動紀錄不一致。');}
 }
 if(doc.tasks){const actions=new Map(doc.history.map(r=>[r.id,r]));for(const c of doc.tasks.completions){let r=actions.get(c.transactionId);if(r?.type==='task.completed.batch'){const evidence=deletionEvidence(doc,c);r={...r,type:'task.completed',delta:{currency:evidence.currency,experience:evidence.experience,abilities:ABILITIES.map(a=>({id:a.id,value:evidence.abilities[a.id]}))}};}check(r?.type==='task.completed','完成紀錄缺少原獎勵交易。');for(const key of ['currency','experience'])if(c.reward?.[key]!=null)check(r.delta[key]===c.reward[key],'完成紀錄與獎勵交易不一致。');if(c.reward?.abilities)check(ABILITIES.every(a=>r.delta.abilities.filter(d=>d.id===a.id).length===1&&r.delta.abilities.find(d=>d.id===a.id)?.value===c.reward.abilities[a.id]),'完成紀錄與能力交易不一致。');if(c.retraction){const reversal=actions.get(c.retraction.transactionId),reward=c.retraction.reward;if(['recorded','history'].includes(c.retraction.method))check(ABILITIES.every(a=>r.delta.abilities.find(d=>d.id===a.id)?.value===reward.abilities[a.id]),'撤回能力與原交易不一致。');else check(c.reward?.abilities==null&&r.delta.abilities.length===0,'有原始能力紀錄時不得改用推估。');const group=doc.tasks.completions.filter(entry=>entry.retraction?.transactionId===c.retraction.transactionId),sum={currency:0,experience:0,abilities:Object.fromEntries(ABILITIES.map(a=>[a.id,0]))};for(const entry of group){sum.currency+=entry.retraction.reward.currency;sum.experience+=entry.retraction.reward.experience;ABILITIES.forEach(a=>sum.abilities[a.id]+=entry.retraction.reward.abilities[a.id]);}check(reversal?.type==='task.deleted-completed'&&!reversal.undone&&reversal.delta.currency===-sum.currency&&reversal.delta.experience===-sum.experience&&reversal.delta.abilities.length===5&&ABILITIES.every(a=>reversal.delta.abilities.filter(d=>d.id===a.id).length===1&&reversal.delta.abilities.find(d=>d.id===a.id)?.value===-sum.abilities[a.id]),'撤回紀錄與反向交易不一致。');}}}

 return doc;
}
export const dataCount=doc=>(doc.wallet?Object.keys(doc.wallet.items).length+Object.keys(doc.wallet.records).length:0)+(doc.affinity?doc.affinity.transactions.length+Object.keys(doc.affinity.penalties).length:0)+(doc.companion?doc.companion.characters.length+doc.companion.switchHistory.length+doc.companion.deletedCharacterIds.length:0)+(doc.habits?doc.habits.periods.length+doc.habits.records.length+doc.habits.bonusItems.length+doc.habits.bonusRecords.length:0)+3+doc.portraits.length+Object.keys(doc.activities).length+doc.history.length+(doc.tasks?doc.tasks.definitions.length+doc.tasks.occurrences.length+doc.tasks.completions.length+doc.tasks.categories.length:0);
async function passwordKey(password,salt,usage) {
  check(typeof password==='string'&&password.length>0&&password.length<=1024,'請輸入備份密碼。');
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},key,{name:'AES-GCM',length:256},false,[usage]);
}
export async function encodeBackup(payload,password='') {
  const raw=encoder.encode(JSON.stringify(payload));check(raw.length<=MAX_FILE_BYTES,'備份超過 150 MiB 檔案上限。');
  const envelope={format:FORMAT,version:VERSION,encrypted:Boolean(password)};
  if(password){const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));const key=await passwordKey(password,salt,'encrypt');
    Object.assign(envelope,{algorithm:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:600000,salt:b64(salt),iv:b64(iv),ciphertext:b64(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(FORMAT+VERSION)},key,raw)))});
  }else{envelope.payload=payload;envelope.sha256=await hash(raw);}
  const blob=new Blob([JSON.stringify(envelope)],{type:'application/json'});check(blob.size<=MAX_FILE_BYTES,'備份超過 150 MiB 檔案上限。');return blob;
}
export async function withBackup(store,password,consume,{snapshot,chatSnapshot}={}) {
  validateNewPassword(password);
  return maintenance(async()=>{
    store.refresh();store.maintain();await yieldBackupWork();
    const document=snapshot?maintainRecovery(snapshot).document:store.get();await yieldBackupWork();
    validateDocument(document);check(encoder.encode(JSON.stringify(document)).length<=10*1024*1024,'資料文件超過 10 MiB 備份上限；目前資料與行動紀錄均保留。');await yieldBackupWork();
    const {assets,refs,transientSources}=await inspectImages(document,{maintained:true});
    check(!transientSources.length,'請先儲存或取消以下圖片操作再備份：'+transientSources.join('、'));
    const ownRefs=documentImageReferences(document,{raw:true});check(ownRefs.size<=MAX_IMAGES);let size=0;
    const images=[];
    for(const asset of assets.filter(a=>ownRefs.has(a.id))){size+=asset.blob.size;check(size<=MAX_CONTENT_BYTES,'圖片總容量超過 100 MiB。');const bytes=new Uint8Array(await asset.blob.arrayBuffer());check(asset.id==='asset:'+await hash(bytes),'本機圖片完整性驗證失敗。');images.push({id:asset.id,mime:asset.blob.type,size:asset.blob.size,createdAt:asset.createdAt??null,name:asset.name??null,sha256:await hash(bytes),data:b64(bytes)});}
    const replyAssets=document.replyLibrary?await (await import('./reply-store.mjs?v=backup-chat-20261031')).exportReplyAssets(document.replyLibrary):undefined;
    const chatBackup=await import('./chat-backup.mjs?v=backup-chat-20261031');const chats=chatSnapshot===undefined?await chatBackup.exportChatBackup(document):chatBackup.validateChatBackup(chatSnapshot,document);
    const payload={chats,...(replyAssets?{replyAssets}:{}),formatVersion:VERSION,dataVersion:3,createdAt:new Date().toISOString(),dataCount:dataCount(document),imageCount:images.length,document,images};
    return consume(await encodeBackup(payload,password),payload);
  });
}
export async function inspectBackupFile(file){
  check(file&&file.size<=MAX_FILE_BYTES&&file.size>0,'檔案上限為 150 MiB。');
  let envelope;try{envelope=JSON.parse(await file.text());}catch{throw new Error('無法讀取備份 JSON。');}
  check(envelope&&envelope.format===FORMAT&&envelope.version===VERSION&&typeof envelope.encrypted==='boolean','不支援的備份格式或版本。');
  // Bound the outer structure before opening password UI; no payload is trusted.
  safeObject(envelope);
  if(envelope.encrypted){check(envelope.algorithm==='AES-256-GCM'&&envelope.kdf==='PBKDF2-SHA256'&&envelope.iterations===600000,'不支援的加密格式。');check(typeof envelope.ciphertext==='string'&&envelope.ciphertext.length<=MAX_FILE_BYTES*4/3);check(unb64(envelope.salt,16).length===16&&unb64(envelope.iv,12).length===12);}
  else check(envelope.payload&&typeof envelope.sha256==='string');
  return {encrypted:envelope.encrypted};
}
export async function readBackup(file,password='') {
  validateRestorePassword(password);await inspectBackupFile(file);
  const envelope=JSON.parse(await file.text());
  let payload;
  if(envelope.encrypted===true){
    check(envelope.algorithm==='AES-256-GCM'&&envelope.kdf==='PBKDF2-SHA256'&&envelope.iterations===600000,'不支援的加密格式。');
    const salt=unb64(envelope.salt,16),iv=unb64(envelope.iv,12);check(salt.length===16&&iv.length===12);
    const cipher=unb64(envelope.ciphertext);let plain;
    try{const key=await passwordKey(password,salt,'decrypt');plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:encoder.encode(FORMAT+VERSION)},key,cipher);}catch{throw new Error('密碼錯誤，或備份檔案已損毀');}
    try{payload=JSON.parse(decoder.decode(plain));}catch{throw new Error('解密後的備份內容不是有效 JSON。');}
  }else{
    check(envelope.encrypted===false&&envelope.payload);check(await hash(encoder.encode(JSON.stringify(envelope.payload)))===envelope.sha256,'備份完整性驗證失敗。');payload=envelope.payload;
  }
  check(payload.formatVersion===VERSION&&[2,3].includes(payload.dataVersion),'不支援的資料版本；此版本使用 Lv1／經驗值基準 100 的數值規則，原資料未更動。');
  check(Number.isFinite(Date.parse(payload.createdAt))&&Array.isArray(payload.images)&&payload.images.length<=MAX_IMAGES);
  check(encoder.encode(JSON.stringify(payload.document)).length<=10*1024*1024,'資料文件超過 10 MiB。');
  validateDocument(payload.document,{legacy:payload.dataVersion===2});
  if(payload.chats!==undefined)(await import('./chat-backup.mjs?v=backup-chat-20261031')).validateChatBackup(payload.chats,payload.document);
  check(payload.dataCount===dataCount(payload.document)&&payload.imageCount===payload.images.length);
  const ids=new Set(),assets=[];let total=0;
  for(const item of payload.images){
    check(isImageReference(item.id)&&!ids.has(item.id)&&['image/png','image/jpeg','image/webp'].includes(item.mime));ids.add(item.id);
    check(Number.isSafeInteger(item.size)&&item.size>=0&&item.size<=MAX_CONTENT_BYTES);total+=item.size;check(total<=MAX_CONTENT_BYTES,'圖片總容量超過 100 MiB。');
    const bytes=unb64(item.data,MAX_CONTENT_BYTES);check(bytes.length===item.size&&await hash(bytes)===item.sha256&&item.id==='asset:'+item.sha256,'圖片完整性驗證失敗。');
    const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
    const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
    check(item.mime==='image/png'?png:item.mime==='image/jpeg'?jpeg:webp,'圖片內容格式不正確。');
    check(item.name===null||typeof item.name==='string');check(item.createdAt===null||Number.isFinite(Date.parse(item.createdAt)));
    const blob=new Blob([bytes],{type:item.mime});if(globalThis.createImageBitmap){let image;try{image=await createImageBitmap(blob);}catch{throw new Error('圖片內容無法解碼，原資料未更動。');}finally{image?.close();}}
    assets.push({id:item.id,blob,name:item.name,createdAt:item.createdAt,protectedUntil:0});
  }
  await validateRoleImageAssets(payload.document,assets);
  const refs=documentImageReferences(payload.document,{legacy:payload.dataVersion===2,raw:true});check([...refs].every(id=>ids.has(id)),'備份缺少必要圖片。');check(ids.size===refs.size,'備份含不在範圍內的圖片。');
  // Verify the original inventory before discarding expired legacy snapshots.
  // Never renew timestamps. Import only images still required at restore time.
  if(payload.document.replyLibrary||payload.replyAssets)await (await import('./reply-store.mjs?v=backup-chat-20261031')).validateReplyAssets(payload.document.replyLibrary,payload.replyAssets??[],payload.document.companion);
  const source=structuredClone(payload.document);source.stats=normalizeStats(source.stats);source.wallet??=emptyWallet();for(const r of source.undoHistory??source.history)for(const snap of [r.before,r.after])if(snap?.stats)snap.stats=normalizeStats(snap.stats);
  const document=maintainRecovery(source).document;document.settings=normalizeSettings(document.settings);
  for(const r of document.undoHistory)for(const snapshot of [r.before,r.after])if(snapshot.settings)snapshot.settings=normalizeSettings(snapshot.settings);
  document.companion ??= emptyCharacters();document.affinity ??= emptyAffinity();
  document.tasks ??= emptyTasks();
  document.habits ??= emptyHabits();
  const normalized=maintainRecovery(document).document;validateDocument(normalized);
  const liveRefs=documentImageReferences(normalized);
  return {payload:{...payload,dataVersion:3,document:normalized,dataCount:dataCount(normalized)},assets:assets.filter(a=>liveRefs.has(a.id))};
}
export async function restoreBackup(store,prepared,expectedRevision,{beforeReplace,afterReplace,replaceDocument}={}) {
  return maintenance(async()=>{
    store.refresh();check(store.get().revision===expectedRevision,'確認期間資料已改變，請重新選取備份。');
    validateDocument(prepared.payload.document);
    // Stage only content-addressed images. The original document and images are
    // retained until a single atomic localStorage write publishes the new state.
    const existing=await listImageAssets();
    for(const asset of prepared.assets){const prior=existing.find(a=>a.id===asset.id);if(prior&&(!(prior.blob instanceof Blob)||'asset:'+await hash(await prior.blob.arrayBuffer())!==asset.id))throw new Error('本機同 ID 圖片的完整性異常，已停止還原並保留原資料。');}
    const required=documentImageReferences(prepared.payload.document),available=new Set([...existing,...prepared.assets].map(a=>a.id));
    check([...required].every(id=>available.has(id)),'還原缺少必要圖片，原資料已保留。');
    for(const asset of prepared.assets)check(asset.blob instanceof Blob&&'asset:'+await hash(await asset.blob.arrayBuffer())===asset.id,'還原圖片完整性不正確，原資料已保留。');
    await validateRoleImageAssets(prepared.payload.document,[...existing,...prepared.assets]);await beforeReplace?.();
    if(prepared.payload.document.replyLibrary||prepared.payload.replyAssets)await (await import('./reply-store.mjs?v=backup-chat-20261031')).importReplyAssets(prepared.payload.document.replyLibrary,prepared.payload.replyAssets??[],prepared.payload.document.companion);
    await stageImageAssets(prepared.assets);
    const document=maintainRecovery(prepared.payload.document).document;let chatEpoch;if(prepared.payload.chats!==undefined){check(!replaceDocument,'聊天還原不支援舊自動同步流程。');chatEpoch=crypto.randomUUID();await (await import('./chat-backup.mjs?v=backup-chat-20261031')).stageChatBackup(prepared.payload.chats,document,chatEpoch);}if(replaceDocument)await replaceDocument(document);else store.replace(document,{chatEpoch});await afterReplace?.();
  });
}
export function backupFilename(){return 'Life system '+new Date().toISOString().replace(/[:.]/g,'-')+'.life-backup.json';}
export function downloadBlob(blob,name=backupFilename()) {
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
