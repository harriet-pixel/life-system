// A single atomic localStorage document owns data and its reversible journal.
export const STORAGE_KEY = 'life-system.data.v1';
const copy = value => structuredClone(value);
const initial = () => ({ revision: 0, profile: { name: '', age: '', gender: '', bio: '', boundaries: '' }, photo: null, activities: {}, stats: { experience: null, level: null, currency: null, abilities: [] }, history: [] });
export function createDataStore(storage) {
  let state;
  const listeners = new Set();
  const load = () => {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return initial();
    const value = JSON.parse(raw);
    if (!value || !Array.isArray(value.history) || !value.profile || !value.stats || !value.activities || !Number.isInteger(value.revision)) throw new Error('儲存資料無法讀取；已保留原資料，請勿清除瀏覽器儲存。');
    return value;
  };
  state = load();
  const notify = () => listeners.forEach(fn => fn(copy(state)));
  const persist = next => {
    const current = load();
    if (current.revision !== state.revision) { state = current; notify(); throw new Error('資料已在其他頁面更新，請重試。'); }
    next.revision = state.revision + 1;
    try { storage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { throw new Error('無法儲存，可能是瀏覽器儲存空間不足或儲存權限受限。資料尚未變更。'); }
    state = next; notify();
  };
  const api = {
    get: () => copy(state),
    subscribe(fn) { listeners.add(fn); fn(copy(state)); return () => listeners.delete(fn); },
    refresh() { state = load(); notify(); },
    transact({ type, label, target, changes, fields = [] }) {
      const next = copy(state), before = {}, after = {};
      for (const [key, value] of Object.entries(changes)) {
        if (!['profile', 'photo', 'activities', 'stats'].includes(key)) throw new Error('不支援的資料類型');
        if (JSON.stringify(state[key]) === JSON.stringify(value)) continue;
        before[key] = copy(state[key]); after[key] = copy(value); next[key] = copy(value);
      }
      if (!Object.keys(after).length) return false;
      const delta = {};
      for (const key of ['experience', 'level', 'currency']) delta[key] = typeof next.stats[key] === 'number' && typeof state.stats[key] === 'number' ? next.stats[key] - state.stats[key] : 0;
      delta.abilities = next.stats.abilities.map((a, i) => ({ id: a.id, value: a.value - (state.stats.abilities[i]?.value ?? 0) }));
      next.history.push({ id: crypto.randomUUID(), time: new Date().toISOString(), type, label, target, fields, before, after, delta, undone: false, undoneAt: null });
      persist(next); return true;
    },
    getState() { const record = [...state.history].reverse().find(x => !x.undone); return { available: Boolean(record), busy: false, label: record?.label ?? null }; },
    async undo() {
      const next = copy(state), record = [...next.history].reverse().find(x => !x.undone);
      if (!record) return { ok: false, reason: 'unavailable' };
      try {
        for (const key of Object.keys(record.after)) {
          if (JSON.stringify(state[key]) !== JSON.stringify(record.after[key])) throw new Error('資料已改變，無法安全撤銷。');
          next[key] = copy(record.before[key]);
        }
        record.undone = true; record.undoneAt = new Date().toISOString();
        persist(next); return { ok: true, label: record.label };
      } catch (error) { return { ok: false, reason: 'failed', error }; }
    },
  };
  return api;
}
export function formatSI(value) {
  if (value == null) return '—';
  if (Math.abs(value) < 1000) return String(value);
  const units = ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y', 'R', 'Q'];
  let n = Math.abs(value), i = 0;
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
  n = Math.round(n * 10) / 10;
  if (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
  return `${value < 0 ? '-' : ''}${n}${units[i]}`;
}
export function validateProfile(value) {
  const result = Object.fromEntries(['name', 'age', 'gender', 'bio', 'boundaries'].map(key => [key, String(value[key] ?? '').trim()]));
  if (result.age && (!/^\d+$/.test(result.age) || !Number.isSafeInteger(Number(result.age)))) throw new Error('年紀請填寫有效的非負整數，或留白。');
  if (result.age) result.age = String(Number(result.age));
  return result;
}
export function abilityRatios(abilities) {
  const max = Math.max(0, ...abilities.map(a => a.value));
  return abilities.map(a => max > 0 ? a.value / max : 0);
}
function openBrowserStore() {
  try { return createDataStore(window.localStorage); }
  catch (error) {
    const status = document.querySelector('#operation-status');
    if (status) { status.hidden = false; status.textContent = `無法讀取本機儲存，請確認瀏覽器允許儲存資料。${error.message}`; }
    document.querySelectorAll('input, button').forEach(control => { control.disabled = true; });
    throw error;
  }
}
export const dataStore = typeof window !== 'undefined' ? openBrowserStore() : null;
export const persistentUndo = dataStore && { getState: () => dataStore.getState(), undo: () => dataStore.undo(), subscribe: fn => dataStore.subscribe(() => fn(dataStore.getState())) };
if (typeof window !== 'undefined') window.addEventListener('storage', e => { if (e.key === STORAGE_KEY || e.key === null) dataStore.refresh(); });
