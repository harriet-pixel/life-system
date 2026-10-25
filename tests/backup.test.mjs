import test from 'node:test';
import assert from 'node:assert/strict';
import {createDataStore} from '../assets/data.mjs';
import {encodeBackup,readBackup,dataCount,hash,validateDocument} from '../assets/backup.mjs';
import {themeTokens,luminance} from '../assets/settings-model.mjs';
import {collectReferences,documentImageReferences} from '../assets/image-references.mjs?v=task-response-16';
const fixture=()=>{const d=createDataStore({getItem:()=>null,setItem:()=>{}}).get();return {formatVersion:1,dataVersion:3,createdAt:new Date().toISOString(),dataCount:dataCount(d),imageCount:0,document:d,images:[]};};
test('encrypted and plain backups round trip with identical settings and history',async()=>{
 for(const password of ['','測試密碼']){const payload=fixture(),blob=await encodeBackup(payload,password),restored=await readBackup(blob,password);assert.deepEqual(restored.payload,payload);assert.deepEqual(restored.assets,[]);}
});
test('wrong password, tampering and unsupported versions are rejected',async()=>{
 const encrypted=await encodeBackup(fixture(),'right');await assert.rejects(readBackup(encrypted,'wrong'),/密碼/);
 const blob=await encodeBackup(fixture());const envelope=JSON.parse(await blob.text());envelope.payload.document.profile.name='changed';await assert.rejects(readBackup(new Blob([JSON.stringify(envelope)])),/完整性/);
 envelope.version=99;await assert.rejects(readBackup(new Blob([JSON.stringify(envelope)])),/版本/);
 await assert.rejects(readBackup(new Blob(['not json'])),/JSON/);
});
test('missing images and invalid structures cannot be restored',async()=>{
 const privateText=fixture().document;privateText.profile.motto='asset:這是文字';assert.equal(documentImageReferences(privateText).size,0);
 const payload=fixture();payload.document.photo='asset:'+'a'.repeat(64);await assert.rejects(readBackup(await encodeBackup(payload)),/缺少必要圖片/);
 assert.throws(()=>validateDocument({...fixture().document,accessToken:'secret'}),/認證欄位/);
 const foreign=fixture();foreign.document.stats.abilities[0].id='unknown';await assert.rejects(readBackup(await encodeBackup(foreign)),/結構/);
 const invalid=fixture();invalid.document.stats.abilities[0].value=-1;await assert.rejects(readBackup(await encodeBackup(invalid)),/結構/);
});
test('reference collector covers all nested snapshots and fails on unknown asset formats',()=>{
 const a='asset:'+'a'.repeat(64),b='asset:'+'b'.repeat(64);assert.deepEqual([...collectReferences({history:[{before:{photo:a},after:{portraits:[{source:b}]}}]})],[a,b]);assert.throws(()=>collectReferences({photo:'asset:unknown'}));
});
test('light and dark colours produce readable control text and surfaces',()=>{
 for(const color of ['#ffffff','#000000','#ffff00','#00ffff','#ff0000','#104a7a','#777777']){
 const t=themeTokens(color),control=t['--color-primary'];assert.ok(1.05/(luminance(control)+.05)>=4.5);assert.ok((luminance(t['--color-tint'])+.05)/(luminance(control)+.05)>=4.5);
 const a=luminance(color),b=luminance(t['--color-on-accent']);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5);
 }
});
test('legacy portrait source remains optional, matching existing image fallback semantics',async()=>{
 const p=fixture(),bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2mSIAAAAASUVORK5CYII=','base64'),digest=await hash(bytes),id='asset:'+digest;
 p.document.portraits=[{id:'legacy',image:id}];p.images=[{id,mime:'image/png',size:bytes.length,createdAt:null,name:null,sha256:digest,data:bytes.toString('base64')}];p.imageCount=1;p.dataCount=dataCount(p.document);
 const restored=await readBackup(await encodeBackup(p));assert.deepEqual(restored.payload.document.portraits,p.document.portraits);
});
