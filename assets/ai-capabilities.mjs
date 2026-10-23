// Compatibility evidence, never an available-model list. Intersect with official
// authenticated /models results. Sources/revisions: docs/AI_PROVIDER_AUDIT.md.
export const CAPABILITIES=Object.freeze({
 gemini:new Set(['models/gemini-2.0-flash','models/gemini-2.0-flash-lite','models/gemini-2.5-flash','models/gemini-2.5-flash-lite','models/gemini-2.5-pro','models/gemini-flash-latest','models/gemini-flash-lite-latest','models/gemini-pro-latest','models/gemini-3-flash-preview','models/gemini-3.1-pro-preview','models/gemini-3.1-flash-lite-preview','models/gemini-3.1-flash-lite','models/gemini-3.5-flash','models/gemini-3.5-flash-lite','models/gemini-3.6-flash','models/gemini-3.7-flash','models/gemini-3.8-flash','models/gemma-4-26b-a4b-it','models/gemma-4-31b-it']),
 deepseek:new Set(['deepseek-chat','deepseek-reasoner','deepseek-flash','deepseek-v4-flash','deepseek-v4-pro']),
 openai:new Set(['gpt-6-astra','gpt-6.1-sol','gpt-6-sol','gpt-6-luna','gpt-5.6-sol','gpt-5.6-terra','gpt-5.6-luna','gpt-5.5','gpt-5.5-2026-04-23','gpt-5.5-pro','gpt-5.5-pro-2026-04-23','gpt-5.4','gpt-5.4-mini','gpt-5.4-mini-2026-03-17','gpt-5.4-nano','gpt-5.4-nano-2026-03-17','gpt-5.2','gpt-5.2-2025-12-11','gpt-5.2-pro','gpt-5.2-pro-2025-12-11','gpt-5.1','gpt-5.1-2025-11-13','gpt-5','gpt-5-mini','gpt-5-nano','gpt-5-2025-08-07','gpt-5-mini-2025-08-07','gpt-5-nano-2025-08-07','gpt-4.1','gpt-4.1-mini','gpt-4.1-nano','gpt-4.1-2025-04-14','gpt-4.1-mini-2025-04-14','gpt-4.1-nano-2025-04-14','gpt-4o','gpt-4o-2024-11-20','gpt-4o-2024-08-06','gpt-4o-mini','gpt-4o-mini-2024-07-18','o3','o3-2025-04-16','o4-mini','o4-mini-2025-04-16']),
});
export const MODEL_ID=/^(?:models\/)?[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
export const MODEL_REASONS=Object.freeze({invalid_id:'無有效的模型 ID',sensitive_id:'識別資訊含敏感內容，已隱藏',duplicate:'重複模型 ID',retired:'官方已標示退役或停用',non_text_input:'不支援本站文字輸入',non_text_output:'不提供文字輸出',unsupported_api:'未宣告本站已支援的生成 API',unknown_text_capability:'缺少可確認的文字能力資訊，尚無已核對的相容規則',invalid_limit:'官方輸出上限格式無效',unavailable:'本次生成已明確回報模型不可用'});
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
export function assessModel(provider,model){
 const id=provider==='gemini'?model?.name:model?.id;
 const no=reason=>({compatible:false,reason});
 if(typeof id!=='string'||!MODEL_ID.test(id))return no('invalid_id');
 if(model.lifecycle==='retired'||model.lifecycle==='disabled'||model.shutdown_date&&Date.parse(model.shutdown_date)<=Date.now())return no('retired');
 if(model.input_modalities!==undefined&&(!Array.isArray(model.input_modalities)||!model.input_modalities.includes('text')))return no('non_text_input');
 if(model.output_modalities!==undefined&&(!Array.isArray(model.output_modalities)||!model.output_modalities.includes('text')))return no('non_text_output');
 const limit=model.max_output_tokens??model.max_tokens??model.outputTokenLimit;
 if(limit!==undefined&&limit!==null&&(!Number.isSafeInteger(limit)||limit<=0))return no('invalid_limit');
 let protocol;
 if(provider==='deepseek'){
  if(model.api_capabilities!==undefined){
   if(!object(model.api_capabilities)||!object(model.api_capabilities.anthropic_messages))return no('unsupported_api');
   protocol='deepseek-messages'; // Official current listing declares this API, not a model-name guess.
  }else if(CAPABILITIES.deepseek.has(id))protocol='chat-completions';
  else return no('unknown_text_capability');
 }else if(provider==='gemini'){
  const actions=model.supportedGenerationMethods??model.supportedActions;
  if(!Array.isArray(actions)||!actions.includes('generateContent'))return no('unsupported_api');
  if(!CAPABILITIES.gemini.has(id)&&!(/\b(?:text generation|text output|conversational|chat)\b/i.test(model.description??'')))return no('unknown_text_capability');
  protocol='gemini-generate';
 }else if(provider==='openai'){
  if(!CAPABILITIES.openai.has(id))return no('unknown_text_capability');
  protocol='openai-responses';
 }else if(provider==='claude'){
  if(model.type!=='model')return no('unsupported_api');
  protocol='claude-messages'; // /v1/models is the official Messages catalogue; deprecated can still be callable.
 }else return no('unsupported_api');
 return {compatible:true,protocol,...(limit?{outputLimit:limit}:{})};
}
export const compatible=(provider,model)=>assessModel(provider,model).compatible;
