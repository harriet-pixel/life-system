export const AUTO_SYNC_ENABLED=false; // Emergency stop: local writes take priority; no automatic Drive I/O.
export const SYNC_MODE_KEY='life-system.cloud-sync-mode.v1';
export const autoSyncEnabled=(storage=globalThis.localStorage)=>AUTO_SYNC_ENABLED&&storage.getItem(SYNC_MODE_KEY)!=='manual';
export function setAutoSyncEnabled(enabled,storage=localStorage){storage.setItem(SYNC_MODE_KEY,enabled?'auto':'manual');}
export function cloudStatus({connected=false,online=true,busy=false,pending=false,error=false,conflicts=0,checked=false,confirmed=false}={}){if(!online)return '離線';if(!connected)return '需要登入';if(conflicts)return '資料衝突';if(error)return '同步失敗';if(busy)return '同步中';return checked&&confirmed&&!pending?'已同步':'待同步';}
export function taiwanTime(value){return typeof value==='string'&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'medium',timeStyle:'medium',hour12:false}).format(new Date(value)):'未記錄';}
let runtime=null;
export const getSyncRuntime=()=>runtime;
export const setSyncRuntime=value=>{runtime=value;};

export function backupStatus({connected=false,online=true,busy=false,pending=false,error=false}={}){if(!online)return '離線';if(!connected)return '需要登入';if(error)return '備份未完成';if(busy)return '備份中';return pending?'有未備份變更':'已連接';}
