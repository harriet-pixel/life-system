// All durable writes share one origin-wide Web Lock. Drafts use a separate
// shared lock, so maintenance can fail closed rather than discard open edits.
export const WRITE_LOCK = 'life-system.write.v2';
const DRAFTS = {companion:'「夥伴 → 角色設定」',tasks:'「待辦事項 → 編輯事項」',profile:'「我的資料 → 使用者設定」（含立繪、頭像與我的最愛裁切）',appearance:'「設定 → 外觀設定」'};
const draftName=kind=>'life-system.drafts.v2.'+kind;
export function coordinatedWrite(work) {
  if (!globalThis.navigator?.locks) return Promise.reject(new Error('此瀏覽器缺少安全協調功能；請使用支援 Web Locks 的 HTTPS 瀏覽器。'));
  return navigator.locks.request(WRITE_LOCK, work);
}
export function maintenance(work) {
  if (!globalThis.navigator?.locks) return Promise.reject(new Error('無法安全協調其他分頁，已停止操作。'));
  const kinds=Object.keys(DRAFTS);
  const acquire=index=>index===kinds.length
    ? navigator.locks.request(WRITE_LOCK,{ifAvailable:true},lock=>{if(!lock)throw new Error('其他資料操作或備份進行中，請稍後重試。');return work();})
    : navigator.locks.request(draftName(kinds[index]),{ifAvailable:true},lock=>{
        if(!lock)throw new Error('請先儲存或取消'+DRAFTS[kinds[index]]+'的編輯（可能位於其他分頁），再重試。');
        return acquire(index+1);
      });
  return acquire(0);
}
export async function holdDraft(kind='profile') {
  if (!globalThis.navigator?.locks) throw new Error('無法保護編輯草稿，請使用支援 Web Locks 的瀏覽器。');
  if(!Object.hasOwn(DRAFTS,kind))throw new Error('未知的編輯來源。');
  let release;
  const held = new Promise(resolve => { release=resolve; });
  return new Promise((resolve,reject) => {
    navigator.locks.request(draftName(kind),{mode:'shared',ifAvailable:true},lock=>{
      if(!lock)throw new Error('備份、清理或還原進行中，請完成後再編輯。');
      resolve(release); return held;
    }).catch(reject);
  });
}
