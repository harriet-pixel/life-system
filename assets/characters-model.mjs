import {validateCharacterImages} from './character-images-model.mjs?v=companion-images-20261027';
// Manual character settings; image metadata is validated separately.
export const RELATIONSHIP_STAGES=Object.freeze([
 ['初識',0],['熟悉',50],['友好',150],['信任',350],['默契',500],['深厚情誼',700],['長久羈絆',1000]
].map(([name,min],i)=>Object.freeze({stage:i+1,name,min})));
export const CHARACTER_FIELDS=Object.freeze({name:'角色名稱',address:'角色稱呼',identity:'基本身份',background:'背景',description:'描述',personality:'核心人格',traits:'性格特質',values:'價值觀',likes:'喜好',dislikes:'不喜歡的事物',speech:'說話方式',catchphrases:'口頭禪',boundaries:'互動界線',notes:'其他手動設定'});
export const STYLE_FIELDS=Object.freeze({attitude:'互動態度',tone:'說話語氣',userAddress:'對使用者的稱呼',daily:'日常交流風格',success:'完成事項回應風格',setback:'挫折或未完成回應風格',emotion:'情緒表達方式',examples:'回覆範例'});
const check=(ok,message='夥伴資料格式不正確；原資料已保留。')=>{if(!ok)throw new Error(message);};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const validId=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
const stamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
export const emptyCharacters=()=>({version:1,characters:[],activeCharacterId:null,switchHistory:[],deletedCharacterIds:[]});
export function relationshipStage(affinity){check(Number.isSafeInteger(affinity)&&affinity>=0,'好感度必須為非負安全整數。');return RELATIONSHIP_STAGES.findLast(s=>affinity>=s.min);}
function textFields(value,fields){check(object(value));const result={};check(Object.keys(value).every(k=>Object.hasOwn(fields,k)));for(const key of Object.keys(fields)){check(value[key]===undefined||typeof value[key]==='string');result[key]=value[key]??'';}return result;}
export function normalizeCharacter(c){
 check(object(c)&&validId(c.characterId)&&stamp(c.createdAt)&&stamp(c.updatedAt)&&typeof c.archived==='boolean'&&Number.isSafeInteger(c.configVersion)&&c.configVersion>=1);
 const current=relationshipStage(c.affinity);check(Number.isInteger(c.highestStage)&&c.highestStage>=current.stage&&c.highestStage<=7);
 const settings=textFields(c.settings??{},CHARACTER_FIELDS);check(object(c.stages??{}));check(Object.keys(c.stages??{}).every(k=>/^[1-7]$/.test(k)));
 const stages=Object.fromEntries(RELATIONSHIP_STAGES.map(s=>[s.stage,textFields(c.stages?.[s.stage]??{},STYLE_FIELDS)]));
 check(Object.keys(c).every(k=>['characterId','createdAt','updatedAt','archived','configVersion','affinity','highestStage','settings','stages','imageSettings'].includes(k)));
 return {...c,settings,stages,...(c.imageSettings===undefined?{}:{imageSettings:validateCharacterImages(c.imageSettings)})};
}
export function validateCharacters(raw){
 if(raw===undefined)return emptyCharacters();check(object(raw)&&raw.version===1&&Array.isArray(raw.characters)&&Array.isArray(raw.switchHistory)&&Array.isArray(raw.deletedCharacterIds));
 check(Object.keys(raw).every(k=>['version','characters','activeCharacterId','switchHistory','deletedCharacterIds'].includes(k)));
 const result=structuredClone(raw);result.characters=result.characters.map(normalizeCharacter);const ids=new Set(result.characters.map(c=>c.characterId)),deleted=new Set(result.deletedCharacterIds);
 check(ids.size===result.characters.length&&deleted.size===result.deletedCharacterIds.length&&[...deleted].every(id=>validId(id)&&!ids.has(id)));
 check(result.activeCharacterId===null||result.characters.some(c=>c.characterId===result.activeCharacterId&&!c.archived));
 let previous=-Infinity;for(const item of result.switchHistory){check(object(item)&&Object.keys(item).length===2&&stamp(item.time)&&(item.characterId===null||ids.has(item.characterId)||deleted.has(item.characterId)));const time=Date.parse(item.time);check(time>=previous);previous=time;}
 check((result.switchHistory.at(-1)?.characterId??null)===result.activeCharacterId);return result;
}
export function newCharacter(characterId,time){return normalizeCharacter({characterId,createdAt:time,updatedAt:time,archived:false,configVersion:1,affinity:0,highestStage:1,settings:{},stages:{}});}
export function activeCharacterAt(raw,instant){const d=validateCharacters(raw),time=typeof instant==='number'?instant:Date.parse(instant);check(Number.isFinite(time),'截止時間不正確。');let low=0,high=d.switchHistory.length;while(low<high){const mid=(low+high)>>>1;if(Date.parse(d.switchHistory[mid].time)<=time)low=mid+1;else high=mid;}return d.switchHistory[low-1]?.characterId??null;}
export function activeCharacterOnDate(raw,date){check(/^\d{4}-\d{2}-\d{2}$/.test(date),'日期不正確。');const end=Date.parse(date+'T23:59:59.999+08:00');check(new Date(end+8*3600000).toISOString().slice(0,10)===date,'日期不正確。');return activeCharacterAt(raw,end);}
export function changeCharacters(raw,action,{now=Date.now(),id=()=>crypto.randomUUID()}={}){
 const d=validateCharacters(raw),time=new Date(Math.max(now,Date.parse(d.switchHistory.at(-1)?.time)||0)).toISOString();
 const find=key=>{const c=d.characters.find(c=>c.characterId===key);check(c,'角色已不存在，請重新選擇。');return c;};
 const switchTo=key=>{if(key!==null)check(!find(key).archived,'無法選擇已封存的角色。');if(d.activeCharacterId===key)return;d.activeCharacterId=key;d.switchHistory.push({time,characterId:key});};
 if(action.type==='create'){const key=id();check(!d.deletedCharacterIds.includes(key)&&!d.characters.some(c=>c.characterId===key));const c=newCharacter(key,time);c.settings.name='新角色';d.characters.push(c);}
 else if(action.type==='switch')switchTo(action.characterId);
 else {const c=find(action.characterId);
  if(action.type==='edit'){
   check(action.expectedVersion===c.configVersion&&(action.expectedConfig===undefined||action.expectedConfig===JSON.stringify([c.createdAt,c.settings,c.stages])),'此角色已在其他分頁修改；草稿保留，請取消草稿後重新讀取。');
   const settings=textFields(action.settings,CHARACTER_FIELDS),stages=normalizeCharacter({...c,settings,stages:action.stages}).stages;
   for(const [key,value]of Object.entries(settings))if(value!==c.settings[key])check([...value].length<=(key==='name'||key==='address'?100:4000),'角色欄位過長（名稱／稱呼限100字，其餘4000字）。');
   for(const stage of RELATIONSHIP_STAGES)for(const key of Object.keys(STYLE_FIELDS))if(stages[stage.stage][key]!==c.stages[stage.stage][key])check([...stages[stage.stage][key]].length<=4000,'階段欄位限4000字。');
   check(settings.name.trim(),'請填寫角色名稱。');
   if(JSON.stringify(settings)!==JSON.stringify(c.settings)||JSON.stringify(stages)!==JSON.stringify(c.stages)){check(Number.isSafeInteger(c.configVersion+1));c.settings=settings;c.stages=stages;c.configVersion++;c.updatedAt=time;}
  }else if(action.type==='archive'||action.type==='delete'){
   if(c.characterId===d.activeCharacterId){check(Object.hasOwn(action,'replacementId'),'請先選擇替代夥伴或明確取消出場。');check(action.replacementId!==c.characterId);switchTo(action.replacementId);}
   if(action.type==='archive'){c.archived=true;c.updatedAt=time;}else{d.characters=d.characters.filter(x=>x!==c);d.deletedCharacterIds.push(c.characterId);}
  }else if(action.type==='unarchive'){c.archived=false;c.updatedAt=time;}else throw new Error('未知角色操作。');
 }
 return validateCharacters(d);
}
