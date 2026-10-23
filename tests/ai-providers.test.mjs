import test from 'node:test';import assert from 'node:assert/strict';
import {createProviderAdapter,PROVIDERS} from '../backend/providers.mjs';
import {providerError} from '../backend/errors.mjs';
const key='test-only-invalid-credential';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const fixtures={
 gemini:[{models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']},{name:'models/gemini-2.5-pro',supportedGenerationMethods:['embedContent']},{name:'models/unknown-image',supportedGenerationMethods:['generateContent']}],nextPageToken:'page-two'},{models:[{name:'models/gemini-2.5-pro',supportedGenerationMethods:['generateContent']}]}],
 claude:[{data:[{id:'claude-fixture',type:'model',display_name:'Claude fixture',lifecycle:'active'},{id:'retired-fixture',type:'model',lifecycle:'retired'},{id:'<script>',type:'model'}],has_more:true,last_id:'claude-fixture'},{data:[{id:'claude-next',type:'model'}],has_more:false}],
 openai:[{data:[{id:'gpt-4.1'},{id:'text-embedding-3-small'},{id:'gpt-4.1-unknown-image'},{id:'unknown'}],has_more:true,last_id:'gpt-4.1'},{data:[{id:'gpt-4.1-mini'}]}],
 deepseek:[{data:[{id:'deepseek-chat'},{id:'unknown-embedding'}],has_more:true,last_id:'deepseek-chat'},{data:[{id:'deepseek-reasoner'}]}],
};
for(const provider of Object.keys(PROVIDERS))test(`${provider}: official response, full pagination, capability filtering and headers`,async()=>{
 const calls=[];const queue=structuredClone(fixtures[provider]);const adapter=createProviderAdapter(provider,key,{fetcher:async(url,options)=>{calls.push({url,options});return json(queue.shift());}});
 const result=await adapter.listModels();assert.equal(result.models.length,2);assert.ok(result.fetchedAt);assert.equal(calls.length,2);assert.equal(calls[1].url.origin,PROVIDERS[provider].origin);assert.equal(calls[1].options.redirect,'error');assert.ok(!String(calls[0].url).includes(key));assert.ok(!JSON.stringify(result).includes(key));
 const params=calls[1].url.searchParams;assert.ok(params.has(provider==='gemini'?'pageToken':provider==='claude'?'after_id':'after'));
 if(provider==='gemini')assert.equal(calls[0].options.headers['x-goog-api-key'],key);else if(provider==='claude')assert.equal(calls[0].options.headers['x-api-key'],key);else assert.equal(calls[0].options.headers.Authorization,'Bearer '+key);
});
for(const provider of Object.keys(PROVIDERS))test(`${provider}: normalized minimal text generation, no private fields`,async()=>{
 const values={gemini:{candidates:[{content:{parts:[{text:'OK'}]}}]},claude:{content:[{type:'text',text:'OK'}]},openai:{output:[{type:'message',content:[{type:'output_text',text:'OK'}]}]},deepseek:{choices:[{message:{content:'OK'}}]}};
 let body,path;const adapter=createProviderAdapter(provider,key,{fetcher:async(url,options)=>{body=JSON.parse(options.body);path=url;return json(values[provider]);}});
 const model=provider==='gemini'?'models/gemini-2.5-flash':provider==='claude'?'claude-fixture':provider==='openai'?'gpt-4.1':'deepseek-chat';
 assert.deepEqual(await adapter.generate({model,text:'Reply OK.',maxOutputTokens:64}),{text:'OK'});assert.ok(!JSON.stringify(body).includes(key));assert.ok(!JSON.stringify(body).includes('profile'));assert.equal(path.origin,PROVIDERS[provider].origin);
 await assert.rejects(adapter.generate({model:'https://evil.invalid',text:'OK'}));await assert.rejects(adapter.generate({model,text:'x'.repeat(4001)}));await assert.rejects(adapter.generate({model,text:'OK',maxOutputTokens:257}));
});
test('pagination cycles, result/response limits and invalid formats fail closed without partial lists',async()=>{
 for(const value of [{models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']}],nextPageToken:'again'},{models:Array(2001).fill({})},{models:'bad'}]){
  await assert.rejects(createProviderAdapter('gemini',key,{fetcher:async()=>json(value)}).listModels());
 }
 await assert.rejects(createProviderAdapter('openai',key,{fetcher:async()=>new Response('x'.repeat(1048577))}).listModels(),e=>e.code==='response_size');
});
test('provider errors use safe codes, distinguish quota/rate/auth/model/service, never echo keys',async()=>{
 for(const[status,payload,expected]of[[429,{error:{code:'insufficient_quota'}},'quota'],[429,{},'rate_limit'],[401,{},'provider_auth'],[403,{},'permission'],[403,{error:{code:'model_access_denied'}},'model_unavailable'],[404,{},'model_unavailable'],[503,{},'provider_service'],[400,{error:{code:'model_not_found'}},'model_unavailable']]){
  assert.equal(providerError(status,payload,'generate').code,expected);
  const adapter=createProviderAdapter('openai',key,{fetcher:async()=>json({...payload,message:key},status)});
  await assert.rejects(adapter.listModels(),e=>!JSON.stringify(e).includes(key)&&!e.message.includes(key));
 }
 assert.equal(providerError(403,{},'models').code,'permission');
 const controller=new AbortController();controller.abort();await assert.rejects(createProviderAdapter('openai',key,{signal:controller.signal,fetcher:async()=>{throw new Error(key);}}).listModels(),e=>e.code==='timeout'&&!e.message.includes(key));
 await assert.rejects(createProviderAdapter('openai',key,{fetcher:async()=>{throw new Error(key);}}).listModels(),e=>e.code==='network'&&!e.message.includes(key));
});

test('Claude dangerous browser header is present only for explicitly selected browser transport',async()=>{
 for(const browser of [false,true]){
  let headers;await createProviderAdapter('claude',key,{browser,fetcher:async(_,o)=>{headers=o.headers;assert.equal(o.credentials,'omit');assert.equal(o.referrerPolicy,'no-referrer');return json({data:[]});}}).listModels();
  assert.equal(headers['anthropic-dangerous-direct-browser-access'],browser?'true':undefined);
 }
});

test('available HTTP error status is classified even when the error body is not JSON',async()=>{
 for(const[status,code]of [[403,'permission'],[429,'rate_limit'],[503,'provider_service']])await assert.rejects(createProviderAdapter('openai',key,{browser:true,fetcher:async()=>new Response('untrusted non-JSON error',{status})}).listModels(),error=>error.code===code);
});
