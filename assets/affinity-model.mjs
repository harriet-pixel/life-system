// Compact, durable evidence only; no personality or task text snapshots.
import {relationshipStage} from './characters-model.mjs?v=persona-20261029';
export const AFFINITY_POLICY=1;
export const DEFAULT_PENALTIES=Object.freeze({enabled:false,chat:true,tasks:true,habits:true,limit:1});
const check=(ok,message='好感度資料無法安全核對，已停止操作並保留原資料。')=>{if(!ok)throw new Error(message);};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const text=s=>typeof s==='string'&&s.length>0&&s.length<500;
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const stamp=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
export const emptyAffinity=()=>({version:1,startedAt:null,policies:[],sources:{},transactions:[],penalties:{},days:{},taskRules:{},executions:{},habitStates:{},confirmedPeriods:{},lastSeenAt:null,diagnostics:[]});
export function validatePenaltySettings(s){check(object(s)&&Object.keys(s).length===5&&['enabled','chat','tasks','habits'].every(k=>typeof s[k]==='boolean')&&integer(s.limit));return {...s};}
export function validateAffinity(raw,companion,{clone=true}={}){
 const a=raw===undefined?emptyAffinity():clone?structuredClone(raw):raw;check(object(a)&&a.version===1&&Object.keys(a).every(k=>(Object.hasOwn(emptyAffinity(),k)||['chatEpoch','chatAssessments'].includes(k)))&&Object.keys(emptyAffinity()).every(k=>Object.hasOwn(a,k)));
 check((a.startedAt===null||stamp(a.startedAt))&&(a.lastSeenAt===null||stamp(a.lastSeenAt))&&Array.isArray(a.policies)&&Array.isArray(a.transactions)&&Array.isArray(a.diagnostics)&&a.diagnostics.length<=20);
 for(const key of ['sources','penalties','days','taskRules','executions','habitStates','confirmedPeriods'])check(object(a[key]));
 const ids=companion?new Set([...companion.characters.map(c=>c.characterId),...companion.deletedCharacterIds]):null;
 const owner=id=>id===null||text(id)&&(!ids||ids.has(id));let previous=-Infinity;
 for(const p of a.policies){check(object(p)&&Object.keys(p).length===3&&text(p.id)&&stamp(p.time)&&Date.parse(p.time)>=previous);validatePenaltySettings(p.settings);previous=Date.parse(p.time);}
 const tx=new Map(),revoked=new Set();for(const t of a.transactions){check(object(t)&&Object.keys(t).every(k=>['id','operationId','sourceKey','characterId','requested','actual','time','policy','kind','reverses'].includes(k))&&text(t.id)&&text(t.operationId)&&text(t.sourceKey)&&owner(t.characterId)&&Number.isSafeInteger(t.requested)&&Number.isSafeInteger(t.actual)&&Math.sign(t.actual||t.requested)===Math.sign(t.requested)&&Math.abs(t.actual)<=Math.abs(t.requested)&&stamp(t.time)&&t.policy===AFFINITY_POLICY&&['grant','revoke','penalty','chat'].includes(t.kind)&&!tx.has(t.id));if(t.reverses){const original=tx.get(t.reverses);check(t.kind==='revoke'&&original?.kind==='grant'&&original.sourceKey===t.sourceKey&&original.characterId===t.characterId&&!revoked.has(t.reverses));revoked.add(t.reverses);}tx.set(t.id,t);}
 for(const [key,s]of Object.entries(a.sources)){check(text(key)&&object(s)&&Object.keys(s).length===6&&integer(s.ceiling)&&integer(s.credit)&&s.credit<=s.ceiling&&integer(s.quantity)&&s.quantity<=s.ceiling&&owner(s.characterId)&&(s.current===null||tx.get(s.current)?.sourceKey===key)&&text(s.origin));if(s.current)check(tx.get(s.current).kind==='grant'&&tx.get(s.current).characterId===s.characterId&&!revoked.has(s.current));if(s.quantity===0)check(s.current===null);}
 for(const [key,p]of Object.entries(a.penalties)){check(text(key)&&object(p)&&text(p.sourceId)&&['task','habit'].includes(p.domain)&&date(p.date)&&text(p.zone)&&stamp(p.cutoff)&&owner(p.characterId)&&integer(p.actual)&&p.actual<=1&&text(p.policyId)&&['charged','disabled','no-character','deleted-character','uncertain'].includes(p.status)&&tx.get(p.transactionId)?.sourceKey===key&&tx.get(p.transactionId).actual===-p.actual&&a.policies.some(policy=>policy.id===p.policyId));}
 for(const [key,d]of Object.entries(a.days))check(text(key)&&object(d)&&stamp(d.cutoff)&&text(d.status)&&a.policies.some(p=>p.id===d.policyId));
 for(const [key,rows]of Object.entries(a.taskRules)){check(text(key)&&Array.isArray(rows));let previous=-Infinity;for(const r of rows){const v=r.rule;check(stamp(r.time)&&Date.parse(r.time)>=previous&&object(v)&&Object.keys(v).length===7&&['once','repeat'].includes(v.kind)&&(v.date===null||date(v.date))&&date(v.start)&&(v.end===null||date(v.end)&&v.end>=v.start)&&Array.isArray(v.days)&&new Set(v.days).size===v.days.length&&v.days.every(n=>Number.isInteger(n)&&n>=0&&n<=6)&&typeof v.deleted==='boolean'&&stamp(v.createdAt));previous=Date.parse(r.time);}}
 for(const [key,rows]of Object.entries(a.executions)){check(text(key)&&Array.isArray(rows));let previous=-Infinity;for(const r of rows){check(stamp(r.time)&&Date.parse(r.time)>=previous&&date(r.date)&&date(r.originalDate)&&['pending','done','skipped','moved','deleted','unarranged'].includes(r.status));previous=Date.parse(r.time);}}
 for(const [key,rows]of Object.entries(a.habitStates)){check(text(key)&&Array.isArray(rows));let previous=-Infinity;for(const r of rows){check(stamp(r.time)&&Date.parse(r.time)>=previous&&['-','M','P','E'].includes(r.state));previous=Date.parse(r.time);}}
 for(const time of Object.values(a.confirmedPeriods))check(stamp(time));
 const chatTransactions=new Set(Object.values(a.chatAssessments??{}).map(r=>r?.transactionId));
 for(const t of a.transactions)check(t.kind==='chat'?chatTransactions.has(t.id):t.kind==='penalty'?Object.hasOwn(a.penalties,t.sourceKey):Object.hasOwn(a.sources,t.sourceKey));
 if(a.chatEpoch!==undefined)check(text(a.chatEpoch));
 if(a.chatAssessments!==undefined){check(object(a.chatAssessments));for(const [key,r]of Object.entries(a.chatAssessments)){const t=tx.get(r?.transactionId);check(/^[a-zA-Z0-9_-]{1,100}$/.test(key)&&object(r)&&Object.keys(r).length===8&&owner(r.characterId)&&r.characterId!==null&&stamp(r.characterCreatedAt)&&text(r.epoch)&&integer(r.configVersion)&&r.configVersion>=1&&Number.isInteger(r.stage)&&r.stage>=1&&r.stage<=7&&['positive','neutral','negative'].includes(r.assessment)&&/^[a-f0-9]{64}$/.test(r.responseHash)&&t?.kind==='chat'&&t.sourceKey==='chat:'+key&&t.characterId===r.characterId&&t.requested===({positive:1,neutral:0,negative:-1})[r.assessment]);}}
 for(const d of a.diagnostics)check(stamp(d.time)&&text(d.code));return a;
}
export function initializeAffinity(doc,time){doc.affinity??=emptyAffinity();const a=doc.affinity;if(a.startedAt!==null)return;a.startedAt=time;a.lastSeenAt=time;a.policies.push({id:'initial',time,settings:{...DEFAULT_PENALTIES}});observeEligibility(doc,null,time);}
function appendChanged(map,key,value){const rows=map[key]??=[];if(JSON.stringify(rows.at(-1)?.rule??null)===JSON.stringify(value.rule??null)&&rows.at(-1)?.date===value.date&&rows.at(-1)?.status===value.status&&rows.at(-1)?.originalDate===value.originalDate)return;check(!rows.length||Date.parse(value.time)>=Date.parse(rows.at(-1).time),'裝置時間倒退，來源時間無法核對，整筆操作未儲存。');rows.push(value);}
export function observeEligibility(doc,prior,time){const a=doc.affinity;time=new Date(Math.max(Date.parse(time),Date.parse(a.lastSeenAt)||0)).toISOString();
 for(const t of doc.tasks?.definitions??[]){const rule=Object.fromEntries(['kind','date','start','end','days','deleted','createdAt'].map(k=>[k,t[k]]));appendChanged(a.taskRules,t.id,{time,rule});}
 for(const o of doc.tasks?.occurrences??[]){if(o.source==='auto'&&o.status==='pending'&&!a.executions[o.id])continue;appendChanged(a.executions,o.id,{time,date:o.date,originalDate:o.originalDate,status:o.status});}
 for(const t of prior?.tasks?.definitions??[])if(!doc.tasks.definitions.some(n=>n.id===t.id)){const previous=a.taskRules[t.id]?.at(-1)?.rule;if(previous)appendChanged(a.taskRules,t.id,{time,rule:{...previous,deleted:true}});}
 for(const o of prior?.tasks?.occurrences??[])if(!doc.tasks.occurrences.some(n=>n.id===o.id)&&!(o.source==='auto'&&o.status==='pending')){const t=doc.tasks.definitions.find(t=>t.id===o.taskId&&!t.deleted),automatic=t&&(t.kind==='once'?t.date===o.date:o.date>=t.start&&(!t.end||o.date<=t.end)&&t.days.includes(new Date(o.date+'T12:00:00').getDay()));appendChanged(a.executions,o.id,{time,date:o.date,originalDate:o.originalDate,status:automatic?'pending':'deleted'});}
 for(const r of prior?.habits?.records??[])if(!doc.habits.records.some(n=>n.periodId===r.periodId&&n.date===r.date&&n.habitIndex===r.habitIndex)){const rows=a.habitStates[r.periodId+':'+r.date+':'+r.habitIndex]??=[];if(rows.at(-1)?.state!=='-')rows.push({time,state:'-'});}
 for(const r of doc.habits?.records??[]){const key=r.periodId+':'+r.date+':'+r.habitIndex,rows=a.habitStates[key]??=[];if(rows.at(-1)?.state!==r.state)rows.push({time,state:r.state});}
 for(const p of doc.habits?.periods??[])if(p.confirmed&&!a.confirmedPeriods[p.id])a.confirmedPeriods[p.id]=time;
}
export function setPenaltyPolicy(doc,settings,time,operationId){initializeAffinity(doc,time);settings=validatePenaltySettings(settings);const previous=doc.affinity.policies.at(-1);if(JSON.stringify(previous.settings)===JSON.stringify(settings))return false;check(Date.parse(time)>=Date.parse(previous.time),'裝置時間早於既有設定，請先校正時間。');doc.affinity.policies.push({id:operationId,time,settings});return true;}
export function activeOwner(doc){const id=doc.companion?.activeCharacterId;return doc.companion?.characters.some(c=>c.characterId===id&&!c.archived)?id:null;}
function move(doc,characterId,requested){const c=doc.companion?.characters.find(c=>c.characterId===characterId);if(!c)return 0;const next=requested<0?Math.max(0,c.affinity+requested):c.affinity+requested;check(integer(next),'好感度超過安全整數，整筆操作未儲存。');const actual=next-c.affinity;c.affinity=next;c.highestStage=Math.max(c.highestStage,relationshipStage(next).stage);return actual;}
export function affinityTransaction(doc,{sourceKey,characterId,requested,time,operationId,kind,reverses,applied=requested}){const a=doc.affinity,id=operationId+':a'+a.transactions.length,actual=move(doc,characterId,applied);const t={id,operationId,sourceKey,characterId,requested,actual,time,policy:AFFINITY_POLICY,kind,...(reverses?{reverses}:{})};a.transactions.push(t);return t;}
export function sourceState(a,key){const s=a.sources[key];return {quantity:s?.quantity??0,characterId:s?.characterId??null};}
export function setSource(doc,key,quantity,characterId,{time,operationId,origin=operationId}={}){
 const a=doc.affinity;check(integer(quantity));let s=a.sources[key];if(!s&&quantity===0)return;if(!s)s=a.sources[key]={ceiling:0,credit:0,quantity:0,characterId:null,current:null,origin};
 if(s.quantity===quantity&&s.characterId===characterId)return;
 if(s.current){const old=a.transactions.find(t=>t.id===s.current);check(old?.kind==='grant');const rev=affinityTransaction(doc,{sourceKey:key,characterId:s.characterId,requested:-old.actual,time,operationId,kind:'revoke',reverses:old.id});s.credit+=-rev.actual;}
 s.current=null;s.quantity=0;s.characterId=null;if(quantity===0)return;
 // Only actually recovered points plus a newly earned higher level can be issued.
 // Consumed rewards never turn into debt or a fresh re-completion grant.
 const carried=s.credit,available=carried+Math.max(0,quantity-s.ceiling),requested=Math.min(quantity,available);s.ceiling=Math.max(s.ceiling,quantity);s.quantity=quantity;s.characterId=characterId;
 const grant=affinityTransaction(doc,{sourceKey:key,characterId,requested:quantity,applied:requested,time,operationId,kind:'grant'});s.current=grant.id;s.credit=Math.max(0,available-grant.actual);
 // Absence/deletion is not a claim on a future character.
 if(characterId===null||!doc.companion?.characters.some(c=>c.characterId===characterId))s.credit=carried;
}
export function applyAffinityPlan(doc,plan,{redo=true,time,operationId}={}){if(!plan?.length)return;for(const p of plan){const desired=redo?p.after:p.before;setSource(doc,p.sourceKey,desired.quantity,desired.characterId,{time,operationId,origin:p.origin});}}
export function diagnostic(a,time,code){if(a.diagnostics.at(-1)?.code===code)return;a.diagnostics.push({time,code});a.diagnostics=a.diagnostics.slice(-20);}
