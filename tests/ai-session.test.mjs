import test from 'node:test';import assert from 'node:assert/strict';
import {createAISession,AI_SESSION_KEY} from '../assets/ai-session.mjs';
import {createPageAIConnection} from '../assets/ai-client.mjs';
const key='test-only-invalid-credential';
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),values};};
const listing=()=>new Response(JSON.stringify({data:[{id:'gpt-4.1'},{id:'text-embedding-3-small'}]}));
const output=()=>new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:'fixture response'}]}]}));
test('test mode defaults off and stores one manual-lifetime session until explicit clear',()=>{
 const storage=memory();let time=1000000;const session=createAISession(storage,{now:()=>time});assert.equal(session.read(),null);session.enable('openai');session.setKey('openai',key);session.setModel('gpt-4.1');const start=session.read();
 time+=1000;assert.equal(session.read().expiresAt,null);assert.equal(session.read().version,2);session.setKey('openai','another-test-only-invalid-credential');assert.equal(session.read().issuedAt,start.issuedAt);assert.equal(storage.values.size,1);assert.ok(storage.values.has(AI_SESSION_KEY));
 time+=10*365*86400000;assert.equal(session.read().apiKey,'another-test-only-invalid-credential');session.clear();assert.equal(session.read(),null);assert.equal(storage.values.size,0);
});
test('future, malformed, overlong or invalid-deadline data is removed without touching user data',()=>{
 const storage=memory();storage.setItem('life-system.data.v1','unchanged');let time=1000;const session=createAISession(storage,{now:()=>time});
 session.enable('gemini');session.setKey('gemini',key);const valid=session.read();
 for(const changes of [{expiresAt:valid.expiresAt+1},{issuedAt:time+1},{version:99},{provider:'unknown'},{apiKey:'x'.repeat(4097)},{extra:'unsupported'}]){storage.setItem(AI_SESSION_KEY,JSON.stringify({...valid,...changes}));assert.equal(session.read(),null);assert.equal(storage.getItem('life-system.data.v1'),'unchanged');}
 storage.setItem(AI_SESSION_KEY,'bad-json');assert.equal(session.read(),null);
});
test('one service resumes selected provider/model on another page and truly generates through the official adapter',async()=>{
 const storage=memory(),calls=[];let time=1000;
 const options={storage,now:()=>time,fetcher:async(url,request)=>{calls.push({url:String(url),request});return request.method==='GET'?listing():output();}};
 const first=createPageAIConnection(options);assert.equal(first.getState().configured,false);first.setBrowserMode(true);assert.equal(first.getState().configured,true);first.setProvider('openai');first.setKey(key);await first.connect();first.selectModel('gpt-4.1');const expiresAt=first.getState().expiresAt;first.suspend();
 time+=30000;const second=createPageAIConnection(options);assert.equal(second.getState().mode,'browser');assert.equal(second.getState().expiresAt,expiresAt);assert.equal(second.getState().restorableModel,true);
 const response=await second.generate({text:'Hello fixture',maxOutputTokens:128});assert.deepEqual(response,{text:'fixture response'});assert.equal(calls.at(-1).url,'https://api.openai.com/v1/responses');assert.equal(JSON.parse(calls.at(-1).request.body).input,'Hello fixture');assert.equal(calls.at(-1).request.headers.Authorization,'Bearer '+key);assert.ok(!JSON.stringify(second.getState()).includes(key));
 second.disconnect();assert.equal(storage.getItem(AI_SESSION_KEY),null);assert.equal(second.getState().hasKey,false);second.suspend();
});
test('elapsed years do not disable requests; removing session still blocks stale credentials',async()=>{
 const storage=memory();let time=1000,calls=0;const client=createPageAIConnection({storage,now:()=>time,fetcher:async()=>{calls++;return listing();}});client.setBrowserMode(true);client.setProvider('openai');client.setKey(key);time+=10*365*86400000;
 await client.connect();assert.equal(calls,1);assert.equal(client.getState().hasKey,true);assert.equal(client.getState().mode,'browser');assert.equal(client.getState().expiresAt,null);client.suspend();client.resume();assert.equal(client.getState().hasKey,true);storage.removeItem(AI_SESSION_KEY);await client.connect();assert.equal(calls,1);assert.equal(client.getState().mode,'backend');assert.equal(client.getState().hasKey,false);assert.match(client.getState().message,/清除|無效/);client.suspend();
});
test('unexpired legacy sessions migrate once without changing keys or model; expired legacy data is not revived',()=>{
 const storage=memory();let time=10000;const old={version:1,enabled:true,provider:'openai',apiKey:key,model:'gpt-4.1',issuedAt:time,expiresAt:time+7200000};storage.setItem(AI_SESSION_KEY,JSON.stringify(old));storage.setItem('life-system.data.v1','untouched');const session=createAISession(storage,{now:()=>time});assert.deepEqual(session.read(),{...old,version:2,expiresAt:null});time+=7200001;assert.equal(session.read().apiKey,key);assert.equal(session.read().model,old.model);assert.equal(storage.getItem('life-system.data.v1'),'untouched');storage.setItem(AI_SESSION_KEY,JSON.stringify(old));assert.equal(session.read(),null);assert.equal(storage.getItem(AI_SESSION_KEY),null);
});
test('turning test mode off and switching providers abort in-flight requests without stale resurrection',async()=>{
 const storage=memory();let resolve;const client=createPageAIConnection({storage,fetcher:()=>new Promise(r=>resolve=r)});client.setBrowserMode(true);client.setProvider('openai');client.setKey(key);const work=client.connect();client.setProvider('claude');resolve(listing());await work;assert.equal(client.getState().provider,'claude');assert.equal(client.getState().hasKey,false);assert.equal(JSON.parse(storage.getItem(AI_SESSION_KEY)).apiKey,'');
 client.setKey(key);const pending=client.connect();client.setBrowserMode(false);resolve(listing());await pending;assert.equal(storage.getItem(AI_SESSION_KEY),null);assert.equal(client.getState().mode,'backend');assert.deepEqual(client.getState().models,[]);client.suspend();
});
test('cancel preserves only the same current session; session storage failure safely disables browser mode',async()=>{
 const storage=memory();let resolve;const client=createPageAIConnection({storage,fetcher:()=>new Promise(r=>resolve=r)});client.setBrowserMode(true);client.setKey(key);const work=client.connect();client.cancel();resolve(listing());await work;assert.equal(client.getState().busy,false);assert.equal(client.getState().status,'cancelled');assert.equal(client.getState().hasKey,true);client.disconnect();client.suspend();
 const failed=createPageAIConnection({storage:{getItem:()=>null,setItem:()=>{throw new Error(key);},removeItem:()=>{}},fetcher:()=>assert.fail('no request')});failed.setBrowserMode(true);assert.equal(failed.getState().configured,false);assert.ok(!failed.getState().message.includes(key));failed.suspend();
});
test('formal mode remains memory-only and browser mode bypasses missing backend/login without saving general preferences',async()=>{
 const storage=memory();let saves=0;const client=createPageAIConnection({storage,savePreference:async()=>saves++,getAccessToken:()=>assert.fail('no login in browser mode'),fetcher:async()=>listing()});client.setBrowserMode(true);client.setProvider('openai');client.setKey(key);await client.connect();client.selectModel('gpt-4.1');assert.equal(saves,0);client.suspend();
});
