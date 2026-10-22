// Image bytes live once in IndexedDB; the existing atomic journal stores references.
export const IMAGE_DATABASE = 'life-system.images.v1';
const PREFIX = 'asset:';
const urls = new Map();
let database;
export function openDatabase() {
  if (!database) database = new Promise((resolve,reject)=>{
    let request;try{request=indexedDB.open(IMAGE_DATABASE,1);}catch{reject(new Error('無法開啟圖片儲存空間；原資料已保留，請確認瀏覽器權限後重新整理。'));return;}
    request.onupgradeneeded=()=>request.result.createObjectStore('images',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(new Error('無法開啟圖片儲存空間；原資料已保留。'));
  });
  return database;
}
export const isImageReference = value => typeof value==='string' && /^asset:[a-f0-9]{64}$/.test(value);
export async function imageURL(reference) {
  if (!isImageReference(reference)) return reference;
  if (urls.has(reference)) return urls.get(reference);
  const db=await openDatabase();
  const entry=await new Promise((resolve,reject)=>{const request=db.transaction('images').objectStore('images').get(reference);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('圖片讀取失敗。'));});
  if (!entry?.blob) throw new Error('找不到已保存圖片；原資料未更動。');
  const url=URL.createObjectURL(entry.blob);urls.set(reference,url);return url;
}
export async function storeImage(dataURL) {
  if (!/^data:image\/(png|jpeg|webp);base64,/.test(dataURL)) return dataURL;
  const blob=await (await fetch(dataURL)).blob();
  const bytes=await blob.arrayBuffer();
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
  const id=PREFIX+hash,db=await openDatabase();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction('images','readwrite');const store=tx.objectStore('images'),request=store.get(id);
    request.onsuccess=()=>{if(!request.result)store.put({id,blob,createdAt:new Date().toISOString(),protectedUntil:Date.now()+86400000});};
    tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(new Error('圖片儲存失敗，可能是空間不足；尚未套用本次設定。'));
  }).catch(()=>{throw new Error('圖片儲存失敗，可能是空間不足；尚未套用本次設定。');});
  if (!urls.has(id)) urls.set(id,URL.createObjectURL(blob));return id;
}
export async function prepareImageReferences(value) {
  const pending=new Map();
  async function visit(item) {
    if(typeof item==='string' && /^data:image\/(png|jpeg|webp);base64,/.test(item)){
      if(!pending.has(item))pending.set(item,storeImage(item));return pending.get(item);
    }
    if(Array.isArray(item))return Promise.all(item.map(visit));
    if(item && typeof item==='object')return Object.fromEntries(await Promise.all(Object.entries(item).map(async([key,child])=>[key,await visit(child)])));
    return item;
  }
  return visit(value);
}
export async function migrateImages(storage,key) {
  const raw=storage.getItem(key);if(!raw)return;
  const value=JSON.parse(raw);
  // Only image-bearing data is migrated. Private text is never inspected as an image.
  let changed=false;
  const roots=[value,...(value.history??[]).flatMap(record=>[record.before,record.after])];
  for(const root of roots)for(const field of ['photo','avatar','photoEdit','avatarEdit','portraits'])if(root && Object.hasOwn(root,field)){const original=JSON.stringify(root[field]);root[field]=await prepareImageReferences(root[field]);if(JSON.stringify(root[field])!==original)changed=true;}
  if(changed){
    value.revision=(value.revision??0)+1;
    const next=JSON.stringify(value);
    if(storage.getItem(key)!==raw)throw new Error('資料已在其他頁面更新，請重新整理後重試圖片升級。');
    try{storage.setItem(key,next);}catch{throw new Error('圖片升級尚未完成，原本的圖片與資料已保留。請確認瀏覽器儲存權限。');}
  }
}
// No automatic garbage collection. Permanent deletion is settings-only.
export async function listImageAssets() {
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{const tx=db.transaction('images');const r=tx.objectStore('images').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('無法讀取圖片資產，已停止清理。'));});
}
export function revokeImageURL(id) { if(urls.has(id)){URL.revokeObjectURL(urls.get(id));urls.delete(id);} }
export async function stageImageAssets(entries) {
 const db=await openDatabase();
 return new Promise((resolve,reject)=>{const tx=db.transaction('images','readwrite'),store=tx.objectStore('images');
  for(const entry of entries) {const r=store.get(entry.id);r.onsuccess=()=>{if(!r.result)store.put(entry);};}
  tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(new Error('圖片寫入失敗；目前資料仍保留。'));
 });
}

if(typeof window!=='undefined')window.addEventListener('pagehide',()=>{for(const id of [...urls.keys()])revokeImageURL(id);});
