import test from 'node:test';
import assert from 'node:assert/strict';
import { createUndoManager, createActivityStore } from '../assets/undo.mjs';
import { isCurrentRoute } from '../assets/navigation.mjs';
const operation = (undo, rest = {}) => ({ id: 'op1', type: 'task.set', target: 'task-1', label: '測試操作', before: false, after: true, undo, ...rest });

test('disabled until successful operation is recorded; undo restores source, no redo', async () => {
 const manager=createUndoManager(), store=createActivityStore([{id:'task-1',checked:false}]);
 assert.equal(manager.getState().available,false);
 assert.equal((await manager.undo()).reason,'unavailable');
 const change=store.set('task-1',true);
 manager.record(operation(()=>store.restore(change),{before:change.before,after:change.after}));
 assert.equal(store.get('task-1').checked,true);
 assert.equal((await manager.undo()).ok,true);
 assert.equal(store.get('task-1').checked,false);
 assert.equal(manager.getState().available,false);
 assert.equal((await manager.undo()).reason,'unavailable');
});
test('only the most recent reversible operation is retained', async () => {
 const manager=createUndoManager();let a=true,b=true;
 manager.record(operation(()=>{a=false;}));manager.record(operation(()=>{b=false;},{id:'op2',target:'habit-1'}));
 await manager.undo();assert.equal(a,true);assert.equal(b,false);
});
test('failed asynchronous restore retains record and permits retry', async () => {
 const manager=createUndoManager();let fail=true, restored=false;
 manager.record(operation(async()=>{if(fail)throw new Error('network failed');restored=true;}));
 assert.equal((await manager.undo()).reason,'failed');assert.equal(manager.getState().available,true);assert.equal(restored,false);
 fail=false;assert.equal((await manager.undo()).ok,true);assert.equal(restored,true);
});
test('duplicate undo and new submissions are blocked during asynchronous restore', async () => {
 const manager=createUndoManager();let resolve;let calls=0;
 manager.record(operation(()=>{calls++;return new Promise(r=>{resolve=r;});}));
 const pending=manager.undo();assert.equal(manager.getState().busy,true);
 assert.equal((await manager.undo()).reason,'unavailable');assert.throws(()=>manager.record(operation(()=>{})));
 assert.equal(calls,1);resolve();await pending;assert.equal(manager.getState().busy,false);
});
test('source revision conflict never overwrites newer data; failed record remains', async () => {
 const manager=createUndoManager(), store=createActivityStore([{id:'task-1',checked:false}]);
 const change=store.set('task-1',true);manager.record(operation(()=>store.restore(change)));
 store.set('task-1',false);store.set('task-1',true);
 const latest=store.get('task-1');assert.equal((await manager.undo()).reason,'failed');
 assert.deepEqual(store.get('task-1'),latest);assert.equal(manager.getState().available,true);
});
test('state observers share pending and available state; unsubscribe works', async () => {
 const manager=createUndoManager(), states=[];const off=manager.subscribe(s=>states.push(s));
 manager.record(operation(()=>{}));await manager.undo();off();manager.record(operation(()=>{}));
 assert.deepEqual(states.map(s=>[s.available,s.busy]),[[false,false],[true,false],[false,true],[false,false]]);
});
test('no-op edits do not create records and snapshots cannot mutate store', () => {
 const store=createActivityStore([{id:'x',checked:false}]);assert.equal(store.set('x',false),null);
 const copy=store.get('x');copy.checked=true;assert.equal(store.get('x').checked,false);assert.throws(()=>store.set('x','true'));
});
test('current route uses actual origin/path, accepts root/index.html, ignores query/hash', () => {
 assert.equal(isCurrentRoute('https://a.test/life-system/','https://a.test/life-system/index.html?v=1#main'),true);
 assert.equal(isCurrentRoute('https://a.test/life-system/','https://a.test/other/'),false);
 assert.equal(isCurrentRoute('https://a.test/life-system/','https://b.test/life-system/'),false);
 assert.equal(isCurrentRoute(null,'https://a.test/'),false);
});
