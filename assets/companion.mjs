/** Provider-independent coordinator; real AI must live behind a server endpoint. */
export const EMOTIONS = Object.freeze(['neutral', 'pleased', 'calm']);
const ACTION_TYPES = new Set(['task.processing', 'task.completed', 'habit.checked-in', 'task.created', 'task.updated', 'task.scheduled', 'task.deleted', 'task.deleted-completed', 'task.batch', 'task.cancelled', 'task.category']);

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
  isActionValid = () => true,
  debounceMs = 450,
  timeoutMs = 8000,
}) {
  let version = 0;
  let timer;
  let active;
  let disposed = false;
  let activeActions=[];
  const pending = new Map();

  async function flush(expectedVersion) {
    const actions = [...pending.values()].filter(isActionValid);
    pending.clear();
    if (disposed || !actions.length || expectedVersion !== version) return;
    const abortController = new AbortController();
    active = abortController;activeActions=actions;
    const request = { requestId: expectedVersion, actions, context: null };
    onStateChange('generating');
    try {
      request.context = getContext();
      const reply = validateReply(await runWithDeadline(generate, request, abortController.signal, timeoutMs));
      if (!disposed && expectedVersion === version && actions.every(isActionValid)) {
        render(reply,actions);
        onStateChange('ready');
      }
    } catch {
      if (!disposed && expectedVersion === version && actions.every(isActionValid)) {
        // Production must inject an approved character-specific fallback.
        // Until a character exists, use only a neutral development message.
        render(validateReply(fallback(request.context)),actions);
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
        type: action.type, actionId: action.actionId, label: action.label.slice(0, 200), ...(typeof action.brief==='string'?{brief:action.brief}:{}),
      });
      clearTimeout(timer);
      const expectedVersion = version;
      onStateChange('queued');
      timer = setTimeout(() => { void flush(expectedVersion); }, debounceMs);
      return true;
    },
    invalidateAction(id) {
      for(const [key,action] of pending)if(action.actionId===id)pending.delete(key);
      if(activeActions.some(action=>action.actionId===id)){version++;active?.abort();clearTimeout(timer);if(pending.size){const expected=version;timer=setTimeout(()=>{void flush(expected);},debounceMs);}}
      if(!pending.size&&(!active||activeActions.some(action=>action.actionId===id)))onStateChange('cancelled');
    },
    cancelPending() {
      if (disposed) return;
      version += 1;
      clearTimeout(timer);
      pending.clear();
      active?.abort();
      onStateChange('cancelled');
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
      ? `已收到 ${actions.length} 項操作。`
      : `已記錄：${actions[0].label}。`,
    emotion: hasTask ? 'pleased' : 'calm',
  };
}
