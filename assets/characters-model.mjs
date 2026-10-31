import {validateCharacterImages,EMOTIONS as IMAGE_EMOTIONS} from './character-images-model.mjs?v=amount-images-20261031';
// Manual character settings; image metadata is validated separately.
export const RELATIONSHIP_STAGES=Object.freeze([
 ['初識',0],['熟悉',50],['友好',150],['信任',350],['默契',500],['深厚情誼',700],['長久羈絆',1000]
].map(([name,min],i)=>Object.freeze({stage:i+1,name,min})));
export const LEGACY_CHARACTER_FIELDS=Object.freeze({name:'角色名稱',address:'角色稱呼',identity:'基本身份',background:'背景',description:'描述',personality:'核心人格',traits:'性格特質',values:'價值觀',likes:'喜好',dislikes:'不喜歡的事物',speech:'說話方式',catchphrases:'口頭禪',boundaries:'互動界線',notes:'其他手動設定'});
export const LEGACY_STYLE_FIELDS=Object.freeze({attitude:'互動態度',tone:'說話語氣',userAddress:'對使用者的稱呼',daily:'日常交流風格',success:'完成事項回應風格',setback:'挫折或未完成回應風格',emotion:'情緒表達方式',examples:'回覆範例'});
export const PERSONA_GROUPS=Object.freeze({A:{name:'角色名稱',identity:'身分與職責',background:'背景摘要（50字內）',values:'核心價值觀',traits:'主要性格',flaws:'缺點／內在矛盾',motivation:'行為動機',boundaries:'原則與底線'},B:{speech:'語言風格',emotion:'情緒表達方式',reactions:'典型情境反應',catchphrases:'代表台詞'},C:{initialRelation:'初始關係',relationshipGrowth:'好感度提升時的變化',trust:'信任的判斷標準',immutableCore:'關係不可改變的核心特質'}});
export const CHARACTER_FIELDS=Object.freeze(Object.assign({},...Object.values(PERSONA_GROUPS)));
export const STYLE_FIELDS=Object.freeze({attitude:'內在態度',behavior:'外在行為',openness:'開放界線'});
const check=(ok,message='夥伴資料格式不正確；原資料已保留。')=>{if(!ok)throw new Error(message);};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const validId=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
const stamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
export const emptyCharacters=()=>({version:2,characters:[],activeCharacterId:null,switchHistory:[],deletedCharacterIds:[]});
export function relationshipStage(affinity){check(Number.isSafeInteger(affinity)&&affinity>=0,'好感度必須為非負安全整數。');return RELATIONSHIP_STAGES.findLast(s=>affinity>=s.min);}
function textFields(value,fields){check(object(value));const result={};check(Object.keys(value).every(k=>Object.hasOwn(fields,k)));for(const key of Object.keys(fields)){check(value[key]===undefined||typeof value[key]==='string');result[key]=value[key]??'';}return result;}
export function normalizeCharacter(c){
 check(object(c)&&validId(c.characterId)&&stamp(c.createdAt)&&stamp(c.updatedAt)&&typeof c.archived==='boolean'&&Number.isSafeInteger(c.configVersion)&&c.configVersion>=1);
 const current=relationshipStage(c.affinity);check(Number.isInteger(c.highestStage)&&c.highestStage>=current.stage&&c.highestStage<=7);
 if(c.personaVersion===undefined){
  const old=textFields(c.settings??{},LEGACY_CHARACTER_FIELDS),oldStages=Object.fromEntries(RELATIONSHIP_STAGES.map(s=>[s.stage,textFields(c.stages?.[s.stage]??{},LEGACY_STYLE_FIELDS)]));
  const settings=textFields({},CHARACTER_FIELDS);for(const key of ['name','identity','values','traits','speech','catchphrases','boundaries'])settings[key]=[...old[key]].slice(0,key==='name'?100:4000).join('');settings.background=[...old.background].slice(0,50).join('');
  if(!settings.traits)settings.traits=[...old.personality].slice(0,4000).join('');
  check(Number.isSafeInteger(c.configVersion+1));c={...c,personaVersion:2,configVersion:c.configVersion+1,settings,stages:Object.fromEntries(RELATIONSHIP_STAGES.map(s=>[s.stage,{attitude:[...oldStages[s.stage].attitude].slice(0,4000).join(''),behavior:[...oldStages[s.stage].daily].slice(0,4000).join(''),openness:''}])),legacyPersona:{version:1,settings:old,stages:oldStages}};
 }
 check(c.personaVersion===2);
 if(c.legacyPersona!==undefined){const l=c.legacyPersona;check(object(l)&&l.version===1&&Object.keys(l).length===3);textFields(l.settings,LEGACY_CHARACTER_FIELDS);check(object(l.stages)&&Object.keys(l.stages).length===7);for(const s of RELATIONSHIP_STAGES)textFields(l.stages[s.stage],LEGACY_STYLE_FIELDS);}
 const settings=textFields(c.settings??{},CHARACTER_FIELDS);check(object(c.stages??{}));check(Object.keys(c.stages??{}).every(k=>/^[1-7]$/.test(k)));
 const stages=Object.fromEntries(RELATIONSHIP_STAGES.map(s=>[s.stage,textFields(c.stages?.[s.stage]??{},STYLE_FIELDS)]));
 check(Object.keys(c).every(k=>['characterId','createdAt','updatedAt','archived','configVersion','affinity','highestStage','settings','stages','imageSettings','personaVersion','legacyPersona','greetings'].includes(k)));
 if(c.greetings!==undefined)validateGreetings(c.greetings);return {...c,settings,stages,...(c.imageSettings===undefined?{}:{imageSettings:validateCharacterImages(c.imageSettings)})};
}
export function validateCharacters(raw){
 if(raw===undefined)return emptyCharacters();check(object(raw)&&[1,2].includes(raw.version)&&Array.isArray(raw.characters)&&Array.isArray(raw.switchHistory)&&Array.isArray(raw.deletedCharacterIds));
 check(Object.keys(raw).every(k=>['version','characters','activeCharacterId','switchHistory','deletedCharacterIds'].includes(k)));
 const result=structuredClone(raw);result.version=2;result.characters=result.characters.map(normalizeCharacter);const ids=new Set(result.characters.map(c=>c.characterId)),deleted=new Set(result.deletedCharacterIds);
 check(ids.size===result.characters.length&&deleted.size===result.deletedCharacterIds.length&&[...deleted].every(id=>validId(id)&&!ids.has(id)));
 check(result.activeCharacterId===null||result.characters.some(c=>c.characterId===result.activeCharacterId&&!c.archived));
 let previous=-Infinity;for(const item of result.switchHistory){check(object(item)&&Object.keys(item).length===2&&stamp(item.time)&&(item.characterId===null||ids.has(item.characterId)||deleted.has(item.characterId)));const time=Date.parse(item.time);check(time>=previous);previous=time;}
 check((result.switchHistory.at(-1)?.characterId??null)===result.activeCharacterId);return result;
}
export function newCharacter(characterId,time){return normalizeCharacter({personaVersion:2,characterId,createdAt:time,updatedAt:time,archived:false,configVersion:1,affinity:0,highestStage:1,settings:{},stages:{}});}
export function activeCharacterAt(raw,instant){const d=validateCharacters(raw),time=typeof instant==='number'?instant:Date.parse(instant);check(Number.isFinite(time),'截止時間不正確。');let low=0,high=d.switchHistory.length;while(low<high){const mid=(low+high)>>>1;if(Date.parse(d.switchHistory[mid].time)<=time)low=mid+1;else high=mid;}return d.switchHistory[low-1]?.characterId??null;}
export function activeCharacterOnDate(raw,date){check(/^\d{4}-\d{2}-\d{2}$/.test(date),'日期不正確。');const end=Date.parse(date+'T23:59:59.999+08:00');check(new Date(end+8*3600000).toISOString().slice(0,10)===date,'日期不正確。');return activeCharacterAt(raw,end);}
export function validatePersonaInput(settings,stages){textFields(settings,CHARACTER_FIELDS);check(settings.name.trim(),'請填寫角色名稱。');for(const [key,value]of Object.entries(settings))check([...value].length<=(key==='name'?100:key==='background'?50:4000),'角色欄位過長。');check(object(stages)&&Object.keys(stages).length===7);for(const def of RELATIONSHIP_STAGES){const fields=textFields(stages[def.stage],STYLE_FIELDS);for(const value of Object.values(fields))check([...value].length<=4000,'階段欄位限4000字。');}return true;}
export const GREETING_SLOTS=Object.freeze({morning:'早晨（05–11時）',afternoon:'午後（12–17時）',evening:'晚間（18–21時）',night:'深夜（22–04時）'});
export const emptyGreetings=()=>Object.fromEntries(Object.keys(GREETING_SLOTS).map(k=>[k,'']));
// Legacy strings remain readable; new editors save three variants per period.
export function greetingVariants(value){return Array.isArray(value)?value:[value??''];}
export function validateGreetings(raw){check(object(raw)&&Object.keys(raw).length===4&&Object.keys(raw).every(k=>Object.hasOwn(GREETING_SLOTS,k)),'首頁招呼格式不正確。');for(const v of Object.values(raw)){check(typeof v==='string'||Array.isArray(v)&&v.length===3,'每時段請設定三句招呼。');for(const line of greetingVariants(v))check(typeof line==='string'&&[...line].length<=240,'首頁招呼過長，請縮短後再儲存。');}return structuredClone(raw);}
export function greetingSlot(now=new Date()){const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Taipei',hour:'2-digit',hourCycle:'h23'}).format(now));return hour>=5&&hour<12?'morning':hour>=12&&hour<18?'afternoon':hour>=18&&hour<22?'evening':'night';}
export function homeGreeting(character,now=new Date(),index=0){try{const lines=character&&!character.archived?greetingVariants(validateGreetings(character.greetings??emptyGreetings())[greetingSlot(now)]).map(s=>s.trim()).filter(Boolean):[];return lines[index%lines.length]||'歡迎回來，今天也一起慢慢前進。';}catch{return '歡迎回來，今天也一起慢慢前進。';}}
export function nextHomeGreeting(character,now=new Date(),storage=globalThis.sessionStorage){const slot=greetingSlot(now),key='life-system.greeting-rotation.'+(character?.characterId??'none')+'.'+slot;let index=0;try{const saved=Number(storage?.getItem(key));if(Number.isSafeInteger(saved)&&saved>=0)index=saved;storage?.setItem(key,String((index+1)%3));}catch{}return homeGreeting(character,now,index);}
export function changeCharacters(raw,action,{now=Date.now(),id=()=>crypto.randomUUID()}={}){
 const d=validateCharacters(raw),time=new Date(Math.max(now,Date.parse(d.switchHistory.at(-1)?.time)||0)).toISOString();
 const find=key=>{const c=d.characters.find(c=>c.characterId===key);check(c,'角色已不存在，請重新選擇。');return c;};
 const switchTo=key=>{if(key!==null)check(!find(key).archived,'無法選擇已封存的角色。');if(d.activeCharacterId===key)return;d.activeCharacterId=key;d.switchHistory.push({time,characterId:key});};
 if(action.type==='create'){const key=id();check(!d.deletedCharacterIds.includes(key)&&!d.characters.some(c=>c.characterId===key));const c=newCharacter(key,time);c.settings.name='新角色';if(action.settings){const settings=textFields(action.settings,CHARACTER_FIELDS);validatePersonaInput(settings,action.stages);c.settings=settings;c.stages=normalizeCharacter({...c,stages:action.stages}).stages;}d.characters.push(c);}
 else if(action.type==='switch')switchTo(action.characterId);
 else {const c=find(action.characterId);
  if(action.type==='greetings'){check(action.expectedCreatedAt===c.createdAt&&action.expectedGreetings===JSON.stringify(c.greetings??emptyGreetings()),'首頁招呼已在其他分頁修改；草稿保留。');c.greetings=validateGreetings(action.greetings);c.updatedAt=time;}else if(action.type==='edit'){
   check(action.expectedVersion===c.configVersion&&(action.expectedConfig===undefined||action.expectedConfig===JSON.stringify([c.createdAt,c.settings,c.stages])),'此角色已在其他分頁修改；草稿保留，請取消草稿後重新讀取。');
   const settings=textFields(action.settings,CHARACTER_FIELDS),stages=normalizeCharacter({...c,settings,stages:action.stages}).stages;
   for(const [key,value]of Object.entries(settings))if(value!==c.settings[key])check([...value].length<=(key==='name'?100:key==='background'?50:4000),'角色欄位過長（名稱100字、背景50字，其餘4000字）。');
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

// Tiny pointer-only schema. Reply text is never copied into a life transaction.
export const emptyReplyLibrary=()=>({version:2,epoch:crypto.randomUUID(),characters:{}});
export const REPLY_EVENTS=Object.freeze({'task.completed':'待辦完成','habit.mini':'Mini 打卡','habit.plus':'Plus 打卡','habit.elite':'Elite 打卡','habit.bonus':'加分打卡','achievement.unlocked':'正式成就','task.incomplete':'待辦未完成','habit.incomplete':'習慣未完成'});
export const REPLY_EMOTIONS=Object.freeze(IMAGE_EMOTIONS.map(e=>e.id));
export const DEFAULT_REPLY_POOLS=Object.freeze({positive:['neutral','happy','calm','determined','playful'],negative:['neutral','calm','thinking','concerned']});
const replyObject=v=>v&&typeof v==='object'&&!Array.isArray(v),replyStamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
export const replyCheck=(ok,message='回覆庫格式無法驗證，原資料已保留。')=>{if(!ok)throw new Error(message);};
export const categoryKey=(direction,emotion)=>`${direction}|${emotion}`;
export function validateCategoryKey(key){replyCheck(typeof key==='string');const parts=key.split('|');if(parts.length===3){const [stage,event,emotion]=parts;replyCheck(/^[1-7]$/.test(stage)&&Object.hasOwn(REPLY_EVENTS,event)&&REPLY_EMOTIONS.includes(emotion));return {stageId:Number(stage),eventType:event,emotionId:emotion,legacy:true};}const [direction,emotion]=parts;replyCheck(['positive','negative'].includes(direction)&&REPLY_EMOTIONS.includes(emotion)&&key===categoryKey(direction,emotion));return {direction,emotionId:emotion};}
export function validateReplyPools(p){replyCheck(replyObject(p)&&Object.keys(p).length===2);for(const side of ['positive','negative'])replyCheck(Array.isArray(p[side])&&p[side].length>0&&p[side].length<=8&&new Set(p[side]).size===p[side].length&&p[side].every(e=>REPLY_EMOTIONS.includes(e)));return structuredClone(p);}
export function validateReplyManifest(raw,companion){if(raw===undefined)return undefined;replyCheck(replyObject(raw)&&Object.keys(raw).length===3&&[1,2].includes(raw.version)&&typeof raw.epoch==='string'&&/^[\w-]{1,100}$/.test(raw.epoch)&&replyObject(raw.characters));for(const [id,c]of Object.entries(raw.characters)){replyCheck(/^[\w-]{1,100}$/.test(id)&&replyObject(c)&&Object.keys(c).every(k=>['createdAt','revision','pools','categories','legacyCategories'].includes(k))&&replyStamp(c.createdAt)&&Number.isSafeInteger(c.revision)&&c.revision>=0&&replyObject(c.categories)&&Object.keys(c.categories).length<=(raw.version===1?448:16));if(companion)replyCheck(companion.characters.some(x=>x.characterId===id&&x.createdAt===c.createdAt));validateReplyPools(c.pools);for(const [key,ref]of Object.entries(c.categories)){const k=validateCategoryKey(key);replyCheck(Boolean(k.legacy)===(raw.version===1)&&/^reply:[a-f0-9]{64}$/.test(ref));}if(c.legacyCategories!==undefined){replyCheck(raw.version===2&&replyObject(c.legacyCategories)&&Object.keys(c.legacyCategories).length<=448);for(const [key,ref]of Object.entries(c.legacyCategories))replyCheck(validateCategoryKey(key).legacy&&/^reply:[a-f0-9]{64}$/.test(ref));}}return structuredClone(raw);}
export function upgradeReplyManifest(raw){const root=validateReplyManifest(raw)??emptyReplyLibrary();if(root.version===1){root.version=2;for(const owner of Object.values(root.characters)){owner.legacyCategories=owner.categories;owner.categories={};}}return root;}
export const replyRefs=manifest=>[...new Set(Object.values(manifest?.characters??{}).flatMap(c=>[...Object.values(c.categories),...Object.values(c.legacyCategories??{})]))];
