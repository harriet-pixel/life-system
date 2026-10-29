import {attemptJournalRescue} from './storage-vault.mjs?v=daily-polish-20261029';
import {storageFailure} from './storage-diagnostics.mjs?v=daily-polish-20261029';
import {validateReplyManifest,emptyReplyLibrary} from './characters-model.mjs?v=companion-panel-20261029';
import {emptyAffinity,validateAffinity,setPenaltyPolicy,observeEligibility} from './affinity-model.mjs?v=companion-panel-20261029';
import {integrateAffinity} from './affinity-integration.mjs?v=companion-panel-20261029';
import {settleAffinity} from './affinity-settlement.mjs?v=companion-panel-20261029';
import {emptyCharacters,validateCharacters} from './characters-model.mjs?v=companion-panel-20261029';
import {emptyHabits,validateHabits} from './habits-model.mjs?v=daily-polish-20261029';
import {setOperationNotice} from './operation-notice.mjs?v=daily-polish-20261029';
import {emptyTasks,validateTasks} from './tasks-model.mjs?v=daily-polish-20261029';
import {RECOVERY_LIMIT,maintainRecovery,undoCandidate,redoCandidate,expectedMatches,applySnapshot,actionMetadata,expiresAt} from './recovery.mjs?v=companion-panel-20261029';
import {validateProfileFields,validateActivities} from './validation.mjs?v=daily-polish-20261029';
import { coordinatedWrite,pendingFeedbackFrame } from './coordination.mjs?v=daily-polish-20261029';
import { DEFAULT_SETTINGS, normalizeSettings, applyAppearance } from './settings-model.mjs?v=daily-polish-20261029';
import { migrateImages } from './image-store.mjs?v=daily-polish-20261029';
import { normalizeStats, validateStats, createInitialStats, visibleExperience } from './abilities.mjs?v=daily-polish-20261029';
// A single atomic localStorage document owns data and its reversible journal.
export {RECOVERY_LIMIT};
export const STATS_RULES_VERSION = 2;
export { visibleExperience };
export const STORAGE_KEY = 'life-system.data.v1';
const copy = value => structuredClone(value);
const undoRecord = undoCandidate;
const redoRecord = redoCandidate;
const initial = () => ({ revision: 0, companion: emptyCharacters(), affinity: emptyAffinity(), statsRulesVersion: STATS_RULES_VERSION, profile: { name: '', age: '', gender: '', bio: '', boundaries: '', motto: '' }, photo: null, avatar: null, photoEdit: null, avatarEdit: null, portraits: [], currentPortraitId: null, activities: {}, tasks: emptyTasks(), habits: emptyHabits(), stats: createInitialStats(), settings: structuredClone(DEFAULT_SETTINGS), historyVersion:1, undoHistory:[], history: [] });
// Preserve the published one-time legacy restart, but perform the write only
// under the shared write lock; existing v2 progress and settings are untouched.
// Only a genuinely empty device may adopt a cloud root without a choice.
export function isPristineDocument(document){
 const clean=value=>{const d=structuredClone(value);delete d.revision;delete d.affinity;return d;};
 const a=document.affinity;
 if(a&&(a.transactions?.length||a.diagnostics?.length||a.policies?.some(p=>p.id!=='initial')||Object.entries(a).some(([k,v])=>!['version','startedAt','lastSeenAt','policies','transactions','diagnostics'].includes(k)&&v&&Object.keys(v).length)))return false;
 return JSON.stringify(clean(document))===JSON.stringify(clean(initial()));
}

export function migrateStatsRules(storage) {
  const raw=storage.getItem(STORAGE_KEY);if(!raw)return;
  const value=JSON.parse(raw);
  if(!value?.profile||!value.stats||!Array.isArray(value.history)||!Number.isSafeInteger(value.revision))throw new Error('既有資料無法安全讀取，已停止數值升級。');
  if(value.statsRulesVersion===STATS_RULES_VERSION)return;
  if(value.statsRulesVersion!==undefined&&value.statsRulesVersion!==1)throw new Error('不支援的數值規則版本，原資料已保留。');
  const next={...value,stats:createInitialStats(),history:value.history,statsRulesVersion:STATS_RULES_VERSION,revision:value.revision+1};
  if(storage.getItem(STORAGE_KEY)!==raw)throw new Error('其他分頁已更新資料，請重新整理後重試。');
  storage.setItem(STORAGE_KEY,JSON.stringify(next));
}
export function createDataStore(storage,{now=Date.now}={}) {
  let state, busy=false,recoveryNotice=null,loadedRaw;
  const listeners = new Set(),commitListeners=new Map();
  const load = () => {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {loadedRaw=raw;return initial();}
    const value = JSON.parse(raw);
    if (!value || !Array.isArray(value.history) || !value.profile || !value.stats || !value.activities || !Number.isInteger(value.revision)) throw new Error('儲存資料無法讀取；已保留原資料，請勿清除瀏覽器儲存。');
    value.companion ??= emptyCharacters();if(value.companion.version===1){try{value.companion=validateCharacters(value.companion);}catch{recoveryNotice='角色格式遷移暫停，原始內容已保留；其他本機資料仍可讀取。';}}
    value.affinity ??= emptyAffinity();
    value.habits = validateHabits(value.habits ?? emptyHabits());
    value.tasks = validateTasks(value.tasks ?? emptyTasks());
    value.settings = normalizeSettings(value.settings);
    value.statsRulesVersion ??= STATS_RULES_VERSION;
    value.profile.motto ??= '';
    value.avatar ??= null;
    value.portraits ??= [];value.photoEdit ??= null;value.avatarEdit ??= null;value.currentPortraitId ??= null;
    value.stats = normalizeStats(value.stats);
    // Normalize historical snapshots too so pre-upgrade Undo remains consistent.
    for (const record of (value.undoHistory??value.history)) for (const snapshot of [record.before, record.after]) {
      if (snapshot?.settings) snapshot.settings=normalizeSettings(snapshot?.settings);
      if (snapshot?.profile) snapshot.profile.motto ??= '';
      if (snapshot?.stats) snapshot.stats = normalizeStats(snapshot.stats);
    }
    const result=maintainRecovery(value,now());if(result.blocked)recoveryNotice='部分復原鏈與目前資料不一致，已停止提供相關復原；目前資料與行動紀錄保留。';loadedRaw=raw;return result.document;
  };
  state = load();
  // Read-only recovery proof is reusable while the state identity and expiry window
  // are unchanged. Every mutation still gets an isolated copy and full write checks.
  let recoveryCache=null;
  function cacheRecovery(result,time){const deadline=Math.min(Infinity,...result.document.undoHistory.map(expiresAt));recoveryCache={state,result,time,deadline};if(result.blocked)recoveryNotice='復原鏈已無法安全延續，相關復原已停止；目前資料與行動紀錄保留。';return result;}
  function currentRecovery(){const time=now();if(!recoveryCache||recoveryCache.state!==state||time<recoveryCache.time||time>=recoveryCache.deadline)return cacheRecovery(maintainRecovery(state,time),time);return recoveryCache.result;}
  const effective=()=>{const result=currentRecovery();return {...result,document:copy(result.document)};};
  const project=(document,keys)=>keys===null?document:Object.fromEntries(keys.map(key=>{if(key==='activeCharacter'){const c=document.companion?.characters?.find(c=>c.characterId===document.companion.activeCharacterId&&!c.archived);return [key,c?{characterId:c.characterId,createdAt:c.createdAt,settings:{name:c.settings?.name??''},greetings:c.greetings,imageSettings:c.imageSettings}:null];}return [key,Object.hasOwn(document,key)?document[key]:undefined];}));
  const notify = ({statusOnly=false}={}) => {const current=currentRecovery().document;listeners.forEach(entry=>{if(!statusOnly||!entry.changesOnly){const value=project(current,entry.keys),signature=entry.distinct?JSON.stringify(value):null;if(entry.distinct&&signature===entry.signature)return;entry.signature=signature;entry.fn(copy(value));}});};
  const persist = (next,timing=null,operation=null) => {const readAt=performance.now();
    const current = load();timing?.phase('storage-read-check',readAt);
    if (current.revision !== state.revision) { state = current; notify(); throw new Error('資料已在其他頁面更新，請重試。'); }
    const recoveryAt=performance.now(),checkedAt=now(),checked=maintainRecovery(next,checkedAt);next=checked.document;timing?.phase('recovery-write-check',recoveryAt);
    next.revision = Math.max(state.revision + 1,next.revision ?? 0);
    try {const serializedAt=performance.now(),raw=JSON.stringify(next);timing?.phase('serialize',serializedAt);const writeAt=performance.now();storage.setItem(STORAGE_KEY,raw);loadedRaw=raw;timing?.phase('storage-write',writeAt);}
    catch(error) { throw storageFailure(error,storage,{operation:operation?.type??'primary-write',attemptedBytes:JSON.stringify(next).length*2}); }
    state = next;cacheRecovery({...checked,document:state},checkedAt);const subscribersAt=performance.now();notify();commitListeners.forEach(({metadataOnly,omit,keys,types},fn)=>{try{if(types&&!types.includes(operation?.type))return;if(metadataOnly){if(operation){const record=state.history.at(-1);fn(null,copy({id:operation.id,type:operation.type,label:record?.label,delta:record?.delta}));}}else fn(copy(keys?project(state,keys):omit?.length?Object.fromEntries(Object.entries(state).filter(([key])=>!omit.includes(key))):state),operation);}catch{}});timing?.phase('subscribers',subscribersAt);
  };
  const api = {
    get: () => copy(currentRecovery().document),
    getFields: keys => copy(project(currentRecovery().document,keys)),
    maintain() {const result=effective();const raw=storage.getItem(STORAGE_KEY);if(raw&&JSON.stringify(result.document)!==raw)persist(result.document);return result;},
    notify,
    subscribeCommits(fn,{metadataOnly=false,omit=null,keys=null,types=null}={}){commitListeners.set(fn,{metadataOnly,omit,keys,types});return()=>commitListeners.delete(fn);},
    setBusy(value) {busy=value;notify({statusOnly:true});},
    // Dormant sync capability: callers must hold maintenance locks and validate the full document.
    replaceSynchronized(value,expectedRevision) {if(state.revision!==expectedRevision)throw new Error('同步期間本地資料已更新。');const checked=maintainRecovery(copy(value),now());if(checked.blocked)throw new Error('同步復原鏈無法安全延續。');persist(checked.document);},
    replace(value) { const next=copy(value);next.companion=validateCharacters(next.companion);if(state.affinity?.chatEpoch||next.affinity?.chatEpoch){next.affinity??=emptyAffinity();next.affinity.chatEpoch=crypto.randomUUID();}next.replyLibrary??=emptyReplyLibrary();next.replyLibrary.epoch=crypto.randomUUID();next.revision=Math.max(value.revision,state.revision+1);persist(next); },
    subscribe(fn,{changesOnly=false,keys=null,distinct=false}={}) {const value=project(currentRecovery().document,keys),entry={fn,changesOnly,keys,distinct,signature:distinct?JSON.stringify(value):null};listeners.add(entry);fn(copy(value));return()=>listeners.delete(entry);},
    refresh() {if(storage.getItem(STORAGE_KEY)===loadedRaw){const previous=recoveryCache?.result.document;if(currentRecovery().document!==previous)notify();return;}state = load();notify();},
    transact({ type, label, target, changes, fields = [], expectedRevision, id, timing, reversible = true }) {const validateAt=performance.now();
      if(expectedRevision!==undefined&&state.revision!==expectedRevision)throw new Error('等待期間資料已更新，請重新操作。');
      api.maintain();
      const next = effective().document, before = {}, after = {};
      for (const [key, rawValue] of Object.entries(changes)) {
        let value = key==='settings'?normalizeSettings(rawValue):rawValue;
        if(key==='profile')value=validateProfileFields(rawValue,state.profile);
        if(key==='affinity')value=validateAffinity(rawValue,state.companion);
        if(key==='companion')value=validateCharacters(rawValue);
        if(key==='replyLibrary')value=validateReplyManifest(rawValue);
        if(key==='habits')value=validateHabits(rawValue);
        if(key==='tasks')value=validateTasks(rawValue);
        if(key==='activities')value=validateActivities(rawValue);
        if (key === 'stats') {
          value = validateStats(rawValue, state.stats);
        }
        if (!['profile', 'photo', 'avatar', 'photoEdit', 'avatarEdit', 'portraits', 'currentPortraitId', 'activities', 'tasks', 'habits', 'stats', 'settings', 'companion', 'affinity', 'replyLibrary'].includes(key)) throw new Error('不支援的資料類型');
        if (key === 'portraits' && (!Array.isArray(value) || value.length>6 || new Set(value.map(item=>item.id)).size!==value.length)) throw new Error('最多保存 6 個立繪，請先刪除或更換既有項目。');
        if (JSON.stringify(state[key]) === JSON.stringify(value)) continue;
        before[key] = copy(state[key]); after[key] = copy(value); next[key] = copy(value);
      }
      if (!Object.keys(after).length) return false;
      next.undoHistory=next.undoHistory.filter(record=>!record.undone);
      const delta = {};
      for (const key of ['experience', 'level', 'currency']) delta[key] = typeof next.stats[key] === 'number' && typeof state.stats[key] === 'number' ? next.stats[key] - state.stats[key] : 0;
      delta.abilities = next.stats.abilities.map(a => ({ id: a.id, value: a.value - (state.stats.abilities.find(x => x.id === a.id)?.value ?? 0) }));
      let committedId;{
        const transactionId=id??crypto.randomUUID();committedId=transactionId;const time=new Date(now()).toISOString();
        const affinityPlan=integrateAffinity(state,next,{type:type??'data.update',operationId:transactionId,time});
        const record={id:transactionId,time,...(affinityPlan.length?{affinityPlan}:{}),type:type??'data.update',label:label??'已更新資料',target:target??'user',fields,before,after,delta,undone:false,undoneAt:null};
        next.history.push(actionMetadata(record));if(reversible)next.undoHistory.push(record);
      }
      timing?.phase('transaction-validate',validateAt);persist(next,timing,{id:committedId,type:type??'data.update',before,after});return true;
    },
    settleAffinities() {
      const next=effective().document,time=now();next.affinity=validateAffinity(next.affinity,next.companion,{clone:false});
      const prior=JSON.stringify(next.affinity),changed=settleAffinity(next,{now:time,operationId:'settlement:'+next.revision});
      // A check with no new day/diagnostic has no durable write or revision churn.
      if(!changed&&state.affinity?.startedAt!=null&&JSON.stringify(next.affinity.diagnostics)===JSON.stringify(state.affinity?.diagnostics))return false;
      if(JSON.stringify(next.affinity)!==prior){persist(next);return true;}return false;
    },
    setAffinityPolicy(settings) {
      const next=effective().document,time=new Date(now()).toISOString();next.affinity=validateAffinity(next.affinity,next.companion,{clone:false});
      const settled=settleAffinity(next,{now:now(),operationId:'settlement:'+next.revision});
      if(!setPenaltyPolicy(next,settings,time,crypto.randomUUID())&&!settled&&state.affinity?.startedAt!=null)return false;
      persist(next);return true;
    },
    setReplyLibrary(value,expectedRevision,valid=()=>true) {if(!valid()||state.revision!==expectedRevision)throw new Error('回覆庫等待期間資料已更新，請重試。');const next=effective().document;next.replyLibrary=validateReplyManifest(value,next.companion);persist(next);return true;},
    prepareChat() {const next=effective().document;next.affinity=validateAffinity(next.affinity,next.companion);if(!next.affinity.chatEpoch){next.affinity.chatEpoch=crypto.randomUUID();persist(next);}return next.affinity.chatEpoch;},
    async commitChatAssessment(turn,valid=()=>true) {const {commitChat}=await import('./chat-affinity.mjs?v=companion-panel-20261029');if(!valid())throw new Error('此聊天請求已失效，未提交評估。');const next=effective().document,result=commitChat(next,turn,new Date(now()).toISOString());if(result.changed)persist(next);return copy(result.receipt);},
    setAIPreferences(value) {
      const ai=normalizeSettings({ai:value}).ai;
      const next=effective().document;
      if(JSON.stringify(next.settings.ai)===JSON.stringify(ai))return false;
      next.settings={...next.settings,ai};
      persist(next);return true; // Preference only: no history, reward or Redo branch change.
    },
    getState() {
      const {document:current}=currentRecovery();
      const undo = undoRecord(current.undoHistory), redo = redoRecord(current.undoHistory);
      return { recoveryNotice, nextExpiry:recoveryCache.deadline, available: Boolean(undo), redoAvailable: Boolean(redo), busy, label: undo?.label ?? null, redoLabel: redo?.label ?? null };
    },
    async undo() { return replay(false); },
    async redo() { return replay(true); },
  };
  function replay(redo) {
    try{api.maintain();}catch(error){return {ok:false,reason:'failed',error};}
    const next = effective().document, record = redo ? redoRecord(next.undoHistory) : undoRecord(next.undoHistory);
    if (!record) return { ok: false, reason: 'unavailable' };
    try {
      if(!expectedMatches(state,record,redo))throw new Error('資料已改變，無法安全延續復原鏈。');
      applySnapshot(next,record,redo,{time:new Date(now()).toISOString()});
      if(next.affinity?.startedAt&&(record.before.tasks||record.before.habits))observeEligibility(next,state,new Date(now()).toISOString());
      // Replay snapshots directly; never validate as a new edit or award rewards.
      next.stats = normalizeStats(next.stats);
      record.undone = !redo;
      record.undoneAt = redo ? null : new Date(now()).toISOString();
      record.redoable = !redo;
      if (redo) delete record.undoOrder;
      else record.undoOrder = state.revision + 1;
      const metadata=next.history.find(r=>r.id===record.id);if(metadata){metadata.undone=record.undone;metadata.undoneAt=record.undoneAt;}
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
export const validateProfile=(value,previous)=>validateProfileFields(value,previous);
export function abilityRatios(abilities) {
  const max = Math.max(0, ...abilities.map(a => a.value));
  return abilities.map(a => max > 0 ? a.value / max : 0);
}
function openBrowserStore() {
  try { return createDataStore(window.localStorage); }
  catch (error) {
    const status = document.querySelector('#operation-status');
    if (status) { status.hidden = false; setOperationNotice(status,`無法讀取本機儲存，請確認瀏覽器允許儲存資料。${error.message}`); }
    document.querySelectorAll('input, button').forEach(control => { control.disabled = true; });
    throw error;
  }
}
if (typeof window !== 'undefined') {
  const status=document.querySelector('#operation-status');
  try {
    const migrationNeeded=window.localStorage.getItem(STORAGE_KEY)?.includes('data:image/');
    const controls=migrationNeeded?[...document.querySelectorAll('input,button')].map(control=>[control,control.disabled]):[];
    if(migrationNeeded){controls.forEach(([control])=>control.disabled=true);if(status){status.hidden=false;setOperationNotice(status,'正在升級本機圖片儲存，請稍候。');}}
    await coordinatedWrite(async()=>{await attemptJournalRescue(window.localStorage);await migrateImages(window.localStorage,STORAGE_KEY);migrateStatsRules(window.localStorage);});
    controls.forEach(([control,disabled])=>control.disabled=disabled);
    if(migrationNeeded&&status){status.hidden=true;status.textContent='';}
  } catch(error) {
    if(status){status.hidden=false;setOperationNotice(status,`本機儲存讀取或圖片升級失敗，原資料已保留。${error.message}`);}
    document.querySelectorAll('input,button').forEach(control=>control.disabled=true);throw error;
  }
}
export const dataStore = typeof window !== 'undefined' ? openBrowserStore() : null;
if (dataStore) {
  try{await coordinatedWrite(()=>{dataStore.refresh();dataStore.maintain();});}catch(error){const e=document.querySelector('#operation-status');if(e){e.hidden=false;setOperationNotice(e,'復原資料整理失敗，原資料已保留。'+error.message);}document.querySelectorAll('input,button').forEach(control=>control.disabled=true);throw error;}
  let expiryTimer;
  let appliedAppearance;dataStore.subscribe(state=>{const appearance=JSON.stringify(state.settings.appearance);if(appearance!==appliedAppearance){applyAppearance(state.settings.appearance);appliedAppearance=appearance;}clearTimeout(expiryTimer);const deadline=dataStore.getState().nextExpiry;if(Number.isFinite(deadline))expiryTimer=setTimeout(()=>coordinatedWrite(()=>{dataStore.refresh();dataStore.maintain();}).catch(error=>{const e=document.querySelector('#operation-status');if(e){e.hidden=false;setOperationNotice(e,error.message);}}),Math.min(2147483647,Math.max(1,deadline-Date.now())));},{changesOnly:true,keys:['settings']});
  for(const method of ['transact','undo','redo','setAIPreferences','settleAffinities','setAffinityPolicy','prepareChat','commitChatAssessment','setReplyLibrary']) {
    const original=dataStore[method];
    dataStore[method]=async(...args)=>{
      if(dataStore.getState().busy)throw new Error('資料操作進行中，請稍候再試。');
      const expectedRevision=dataStore.getFields(['revision']).revision;
      dataStore.setBusy(true);
      const timing=method==='transact'?args[0]?.timing:null,waitingAt=performance.now();try{if(['undo','redo'].includes(method)||method==='transact'&&['task.completed','task.completed.batch','task.view-settings'].includes(args[0]?.type))await pendingFeedbackFrame();return await coordinatedWrite(async()=>{await attemptJournalRescue(window.localStorage);timing?.phase('lock-wait',waitingAt);const heldAt=performance.now();try{
        if(dataStore.getFields(['revision']).revision!==expectedRevision)throw new Error('等待期間資料已更新，請重試操作。');
        return original(...args);
        }finally{timing?.phase('lock-held',heldAt);}
      });}finally{dataStore.setBusy(false);}
    };
  }
}
export const persistentUndo = dataStore && { getState: () => dataStore.getState(), undo: () => dataStore.undo(), redo: () => dataStore.redo(), subscribe: fn => dataStore.subscribe(() => fn(dataStore.getState()),{keys:[]}) };
if (typeof window !== 'undefined') window.addEventListener('storage', e => { if (e.key === STORAGE_KEY || e.key === null) dataStore.refresh(); });

export function profileSummary(stats) {
  const shown = value => value > 0 ? String(value) : '—';
  return `Exp ${visibleExperience(stats.experience) > 0 ? formatSI(visibleExperience(stats.experience)) : '—'} ｜ Lv ${shown(stats.level)} ｜ $ ${shown(stats.currency)}`;
}
export function abilityShares(abilities) {
  const total = abilities.reduce((sum,a) => sum + a.value, 0);
  return abilities.map(a => total > 0 ? a.value / total : 0);
}

if(typeof window!=='undefined')window.addEventListener('pageshow',event=>{if(event.persisted)dataStore.refresh();});
