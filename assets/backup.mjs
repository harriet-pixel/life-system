import {ABILITIES} from './abilities.mjs';
import {maintenance} from './coordination.mjs';
import {inspectImages,documentImageReferences} from './image-references.mjs';
import {stageImageAssets,isImageReference,listImageAssets} from './image-store.mjs';
import {normalizeSettings} from './settings-model.mjs';
export const MAX_FILE_BYTES=150*1024*1024, MAX_CONTENT_BYTES=100*1024*1024, MAX_IMAGES=2000;
const encoder=new TextEncoder(), decoder=new TextDecoder('utf-8',{fatal:true});
const FORMAT='Life system backup', VERSION=1;
export const hash=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
const b64=bytes=>{let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);};
function unb64(text,max=MAX_FILE_BYTES) {
  if(typeof text!=='string'||text.length>Math.ceil(max/3)*4||text.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(text))throw new Error('備份編碼或大小不正確。');
  const bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));if(bytes.length>max)throw new Error('備份超過大小限制。');return bytes;
}
function check(condition,message='備份結構驗證失敗。'){if(!condition)throw new Error(message);}
const topKeys=['revision','statsRulesVersion','profile','photo','avatar','photoEdit','avatarEdit','portraits','currentPortraitId','activities','stats','history','settings'];
const editKeys=topKeys.filter(k=>!['revision','history','statsRulesVersion'].includes(k));
function safeObject(value,depth=0) {
  check(depth<40,'備份結構過深。');
  if(value&&typeof value==='object')for(const [key,child] of Object.entries(value)){
    check(!['__proto__','constructor','prototype'].includes(key)&&!/(?:access.?token|refresh.?token|client.?secret|password)/i.test(key),'備份含不支援或認證欄位。');safeObject(child,depth+1);
  }
}
function validCrop(crop){return crop&&typeof crop==='object'&&['left','top','width','height'].every(k=>typeof crop[k]==='number'&&Number.isFinite(crop[k]))&&crop.left>=0&&crop.top>=0&&crop.width>0&&crop.height>0;}
function validateFields(value,full=false) {
  check(value&&typeof value==='object'&&!Array.isArray(value));
  check(Object.keys(value).every(k=>(full?topKeys:editKeys).includes(k)),'備份含未知資料欄位，請使用相符版本。');
  if(full){check(topKeys.every(k=>Object.hasOwn(value,k)));check(value.statsRulesVersion===2,'不支援的數值規則版本。');}
  if(Object.hasOwn(value,'profile')){check(value.profile&&['name','age','gender','bio','boundaries','motto'].every(k=>typeof value.profile[k]==='string'));check(value.profile.age===''||(/^\d+$/.test(value.profile.age)&&Number.isSafeInteger(Number(value.profile.age))));}
  if(Object.hasOwn(value,'stats')){
    const s=value.stats;check(s&&['experience','currency','level'].every(k=>Number.isSafeInteger(s[k])&&s[k]>=(k==='experience'?100:k==='level'?1:0))&&Array.isArray(s.abilities)&&s.abilities.length===5);
    check(s.abilities.every((a,i)=>a.id===ABILITIES[i].id&&a.name===ABILITIES[i].name&&Number.isSafeInteger(a.value)&&a.value>=0));
    check(new Set(s.abilities.map(a=>a.id)).size===5);
  }
  if(Object.hasOwn(value,'activities'))check(value.activities&&typeof value.activities==='object'&&!Array.isArray(value.activities)&&Object.values(value.activities).every(v=>typeof v==='boolean'));
  if(Object.hasOwn(value,'portraits'))check(Array.isArray(value.portraits)&&value.portraits.length<=6&&new Set(value.portraits.map(p=>p.id)).size===value.portraits.length&&value.portraits.every(p=>typeof p.id==='string'&&isImageReference(p.image)&&(p.source===undefined||p.source===null||isImageReference(p.source))&&(p.crop===undefined||p.crop===null||validCrop(p.crop))));
  for(const key of ['photo','avatar'])if(Object.hasOwn(value,key))check(value[key]===null||isImageReference(value[key]));
  for(const key of ['photoEdit','avatarEdit'])if(Object.hasOwn(value,key))check(value[key]===null||(value[key]&&typeof value[key]==='object'&&(value[key].source===undefined||value[key].source===null||isImageReference(value[key].source))&&validCrop(value[key].crop)));
  if(Object.hasOwn(value,'currentPortraitId'))check(value.currentPortraitId===null||typeof value.currentPortraitId==='string');
  if(Object.hasOwn(value,'settings'))check(JSON.stringify(normalizeSettings(value.settings))===JSON.stringify(value.settings),'備份設定格式不正確。');
}
export function validateDocument(doc) {
  safeObject(doc);validateFields(doc,true);
  check(Number.isSafeInteger(doc.revision)&&doc.revision>=0&&Array.isArray(doc.history)&&doc.history.length<=50);
  check(new Set(doc.history.map(r=>r.id)).size===doc.history.length);
  for(const r of doc.history){
    check(typeof r.id==='string'&&Number.isFinite(Date.parse(r.time))&&['type','label','target'].every(k=>typeof r[k]==='string')&&Array.isArray(r.fields)&&r.fields.every(k=>typeof k==='string')&&typeof r.undone==='boolean');
    check(r.delta&&Array.isArray(r.delta.abilities)&&r.delta.abilities.every(a=>typeof a.id==='string'&&Number.isFinite(a.value)));
    for(const k of ['experience','currency','level'])check(Number.isFinite(r.delta[k]));
    if(r.undone)check(Number.isFinite(Date.parse(r.undoneAt)));
    if(r.redoable)check(r.undone&&Number.isSafeInteger(r.undoOrder)&&r.undoOrder<=doc.revision);
    validateFields(r.before);validateFields(r.after);check(Object.keys(r.before).length>0&&JSON.stringify(Object.keys(r.before).sort())===JSON.stringify(Object.keys(r.after).sort()));
  }
  return doc;
}
export const dataCount=doc=>3+doc.portraits.length+Object.keys(doc.activities).length+doc.history.length;
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
export async function withBackup(store,password,consume) {
  return maintenance(async()=>{
    store.refresh();const document=validateDocument(store.get()),{assets,refs,transientSources}=await inspectImages(document);
    check(!transientSources.length,'請先儲存或取消以下圖片操作再備份：'+transientSources.join('、'));
    check(refs.size<=MAX_IMAGES);let size=0;
    const images=[];
    for(const asset of assets.filter(a=>refs.has(a.id))){size+=asset.blob.size;check(size<=MAX_CONTENT_BYTES,'圖片總容量超過 100 MiB。');const bytes=new Uint8Array(await asset.blob.arrayBuffer());check(asset.id==='asset:'+await hash(bytes),'本機圖片完整性驗證失敗。');images.push({id:asset.id,mime:asset.blob.type,size:asset.blob.size,createdAt:asset.createdAt??null,name:asset.name??null,sha256:await hash(bytes),data:b64(bytes)});}
    const payload={formatVersion:VERSION,dataVersion:2,createdAt:new Date().toISOString(),dataCount:dataCount(document),imageCount:images.length,document,images};
    return consume(await encodeBackup(payload,password),payload);
  });
}
export async function readBackup(file,password='') {
  check(file.size<=MAX_FILE_BYTES&&file.size>0,'檔案上限為 150 MiB。');
  let envelope;try{envelope=JSON.parse(await file.text());}catch{throw new Error('無法讀取備份 JSON。');}
  check(envelope.format===FORMAT&&envelope.version===VERSION,'不支援的備份格式或版本。');
  let payload;
  if(envelope.encrypted===true){
    check(envelope.algorithm==='AES-256-GCM'&&envelope.kdf==='PBKDF2-SHA256'&&envelope.iterations===600000,'不支援的加密格式。');
    const salt=unb64(envelope.salt,16),iv=unb64(envelope.iv,12);check(salt.length===16&&iv.length===12);
    try{const key=await passwordKey(password,salt,'decrypt');const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:encoder.encode(FORMAT+VERSION)},key,unb64(envelope.ciphertext));payload=JSON.parse(decoder.decode(plain));}catch{throw new Error('密碼錯誤或備份已損毀，原資料未更動。');}
  }else{
    check(envelope.encrypted===false&&envelope.payload);check(await hash(encoder.encode(JSON.stringify(envelope.payload)))===envelope.sha256,'備份完整性驗證失敗。');payload=envelope.payload;
  }
  check(payload.formatVersion===VERSION&&payload.dataVersion===2,'不支援的資料版本；此版本使用 Lv1／經驗值基準 100 的數值規則，原資料未更動。');
  check(Number.isFinite(Date.parse(payload.createdAt))&&Array.isArray(payload.images)&&payload.images.length<=MAX_IMAGES);
  check(encoder.encode(JSON.stringify(payload.document)).length<=10*1024*1024,'資料文件超過 10 MiB。');
  validateDocument(payload.document);
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
  const refs=documentImageReferences(payload.document);check([...refs].every(id=>ids.has(id)),'備份缺少必要圖片。');check(ids.size===refs.size,'備份含不在範圍內的圖片。');
  return {payload,assets};
}
export async function restoreBackup(store,prepared,expectedRevision) {
  return maintenance(async()=>{
    store.refresh();check(store.get().revision===expectedRevision,'確認期間資料已改變，請重新選取備份。');
    validateDocument(prepared.payload.document);
    // Stage only content-addressed images. The original document and images are
    // retained until a single atomic localStorage write publishes the new state.
    const existing=await listImageAssets();
    for(const asset of prepared.assets){const prior=existing.find(a=>a.id===asset.id);if(prior&&(!(prior.blob instanceof Blob)||'asset:'+await hash(await prior.blob.arrayBuffer())!==asset.id))throw new Error('本機同 ID 圖片的完整性異常，已停止還原並保留原資料。');}
    await stageImageAssets(prepared.assets);
    store.replace(prepared.payload.document);
  });
}
export function backupFilename(){return 'Life system '+new Date().toISOString().replace(/[:.]/g,'-')+'.life-backup.json';}
export function downloadBlob(blob,name=backupFilename()) {
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
