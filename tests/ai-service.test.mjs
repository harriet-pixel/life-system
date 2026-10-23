import test from 'node:test';import assert from 'node:assert/strict';
import {createAIConnection,AI_MESSAGES} from '../assets/ai-service.mjs';
const endpoint='https://backend.example.invalid/v1/ai',key='test-only-invalid-credential';
const list=models=>new Response(JSON.stringify({models:models.map(id=>({id,name:id})),fetchedAt:new Date().toISOString()}));
const setup=options=>createAIConnection({endpoint,getAccessToken:async()=>'test-only-login-token',...options});
test('unconfigured backend never fetches and state never includes credentials',async()=>{
 const service=createAIConnection({fetcher:()=>assert.fail('must not fetch')});service.setKey(key);await service.connect();assert.equal(service.getState().status,'error');assert.equal(service.getState().message,AI_MESSAGES.unconfigured);assert.ok(!JSON.stringify(service.getState()).includes(key));
});
test('switching provider/key and disconnect cancel stale listings and pending login without sending a replaced credential',async()=>{
 let resolve,fetches=0;const service=setup({getAccessToken:()=>new Promise(r=>resolve=r),fetcher:async()=>{fetches++;return list(['one']);}});
 service.setKey(key);const work=service.connect();service.setProvider('claude');resolve('test-only-login-token');await work;assert.equal(fetches,0);assert.equal(service.getState().provider,'claude');assert.equal(service.getState().hasKey,false);
 let complete;const delayed=setup({fetcher:()=>new Promise(r=>complete=r)});delayed.setKey(key);const old=delayed.connect();await new Promise(r=>setImmediate(r));delayed.setKey('another-test-only-invalid-credential');complete(list(['old']));await old;assert.deepEqual(delayed.getState().models,[]);
 delayed.setKey(key);const pending=delayed.connect();await new Promise(r=>setImmediate(r));delayed.disconnect();complete(list(['old']));await pending;assert.equal(delayed.getState().connected,false);assert.equal(delayed.getState().hasKey,false);
});
test('saved missing model clears selection/preference; failed refresh never displays a stale list',async()=>{
 let failed=false;const saves=[];const service=setup({preference:{provider:'openai',model:'removed'},savePreference:async p=>saves.push(p),fetcher:async()=>failed?new Response(JSON.stringify({error:{code:'permission'}}),{status:403}):list(['valid'])});
 service.setKey(key);await service.connect();assert.equal(service.getState().model,'');assert.match(service.getState().message,/重新選擇/);assert.deepEqual(saves,[{provider:'openai',model:''}]);service.selectModel('valid');failed=true;await service.refresh();assert.deepEqual(service.getState().models,[]);assert.equal(service.getState().connected,false);
});
test('model unavailable is blocked and refreshes; transient failures retain model; test sends only fixed operation',async()=>{
 let mode='success';const sent=[];const service=setup({fetcher:async(_,options)=>{const body=JSON.parse(options.body);sent.push(body);if(body.operation==='models')return list(['valid','other']);return mode==='success'?new Response('{"ok":true}'):new Response(JSON.stringify({error:{code:mode,message:key}}),{status:mode==='model_unavailable'?404:429});}});
 service.setKey(key);await service.connect();service.selectModel('valid');await service.test();assert.equal(service.getState().status,'generation_succeeded');assert.deepEqual(Object.keys(sent.at(-1)).sort(),['apiKey','model','operation','provider']);
 for(const modeName of ['rate_limit','quota','network','timeout','provider_service']){mode=modeName;await service.test();assert.equal(service.getState().model,'valid');assert.ok(!service.getState().message.includes(key));}
 mode='model_unavailable';await service.test();assert.equal(service.getState().model,'');assert.deepEqual(service.getState().models.map(m=>m.id),['other']);assert.match(service.getState().message,/重新選擇/);
});
test('no login and timeout are safe; no retries or false success',async()=>{
 const service=setup({getAccessToken:async()=>null,fetcher:()=>assert.fail('must not fetch')});service.setKey(key);await service.connect();assert.equal(service.getState().message,AI_MESSAGES.login_required);
 const timeout=setup({timeoutMs:5,fetcher:async(_,options)=>new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(new Error(key))))});timeout.setKey(key);await timeout.connect();assert.equal(timeout.getState().message,AI_MESSAGES.timeout);
});

test('timeout also bounds a pending login integration, not only an upstream fetch',async()=>{
 const service=setup({timeoutMs:5,getAccessToken:()=>new Promise(()=>{}),fetcher:()=>assert.fail('must not fetch')});service.setKey(key);await service.connect();assert.equal(service.getState().message,AI_MESSAGES.timeout);assert.equal(service.getState().busy,false);
});
