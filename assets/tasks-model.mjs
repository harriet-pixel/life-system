import {validHex,luminance} from './settings-model.mjs?v=tasks-data-2';
import {ABILITIES} from './abilities.mjs?v=tasks-data-2';
export function categoryColor(color){if(color===null||color===undefined||color==='')return null;if(!validHex(color))throw new Error('分類顏色請使用 #RRGGBB 格式。');if(1.05/(luminance(color)+.05)<4.5)throw new Error('此顏色在白底上不夠清楚，請選擇較深的文字顏色。');return color.toLowerCase();}
export const emptyTasks=()=>({version:1,categories:[],definitions:[],occurrences:[],completions:[]});
const requireValue=(ok,message='待辦資料格式不正確，原資料已保留。')=>{if(!ok)throw new Error(message);};
export const localDate=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function validDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00');return !Number.isNaN(+d)&&localDate(d)===s;}
export function addDays(s,n){const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return localDate(d);}
export const weekday=s=>new Date(s+'T12:00:00').getDay();
export const weekStart=s=>addDays(s,-((weekday(s)+6)%7));
export const occurrenceId=(task,date)=>task.kind==='once'?task.id:task.id+'@'+date;
export function allocation(value,points){requireValue(value&&typeof value==='object'&&!Array.isArray(value),'能力分配必須是物件。');requireValue(Object.keys(value).length===5&&ABILITIES.every(a=>Object.hasOwn(value,a.id)&&Number.isSafeInteger(value[a.id])&&value[a.id]>=0),'能力分配須包含五項非負整數。');requireValue(Object.values(value).reduce((a,b)=>a+b,0)===points,'能力分配總和須等於事項點數。');return structuredClone(value);}
const unique=items=>new Set(items.map(x=>x.id)).size===items.length;
export function validateTasks(value){
 requireValue(value?.version===1&&['categories','definitions','occurrences','completions'].every(k=>Array.isArray(value[k])&&unique(value[k])));
 const cats=new Set(value.categories.map(x=>x.id)),defs=new Map(value.definitions.map(x=>[x.id,x])),executions=new Map(value.occurrences.map(o=>[o.id,o])),completions=new Map(value.completions.map(c=>[c.id,c]));
 const text=s=>typeof s==='string'&&s.trim().length>0;
 value.categories.forEach(c=>requireValue(text(c.id)&&text(c.name)));
 value.categories.forEach(c=>{if(c.color!==undefined)categoryColor(c.color);});
 value.definitions.forEach(t=>requireValue(text(t.id)&&!t.id.includes('@')&&text(t.name)&&(t.categoryId===null||cats.has(t.categoryId))&&Number.isInteger(t.points)&&t.points>=1&&t.points<=3&&['once','repeat'].includes(t.kind)&&validDate(t.start)&&(t.end===null||validDate(t.end)&&t.end>=t.start)&&(t.date===null||validDate(t.date))&&Array.isArray(t.days)&&new Set(t.days).size===t.days.length&&t.days.every(d=>Number.isInteger(d)&&d>=0&&d<=6)&&['keep','skip'].includes(t.overdue)&&Number.isSafeInteger(t.version)&&t.version>0&&Number.isFinite(Date.parse(t.createdAt))&&typeof t.deleted==='boolean'&&(t.checkedThrough===null||validDate(t.checkedThrough))));
 value.occurrences.forEach(o=>{const t=defs.get(o.taskId);requireValue(t&&o.id===occurrenceId(t,o.date)&&validDate(o.date)&&validDate(o.originalDate)&&['pending','done','skipped','moved','deleted','unarranged'].includes(o.status)&&['auto','manual','pool'].includes(o.source)&&(o.completionId===null||typeof o.completionId==='string'));});
 value.completions.forEach(c=>{requireValue(text(c.id)&&defs.has(c.taskId)&&text(c.occurrenceId)&&text(c.transactionId)&&Number.isFinite(Date.parse(c.time))&&validDate(c.date)&&text(c.name)&&text(c.category)&&Number.isInteger(c.points)&&c.points>=1&&c.points<=3&&c.reward?.currency===c.points&&c.reward?.experience===c.points&&(c.cancelledAt===null||Number.isFinite(Date.parse(c.cancelledAt))));allocation(c.reward.abilities,c.points);requireValue(c.occurrenceId===occurrenceId(defs.get(c.taskId),c.date));if(c.cancelledAt===null){const o=executions.get(c.occurrenceId);requireValue(o?.status==='done'&&o.completionId===c.id&&o.taskId===c.taskId&&o.date===c.date);}});
 requireValue(new Set(value.completions.filter(c=>c.cancelledAt===null).map(c=>c.occurrenceId)).size===value.completions.filter(c=>c.cancelledAt===null).length);
 value.occurrences.filter(o=>o.status==='done').forEach(o=>{const c=completions.get(o.completionId);requireValue(c&&c.occurrenceId===o.id&&c.taskId===o.taskId&&c.date===o.date&&c.cancelledAt===null);});
 return structuredClone(value);
}
export const categoryName=(data,task)=>data.categories.find(c=>c.id===task.categoryId)?.name??'未定義';
export const automatic=(task,date)=>!task.deleted&&task.kind==='repeat'&&date>=task.start&&(!task.end||date<=task.end)&&task.days.includes(weekday(date));
export function occurrence(data,task,date){
 const stored=data.occurrences.find(o=>o.id===occurrenceId(task,date));
 if(stored)return stored;
 if(!task.deleted&&(task.kind==='once'?task.date===date:automatic(task,date)))return {id:occurrenceId(task,date),taskId:task.id,date,originalDate:date,status:'pending',source:task.kind==='repeat'?'auto':'manual',completionId:null};
 return null;
}
export function rowsForDate(data,date){const stored=new Map(data.occurrences.map(o=>[o.id,o])),completed=new Map(data.completions.map(c=>[c.id,c]));return data.definitions.flatMap(t=>{const o=stored.get(occurrenceId(t,date))??(!t.deleted&&(t.kind==='once'?t.date===date:automatic(t,date))?{id:occurrenceId(t,date),taskId:t.id,date,originalDate:date,status:'pending',source:t.kind==='repeat'?'auto':'manual',completionId:null}:null);if(!o||o.date!==date||!['pending','done'].includes(o.status))return [];if(t.deleted&&o.status!=='done')return [];const c=o.status==='done'?completed.get(o.completionId):null;return [{task:t,occurrence:o,name:c?.name??t.name,category:c?.category??categoryName(data,t),points:c?.points??t.points}];});}
export function catchUp(data,today){
 const next=structuredClone(data),yesterday=addDays(today,-1),seen=new Set(data.occurrences.map(o=>o.id));
 for(const t of next.definitions){t.overdue='keep';if(t.deleted)continue;
  if(t.kind==='repeat'&&t.days.length){for(let d=t.checkedThrough?addDays(t.checkedThrough,1):t.start;d<=yesterday;d=addDays(d,1)){if(automatic(t,d)&&!seen.has(occurrenceId(t,d))){const id=occurrenceId(t,d);next.occurrences.push({id,taskId:t.id,date:d,originalDate:d,status:'pending',source:'auto',completionId:null});seen.add(id);}}if(yesterday>=t.start)t.checkedThrough=yesterday;}
  if(t.kind==='once'&&t.date&&t.date<today&&!seen.has(t.id))next.occurrences.push(occurrence(next,t,t.date));
 }
 return next;
}
export function putOccurrence(data,o){const i=data.occurrences.findIndex(x=>x.id===o.id);if(i<0)data.occurrences.push(o);else data.occurrences[i]=o;}
export function schedule(data,taskId,date,from=null){
 requireValue(validDate(date),'請選擇有效日期。');const t=data.definitions.find(t=>t.id===taskId&&!t.deleted);requireValue(t,'事項已刪除。');
 const old=from?occurrence(data,t,from):null;requireValue(!from||(old&&old.date===from),'原日期安排已變更，請重新選取事項。');requireValue(!old||old.status==='pending','僅能移動未完成安排。');
 requireValue(!old||old.date!==date,'請選擇不同日期。');
 const target=occurrence(data,t,date);requireValue(!target||(t.kind==='once'&&['pending','unarranged'].includes(target.status)),'目標日期已有此事項或例外紀錄，請選擇其他日期。');
 if(t.kind==='once'){const existing=data.occurrences.find(o=>o.id===t.id);requireValue(!existing||['pending','unarranged'].includes(existing.status),'一次性事項已完成或不再處理。');t.date=date;t.version++;}
 if(old&&t.kind==='repeat')putOccurrence(data,{...old,status:'moved'});
 putOccurrence(data,{id:occurrenceId(t,date),taskId:t.id,date,originalDate:old?.originalDate??(t.kind==='once'?target?.originalDate:null)??date,status:'pending',source:'manual',completionId:null});
}

// An explicit unarranged state preserves the source date without resurrecting a removed schedule.
export function clearSchedule(data,task,from=null){
 const o=from?occurrence(data,task,from):data.occurrences.find(o=>o.taskId===task.id);
 if(o&&o.status!=='pending'&&o.status!=='unarranged')throw new Error('已完成或不再處理的紀錄不能清除日期。');
 if(o)putOccurrence(data,{...o,status:task.kind==='once'?'unarranged':'deleted'});
 if(task.kind==='once')task.date=null;
}

// Yesterday remains in the three-day list; only earlier pending dates enter the overdue pool.
export const isOverdue=(entry,today=localDate())=>Boolean(entry&&entry.status==='pending'&&entry.date<addDays(today,-1));
