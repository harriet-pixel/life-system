import {normalizeCharacter,relationshipStage,CHARACTER_FIELDS,STYLE_FIELDS,RELATIONSHIP_STAGES} from './characters-model.mjs?v=amount-images-20261031';
const cut=(s,n)=>String(s??'').slice(0,n);
// One canonical A/B/C/D definition; callers choose a bounded projection.
export function compactPersona(raw,{stage=relationshipStage(raw.affinity).stage,chat=false}={}){
 const c=normalizeCharacter(raw),s=c.settings;
 const limits={name:60,identity:100,traits:180,values:140,motivation:120,boundaries:220,speech:120,emotion:100,catchphrases:100,reactions:100,...(chat?{background:50,flaws:100,initialRelation:100,relationshipGrowth:100,trust:100,immutableCore:100}:{})};
 return {persona:Object.fromEntries(Object.entries(limits).map(([k,n])=>[k,cut(s[k],n)])),relationship:{stage,style:Object.fromEntries(Object.entries(c.stages[stage]).map(([k,v])=>[k,cut(v,120)]))}};
}
export function boundedPrompt(value,limit=4000){let text=JSON.stringify(value);if(text.length>limit)throw new Error('人格或事件超出本次提示預算；未呼叫AI。');return text;}
// JSON object member order must never change the meaning or validity of persona text.
export function personaFingerprintInput(c){return [Object.keys(CHARACTER_FIELDS).map(k=>c.settings?.[k]??''),RELATIONSHIP_STAGES.map(s=>Object.keys(STYLE_FIELDS).map(k=>c.stages?.[s.stage]?.[k]??''))];}
