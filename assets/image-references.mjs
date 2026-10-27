import {maintainRecovery} from './recovery.mjs?v=affinity-20261027';
import {isImageReference,listImageAssets,openDatabase,revokeImageURL} from './image-store.mjs';
import {maintenance} from './coordination.mjs?v=characters-20261027';
const providers=new Map();
export function registerImageReferenceSource(name,read,{transient=true}={}) {
  if(providers.has(name)) throw new Error('重複的圖片引用來源');
  providers.set(name,{read,transient});return ()=>providers.delete(name);
}
export function collectReferences(value,refs=new Set()) {
  if(isImageReference(value)) refs.add(value);
  else if(typeof value==='string'&&value.startsWith('asset:')) throw new Error('無法辨識的圖片引用；已停止清理。');
  else if(Array.isArray(value)) value.forEach(v=>collectReferences(v,refs));
  else if(value&&typeof value==='object') Object.values(value).forEach(v=>collectReferences(v,refs));
  return refs;
}
export function documentImageReferences(state,{legacy=false,raw=false}={}) {
  if(!legacy&&!raw)state=maintainRecovery(state).document;
  const refs=new Set(),imageFields=['photo','avatar','photoEdit','avatarEdit','portraits'];
  const nonImageFields=['revision','statsRulesVersion','profile','activities','stats','history','undoHistory','historyVersion','settings','currentPortraitId','companion','affinity'];
  const roots=[state,...(legacy?state.history:state.undoHistory??[]).flatMap(record=>[record.before,record.after])];
  for(const root of roots){
    if(!root||typeof root!=='object')throw new Error('圖片快照尚未完整載入。');
    for(const field of imageFields)collectReferences(root[field],refs);
    // Unknown future root fields are protected conservatively. Known personal
    // text and journal labels are not interpreted as image references.
    for(const [field,value] of Object.entries(root))if(!imageFields.includes(field)&&!nonImageFields.includes(field))collectReferences(value,refs);
  }
  return refs;
}
export async function inspectImages(state) {
  if(!state?.profile||!Array.isArray(state.history)||!Array.isArray(state.portraits)) throw new Error('資料尚未完整載入，無法安全檢查圖片。');
  const refs=documentImageReferences(state),persistedRefs=new Set(refs),transientSources=[];
  for(const [name,{read,transient}] of providers) {
    const value=await read();if(value===undefined)throw new Error('圖片引用來源尚未就緒：'+name);const found=collectReferences(value);if(transient&&[...found].some(id=>!persistedRefs.has(id)))transientSources.push(name);found.forEach(id=>refs.add(id));
  }
  const assets=await listImageAssets();
  if([...refs].some(id=>!assets.some(a=>a.id===id&&a.blob instanceof Blob)))throw new Error('有圖片引用缺少原始檔案，已停止清理。');
  if(assets.some(a=>!(a.blob instanceof Blob)||!isImageReference(a.id)))throw new Error('有無法辨識的圖片資產，已停止清理。');
  const unused=assets.filter(a=>!refs.has(a.id)&&!(a.protectedUntil>Date.now()));
  return {refs,assets,unused,transientSources};
}
export function auditImages(store) {return maintenance(()=>{store.refresh();store.maintain();return inspectImages(store.get());});}
export function deleteUnusedImages(store,selected) {
  if(!globalThis.navigator?.locks)return Promise.reject(new Error('無法安全協調其他分頁，已停止刪除圖片。'));
  return navigator.locks.request('life-system.cloud-backup-pending.v1',{ifAvailable:true},lock=>{if(!lock)throw new Error('雲端備份尚有待處理圖片，請先完成備份或中斷Google連接再清理。');return maintenance(async()=>{
    store.refresh();store.maintain();const {unused}=await inspectImages(store.get());
    const selectedIDs=new Set(selected),safe=unused.filter(a=>selectedIDs.has(a.id));
    // The write lock is held from fresh reference discovery through IDB commit.
    const db=await openDatabase();
    await new Promise((resolve,reject)=>{const tx=db.transaction('images','readwrite'),images=tx.objectStore('images');
      safe.forEach(a=>images.delete(a.id));tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(new Error('刪除失敗，交易未完成。'));
    });
    safe.forEach(a=>revokeImageURL(a.id));
    return {deleted:safe.length,bytes:safe.reduce((sum,a)=>sum+a.blob.size,0),skipped:selectedIDs.size-safe.length};
  });});
}
