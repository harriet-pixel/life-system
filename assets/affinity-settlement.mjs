import {affinityTransaction,diagnostic,initializeAffinity} from './affinity-model.mjs?v=replies-20261027';
import {occurrenceId,automatic,localDate,addDays} from './tasks-model.mjs?v=companion-images-20261027';
import {taipeiDate,periodInfo,validDay} from './habits-model.mjs?v=companion-images-20261027';
const DAY=86400000;
const at=(rows,time)=>{let lo=0,hi=rows?.length??0;while(lo<hi){const mid=(lo+hi)>>>1;if(Date.parse(rows[mid].time)<=time)lo=mid+1;else hi=mid;}return rows?.[lo-1];};
function historicalOwner(doc,cutoff){const rows=doc.companion?.switchHistory;return at(rows,cutoff)?.characterId??null;}
export function dayCutoff(date,domain){return domain==='habit'?Date.parse(date+'T23:59:59.999+08:00'):+new Date(...date.split('-').map((n,i)=>Number(n)-(i===1?1:0)),23,59,59,999);}
export function settlementZone(domain){return domain==='habit'?'Asia/Taipei':Intl.DateTimeFormat().resolvedOptions().timeZone;}
export function penaltyKey(domain,zone,date,sourceId){return JSON.stringify([domain,zone,date,sourceId]);}
function taskCandidates(doc,date,cutoff){const result=[];for(const [taskId,history]of Object.entries(doc.affinity.taskRules)){const rule=at(history,cutoff)?.rule;if(!rule||rule.deleted||Date.parse(rule.createdAt)>cutoff)continue;const executionId=occurrenceId({id:taskId,kind:rule.kind},date),stored=at(doc.affinity.executions[executionId],cutoff);if(stored){if(stored.date!==date||stored.status!=='pending')continue;}else if(!(rule.kind==='once'?rule.date===date:automatic(rule,date)))continue;result.push({sourceId:rule.kind==='repeat'?taskId+'@'+(stored?.originalDate??date):executionId});}return result;}
function habitCandidates(doc,date,cutoff){if(date.endsWith('-31')||!validDay(date))return [];const p=doc.habits?.periods.find(p=>p.id===periodInfo(date).id&&p.confirmed);if(!p||Date.parse(doc.affinity.confirmedPeriods[p.id])>cutoff||!doc.affinity.confirmedPeriods[p.id])return [];const versions=p.versions.filter(v=>v.effectiveDate<=date&&Date.parse(v.time)<=cutoff),v=versions.at(-1);if(!v)return [];return v.habits.flatMap((h,index)=>{if(!h.name.trim())return [];const sourceId=p.id+':'+date+':'+index,record=at(doc.affinity.habitStates[sourceId],cutoff);if(record&&record.state!=='-')return [];return [{sourceId:p.id+':'+date+':'+index}];});}
export function settleAffinity(doc,{now=Date.now(),operationId='settle'}={}){
 if(!Number.isFinite(now))return false;const time=new Date(now).toISOString();initializeAffinity(doc,time);const a=doc.affinity;
 if(!Number.isFinite(now)||now<Date.parse(a.startedAt)-300000||a.lastSeenAt&&now<Date.parse(a.lastSeenAt)-300000||a.lastSeenAt&&now-Date.parse(a.lastSeenAt)>370*DAY){diagnostic(a,time,'clock-unreliable');return false;}
 const claimed=new Set(Object.values(a.penalties).map(p=>JSON.stringify([p.domain,p.date,p.sourceId])));let changed=false;
 for(const domain of ['task','habit']){const today=domain==='habit'?taipeiDate(new Date(now)):localDate(new Date(now)),zone=settlementZone(domain);
  for(let distance=7;distance>=1;distance--){const date=addDays(today,-distance),cutoff=dayCutoff(date,domain),dayId=JSON.stringify([domain,zone,date]);if(a.days[dayId])continue;if(cutoff<Date.parse(a.startedAt))continue;
   const policy=at(a.policies,cutoff);if(!policy){diagnostic(a,time,'policy-unavailable');continue;}
   const settings=policy.settings,enabled=settings.enabled&&settings[domain==='task'?'tasks':'habits'],characterId=historicalOwner(doc,cutoff),exists=doc.companion?.characters.some(c=>c.characterId===characterId),deleted=doc.companion?.deletedCharacterIds.includes(characterId);
   const status=!enabled?'disabled':characterId===null?'no-character':deleted?'deleted-character':!exists?'uncertain':'charged';
   if(status==='uncertain'){diagnostic(a,time,'historical-character-unavailable');continue;}
   a.days[dayId]={cutoff:new Date(cutoff).toISOString(),status,policyId:policy.id};changed=true;
   if(!enabled)continue;const candidates=domain==='task'?taskCandidates(doc,date,cutoff):habitCandidates(doc,date,cutoff);
   for(const item of candidates){const key=penaltyKey(domain,zone,date,item.sourceId);const identity=JSON.stringify([domain,date,item.sourceId]);if(a.penalties[key]||claimed.has(identity))continue;claimed.add(identity);const requested=status==='charged'?-Math.min(1,settings.limit):0,t=affinityTransaction(doc,{sourceKey:key,characterId,requested:-1,applied:requested,time,operationId,kind:'penalty'});a.penalties[key]={domain,date,zone,sourceId:item.sourceId,cutoff:new Date(cutoff).toISOString(),characterId,actual:Math.max(0,-t.actual),transactionId:t.id,policyId:policy.id,status};}
  }
 }
 a.lastSeenAt=new Date(Math.max(now,Date.parse(a.lastSeenAt)||0)).toISOString();return changed;
}
