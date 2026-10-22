import { migrateImages, collectUnusedImages } from './image-store.mjs?v=images-21';
import { normalizeStats, validateStats, createInitialStats, visibleExperience } from './abilities.mjs?v=exp-base-31';
// A single atomic localStorage document owns data and its reversible journal.
export const HISTORY_LIMIT = 50;
export const STATS_RULES_VERSION = 2;
export { visibleExperience };
const retainedHistory = history => [...history].sort((a,b) => Date.parse(a.time) - Date.parse(b.time)).slice(-HISTORY_LIMIT);
export const STORAGE_KEY = 'life-system.data.v1';
const copy = value => structuredClone(value);
const undoRecord = history => [...history].reverse().find(record => !record.undone);
const redoRecord = history => history.filter(record => record.undone && record.redoable === true && Number.isSafeInteger(record.undoOrder)).sort((a,b) => b.undoOrder-a.undoOrder)[0];
const initial = () => ({ revision: 0, statsRulesVersion: STATS_RULES_VERSION, profile: { name: '', age: '', gender: '', bio: '', boundaries: '', motto: '' }, photo: null, avatar: null, photoEdit: null, avatarEdit: null, portraits: [], currentPortraitId: null, activities: {}, stats: createInitialStats(), history: [] });
export function createDataStore(storage) {
  let state;
  const listeners = new Set();
  const load = () => {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return initial();
    const value = JSON.parse(raw);
    if (!value || !Array.isArray(value.history) || !value.profile || !value.stats || !value.activities || !Number.isInteger(value.revision)) throw new Error('儲存資料無法讀取；已保留原資料，請勿清除瀏覽器儲存。');
    // User explicitly chose to restart old progress rather than convert it.
    // Clear the old journal together with stats so Undo cannot revive old rules.
    if(value.statsRulesVersion !== STATS_RULES_VERSION){
      value.stats=createInitialStats();value.history=[];value.statsRulesVersion=STATS_RULES_VERSION;value.revision++;
      try{storage.setItem(STORAGE_KEY,JSON.stringify(value));}
      catch{throw new Error('無法保存新版數值初始設定；原資料未變更，請確認儲存空間與權限。');}
    }
    value.profile.motto ??= '';
    value.avatar ??= null;
    value.portraits ??= [];value.photoEdit ??= null;value.avatarEdit ??= null;value.currentPortraitId ??= null;
    value.stats = normalizeStats(value.stats);
    // Normalize historical snapshots too so pre-upgrade Undo remains consistent.
    for (const record of value.history) for (const snapshot of [record.before, record.after]) {
      if (snapshot.profile) snapshot.profile.motto ??= '';
      if (snapshot.stats) snapshot.stats = normalizeStats(snapshot.stats);
    }
    // Pre-Redo journals have no branch metadata. Recover only a provable chain:
    // each Undo must be newer than every saved transaction, and each before
    // snapshot must match the state reached by replaying the previous candidate.
    if (value.history.every(record => !Object.hasOwn(record,'redoable'))) {
      const latestTransaction = Math.max(0,...value.history.map(record => Date.parse(record.time)));
      const candidates = value.history.map((record,index)=>({record,index}))
        .filter(({record})=>record.undone && Date.parse(record.undoneAt)>latestTransaction)
        .sort((a,b)=>Date.parse(b.record.undoneAt)-Date.parse(a.record.undoneAt) || a.index-b.index);
      const replayState = copy(value);
      for (const [index,{record}] of candidates.entries()) {
        if (!Object.keys(record.before).every(key=>JSON.stringify(replayState[key])===JSON.stringify(record.before[key]))) break;
        record.redoable=true;record.undoOrder=-index;
        Object.assign(replayState,copy(record.after));
      }
    }
    if (value.history.length > HISTORY_LIMIT) {
      value.history = retainedHistory(value.history);
      value.revision++;
      try { storage.setItem(STORAGE_KEY, JSON.stringify(value)); }
      catch { throw new Error('無法保存歷史紀錄保留上限；原資料未清除，請確認儲存空間與權限。'); }
    }
    return value;
  };
  state = load();
  const notify = () => listeners.forEach(fn => fn(copy(state)));
  const persist = next => {
    const current = load();
    if (current.revision !== state.revision) { state = current; notify(); throw new Error('資料已在其他頁面更新，請重試。'); }
    next.history = retainedHistory(next.history);
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
      for (const [key, rawValue] of Object.entries(changes)) {
        let value = rawValue;
        if (key === 'stats') {
          value = validateStats(rawValue, state.stats);
        }
        if (!['profile', 'photo', 'avatar', 'photoEdit', 'avatarEdit', 'portraits', 'currentPortraitId', 'activities', 'stats'].includes(key)) throw new Error('不支援的資料類型');
        if (key === 'portraits' && (!Array.isArray(value) || value.length>6 || new Set(value.map(item=>item.id)).size!==value.length)) throw new Error('最多保存 6 個立繪，請先刪除或更換既有項目。');
        if (JSON.stringify(state[key]) === JSON.stringify(value)) continue;
        before[key] = copy(state[key]); after[key] = copy(value); next[key] = copy(value);
      }
      if (!Object.keys(after).length) return false;
      // Only a successful, non-empty transaction discards the redo branch.
      next.history.forEach(record => { if (record.undone && record.redoable) record.redoable = false; });
      const delta = {};
      for (const key of ['experience', 'level', 'currency']) delta[key] = typeof next.stats[key] === 'number' && typeof state.stats[key] === 'number' ? next.stats[key] - state.stats[key] : 0;
      delta.abilities = next.stats.abilities.map(a => ({ id: a.id, value: a.value - (state.stats.abilities.find(x => x.id === a.id)?.value ?? 0) }));
      next.history.push({ id: crypto.randomUUID(), time: new Date().toISOString(), type, label, target, fields, before, after, delta, undone: false, undoneAt: null });
      persist(next); return true;
    },
    getState() {
      const undo = undoRecord(state.history), redo = redoRecord(state.history);
      return { available: Boolean(undo), redoAvailable: Boolean(redo), busy: false, label: undo?.label ?? null, redoLabel: redo?.label ?? null };
    },
    async undo() { return replay(false); },
    async redo() { return replay(true); },
  };
  function replay(redo) {
    const next = copy(state), record = redo ? redoRecord(next.history) : undoRecord(next.history);
    if (!record) return { ok: false, reason: 'unavailable' };
    try {
      const expected = redo ? record.before : record.after, restored = redo ? record.after : record.before;
      for (const key of Object.keys(expected)) {
        if (JSON.stringify(state[key]) !== JSON.stringify(expected[key])) throw new Error(`資料已改變，無法安全${redo ? '恢復' : '撤銷'}。`);
        next[key] = copy(restored[key]);
      }
      // Replay snapshots directly; never validate as a new edit or award rewards.
      next.stats = normalizeStats(next.stats);
      record.undone = !redo;
      record.undoneAt = redo ? null : new Date().toISOString();
      record.redoable = !redo;
      if (redo) delete record.undoOrder;
      else record.undoOrder = state.revision + 1;
      persist(next); return { ok: true, label: record.label };
    } catch (error) { return { ok: false, reason: 'failed', error }; }
  }
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
  const result = Object.fromEntries(['name', 'age', 'gender', 'bio', 'boundaries', 'motto'].map(key => [key, String(value[key] ?? '').trim()]));
  if (result.age && (!/^\d+$/.test(result.age) || !Number.isSafeInteger(Number(result.age)))) throw new Error('年齡請填寫有效的非負整數，或留白。');
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
if (typeof window !== 'undefined') {
  const status=document.querySelector('#operation-status');
  try {
    const migrationNeeded=window.localStorage.getItem(STORAGE_KEY)?.includes('data:image/');
    const controls=migrationNeeded?[...document.querySelectorAll('input,button')].map(control=>[control,control.disabled]):[];
    if(migrationNeeded){controls.forEach(([control])=>control.disabled=true);if(status){status.hidden=false;status.textContent='正在升級本機圖片儲存，請稍候。';}}
    await migrateImages(window.localStorage,STORAGE_KEY);
    controls.forEach(([control,disabled])=>control.disabled=disabled);
    if(migrationNeeded&&status){status.hidden=true;status.textContent='';}
  } catch(error) {
    if(status){status.hidden=false;status.textContent=`本機儲存讀取或圖片升級失敗，原資料已保留。${error.message}`;}
    document.querySelectorAll('input,button').forEach(control=>control.disabled=true);throw error;
  }
}
export const dataStore = typeof window !== 'undefined' ? openBrowserStore() : null;
if (dataStore) dataStore.subscribe(()=>{collectUnusedImages(window.localStorage,STORAGE_KEY).catch(()=>{});});
export const persistentUndo = dataStore && { getState: () => dataStore.getState(), undo: () => dataStore.undo(), redo: () => dataStore.redo(), subscribe: fn => dataStore.subscribe(() => fn(dataStore.getState())) };
if (typeof window !== 'undefined') window.addEventListener('storage', e => { if (e.key === STORAGE_KEY || e.key === null) dataStore.refresh(); });

export function profileSummary(stats) {
  const shown = value => value > 0 ? String(value) : '—';
  return `Exp ${formatSI(visibleExperience(stats.experience))} ｜ Lv ${shown(stats.level)} ｜ $ ${shown(stats.currency)}`;
}
export function abilityShares(abilities) {
  const total = abilities.reduce((sum,a) => sum + a.value, 0);
  return abilities.map(a => total > 0 ? a.value / total : 0);
}
