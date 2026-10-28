import test from 'node:test';
import assert from 'node:assert/strict';
import {createDataStore} from '../assets/data.mjs';
import {isCurrentRoute} from '../assets/navigation.mjs';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
const activity=(store,checked)=>store.transact({type:'task.set',target:'task-1',label:'測試操作',changes:{activities:{'task-1':checked}}});
test('durable Undo and Redo restore data without duplicate history; a new edit discards redo',async()=>{
 const storage=memory(),store=createDataStore(storage);activity(store,true);assert.equal(store.getState().available,true);
 assert.equal((await store.undo()).ok,true);assert.deepEqual(store.get().activities,{});assert.equal(store.get().history.length,1);
 const reloaded=createDataStore(storage);assert.equal(reloaded.getState().redoAvailable,true);assert.equal((await reloaded.redo()).ok,true);assert.equal(reloaded.get().activities['task-1'],true);
 await reloaded.undo();activity(reloaded,false);assert.equal(reloaded.getState().redoAvailable,false);
});
test('stale revisions never overwrite newer data; failed replay can refresh and retry',async()=>{
 const storage=memory(),a=createDataStore(storage),b=createDataStore(storage);activity(a,true);
 assert.throws(()=>activity(b,false),/其他頁面/);b.refresh();await b.undo();assert.deepEqual(b.get().activities,{});
 assert.equal((await a.undo()).ok,false);assert.deepEqual(createDataStore(storage).get().activities,{});
});
test('no-op edits and replay never add records; returned snapshots cannot mutate source',async()=>{
 const store=createDataStore(memory());activity(store,true);assert.equal(activity(store,true),false);const state=store.get();state.activities.x=true;assert.equal(store.get().activities.x,undefined);
 await store.undo();await store.redo();assert.equal(store.get().history.length,1);
});
test('appearance, profile, image IDs and history settings participate in the same journal',async()=>{
 const store=createDataStore(memory()),before=store.get().settings;
 store.transact({type:'appearance.update',target:'settings',label:'外觀',changes:{settings:{...before,appearance:{color:'#ffffff',font:'rounded'}}}});
 await store.undo();assert.deepEqual(store.get().settings,before);await store.redo();assert.equal(store.get().settings.appearance.font,'rounded');
 store.transact({type:'history.settings',target:'settings',label:'歷史',changes:{settings:{...store.get().settings,history:{recordAll:false}}}});
 const count=store.get().history.length;activity(store,true);assert.equal(store.get().history.length,count+1);
});
test('journal retains 15 recoveries while preserving all action metadata',()=>{const store=createDataStore(memory());for(let i=0;i<60;i++)activity(store,Boolean(i%2));assert.equal(store.get().history.length,60);assert.equal(store.get().undoHistory.length,15);});
test('current route supports GitHub Pages subpaths',()=>{
 assert.equal(isCurrentRoute('https://a.test/life-system/','https://a.test/life-system/index.html?v=sync-live-20261028#main'),true);
 assert.equal(isCurrentRoute('https://a.test/life-system/settings.html','https://a.test/other/'),false);
});
test('restored revisions stay monotonic and preserve the order of a durable Redo branch',async()=>{
 const original=createDataStore(memory());
 for(const photo of ['a','b','c'])original.transact({type:'photo.test',target:'user',label:photo,changes:{photo}});
 await original.undo();await original.undo();
 const restored=createDataStore(memory());restored.replace(original.get());assert.ok(restored.get().revision>=original.get().revision);
 await restored.redo();assert.equal(restored.get().photo,'b');await restored.undo();await restored.redo();assert.equal(restored.get().photo,'b');await restored.redo();assert.equal(restored.get().photo,'c');assert.equal(restored.get().history.length,3);
});
