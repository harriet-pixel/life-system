import {AIError, fail, readJSON, providerError} from './errors.mjs';
import {compatible, MODEL_ID} from './capabilities.mjs';
export const PROVIDERS = Object.freeze({
  gemini: {origin:'https://generativelanguage.googleapis.com', models:'/v1beta/models'},
  deepseek: {origin:'https://api.deepseek.com', models:'/models'},
  openai: {origin:'https://api.openai.com', models:'/v1/models'},
  claude: {origin:'https://api.anthropic.com', models:'/v1/models'},
});
export function createProviderAdapter(provider, apiKey, {fetcher=fetch, signal}={}) {
  if (!Object.hasOwn(PROVIDERS,provider)) fail('provider');
  const config = PROVIDERS[provider];
  if (typeof apiKey !== 'string' || apiKey.length < 8 || apiKey.length > 4096 || /[^\x21-\x7e]/.test(apiKey)) fail('key_format');
  const headers = {'Content-Type':'application/json'};
  if (provider === 'gemini') headers['x-goog-api-key'] = apiKey;
  else if (provider === 'claude') { headers['x-api-key'] = apiKey; headers['anthropic-version'] = '2023-06-01'; }
  else headers.Authorization = 'Bearer ' + apiKey;
  async function request(path, query, body) {
    const url = new URL(path, config.origin);
    // All paths are built here; never accept provider URLs, redirects or arbitrary destinations.
    if (url.origin !== config.origin || url.username || url.password) fail('destination');
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
    let response;
    try { response = await fetcher(url, {method:body ? 'POST' : 'GET', headers, body:body ? JSON.stringify(body) : undefined, signal, redirect:'error'}); }
    catch { if (signal?.aborted) fail('timeout', 504); fail('network', 502); }
    let value;try{value=await readJSON(response);}catch(error){if(signal?.aborted)fail('timeout',504);throw error;}
    if (!response.ok) throw providerError(response.status, value, body ? 'generate' : 'models');
    return value;
  }
  return {
    async listModels() {
      const result = new Map(), seen = new Set(); let cursor = '', count = 0;
      for (let page = 0; page < 20; page++) {
        const query = provider === 'gemini' ? {pageSize:'100', ...(cursor ? {pageToken:cursor} : {})} : provider === 'claude' ? {limit:'100', ...(cursor ? {after_id:cursor} : {})} : cursor ? {after:cursor, limit:'100'} : {};
        const value = await request(config.models, query);
        const models = provider === 'gemini' ? value.models : value.data;
        if (!Array.isArray(models)) fail('provider_response', 502);
        count += models.length; if (count > 2000) fail('model_limit', 502);
        for (const model of models) if (model && compatible(provider, model)) {
          const id = provider === 'gemini' ? model.name : model.id;
          result.set(id, {id, name:String(model.displayName ?? model.display_name ?? id).slice(0,200)});
        }
        let next = provider === 'gemini' ? value.nextPageToken : value.has_more === true ? value.last_id ?? models.at(-1)?.id : '';
        if (!next) { if (value.has_more === true) fail('provider_response', 502); return {models:[...result.values()], fetchedAt:new Date().toISOString(), notice:'清單來自官方 API，僅列出已知文字相容模型；列舉不保證帳戶可生成，未知用途模型已排除。'}; }
        if (typeof next !== 'string' || next.length > 2048 || seen.has(next)) fail('model_limit', 502);
        seen.add(next); cursor = next;
      }
      fail('model_limit', 502); // Never return a silently truncated or stale list.
    },
    async generate({model, text, maxOutputTokens=64}) {
      if (typeof model !== 'string' || !MODEL_ID.test(model) || typeof text !== 'string' || !text.trim() || text.length > 4000 || !Number.isInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 256) fail('input');
      let value, output;
      if (provider === 'gemini') {
        value = await request(`/v1beta/${model}:generateContent`, null, {contents:[{role:'user',parts:[{text}]}], generationConfig:{maxOutputTokens}});
        output = value.candidates?.[0]?.content?.parts?.filter(p => typeof p.text === 'string' && !p.thought).map(p=>p.text).join('');
      } else if (provider === 'claude') {
        value = await request('/v1/messages', null, {model,max_tokens:maxOutputTokens,messages:[{role:'user',content:text}]});
        output = value.content?.filter(p=>p.type === 'text').map(p=>p.text).join('');
      } else if (provider === 'openai') {
        value = await request('/v1/responses', null, {model,input:text,max_output_tokens:maxOutputTokens,store:false});
        output = value.output?.filter(p=>p.type === 'message').flatMap(p=>p.content ?? []).filter(p=>p.type === 'output_text').map(p=>p.text).join('');
      } else {
        value = await request('/chat/completions', null, {model,max_tokens:maxOutputTokens,messages:[{role:'user',content:text}],stream:false});
        output = value.choices?.[0]?.message?.content;
      }
      if (typeof output !== 'string' || !output.trim()) throw new AIError('empty_response', 502);
      return {text:output.slice(0,16000)};
    },
  };
}
