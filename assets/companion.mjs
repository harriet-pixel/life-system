/** Provider-independent coordinator; real AI must live behind a server endpoint. */
export const EMOTIONS = Object.freeze(['neutral', 'pleased', 'calm']);
const ACTION_TYPES = new Set(['task.completed', 'habit.checked-in']);

export function validateReply(reply) {
  if (!reply || typeof reply.dialogue !== 'string' || !reply.dialogue.trim()
      || reply.dialogue.length > 1000 || !EMOTIONS.includes(reply.emotion)) {
    throw new TypeError('Expected one valid { dialogue, emotion } pair');
  }
  return { dialogue: reply.dialogue.trim(), emotion: reply.emotion };
}

async function runWithDeadline(generate, request, signal, timeoutMs) {
  let timer;
  let abort;
  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        if (signal.aborted) throw new Error('Request cancelled');
        return generate(request, { signal });
      }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Generation timed out')), timeoutMs);
        abort = () => reject(new Error('Request cancelled'));
        if (signal.aborted) abort();
        else signal.addEventListener('abort', abort, { once: true });
      }),
    ]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

export function createCompanionController({
  generate,
  render,
  getContext = () => ({ character: null, affinity: null }),
  fallback = () => ({ dialogue: '回應暫時無法產生；原本的示意操作已完成。', emotion: 'neutral' }),
  onStateChange = () => {},
  debounceMs = 450,
  timeoutMs = 8000,
}) {
  let version = 0;
  let timer;
  let active;
  let disposed = false;
  const pending = new Map();

  async function flush(expectedVersion) {
    const actions = [...pending.values()];
    pending.clear();
    if (disposed || !actions.length || expectedVersion !== version) return;
    const abortController = new AbortController();
    active = abortController;
    const request = { requestId: expectedVersion, actions, context: null };
    onStateChange('generating');
    try {
      request.context = getContext();
      const reply = validateReply(await runWithDeadline(generate, request, abortController.signal, timeoutMs));
      if (!disposed && expectedVersion === version) {
        render(reply);
        onStateChange('ready');
      }
    } catch {
      if (!disposed && expectedVersion === version) {
        // Production must inject an approved character-specific fallback.
        // Until a character exists, use only a neutral development message.
        render(validateReply(fallback(request.context)));
        onStateChange('fallback');
      }
    } finally {
      abortController.abort();
      if (active === abortController) active = undefined;
    }
  }

  return {
    recordSuccess(action) {
      if (disposed || !action || !ACTION_TYPES.has(action.type)
          || typeof action.actionId !== 'string' || !action.actionId.trim()
          || typeof action.label !== 'string' || !action.label.trim()) return false;
      // Invalidate on receipt, before debounce, so an old reply cannot win.
      version += 1;
      active?.abort();
      pending.set(`${action.type}:${action.actionId}`, {
        type: action.type, actionId: action.actionId, label: action.label.slice(0, 200),
      });
      clearTimeout(timer);
      const expectedVersion = version;
      onStateChange('queued');
      timer = setTimeout(() => { void flush(expectedVersion); }, debounceMs);
      return true;
    },
    dispose() {
      disposed = true;
      version += 1;
      clearTimeout(timer);
      pending.clear();
      active?.abort();
    },
  };
}

/** Local demonstration only: no invented persona or affinity calculations. */
export async function generateMockReply({ actions }, { signal }) {
  await new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new Error('Cancelled')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 550);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
  const hasTask = actions.some((action) => action.type === 'task.completed');
  return {
    dialogue: actions.length > 1
      ? `已收到 ${actions.length} 項示意完成操作。這是合併事件後的模擬回應，尚未使用角色或好感度資料。`
      : `已收到「${actions[0].label}」的示意完成事件。這是模擬回應，尚未使用角色或好感度資料。`,
    emotion: hasTask ? 'pleased' : 'calm',
  };
}
