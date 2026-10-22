import test from 'node:test';
import assert from 'node:assert/strict';
import {TEXT_LIMITS,textLength,validateProfileFields,validateNewPassword,validateRestorePassword,validateHistoryPage,validHex} from '../assets/validation.mjs';
import {createDataStore,STORAGE_KEY} from '../assets/data.mjs';
import {encodeBackup,readBackup,dataCount,inspectBackupFile} from '../assets/backup.mjs';
const memory=()=>{let raw=null;return {getItem:()=>raw,setItem:(_,value)=>raw=value};};
test('code point limits preserve IME text, Chinese and emoji; unchanged legacy fields remain editable',()=>{
 assert.equal(textLength('繁😀'),2);for(const [key,max]of Object.entries(TEXT_LIMITS)){const old={name:'',age:'',gender:'',motto:'',bio:'',boundaries:'',[key]:'😀'.repeat(max+1)};assert.equal(validateProfileFields(old,old)[key],old[key]);assert.throws(()=>validateProfileFields({...old,[key]:old[key]+'字'},old),/最多/);assert.equal(validateProfileFields({...old,[key]:'繁😀'},old)[key],'繁😀');}
 for(const age of ['-1','1.5','Infinity','NaN','9007199254740992'])assert.throws(()=>validateProfileFields({age}));
});
test('new encryption password is exact ASCII 8–64, legacy decryption retains Unicode and 1024 units',()=>{
 for(const p of ['', '12345678','a '.repeat(32)])assert.equal(validateNewPassword(p),p);
 for(const p of ['short','a'.repeat(65),'繁體中文12345678'])assert.throws(()=>validateNewPassword(p));
 assert.throws(()=>validateNewPassword('',{required:true}));assert.equal(validateRestorePassword('舊😀密碼'.repeat(100)),'舊😀密碼'.repeat(100));assert.throws(()=>validateRestorePassword('a'.repeat(1025)));
 assert.ok(validHex('#b58a36'));assert.equal(validHex('#fff'),false);assert.equal(validateHistoryPage('2',2),2);for(const p of ['0','3','NaN','1.5'])assert.throws(()=>validateHistoryPage(p,2));
});
test('legacy disabled history preference cannot disable fixed recovery',async()=>{
 const storage=memory(),s=createDataStore(storage);s.transact({type:'history.settings',changes:{settings:{...s.get().settings,history:{recordAll:false}}}});assert.equal(s.get().settings.history,undefined);
 s.transact({type:'profile.update',changes:{profile:{...s.get().profile,name:'新的'}}});assert.equal(s.get().history.length,1);assert.equal((await s.undo()).ok,true);assert.equal(s.get().profile.name,'');
 assert.throws(()=>s.transact({type:'profile.update',changes:{profile:{...s.get().profile,name:'字'.repeat(31)}}}));
});
test('legacy long text and short/Unicode/long passwords round trip without truncation; bounded outer parsing fails safely',async()=>{
 const s=createDataStore(memory()),d=s.get();d.profile.name='舊'.repeat(40);d.profile.age='99';const payload={formatVersion:1,dataVersion:3,createdAt:new Date().toISOString(),dataCount:dataCount(d),imageCount:0,document:d,images:[]};
 for(const p of ['短','密😀'.repeat(100),'a'.repeat(1024)]){const blob=await encodeBackup(payload,p);assert.equal((await inspectBackupFile(blob)).encrypted,true);assert.deepEqual((await readBackup(blob,p)).payload,payload);}
 await assert.rejects(inspectBackupFile(new Blob(['null'])));await assert.rejects(inspectBackupFile(new Blob(['{"version":99}'])));
 const storage=memory();storage.setItem(STORAGE_KEY,JSON.stringify(d));const loaded=createDataStore(storage);loaded.transact({type:'profile.update',changes:{profile:{...d.profile,bio:'更新'}}});assert.equal(loaded.get().profile.name,d.profile.name);
});
