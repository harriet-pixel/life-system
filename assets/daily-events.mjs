import {localDate,rowsForDate,validDate} from './tasks-model.mjs?v=action-ready-20261028';
import {taipeiDate,POINTS,activePeriod} from './habits-model.mjs?v=storage-rescue-20261028';
import {relationshipStage} from './characters-model.mjs?v=storage-rescue-20261028';
export function formalDailyEvents(operation,state){
 const c=state.companion?.characters.find(c=>c.characterId===state.companion.activeCharacterId&&!c.archived);if(!c)return [];
 const events=[],push=(eventType,id,domain)=>events.push({sourceEventId:operation.id+':'+eventType+':'+id,operationId:operation.id,characterId:c.characterId,characterCreatedAt:c.createdAt,configVersion:c.configVersion,stageId:relationshipStage(c.affinity).stage,eventType,sourceId:id,domain,switchCount:state.companion.switchHistory.length,epoch:state.replyLibrary?.epoch??null,character:c});
 if(['task.completed','task.completed.batch'].includes(operation.type)){const before=new Set((operation.before.tasks?.completions??[]).filter(c=>!c.cancelledAt&&!c.retraction).map(c=>c.id));for(const r of operation.after.tasks?.completions??[])if(!before.has(r.id)&&!r.cancelledAt&&!r.retraction&&r.date===localDate())push('task.completed',r.id,'task');}
 if(operation.type==='habit.check'){const old=operation.before.habits,next=operation.after.habits;for(const r of next.records)if(r.date===taipeiDate()&&r.source==='normal'){const prior=old.records.find(p=>p.id===r.id);if(POINTS[r.state]>(POINTS[prior?.state]??0))push({'M':'habit.mini','P':'habit.plus','E':'habit.elite'}[r.state],r.id,'habit');}
  const known=new Set(old.periods.flatMap(p=>p.achievements.map(a=>p.id+':'+a.id)));for(const p of next.periods)for(const a of p.achievements)if(!known.has(p.id+':'+a.id)&&events.length)push('achievement.unlocked',p.id+':'+a.id,'achievement');
 }
 if(operation.type==='habit.bonus'){const known=new Set(operation.before.habits.bonusRecords.map(r=>r.id));for(const r of operation.after.habits.bonusRecords)if(!known.has(r.id)&&!r.cancelledAt&&r.date===taipeiDate())push('habit.bonus',r.id,'bonus');}
 return events;
}
export function validDailySource(state,e){const c=state.companion?.characters.find(c=>c.characterId===e.characterId);if(!c||c.archived||c.createdAt!==e.characterCreatedAt||state.companion.activeCharacterId!==e.characterId||state.companion.switchHistory.length!==e.switchCount||(state.replyLibrary?.epoch??null)!==e.epoch)return false;
 if(e.domain==='task-reminder'&&e.eventType==='task.incomplete'){const date=e.date??localDate();return validDate(date)&&date<=localDate()&&rowsForDate(state.tasks,date).some(r=>r.occurrence.id===e.sourceId&&r.occurrence.status==='pending');}
 if(e.domain==='habit-reminder'&&e.eventType==='habit.incomplete'){const [periodId,date,index]=e.sourceId.split('|');return date===taipeiDate()&&/^[0-2]$/.test(index)&&activePeriod(state.habits,date)?.id===periodId&&!state.habits.records.some(r=>r.periodId===periodId&&r.date===date&&r.habitIndex===Number(index)&&r.state!=='-');}
 if(e.domain==='task')return state.tasks.completions.some(r=>r.id===e.sourceId&&!r.cancelledAt&&!r.retraction);
 if(e.domain==='habit')return state.habits.records.some(r=>r.id===e.sourceId&&({'M':'habit.mini','P':'habit.plus','E':'habit.elite'})[r.state]===e.eventType);
 if(e.domain==='bonus')return state.habits.bonusRecords.some(r=>r.id===e.sourceId&&!r.cancelledAt);
 if(e.domain==='achievement')return state.habits.periods.some(p=>p.achievements.some(a=>p.id+':'+a.id===e.sourceId));return false;
}
