import {validateAffinity,initializeAffinity,observeEligibility,activeOwner,sourceState,setSource} from './affinity-model.mjs?v=backup-chat-20261031';
import {settleAffinity} from './affinity-settlement.mjs?v=backup-chat-20261031';
const taskEntries=tasks=>{const map=new Map(),executions=new Map((tasks?.occurrences??[]).map(o=>[o.id,o]));for(const c of tasks?.completions??[]){if(c.cancelledAt)continue;const o=executions.get(c.occurrenceId),sourceId=c.occurrenceId.includes('@')?c.taskId+'@'+(o?.originalDate??c.date):c.occurrenceId;map.set('task:'+sourceId,{quantity:1,sourceId,domain:'task',origin:c.transactionId});}return map;};
function habitEntries(h){const map=new Map();for(const r of h?.records??[])map.set('habit:'+r.periodId+':'+r.date+':'+r.habitIndex,{quantity:({'-':0,M:1,P:2,E:3})[r.state],sourceId:r.periodId+':'+r.date+':'+r.habitIndex,domain:'habit',origin:r.id});for(const p of h?.periods??[])for(const e of p.achievements)map.set('achievement:'+p.id+':'+e.id,{quantity:5,origin:p.id+':'+e.id});for(const r of h?.bonusRecords??[])map.set('bonus:'+r.id,{quantity:r.cancelledAt?0:1,origin:r.id});return map;}
export function integrateAffinity(before,next,{type,operationId,time}){
 if(type==='wallet.item')return [];
 if(!Array.isArray(next.companion?.characters))return [];
 next.affinity=validateAffinity(next.affinity,next.companion,{clone:false});initializeAffinity(next,time);
 // Settle against the pre-operation evidence. A late completion receives its
 // normal award AND the actual, previously established penalty refund atomically.
 if(!type.startsWith('wallet.'))settleAffinity(next,{now:Date.parse(time),operationId});
 const plan=[],owner=activeOwner(next),sets=[];
 if(type==='wallet.spent'||type==='wallet.cancelled'){const id=next.wallet.lastChange.id,entries=w=>{const r=w?.records[id];return new Map(r?[['wallet:'+r.id,{quantity:r.status==='active'?1:0,origin:r.debitId}]]:[]);};sets.push([entries(before.wallet),entries(next.wallet)]);}
 if(type.startsWith('task.')&&next.tasks!==before.tasks)sets.push([taskEntries(before.tasks),taskEntries(next.tasks)]);
 if(type.startsWith('habit.')&&next.habits!==before.habits)sets.push([habitEntries(before.habits),habitEntries(next.habits)]);
 function change(key,quantity,origin){const prior=sourceState(next.affinity,key),after={quantity,characterId:quantity?owner:null};if(prior.quantity===quantity)return;plan.push({sourceKey:key,before:prior,after,origin});setSource(next,key,quantity,after.characterId,{time,operationId,origin});}
 for(const [old,updated]of sets){const keys=new Set([...old.keys(),...updated.keys()]);for(const key of keys){const prev=old.get(key),entry=updated.get(key),quantity=entry?.quantity??0;if((prev?.quantity??0)===quantity)continue;
  // Existing pre-upgrade completions are never awarded retroactively.
  if(prev?.quantity&&!next.affinity.sources[key]){if(quantity<=prev.quantity)continue;next.affinity.sources[key]={ceiling:prev.quantity,credit:0,quantity:prev.quantity,characterId:null,current:null,origin:prev.origin};}
  change(key,quantity,entry?.origin??prev?.origin??operationId);
  const source=entry??prev;if(source?.domain)for(const [penaltyId,p]of Object.entries(next.affinity.penalties))if(p.domain===source.domain&&p.sourceId===source.sourceId&&p.actual>0)change('refund:'+penaltyId,quantity>0?p.actual:0,p.transactionId);
 }}
 if(type.startsWith('task.')||type.startsWith('habit.'))observeEligibility(next,before,time);return plan;
}
