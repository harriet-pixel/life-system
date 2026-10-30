import {assembleAIPrompt,AI_LANGUAGE_RULE} from './ai-prompts.mjs?v=restore-images-20261031';
import {AIError, fail, readJSON, providerError} from './ai-errors.mjs?v=restore-images-20261031';
import {assessModel, MODEL_ID} from './ai-capabilities.mjs?v=restore-images-20261031';
export const PROVIDERS = Object.freeze({
  gemini: {origin:'https://generativelanguage.googleapis.com', models:'/v1beta/models'},
  deepseek: {origin:'https://api.deepseek.com', models:'/models'},
  openai: {origin:'https://api.openai.com', models:'/v1/models'},
  claude: {origin:'https://api.anthropic.com', models:'/v1/models'},
});
export function createProviderAdapter(provider, apiKey, {fetcher=fetch, signal, browser=false}={}) {
  if (!Object.hasOwn(PROVIDERS,provider)) fail('provider');
  const config = PROVIDERS[provider];
  if (typeof apiKey !== 'string' || apiKey.length < 8 || apiKey.length > 4096 || /[^\x21-\x7e]/.test(apiKey)) fail('key_format');
  const headers = {'Content-Type':'application/json'};
  if (provider === 'gemini') headers['x-goog-api-key'] = apiKey;
  else if (provider === 'claude') { headers['x-api-key'] = apiKey; headers['anthropic-version'] = '2023-06-01'; }
  else headers.Authorization = 'Bearer ' + apiKey;
  if(provider==='deepseek')headers['anthropic-version']='2023-06-01';
  if (browser && provider === 'claude') headers['anthropic-dangerous-direct-browser-access'] = 'true';
  async function request(path, query, body) {
    const url = new URL(path, config.origin);
    // All paths are built here; never accept provider URLs, redirects or arbitrary destinations.
    if (url.origin !== config.origin || url.username || url.password) fail('destination');
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
    let response;
    const requestHeaders={...headers};
    if(provider==='deepseek'){if(path.startsWith('/anthropic/')){delete requestHeaders.Authorization;requestHeaders['x-api-key']=apiKey;}else delete requestHeaders['anthropic-version'];}
    try { response = await fetcher(url, {method:body ? 'POST' : 'GET', headers:requestHeaders, body:body ? JSON.stringify(body) : undefined, signal, redirect:'error', credentials:'omit', referrerPolicy:'no-referrer'}); }
    catch { if (signal?.aborted) fail('timeout', 504); fail('network', 502); }
    let value;try{value=await readJSON(response);}catch(error){if(signal?.aborted)fail('timeout',504);if(!response.ok)throw providerError(response.status,null,body?'generate':'models');throw error;}
    if (!response.ok) throw providerError(response.status, value, body ? 'generate' : 'models');
    return value;
  }
  return {
    async listModels() {
      const result = new Map(), seen = new Set(), excluded=[]; let cursor = '', count = 0;
      const privateValue=value=>typeof value==='string'&&Array.from({length:Math.max(0,apiKey.length-7)},(_,i)=>apiKey.slice(i,i+8)).some(part=>value.includes(part));
      for (let page = 0; page < 20; page++) {
        const query = provider === 'gemini' ? {pageSize:'100', ...(cursor ? {pageToken:cursor} : {})} : provider === 'claude' ? {limit:'100', ...(cursor ? {after_id:cursor} : {})} : cursor ? {after:cursor, limit:'100'} : {};
        const value = await request(config.models, query);
        const models = provider === 'gemini' ? value.models : value.data;
        if (!Array.isArray(models)) fail('provider_response', 502);
        count += models.length; if (count > 2000) fail('model_limit', 502);
        for(const model of models){
          const id=provider==='gemini'?model?.name:model?.id, assessment=assessModel(provider,model);
          if(privateValue(id)){excluded.push({id:'（已隱藏）',reason:'sensitive_id'});continue;}
          if(!assessment.compatible){excluded.push({id:typeof id==='string'&&MODEL_ID.test(id)?id:'（無有效 ID）',reason:assessment.reason});continue;}
          if(result.has(id)){excluded.push({id,reason:'duplicate'});continue;}
          const rawName=model.displayName??model.display_name??model.name??id;
          result.set(id,{id,name:privateValue(rawName)?id:String(rawName).slice(0,200),protocol:assessment.protocol,...(assessment.outputLimit?{outputLimit:assessment.outputLimit}:{})});
        }
        let next = provider === 'gemini' ? value.nextPageToken : value.has_more === true ? value.last_id ?? models.at(-1)?.id : '';
        if (!next) { if (value.has_more === true) fail('provider_response', 502); return {models:[...result.values()], diagnostics:{received:count,retained:result.size,excluded}, fetchedAt:new Date().toISOString(), notice:'清單來自官方 API，僅列出已知文字相容模型；列舉不保證帳戶可生成，未知用途模型已排除。'}; }
        if (typeof next !== 'string' || next.length > 2048 || seen.has(next)) fail('model_limit', 502);
        seen.add(next); cursor = next;
      }
      fail('model_limit', 502); // Never return a silently truncated or stale list.
    },
    async generate({model, text, maxOutputTokens=64, descriptor, prompt:providedPrompt,purpose}={}) {
      if (typeof model !== 'string' || !MODEL_ID.test(model) || typeof text !== 'string' || !text.trim() || text.length > 4000 || !Number.isInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > (['reply-library','greetings'].includes(purpose)?1024:256)) fail('input');
      const prompt=providedPrompt?.system===AI_LANGUAGE_RULE&&providedPrompt.user===text?providedPrompt:assembleAIPrompt(text);
      const protocol=descriptor?.protocol;
      if(descriptor?.outputLimit)maxOutputTokens=Math.min(maxOutputTokens,descriptor.outputLimit);
      let value, output;
      if (provider === 'gemini') {
        value = await request(`/v1beta/${model}:generateContent`, null, {systemInstruction:{parts:[{text:prompt.system}]},contents:[{role:'user',parts:[{text:prompt.user}]}], generationConfig:{maxOutputTokens}});
        output = value.candidates?.[0]?.content?.parts?.filter(p => typeof p.text === 'string' && !p.thought).map(p=>p.text).join('');
      } else if (provider === 'claude' || provider==='deepseek'&&protocol==='deepseek-messages') {
        value = await request(provider==='deepseek'?'/anthropic/v1/messages':'/v1/messages', null, {model,system:prompt.system,max_tokens:maxOutputTokens,messages:[{role:'user',content:prompt.user}],...(provider==='deepseek'?{thinking:{type:'disabled'},stream:false}:{})});
        output = value.content?.filter(p=>p.type === 'text').map(p=>p.text).join('');
      } else if (provider === 'openai') {
        value = await request('/v1/responses', null, {model,instructions:prompt.system,input:prompt.user,max_output_tokens:maxOutputTokens,store:false});
        if(value.status==='failed'||value.error)throw providerError(400,value,'generate');
        output = value.output?.filter(p=>p.type === 'message').flatMap(p=>p.content ?? []).filter(p=>p.type === 'output_text').map(p=>p.text).join('');
      } else {
        value = await request('/chat/completions', null, {model,max_tokens:maxOutputTokens,messages:[{role:'system',content:prompt.system},{role:'user',content:prompt.user}],stream:false,...(['deepseek-flash','deepseek-v4-flash','deepseek-v4-pro'].includes(model)?{thinking:{type:'disabled'}}:{})});
        output = value.choices?.[0]?.message?.content;
      }
      if (typeof output !== 'string' || !output.trim()) throw new AIError('empty_response', 502);
      return {text:output.slice(0,16000)};
    },
  };
}
