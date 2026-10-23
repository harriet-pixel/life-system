import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createProviderAdapter} from '../assets/ai-providers.mjs';import {createAIConnection} from '../assets/ai-service.mjs';
const fixtures=JSON.parse(await readFile(new URL('./fixtures/provider-catalogues-20261023.json',import.meta.url))),key='test-only-invalid-credential';
const response=(value,status=200)=>new Response(JSON.stringify(value),{status});
for(const provider of ['gemini','deepseek','openai','claude']){
 test(`${provider}: current official-schema catalogue, new IDs, diagnostic counts and successful bounded generation`,async()=>{
  const calls=[];const fetcher=async(url,options)=>{calls.push({url:String(url),options});if(options.method==='GET')return response(fixtures[provider]);return response({gemini:{candidates:[{content:{parts:[{text:'OK'}]},finishReason:'STOP'}]},deepseek:{content:[{type:'thinking',thinking:'not displayed'},{type:'text',text:'OK'}],stop_reason:'end_turn'},openai:{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'OK'}]}]},claude:{content:[{type:'text',text:'OK'}],stop_reason:'end_turn'}}[provider]);};
  const adapter=createProviderAdapter(provider,key,{browser:true,fetcher});const list=await adapter.listModels();assert.ok(list.models.length>0);assert.equal(list.diagnostics.received,list.models.length+list.diagnostics.excluded.length);assert.equal(list.diagnostics.retained,list.models.length);assert.ok(!JSON.stringify(list).includes(key));
  const chosen=list.models[0];assert.deepEqual(await adapter.generate({model:chosen.id,descriptor:chosen,text:'Reply OK',maxOutputTokens:64}),{text:'OK'});
  const body=JSON.parse(calls.at(-1).options.body);
  if(provider==='deepseek'){assert.ok(calls.at(-1).url.endsWith('/anthropic/v1/messages'));assert.equal(body.model,'deepseek-flash');assert.deepEqual(body.thinking,{type:'disabled'});assert.equal(body.stream,false);assert.equal(calls.at(-1).options.headers['anthropic-version'],'2023-06-01');assert.equal(calls.at(-1).options.headers['x-api-key'],key);assert.equal(calls.at(-1).options.headers.Authorization,undefined);}
  if(provider==='gemini')assert.ok(calls.at(-1).url.endsWith('/models/gemini-3.7-flash:generateContent'));
  if(provider==='openai'){assert.equal(body.model,'gpt-6.1-sol');assert.equal(body.store,false);assert.equal(body.max_output_tokens,64);}
  if(provider==='claude')assert.equal(body.model,'claude-opus-5-5');
 });
 test(`${provider}: genuine empty catalogue differs from all-filtered, permission/query and generation failures`,async()=>{
  let listing=provider==='gemini'?{models:[]}:{data:[]},failure=0;
  const adapter=createProviderAdapter(provider,key,{fetcher:async(_,o)=>failure?response({error:{code:'permission_denied',message:key}},failure):o.method==='GET'?response(listing):response({error:{code:'model_not_found'}},404)});
  const empty=await adapter.listModels();assert.deepEqual(empty.diagnostics,{received:0,retained:0,excluded:[]});
  listing=provider==='gemini'?{models:[{name:'models/embedding-fixture',supportedGenerationMethods:['embedContent']}]}:{data:[provider==='claude'?{id:'retired',type:'model',lifecycle:'retired'}:{id:'unknown-image-fixture',output_modalities:['image']}]};
  const filtered=await adapter.listModels();assert.equal(filtered.diagnostics.received,1);assert.equal(filtered.diagnostics.retained,0);assert.ok(filtered.diagnostics.excluded[0].reason);
  failure=403;await assert.rejects(adapter.listModels(),error=>error.code==='permission'&&!error.message.includes(key));failure=0;
  await assert.rejects(adapter.generate({model:'fixture',text:'OK'}),error=>error.code==='model_unavailable');
 });
}
test('DeepSeek uses declared API/modalities for a new ID, not a model-name prefix or legacy-only allowlist',async()=>{
 const data=[{id:'future-text-fixture',input_modalities:['text'],output_modalities:['text'],api_capabilities:{anthropic_messages:{}}},{id:'future-image-fixture',output_modalities:['image'],api_capabilities:{anthropic_messages:{}}},{id:'future-unproven-fixture'},{id:'future-other-api-fixture',output_modalities:['text'],api_capabilities:{unknown:{}}}];
 const result=await createProviderAdapter('deepseek',key,{fetcher:async()=>response({data})}).listModels();assert.deepEqual(result.models.map(m=>m.id),['future-text-fixture']);assert.deepEqual(result.diagnostics.excluded.map(m=>m.reason),['non_text_output','unknown_text_capability','unsupported_api']);
});
test('minimal DeepSeek current alias uses documented Chat Completions and disables thinking; hidden reasoning never becomes output',async()=>{
 let body;const adapter=createProviderAdapter('deepseek',key,{fetcher:async(_,o)=>{body=JSON.parse(o.body);return response({choices:[{message:{reasoning_content:'private reasoning',content:'OK'},finish_reason:'stop'}]});}});
 assert.deepEqual(await adapter.generate({model:'deepseek-flash',text:'OK'}),{text:'OK'});assert.equal(body.thinking.type,'disabled');
});
test('model diagnostics never contain credentials, credential fragments, headers or raw malformed objects',async()=>{
 const result=await createProviderAdapter('deepseek',key,{fetcher:async()=>response({data:[{id:key},{id:'prefix-'+key.slice(-12)},{id:'<script>'+key,headers:{Authorization:key}},{id:'unknown-fixture',headers:{Authorization:key}}]})}).listModels();
 const serialized=JSON.stringify(result);assert.ok(!serialized.includes(key));assert.ok(!serialized.includes(key.slice(-12)));assert.ok(!serialized.includes('Authorization'));assert.equal(result.diagnostics.received,4);assert.equal(result.diagnostics.retained,0);
});
test('service exposes four separate stages and distinguishes official empty from client filtering without retaining stale diagnostics',async()=>{
 let models={models:[],diagnostics:{received:0,retained:0,excluded:[]},fetchedAt:new Date().toISOString()},fail=false;
 const service=createAIConnection({transport:async request=>{if(fail)throw {code:'permission'};return request.operation==='models'?models:{ok:true};}});
 service.setKey(key);assert.equal(service.getState().status,'key_stored');await service.connect();assert.equal(service.getState().status,'models_empty');assert.match(service.getState().message,/官方回傳空清單/);
 models={...models,diagnostics:{received:1,retained:0,excluded:[{id:'unknown',reason:'unknown_text_capability'}]}};await service.refresh();assert.equal(service.getState().status,'models_filtered');assert.match(service.getState().message,/全部過濾/);
 models={...models,models:[{id:'gpt-6.1-sol',name:'GPT',protocol:'openai-responses'}],diagnostics:{received:1,retained:1,excluded:[]}};await service.refresh();assert.equal(service.getState().status,'models_loaded');service.selectModel('gpt-6.1-sol');assert.equal(service.getState().status,'model_selected');await service.test();assert.equal(service.getState().status,'generation_succeeded');
 fail=true;await service.refresh();assert.equal(service.getState().diagnostics,null);assert.equal(service.getState().fetchedAt,null);
});
for(const provider of ['gemini','deepseek','openai','claude']){
 test(`${provider}: current-format pagination and invisible/failed generation never report success`,async()=>{
  const calls=[],first=fixtures[provider],rows=provider==='gemini'?first.models:first.data;
  const adapter=createProviderAdapter(provider,key,{fetcher:async(url,o)=>{calls.push(new URL(url));if(o.method==='POST')return response(provider==='openai'?{status:'failed',error:{code:'server_error',message:key},output:[]} : provider==='gemini'?{candidates:[{finishReason:'SAFETY',content:{parts:[]}}]}:{content:[{type:'thinking',thinking:'not user output'}]});const more=calls.length===1;return response(provider==='gemini'?{models:more?[rows[0]]:rows.slice(1),...(more?{nextPageToken:'next-fixture'}:{})}:{data:more?[rows[0]]:rows.slice(1),has_more:more,...(more?{last_id:rows[0].id}:{})});}});
  const list=await adapter.listModels();assert.equal(list.diagnostics.received,rows.length);assert.equal(calls.length,2);assert.ok(calls[1].searchParams.has(provider==='gemini'?'pageToken':provider==='claude'?'after_id':'after'));
  await assert.rejects(adapter.generate({model:list.models[0].id,descriptor:list.models[0],text:'OK'}),error=>['empty_response','provider_request'].includes(error.code)&&!error.message.includes(key));
 });
}
