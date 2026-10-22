import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';import {generateKeyPairSync,sign} from 'node:crypto';
import {createAIHandler,startServer} from '../backend/server.mjs';import {createJWTVerifier} from '../backend/auth.mjs';
const key='test-only-invalid-credential',origin='https://site.example.invalid';
async function server(options,work){const server=createServer(createAIHandler({origins:[origin],trustedProxyIPs:['127.0.0.1'],...options}));await new Promise(r=>server.listen(0,'127.0.0.1',r));try{await work(`http://127.0.0.1:${server.address().port}/v1/ai`);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}}
const options=body=>({method:'POST',headers:{Origin:origin,'X-Forwarded-Proto':'https','Content-Type':'application/json',Authorization:'Bearer test-only-login-token'},body:JSON.stringify(body)});
const body={provider:'openai',apiKey:key,operation:'models'};
test('unconfigured backend refuses startup; CORS never substitutes for authentication and HTTPS',async()=>{
 assert.throws(()=>startServer({}));
 await server({authenticate:async()=>{throw new Error(key);},fetcher:()=>assert.fail('upstream must not run')},async url=>{
  const r=await fetch(url,options(body));assert.equal(r.status,500);assert.ok(!(await r.text()).includes(key));
  const insecure=options(body);delete insecure.headers['X-Forwarded-Proto'];assert.equal((await fetch(url,insecure)).status,400);
  const foreign=options(body);foreign.headers.Origin='https://evil.invalid';assert.equal((await fetch(url,foreign)).status,403);
 });
 const authenticate=createJWTVerifier({issuer:'https://issuer.example.invalid/',audience:'life-ai',jwksURL:'https://issuer.example.invalid/keys'});
 await server({authenticate,fetcher:()=>assert.fail('upstream must not run')},async url=>{const o=options(body);delete o.headers.Authorization;assert.equal((await fetch(url,o)).status,401);});
});
test('valid signed issuer, audience, expiry and scope required, token-selected JWKS rejected',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});const jwk={...publicKey.export({format:'jwk'}),kid:'fixture',alg:'RS256',use:'sig'};const epoch=Math.floor(Date.now()/1000);
 const verifier=createJWTVerifier({issuer:'https://issuer.example.invalid/',audience:'life-ai',jwksURL:'https://issuer.example.invalid/keys',fetcher:async()=>new Response(JSON.stringify({keys:[jwk]}))});
 const token=(change={},header={})=>{const h=Buffer.from(JSON.stringify({alg:'RS256',kid:'fixture',...header})).toString('base64url'),p=Buffer.from(JSON.stringify({iss:'https://issuer.example.invalid/',aud:'life-ai',sub:'user-one',iat:epoch,exp:epoch+300,scope:'life:ai',...change})).toString('base64url');return 'Bearer '+h+'.'+p+'.'+sign('RSA-SHA256',Buffer.from(h+'.'+p),privateKey).toString('base64url');};
 assert.equal(await verifier(token()),'https://issuer.example.invalid/|user-one');
 for(const change of [{iss:'https://evil.invalid'},{aud:'other'},{exp:epoch-1},{nbf:epoch+20},{scope:'other'},{iat:epoch-7200}])await assert.rejects(verifier(token(change)));
 await assert.rejects(verifier(token({}, {alg:'HS256'})));await assert.rejects(verifier(token({}, {jku:'https://evil.invalid'})));
});
test('fixed destinations, payload allowlist, per-identity rate and response bounds; no retries or leaked provider errors',async()=>{
 const calls=[];await server({authenticate:async()=> 'user-one',rateLimit:4,fetcher:async(url,opts)=>{calls.push({url:String(url),opts});return new Response(JSON.stringify({data:[{id:'gpt-4.1'}]}));}},async url=>{
  const valid=await fetch(url,options(body));assert.equal(valid.status,200);assert.equal(valid.headers.get('cache-control'),'no-store, private');assert.ok(!(await valid.text()).includes(key));
  assert.equal((await fetch(url,options({...body,baseURL:'https://evil.invalid'}))).status,400);
  assert.equal((await fetch(url,options({...body,provider:'unknown'}))).status,400);
  assert.equal((await fetch(url,options({...body,apiKey:'x'.repeat(13000)}))).status,413);
  assert.equal((await fetch(url,options(body))).status,429);
  assert.equal(calls.length,1);assert.equal(new URL(calls[0].url).origin,'https://api.openai.com');
 });
});
test('concurrent requests are bounded and client/timeout cancellation reaches upstream',async()=>{
 let resolve,started;const begin=new Promise(r=>started=r);
 await server({authenticate:async()=> 'user-one',concurrency:1,timeoutMs:100,fetcher:async(_,o)=>{started();return new Promise((r,reject)=>{resolve=()=>r(new Response('{"data":[]}'));o.signal.addEventListener('abort',()=>reject(new Error(key)));});}},async url=>{
  const first=fetch(url,options(body));await begin;assert.equal((await fetch(url,options(body))).status,429);const response=await first;assert.equal(response.status,504);assert.ok(!(await response.text()).includes(key));resolve();
 });
});
test('test request uses only fixed harmless text, never persists or returns credentials',async()=>{
 const outgoing=[];await server({authenticate:async()=> 'user-one',fetcher:async(url,o)=>{outgoing.push(o.body&&JSON.parse(o.body));return new Response(JSON.stringify(o.method==='GET'?{data:[{id:'gpt-4.1'}]}:{output:[{type:'message',content:[{type:'output_text',text:'OK'}]}]}));}},async url=>{
  const response=await fetch(url,options({...body,operation:'test',model:'gpt-4.1'}));assert.deepEqual(await response.json(),{ok:true});assert.equal(outgoing[1].input,'Reply only with OK.');assert.equal(outgoing[1].max_output_tokens,64);assert.equal(outgoing[1].store,false);
 });
});
