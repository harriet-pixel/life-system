// Compatibility rules, NOT an available-model list. Always intersect with the
// authenticated official listing. Unknown capabilities fail closed.
// Sources and update limitations: AI_CONNECTION.md. No prefix matching.
export const CAPABILITIES = Object.freeze({
  gemini: new Set(['models/gemini-2.0-flash','models/gemini-2.0-flash-lite','models/gemini-2.5-flash','models/gemini-2.5-flash-lite','models/gemini-2.5-pro']),
  deepseek: new Set(['deepseek-chat','deepseek-reasoner']),
  openai: new Set(['gpt-4.1','gpt-4.1-mini','gpt-4.1-nano','gpt-4o','gpt-4o-mini','gpt-5','gpt-5-mini','gpt-5-nano','o3','o4-mini']),
});
export const MODEL_ID = /^(?:models\/)?[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
export function compatible(provider, model) {
  const id = provider === 'gemini' ? model.name : model.id;
  if (typeof id !== 'string' || !MODEL_ID.test(id)) return false;
  if (model.lifecycle && model.lifecycle !== 'active') return false;
  if (model.shutdown_date && Date.parse(model.shutdown_date) <= Date.now()) return false;
  if (provider === 'claude') return model.type === 'model'; // Official /v1/models is the Messages model catalogue.
  if (!CAPABILITIES[provider]?.has(id)) return false;
  return provider !== 'gemini' || (model.supportedGenerationMethods ?? model.supportedActions ?? []).includes('generateContent');
}
