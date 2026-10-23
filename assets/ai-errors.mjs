export class AIError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
export const fail = (code, status) => { throw new AIError(code, status); };
export function providerError(status, value, operation) {
  // Inspect only machine codes; never forward provider messages, headers or payloads.
  const code = String(value?.error?.code ?? value?.error?.type ?? '');
  if (/insufficient_quota|quota_exceeded|billing|credit|balance/i.test(code) || status === 402) return new AIError('quota', 429);
  if (status === 429) return new AIError('rate_limit', 429);
  if (status === 401) return new AIError('provider_auth', 401);
  if (status === 403) return new AIError(operation !== 'models' && /model.*(?:access|permission|denied)|(?:access|permission).*model/i.test(code) ? 'model_unavailable' : 'permission', 403);
  if (status === 404 || /model_not_found|model_not_available|model_deprecated/i.test(code)) return new AIError('model_unavailable', 404);
  if (status >= 500) return new AIError('provider_service', 502);
  return new AIError('provider_request', 400);
}
export async function readJSON(response, maximum = 1024 * 1024) {
  if (Number(response.headers.get('content-length')) > maximum) fail('response_size', 502);
  const chunks = []; let length = 0;
  const reader = response.body?.getReader();
  if (!reader) fail('provider_response', 502);
  try {
    while (true) { const {value, done} = await reader.read(); if (done) break; length += value.length; if (length > maximum) fail('response_size', 502); chunks.push(value); }
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) { await reader.cancel().catch(() => {}); if (error instanceof AIError) throw error; fail('provider_response', 502); }
  finally { reader.releaseLock(); }
}
