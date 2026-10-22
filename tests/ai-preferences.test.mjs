import test from 'node:test';import assert from 'node:assert/strict';
import {createDataStore} from '../assets/data.mjs';import {normalizeSettings} from '../assets/settings-model.mjs';import {encodeBackup,readBackup,dataCount,validateDocument} from '../assets/backup.mjs';
const fixture=()=>{let raw=null;return {getItem:()=>raw,setItem:(_,value)=>raw=value};};
test('AI preferences use the shared store without journal, Redo invalidation, credentials or changes to progress',async()=>{
 const storage=fixture(),store=createDataStore(storage);store.transact({type:'appearance.update',changes:{settings:{...store.get().settings,appearance:{color:'#315e46',font:'sans'}}}});await store.undo();const before=store.get();
 store.setAIPreferences({provider:'claude',model:'fixture-model'});assert.equal(store.getState().redoAvailable,true);assert.deepEqual(store.get().stats,before.stats);assert.deepEqual(store.get().history,before.history);assert.equal(store.get().undoHistory.length,before.undoHistory.length);
 await store.redo();assert.deepEqual(store.get().settings.ai,{provider:'claude',model:'fixture-model'});assert.deepEqual(createDataStore(storage).get().settings.ai,store.get().settings.ai);
 assert.throws(()=>store.setAIPreferences({provider:'openai',model:'x',apiKey:'test-only-invalid-credential'}));assert.ok(!storage.getItem().includes('credential'));
});
test('backup preserves only non-sensitive preferences; old backups default safely and credential imports are rejected',async()=>{
 const store=createDataStore(fixture());store.setAIPreferences({provider:'gemini',model:'models/gemini-2.5-flash'});const document=store.get();
 const payload={formatVersion:1,dataVersion:3,createdAt:new Date().toISOString(),document,dataCount:dataCount(document),imageCount:0,images:[]};
 const restored=await readBackup(await encodeBackup(payload));assert.deepEqual(restored.payload.document.settings.ai,document.settings.ai);
 const old=structuredClone(payload);delete old.document.settings.ai;const result=await readBackup(await encodeBackup(old));assert.deepEqual(result.payload.document.settings.ai,{provider:'gemini',model:''});
 for(const field of ['apiKey','token','connected','connectionState']){const copy=structuredClone(document);copy.settings.ai[field]='test-only-invalid-credential';assert.throws(()=>validateDocument(copy));}
 assert.deepEqual(normalizeSettings({appearance:{color:'#104a7a',font:'serif'}}).ai,{provider:'gemini',model:''});
});
