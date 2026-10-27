// Small, DOM-free definitions shared by validation, display and future chat.
export const EMOTIONS=Object.freeze([['neutral','一般'],['happy','開心'],['calm','平靜'],['thinking','思考'],['surprised','驚訝'],['concerned','關心'],['determined','認真'],['playful','俏皮']].map(([id,name])=>Object.freeze({id,name})));
export const IMAGE_LIMITS=Object.freeze({rawBytes:12*1024*1024,pixels:24000000,rawEdge:12000,workingEdge:2048,maxEdge:1600,bytes:1024*1024,thumbnailEdge:160,thumbnailBytes:32000});
export const imageLimitText='PNG／JPEG／WebP；原檔最多 12 MiB、2,400 萬像素。儲存為 3:4、最長 1600px、最多 1 MiB。';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const check=ok=>{if(!ok)throw new Error('角色圖片設定不正確；原資料已保留。');};
const asset=v=>typeof v==='string'&&/^asset:[a-f0-9]{64}$/.test(v);
export const emotionId=value=>EMOTIONS.some(e=>e.id===value)?value:'neutral';
export const mockEmotionId=value=>emotionId(value==='pleased'?'happy':value);
// x, y and size are fractions of image WIDTH. Height is always 4/3 width.
export const defaultAvatarCrop=()=>({x:.125,y:.08,size:.75});
export function validateAvatarCrop(c){check(object(c)&&Object.keys(c).length===3&&['x','y','size'].every(k=>typeof c[k]==='number'&&Number.isFinite(c[k]))&&c.x>=0&&c.y>=0&&c.size>=.05&&c.size<=1&&c.x+c.size<=1.000000001&&c.y+c.size<=4/3+.000000001);return {...c};}
export const emptyImageSettings=()=>({version:1,revision:0,emotions:{}});
export function validateCharacterImages(raw){
 if(raw===undefined)return emptyImageSettings();
 check(object(raw)&&Object.keys(raw).length===3&&raw.version===1&&Number.isSafeInteger(raw.revision)&&raw.revision>=0&&object(raw.emotions));
 const emotions={};for(const [id,item]of Object.entries(raw.emotions)){
  check(EMOTIONS.some(e=>e.id===id)&&object(item)&&Object.keys(item).length===4&&asset(item.image)&&asset(item.thumbnail)&&typeof item.updatedAt==='string'&&Number.isFinite(Date.parse(item.updatedAt)));
  emotions[id]={image:item.image,thumbnail:item.thumbnail,crop:validateAvatarCrop(item.crop),updatedAt:item.updatedAt};
 }
 return {version:1,revision:raw.revision,emotions};
}
export const imageSignature=character=>JSON.stringify([character?.createdAt,validateCharacterImages(character?.imageSettings)]);
export function resolveCharacterImage(character,emotion='neutral'){const images=validateCharacterImages(character?.imageSettings).emotions;return images[emotionId(emotion)]??images.neutral??null;}
export function updateCharacterImage(character,action,time=new Date().toISOString()){
 check(imageSignature(character)===action.expectedImages);const settings=validateCharacterImages(character.imageSettings),id=action.emotionId;
 check(EMOTIONS.some(e=>e.id===id));
 if(action.image===null){
  if(id==='neutral'&&EMOTIONS.some(e=>e.id!=='neutral'&&!settings.emotions[e.id]))throw new Error('其他情緒仍以一般立繪備援；請替換一般立繪，不能直接刪除。');
  delete settings.emotions[id];
 }else settings.emotions[id]={image:action.image,thumbnail:action.thumbnail,crop:validateAvatarCrop(action.crop),updatedAt:time};
 check(Number.isSafeInteger(settings.revision+1));settings.revision++;
 return {...character,imageSettings:validateCharacterImages(settings),updatedAt:time};
}
