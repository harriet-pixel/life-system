// OAuth, storage and provider traffic are mocks. All credentials are fabricated.
import test from 'node:test';import assert from 'node:assert/strict';
import {createPersonalWorker} from '../backend/worker/index.mjs';import {PersonalGate} from '../backend/worker/gate.mjs';
import {digest,challenge} from '../backend/worker/security.mjs';
import {createPersonalBackend,WORKER_SESSION_KEY,validateWorkerURL} from '../assets/ai-worker-auth.mjs';
import {createPageAIConnection} from '../assets/ai-client.mjs';
const secret='test-only-invalid-worker-provider-key',clientSecret='test-only-invalid-oauth-client-secret',site='https://harriet-pixel.github.io',worker='https://personal-fixture.workers.dev';
const response=(body,status=200)=>new Response(JSON.stringify(body),{status});
function setup(){
 let time=1800000000000,chain=Promise.resolve();const values=new Map(),storage={get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v))};
 const ctx={storage,blockConcurrencyWhile(action){const current=chain.then(action);chain=current.catch(()=>{});return current;}};
 const env={SITE_URL:site+'/life-system/',WORKER_URL:worker+'/',GITHUB_CLIENT_ID:'fixture-client',GITHUB_CLIENT_SECRET:clientSecret,ALLOWED_GITHUB_ID:'123',DEEPSEEK_API_KEY:secret};
 const gate=new PersonalGate(ctx,env);gate.now=()=>time;const providerCalls=[];gate.fetcher=async(url,options)=>{providerCalls.push({url:String(url),options});return response(options.method==='GET'?{data:[{id:'deepseek-flash',input_modalities:['text'],output_modalities:['text'],api_capabilities:{anthropic_messages:{}}}]}:{content:[{type:'text',text:'mock OK'}]});};env.PERSONAL_GATE={idFromName:name=>name,get:()=>gate};
 let userId=123;const oauthCalls=[];const app=createPersonalWorker({fetcher:async(url,options)=>{oauthCalls.push({url,options});return response(url.endsWith('/user')?{id:userId}:{access_token:'test-only-invalid-github-access',token_type:'bearer'});}});
 const send=(path,body={},token,headers={})=>app.fetch(new Request(worker+path,{method:'POST',headers:{Origin:site,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...headers},body:JSON.stringify(body)}),env);
 const issue=async()=>{const result=await gate.fetch(new Request('https://internal/issue',{method:'POST',body:'{}'}));return result.json();};
 return {env,gate,app,send,issue,values,providerCalls,oauthCalls,setTime:value=>time=value,setUserId:value=>userId=value};
}
async function oauth(s){const nonce='a'.repeat(64),start=await s.app.fetch(new Request(worker+'/auth/start?nonce='+nonce),s.env),target=new URL(start.headers.get('Location')),state=target.searchParams.get('state'),cookie=start.headers.get('Set-Cookie').split(';')[0];return {start,target,state,cookie,nonce,callback:()=>s.app.fetch(new Request(worker+'/auth/callback?code=fabricated-code&state='+state,{headers:{Cookie:cookie}}),s.env)};}
test('Worker rejects missing configuration, unauthenticated callers, arbitrary destinations, origins and unexpected bodies',async()=>{
 const s=setup();assert.equal((await s.app.fetch(new Request(worker+'/v1/ai'),{})).status,503);
 assert.equal((await s.send('/v1/ai',{provider:'deepseek',operation:'models'})).status,401);
 assert.equal((await s.send('/v1/ai',{provider:'deepseek',operation:'models'},'f'.repeat(64))).status,401);
 const{token}=await s.issue();
 assert.equal((await s.send('/v1/ai',{provider:'deepseek',operation:'models'},token,{Origin:'https://evil.invalid'})).status,403);
 for(const input of [{provider:'unknown',operation:'models'},{provider:'deepseek',operation:'models',apiKey:secret},{provider:'deepseek',operation:'models',baseURL:'https://evil.invalid'}])assert.equal((await s.send('/v1/ai',input,token)).status,400);
 assert.equal(s.providerCalls.length,0);
 const preflight=await s.app.fetch(new Request(worker+'/v1/ai',{method:'OPTIONS',headers:{Origin:site}}),s.env);assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),site);assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'),null);
});
test('OAuth uses state + PKCE + secure first-party cookie; owner only, session never appears in URL or plaintext storage',async()=>{
 const s=setup(),flow=await oauth(s);assert.match(flow.start.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Lax/);assert.equal(flow.target.hostname,'github.com');assert.equal(flow.target.searchParams.get('scope'),'');assert.equal(flow.target.searchParams.get('code_challenge_method'),'S256');
 const result=await flow.callback();assert.equal(result.status,200);const html=await result.text();assert.match(html,/postMessage/);assert.match(html,/history.replaceState/);assert.ok(!html.includes(secret)&&!html.includes(clientSecret));assert.equal(result.headers.get('Location'),null);assert.match(result.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
 const payload=JSON.parse(html.match(/postMessage\((\{.*?\}),/)[1]);assert.equal(payload.nonce,flow.nonce);assert.equal(payload.token.length,64);
 const exchange=JSON.parse(s.oauthCalls[0].options.body);assert.equal(await challenge(exchange.code_verifier),flow.target.searchParams.get('code_challenge'));assert.equal(exchange.client_secret,clientSecret);
 const saved=JSON.stringify([...s.values]);assert.ok(!saved.includes(payload.token)&&!saved.includes(secret)&&!saved.includes(clientSecret));assert.ok(saved.includes(await digest(payload.token)));
 assert.equal((await flow.callback()).status,401,'state consumed once');
 const other=await oauth(s);s.setUserId(456);assert.equal((await other.callback()).status,403);
 const mismatch=await s.app.fetch(new Request(worker+'/auth/callback?code=fabricated&state='+'b'.repeat(64)),s.env);assert.equal(mismatch.status,401);
});
test('Secret-backed model query and bounded generation reuse adapters, do not return or persist secrets, and logout revokes',async()=>{
 const s=setup(),session=await s.issue();const listing=await s.send('/v1/ai',{provider:'deepseek',operation:'models'},session.token);assert.equal(listing.status,200);assert.equal((await listing.json()).models[0].id,'deepseek-flash');
 const generated=await s.send('/v1/ai',{provider:'deepseek',operation:'generate',model:'deepseek-flash',text:'Only this text',maxOutputTokens:64},session.token);assert.deepEqual(await generated.json(),{text:'mock OK'});
 assert.equal(s.providerCalls.at(-1).url,'https://api.deepseek.com/anthropic/v1/messages');assert.equal(s.providerCalls.at(-1).options.headers['x-api-key'],secret);assert.equal(JSON.parse(s.providerCalls.at(-1).options.body).max_tokens,64);
 assert.ok(!JSON.stringify([...s.values]).includes(secret));assert.equal((await s.send('/auth/logout',{},session.token)).status,200);assert.equal((await s.send('/auth/session',{},session.token)).status,401);assert.equal((await s.send('/v1/ai',{provider:'deepseek',operation:'models'},session.token)).status,401);
});
test('request/token/response limits and provider-vs-backend errors remain distinct; no retries',async()=>{
 const s=setup(),{token}=await s.issue();
 assert.equal((await s.send('/v1/ai',{provider:'deepseek',operation:'generate',model:'deepseek-flash',text:'x'.repeat(1001),maxOutputTokens:64},token)).status,400);
 assert.equal((await s.send('/v1/ai',{provider:'deepseek',operation:'generate',model:'deepseek-flash',text:'x',maxOutputTokens:257},token)).status,400);
 assert.equal((await s.send('/v1/ai',{provider:'deepseek',operation:'models',extra:'x'.repeat(7000)},token)).status,413);
 const unset=await s.send('/v1/ai',{provider:'openai',operation:'models'},token);assert.equal((await unset.json()).error.code,'provider_unconfigured');
 let count=0;s.gate.fetcher=async()=>{count++;return response({error:{code:'insufficient_quota',message:secret}},429);};const quota=await s.send('/v1/ai',{provider:'deepseek',operation:'models'},token);assert.equal((await quota.json()).error.code,'quota');assert.equal(count,1);
 s.gate.fetcher=async()=>response({data:[]});for(let i=0;i<9;i++)assert.equal((await s.send('/v1/ai',{provider:'deepseek',operation:'models'},token)).status,200);
 const limit=await s.send('/v1/ai',{provider:'deepseek',operation:'models'},token);assert.equal((await limit.json()).error.code,'backend_rate_limit');
});
test('global atomic concurrency reservations and UTC daily limits survive object recreation and session refresh',async()=>{
 const s=setup(),{token}=await s.issue();const pending=[];s.gate.fetcher=()=>new Promise(resolve=>pending.push(resolve));const first=s.send('/v1/ai',{provider:'deepseek',operation:'models'},token),second=s.send('/v1/ai',{provider:'deepseek',operation:'models'},token);while(pending.length<2)await new Promise(r=>setTimeout(r,1));
 const third=await s.send('/v1/ai',{provider:'deepseek',operation:'models'},token);assert.equal((await third.json()).error.code,'backend_busy');for(const resolve of pending)resolve(response({data:[]}));await Promise.all([first,second]);assert.deepEqual(s.values.get('gate').leases,{});
 await s.gate.change((data,now)=>{data.day={start:Math.floor(now/86400000),count:100};});assert.equal((await(await s.send('/v1/ai',{provider:'deepseek',operation:'models'},token)).json()).error.code,'backend_rate_limit');s.setTime(1800000000000+3600001);assert.equal((await s.send('/auth/session',{},token)).status,401);
});
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map};};
test('personal session restores across pages, never sends a provider key, fails expired/foreign session safely',async()=>{
 const storage=memory();let time=1800000000000;storage.setItem(WORKER_SESSION_KEY,JSON.stringify({origin:worker,token:'c'.repeat(64),issuedAt:time,expiresAt:time+3600000}));let calls=[];
 const fetcher=async(url,o)=>{calls.push({url,body:JSON.parse(o.body)});return response(JSON.parse(o.body).operation==='models'?{models:[{id:'deepseek-flash',name:'Flash'}],fetchedAt:new Date().toISOString()}:{text:'cross-page mock'});};
 const personal=createPersonalBackend({endpoint:worker+'/',storage,now:()=>time,fetcher}),client=createPageAIConnection({storage,personalBackend:personal,preference:{provider:'deepseek',model:'deepseek-flash'}});
 assert.equal(client.getState().hasKey,false);assert.equal(client.getState().backendReady,true);client.setKey(secret);assert.equal(client.getState().hasKey,false);
 assert.deepEqual(await client.generate({text:'test',maxOutputTokens:64}),{text:'cross-page mock'});assert.ok(calls.every(call=>!JSON.stringify(call).includes(secret)&&!Object.hasOwn(call.body,'apiKey')));client.suspend();
 const restored=createPageAIConnection({storage,personalBackend:createPersonalBackend({endpoint:worker+'/',storage,now:()=>time,fetcher}),preference:{provider:'deepseek',model:'deepseek-flash'}});assert.deepEqual(await restored.generate({text:'again',maxOutputTokens:64}),{text:'cross-page mock'});
 time+=3600000;assert.equal(personal.getState().authenticated,false);assert.equal(storage.getItem(WORKER_SESSION_KEY),null);restored.suspend();
 for(const url of ['http://personal.workers.dev/','https://evil.invalid/','https://personal.workers.dev/path','https://user:pass@personal.workers.dev/'])assert.throws(()=>validateWorkerURL(url));
});
test('backend failure never automatically enables direct mode or replays; explicit manual backup keeps two-hour lifecycle',async()=>{
 const storage=memory(),backend={getState:()=>({configured:true,authenticated:true}),subscribe:()=>()=>{},cancel(){},request:async()=>{throw {code:'backend_unavailable'};}};
 const client=createPageAIConnection({storage,personalBackend:backend});await client.connect();assert.equal(client.getState().mode,'backend');assert.match(client.getState().message,/手動/);assert.equal(storage.getItem('life-system.ai-test.v1'),null);
 client.setBrowserMode(true);assert.equal(client.getState().hasKey,false);client.setKey('test-only-invalid-direct-key');const value=JSON.parse(storage.getItem('life-system.ai-test.v1'));assert.equal(value.expiresAt-value.issuedAt,7200000);client.setBrowserMode(false);assert.equal(storage.getItem('life-system.ai-test.v1'),null);assert.equal(client.getState().hasKey,false);client.suspend();
});
test('popup authentication validates source/origin/nonce, checks server before storage, and cancellation defeats late verification',async()=>{
 const storage=memory(),time=1800000000000;let receive,url,resolve,count=0;
 const popup={closed:false,close(){this.closed=true;}},browser={open(value){url=value;popup.closed=false;return popup;},addEventListener(_,fn){receive=fn;},removeEventListener(_,fn){if(receive===fn)receive=null;}};
 const auth=createPersonalBackend({endpoint:worker+'/',storage,browser,now:()=>time,fetcher:async()=>{count++;return new Promise(r=>resolve=r);}});
 let task=auth.login(),nonce=new URL(url).searchParams.get('nonce'),data={type:'life-ai-login',nonce,token:'e'.repeat(64),expiresAt:time+3600000};
 receive({origin:'https://evil.invalid',source:popup,data});receive({origin:worker,source:{},data});receive({origin:worker,source:popup,data:{...data,nonce:'b'.repeat(64)}});assert.equal(count,0);assert.equal(storage.getItem(WORKER_SESSION_KEY),null);
 const received=receive({origin:worker,source:popup,data});assert.equal(count,1);assert.equal(storage.getItem(WORKER_SESSION_KEY),null);auth.cancel();resolve(response({authenticated:true,expiresAt:data.expiresAt}));await received;assert.equal(await task,false);assert.equal(storage.getItem(WORKER_SESSION_KEY),null);
 task=auth.login();nonce=new URL(url).searchParams.get('nonce');data={...data,nonce};const next=receive({origin:worker,source:popup,data});resolve(response({authenticated:true,expiresAt:data.expiresAt}));await next;assert.equal(await task,true);assert.equal(auth.getState().authenticated,true);assert.ok(storage.getItem(WORKER_SESSION_KEY).includes(data.token));auth.cancel();
});
