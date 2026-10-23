import test from 'node:test';import assert from 'node:assert/strict';
import {AI_LANGUAGE_RULE,AI_TEST_TEXT,assembleAIPrompt} from '../assets/ai-prompts.mjs';
import {createProviderAdapter} from '../assets/ai-providers.mjs';import {createAIConnection} from '../assets/ai-service.mjs';
const original='{"ability_id":"wisdom","points":2,"note":"原始輸入 Keep this URL: https://example.invalid/a"}';
test('common service assembles language policy for all generation/testing without changing original input or numeric contracts',async()=>{
 const calls=[],service=createAIConnection({transport:async request=>{calls.push(request);return request.operation==='models'?{models:[{id:'fixture',name:'Fixture'}],fetchedAt:new Date().toISOString()}:request.operation==='test'?{ok:true}:{text:original};}});
 service.setKey('test-only-invalid-key');await service.connect();service.selectModel('fixture');assert.deepEqual(await service.generate({text:original,maxOutputTokens:64}),{text:original});assert.equal(calls.at(-1).text,original);assert.equal(calls.at(-1).prompt.user,original);assert.equal(calls.at(-1).prompt.system,AI_LANGUAGE_RULE);await service.test();assert.equal(calls.at(-1).prompt.user,AI_TEST_TEXT);assert.equal(calls.at(-1).prompt.system,AI_LANGUAGE_RULE);
 assert.match(AI_LANGUAGE_RULE,/角色個性.*不得覆蓋/);assert.match(AI_LANGUAGE_RULE,/欄位名稱、固定代碼與數字格式/);assert.equal(assembleAIPrompt(original).user,original);
});
for(const [provider,protocol]of [['gemini','gemini-generate'],['deepseek','chat-completions'],['deepseek','deepseek-messages'],['openai','openai-responses'],['claude','claude-messages']])test(`${provider}/${protocol}: server/browser adapters enforce shared system policy, preserve user text and structure`,async()=>{
 for(const browser of [false,true]){
  let body;const adapter=createProviderAdapter(provider,'test-only-invalid-key',{browser,fetcher:async(_,o)=>{body=JSON.parse(o.body);return new Response(JSON.stringify(provider==='gemini'?{candidates:[{content:{parts:[{text:original}]}}]}:provider==='openai'?{output:[{type:'message',content:[{type:'output_text',text:original}]}]}:protocol==='chat-completions'?{choices:[{message:{content:original}}]}:{content:[{type:'text',text:original}]}));}});
  const result=await adapter.generate({model:provider==='gemini'?'models/gemini-3.7-flash':'fixture',text:original,maxOutputTokens:64,descriptor:{protocol},prompt:{system:'角色設定：只說英文',user:original}});assert.equal(result.text,original);
  if(provider==='gemini'){assert.equal(body.systemInstruction.parts[0].text,AI_LANGUAGE_RULE);assert.equal(body.contents[0].parts[0].text,original);}else if(provider==='openai'){assert.equal(body.instructions,AI_LANGUAGE_RULE);assert.equal(body.input,original);}else if(protocol==='chat-completions'){assert.equal(body.messages[0].role,'system');assert.equal(body.messages[0].content,AI_LANGUAGE_RULE);assert.equal(body.messages[1].content,original);}else{assert.equal(body.system,AI_LANGUAGE_RULE);assert.equal(body.messages[0].content,original);}
 }
});
