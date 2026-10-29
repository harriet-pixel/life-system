import {IMAGE_LIMITS,validateCharacterImages} from './character-images-model.mjs?v=daily-polish-20261029';
// Used only during explicit save/backup/restore/maintenance, never first paint.
export async function validateRoleImageAssets(document,assets){
 const uses=new Map();for(const c of document.companion?.characters??[])for(const item of Object.values(validateCharacterImages(c.imageSettings).emotions))for(const key of ['image','thumbnail']){if(!uses.has(item[key]))uses.set(item[key],new Set());uses.get(item[key]).add(key);}
 for(const [id,kinds]of uses){const blob=assets.find(a=>a.id===id)?.blob;
  if(!(blob instanceof Blob)||!['image/png','image/jpeg','image/webp'].includes(blob.type)||blob.size>(kinds.has('thumbnail')?IMAGE_LIMITS.thumbnailBytes:IMAGE_LIMITS.bytes))throw new Error('角色圖片缺少檔案或超出格式／容量限制；原資料已保留。');
  const actual='asset:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');if(actual!==id)throw new Error('角色圖片內容雜湊不符，原資料已保留。');
  if(globalThis.createImageBitmap){let image;try{image=await createImageBitmap(blob);if(image.width*4!==image.height*3||image.width>(kinds.has('thumbnail')?IMAGE_LIMITS.thumbnailEdge:IMAGE_LIMITS.maxEdge)*3/4||image.height>(kinds.has('thumbnail')?IMAGE_LIMITS.thumbnailEdge:IMAGE_LIMITS.maxEdge))throw new Error('角色圖片比例或尺寸不正確。');}catch{throw new Error('角色圖片無法解碼或比例／尺寸不正確，原資料已保留。');}finally{image?.close();}}
 }
}
