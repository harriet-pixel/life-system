// One shared reversible operation per document. Persistence adapters must perform
// their real write inside undo(), rejecting on conflicts or failed requests.
export function createUndoManager() {
  let latest = null;
  let busy = false;
  const subscribers = new Set();
  const state = () => ({ available: Boolean(latest) && !busy, busy, label: latest?.label ?? null });
  const notify = () => subscribers.forEach((listener) => listener(state()));
  return {
    getState: state,
    subscribe(listener) { subscribers.add(listener); listener(state()); return () => subscribers.delete(listener); },
    record(operation) {
      if (busy) throw new Error('撤銷處理中，請稍候再操作。');
      if (!operation?.id || !operation.type || !operation.target || typeof operation.undo !== 'function') {
        throw new TypeError('A reversible operation requires id, type, target and undo');
      }
      latest = Object.freeze({ ...operation });
      notify();
    },
    async undo() {
      if (busy || !latest) return { ok: false, reason: 'unavailable' };
      const operation = latest;
      busy = true;
      notify();
      try {
        if (await operation.undo(operation) === false) throw new Error('資料未能還原，請重試。');
        latest = null;
        return { ok: true, label: operation.label };
      } catch (error) {
        // Keep the record available for retry; never clear on failure.
        return { ok: false, reason: 'failed', error };
      } finally {
        busy = false;
        notify();
      }
    },
  };
}

export const undoManager = createUndoManager();

// The current source of truth is an in-memory store, not checkbox DOM state.
// Revision checks refuse to overwrite a record changed by another operation.
export function createActivityStore(initial) {
  const records = new Map(initial.map(({ id, checked }) => [id, { checked, revision: 0 }]));
  const get = (id) => {
    if (!records.has(id)) throw new Error('找不到操作資料。');
    return { ...records.get(id) };
  };
  return {
    get,
    set(id, checked) {
      if (typeof checked !== 'boolean') throw new TypeError('checked must be boolean');
      const before = get(id);
      if (before.checked === checked) return null;
      const after = { checked, revision: before.revision + 1 };
      records.set(id, after);
      return { id, before, after: { ...after } };
    },
    restore({ id, before, after }) {
      const current = get(id);
      if (current.revision !== after.revision || current.checked !== after.checked) {
        throw new Error('資料已被其他操作改動，無法安全撤銷。');
      }
      records.set(id, { checked: before.checked, revision: current.revision + 1 });
    },
  };
}
