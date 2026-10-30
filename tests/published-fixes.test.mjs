import test from 'node:test';import assert from 'node:assert/strict';
import {createDataStore,migrateStatsRules,STORAGE_KEY,profileSummary} from '../assets/data.mjs';
import {createInitialStats,visibleExperience,validateManualStats} from '../assets/abilities.mjs';
function memory(){let raw=null;return {getItem:()=>raw,setItem:(_k,v)=>raw=v};}
test('published Lv1 baseline, visible EXP and numeric restart remain reversible',async()=>{
 const s=createDataStore(memory());assert.equal(s.get().stats.level,1);assert.equal(s.get().stats.experience,100);assert.equal(visibleExperience(100),0);assert.equal(profileSummary(s.get().stats),'Exp — ｜ Lv 1 ｜ $0/0');
 const progressed={...s.get().stats,level:3,experience:325,currency:45};s.transact({type:'test',label:'progress',target:'user',changes:{stats:progressed}});
 const before=s.get().stats;s.transact({type:'settings.update',label:'重新開始',target:'user',changes:{stats:createInitialStats()}});assert.equal(s.get().stats.level,1);await s.undo();assert.deepEqual(s.get().stats,before);
 const values={level:'0',currency:'0'};assert.throws(()=>validateManualStats(values,s.get().stats),/最低為 1/);
});
test('current published progress and journal are not reset; legacy upgrade retains other data',()=>{
 const storage=memory(),s=createDataStore(storage);s.transact({type:'test',label:'姓名',target:'user',changes:{profile:{...s.get().profile,name:'保留文字'}}});
 const raw=storage.getItem(STORAGE_KEY);migrateStatsRules(storage);assert.equal(storage.getItem(STORAGE_KEY),raw);
 const legacy=JSON.parse(raw);delete legacy.statsRulesVersion;legacy.stats.experience=999;legacy.stats.level=9;storage.setItem(STORAGE_KEY,JSON.stringify(legacy));migrateStatsRules(storage);
 const migrated=JSON.parse(storage.getItem(STORAGE_KEY));assert.equal(migrated.profile.name,'保留文字');assert.deepEqual(migrated.settings,legacy.settings);assert.deepEqual(migrated.portraits,legacy.portraits);assert.equal(migrated.statsRulesVersion,2);assert.equal(migrated.stats.level,1);assert.equal(migrated.history.length,legacy.history.length);
 const once=storage.getItem(STORAGE_KEY);migrateStatsRules(storage);assert.equal(storage.getItem(STORAGE_KEY),once);
});
