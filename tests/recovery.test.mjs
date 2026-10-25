import test from 'node:test';import assert from 'node:assert/strict';
import {createDataStore,STORAGE_KEY} from '../assets/data.mjs';
import {DAY,maintainRecovery,recoveryLifetime} from '../assets/recovery.mjs';
import {documentImageReferences} from '../assets/image-references.mjs?v=task-mobile-15';
import {encodeBackup,readBackup,dataCount} from '../assets/backup.mjs';
const memory=()=>{let raw=null;return {getItem:()=>raw,setItem:(_,v)=>raw=v};};
const fixture=()=>{let time=Date.now()-10*DAY;const storage=memory(),store=createDataStore(storage,{now:()=>time});return {store,storage,get time(){return time;},advance:n=>time+=n};};
const edit=(s,changes,type='settings.update')=>s.transact({type,label:'測試操作',target:'user',changes});
test('24h and 7d exact boundaries, mixed transactions take the shorter lifetime',async()=>{
 for(const [category,duration]of [['profile',DAY],['stats',7*DAY],['mixed',DAY],['activities',7*DAY]]){
 const f=fixture(),s=f.store;const changes=category==='stats'?{stats:{...s.get().stats,currency:20}}:category==='activities'?{activities:{task:true}}:{profile:{...s.get().profile,name:'修改'},...(category==='mixed'?{stats:{...s.get().stats,currency:20}}:{})};
 edit(s,changes);assert.equal(recoveryLifetime(s.get().undoHistory[0]),duration);f.advance(duration-1);assert.equal(s.getState().available,true);f.advance(1);assert.equal(s.getState().available,false);assert.equal((await s.undo()).ok,false);assert.equal(s.get().history.length,1);s.maintain();assert.equal(JSON.parse(f.storage.getItem(STORAGE_KEY)).undoHistory.length,0);for(const [key,value]of Object.entries(changes))assert.deepEqual(s.get()[key],value);
 }
});
test('Undo and Redo never renew original timestamps and their combined cap is 15',async()=>{
 const f=fixture(),s=f.store;edit(s,{profile:{...s.get().profile,name:'A'}});const time=s.get().undoHistory[0].time;f.advance(DAY-2);await s.undo();assert.equal(s.get().undoHistory[0].time,time);await s.redo();assert.equal(s.get().undoHistory[0].time,time);await s.undo();f.advance(2);assert.equal(s.getState().redoAvailable,false);assert.equal(s.get().profile.name,'');assert.equal(s.get().history[0].undone,true);
 for(let i=0;i<20;i++){edit(s,{stats:{...s.get().stats,currency:i+1}},'stats.manual');f.advance(1);}
 assert.equal(s.get().undoHistory.length,15);assert.equal(s.get().history.length,21);await s.undo();await s.undo();assert.equal(s.get().undoHistory.length,15);edit(s,{activities:{task:true}},'task.set');assert.equal(s.getState().redoAvailable,false);assert.equal(s.get().undoHistory.some(r=>r.undone),false);assert.equal(s.get().history.length,22);
});
test('expiry gaps do not resurrect unsafe Undo or Redo chains; current values and action deltas survive',async()=>{
 const f=fixture(),s=f.store;edit(s,{stats:{...s.get().stats,currency:10}},'stats.manual');f.advance(1);edit(s,{stats:{...s.get().stats,currency:20},profile:{...s.get().profile,name:'短期'}},'settings.update');f.advance(DAY);assert.equal(s.getState().available,false);assert.equal(s.get().stats.currency,20);assert.equal(s.get().history.length,2);assert.equal(s.get().history[0].delta.currency,10);assert.match(s.getState().recoveryNotice,/復原/);
 const g=fixture(),a=g.store;edit(a,{stats:{...a.get().stats,currency:10}},'stats.manual');g.advance(1);edit(a,{stats:{...a.get().stats,currency:20},profile:{...a.get().profile,name:'短期'}});await a.undo();await a.undo();g.advance(DAY);assert.equal(a.getState().redoAvailable,true);await a.redo();assert.equal(a.get().stats.currency,10);assert.equal(a.getState().redoAvailable,false);assert.equal(a.get().history.length,2);
});
test('only live recovery protects old images; metadata never contains snapshots',()=>{
 const now=Date.now(),s=createDataStore(memory(),{now:()=>now});const id='asset:'+'a'.repeat(64);edit(s,{photo:id},'image.update');edit(s,{photo:null},'image.update');const doc=s.get();assert.ok(documentImageReferences(doc).has(id));assert.ok(doc.history.every(r=>!('before'in r)&&!('after'in r)));
 const expired=maintainRecovery(doc,now+DAY).document;assert.equal(documentImageReferences(expired).has(id),false);assert.equal(expired.history.length,2);assert.equal(expired.photo,null);
});
test('legacy split retains original dates, effective action data and other settings; unknown snapshots are not recoverable',async()=>{
 const f=fixture(),s=f.store;edit(s,{profile:{...s.get().profile,name:'保留'}});const d=s.get(),date=d.history[0].time;
 d.history=structuredClone(d.undoHistory);delete d.undoHistory;delete d.historyVersion;d.settings={...d.settings,history:{recordAll:false}};
 const before=structuredClone(d);const migrated=maintainRecovery(d,f.time+DAY).document;assert.equal(migrated.history[0].time,date);assert.equal(migrated.undoHistory.length,0);assert.equal(migrated.profile.name,'保留');assert.equal(migrated.history[0].before,undefined);
 const payload={formatVersion:1,dataVersion:2,createdAt:new Date().toISOString(),dataCount:dataCount(before),imageCount:0,document:before,images:[]};const result=await readBackup(await encodeBackup(payload,'舊'),'舊');assert.equal(result.payload.document.history[0].time,date);assert.equal(result.payload.document.undoHistory.length,0);assert.equal(result.payload.document.settings.history,undefined);assert.deepEqual(result.payload.document.settings.appearance,d.settings.appearance);
 const unknown=structuredClone(before);unknown.history[0].after={futureData:{private:'snapshot'}};unknown.history[0].before={futureData:null};const u=maintainRecovery(unknown,f.time);assert.equal(u.document.undoHistory.length,0);assert.equal(u.document.history.length,1);
});
test('new backup round trip keeps expiry clocks, history and valid recovery separate',async()=>{
 const now=Date.now(),storage=memory(),s=createDataStore(storage,{now:()=>now});edit(s,{activities:{task:true},stats:{...s.get().stats,currency:5}},'task.set');const d=s.get(),payload={formatVersion:1,dataVersion:3,createdAt:new Date().toISOString(),dataCount:dataCount(d),imageCount:0,document:d,images:[]};const restored=await readBackup(await encodeBackup(payload,'password'),'password');
 assert.deepEqual(restored.payload.document,d);const t=Date.parse(d.undoHistory[0].time);assert.equal(maintainRecovery(restored.payload.document,t+7*DAY).document.undoHistory.length,0);assert.equal(restored.payload.document.history.length,1);
});

test('expired recent actions never revive a long-lived operation outside the latest 15',()=>{
 const f=fixture(),s=f.store;edit(s,{stats:{...s.get().stats,currency:8}},'stats.manual');
 for(let i=0;i<15;i++){f.advance(1);edit(s,{profile:{...s.get().profile,name:String(i)}},'profile.update');}
 f.advance(DAY);assert.equal(s.get().undoHistory.length,0);assert.equal(s.get().history.length,16);assert.equal(s.get().stats.currency,8);
});
test('unknown legacy timestamps retain readable/exportable metadata without inventing a recovery deadline',async()=>{
 const s=createDataStore(memory());edit(s,{profile:{...s.get().profile,name:'資料'}});const d=s.get();d.history=d.undoHistory;delete d.historyVersion;delete d.undoHistory;d.history[0].time='舊資料未記錄時間';const migrated=maintainRecovery(d).document;assert.equal(migrated.history.length,1);assert.equal(migrated.undoHistory.length,0);const payload={formatVersion:1,dataVersion:3,createdAt:new Date().toISOString(),dataCount:dataCount(migrated),imageCount:0,document:migrated,images:[]};const result=await readBackup(await encodeBackup(payload));assert.equal(result.payload.document.history[0].time,'舊資料未記錄時間');
});

test('expired replay and no-op edits publish snapshot cleanup without adding action records',async()=>{
 const f=fixture(),s=f.store;edit(s,{profile:{...s.get().profile,name:'仍保留'}});f.advance(DAY);await s.undo();assert.equal(JSON.parse(f.storage.getItem(STORAGE_KEY)).undoHistory.length,0);assert.equal(s.get().history.length,1);assert.equal(s.get().profile.name,'仍保留');
 const d=s.get(),payload={formatVersion:1,dataVersion:999,createdAt:new Date().toISOString(),dataCount:dataCount(d),imageCount:0,document:d,images:[]};await assert.rejects(readBackup(await encodeBackup(payload,'password'),'password'),/資料版本/);
});
