import {createDriveAuthSession} from './drive-auth-session.mjs?v=drive-poll-25';
import {GOOGLE_CLIENT_ID} from './google-config.mjs?v=drive-poll-25';
import {MAX_FILE_BYTES,backupFilename} from './backup.mjs?v=drive-poll-25';
const SCOPE='https://www.googleapis.com/auth/drive.appdata';
export const driveConfigured=Boolean(GOOGLE_CLIENT_ID);
let token=null,expires=0,loading;const listeners=new Set();const session=createDriveAuthSession({getItem:k=>globalThis.sessionStorage?.getItem(k)??null,setItem:(k,v)=>globalThis.sessionStorage.setItem(k,v),removeItem:k=>globalThis.sessionStorage?.removeItem(k)},GOOGLE_CLIENT_ID);
export function getDriveState(){const wasConnected=Boolean(token);let value;try{value=session.read();}catch{value=null;}token=value?.token??null;expires=value?.expiresAt??0;if(wasConnected&&!token)queueMicrotask(notify);return {configured:driveConfigured,connected:Boolean(token),expiresAt:expires||null};}
const notify=()=>listeners.forEach(fn=>fn(getDriveState()));
export const driveAuth={getState:getDriveState,subscribe(fn){listeners.add(fn);fn(getDriveState());return()=>listeners.delete(fn);}};
export function disconnectDrive(){token=null;expires=0;try{session.clear();}catch{}notify();}
export function revokeDrive(){
  getDriveState();if(!token)throw new Error('目前沒有可撤銷的有效授權；可至 Google 帳戶的第三方連線管理移除。');
  return new Promise((resolve,reject)=>{google.accounts.oauth2.revoke(token,result=>{disconnectDrive();if(result?.error)reject(new Error('撤銷失敗，已中斷本頁連接；請至 Google 帳戶移除授權。'));else resolve();});});
}
export async function connectDrive(){
  if(!driveConfigured)throw new Error('Google 備份尚未設定 OAuth client ID；本機備份仍可使用。');
  if(!globalThis.google?.accounts?.oauth2){
    if(!loading)loading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.onload=resolve;script.onerror=()=>{loading=null;script.remove();reject(new Error('無法載入 Google 授權程式，請稍後再試。'));};document.head.append(script);});
    await loading;return {needsClick:true};
  }
  return new Promise((resolve,reject)=>{
    const client=google.accounts.oauth2.initTokenClient({client_id:GOOGLE_CLIENT_ID,scope:SCOPE,include_granted_scopes:false,
      callback:response=>{
        if(response.error||!response.access_token||!google.accounts.oauth2.hasGrantedAllScopes(response,SCOPE)){disconnectDrive();reject(new Error('Google 授權未完成或已取消；本機資料未更動。'));return;}
        try{session.write(response.access_token,response.expires_in);getDriveState();notify();resolve({connected:true});}catch{disconnectDrive();reject(new Error('無法保存本分頁 Google 授權，已停止連接。'));}
      },error_callback:()=>reject(new Error('Google 授權視窗已關閉或無法開啟；本機資料未更動。'))});
    client.requestAccessToken({prompt:'consent'});
  });
}
export async function driveRequest(url,options={}) {
  getDriveState();if(!token||Date.now()>=expires){disconnectDrive();throw Object.assign(new Error('Google 尚未連接或授權已過期，請手動重新連接。'),{code:'auth'});}
  const headers=new Headers(options.headers);headers.set('Authorization','Bearer '+token);
  const {timeoutMs,...requestOptions}=options;const signal=timeoutMs?AbortSignal.any([AbortSignal.timeout(timeoutMs),...(options.signal?[options.signal]:[])]):options.signal;let response;try{response=await fetch(url,{...requestOptions,headers,signal});}catch{throw Object.assign(new Error('Google Drive 網路連線失敗；本機資料保留。'),{transient:true});}
  if(!response.ok){if(response.status===401)disconnectDrive();const raw=response.headers.get('Retry-After'),retryAfterMs=raw?(Number.isFinite(Number(raw))?Number(raw)*1000:Math.max(0,Date.parse(raw)-Date.now())):0;let quota=false;if(response.status===403){try{const body=await response.clone().json();quota=body.error?.errors?.some(e=>/rateLimit|quota|dailyLimit|userRateLimit/i.test(e.reason));}catch{}}throw Object.assign(new Error(response.status===401?'Google 授權已過期，請重新連接。':response.status===403?'Google Drive 權限或儲存容量不足，操作未完成。':'Google Drive 操作失敗（HTTP '+response.status+'），請稍後重試。'),{code:response.status===401?'auth':'drive',status:response.status,transient:response.status===429||response.status>=500||quota,retryAfterMs:Number.isFinite(retryAfterMs)?retryAfterMs:0});}
  return response;
}
export async function uploadDriveBackup(blob,payload) {
  const envelope=JSON.parse(await blob.text());if(envelope.encrypted!==true)throw new Error('雲端備份必須先在瀏覽器加密。');
  const response=await driveRequest('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',{
    method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':'application/json','X-Upload-Content-Length':String(blob.size)},
    body:JSON.stringify({name:backupFilename(),parents:['appDataFolder'],appProperties:{lifeSystemFormat:'1',backupTime:payload.createdAt},mimeType:'application/json'})});
  const location=response.headers.get('Location');
  if(!location||!/^https:\/\/(www|content)\.googleapis\.com\/upload\/drive\//.test(location))throw new Error('Google 上傳位置驗證失敗，已停止。');
  await driveRequest(location,{method:'PUT',headers:{'Content-Type':'application/json'},body:blob});
}
export async function listDriveBackups() {
  const files=[];let pageToken;
  do{const params=new URLSearchParams({spaces:'appDataFolder',q:"trashed = false and appProperties has { key='lifeSystemFormat' and value='1' }",fields:'nextPageToken,files(id,name,size,createdTime,appProperties)',pageSize:'100',orderBy:'createdTime desc'});if(pageToken)params.set('pageToken',pageToken);
    const data=await(await driveRequest('https://www.googleapis.com/drive/v3/files?'+params)).json();files.push(...(data.files??[]));pageToken=data.nextPageToken;
    if(files.length>5000)throw new Error('雲端備份清單過多，請先至帳戶管理檢查應用程式資料。');
  }while(pageToken);
  return files;
}
export async function downloadDriveBackup(file) {
  if(!/^[a-zA-Z0-9_-]+$/.test(file.id)||Number(file.size)>MAX_FILE_BYTES)throw new Error('雲端備份大小或 ID 不正確。');
  const response=await driveRequest('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(file.id)+'?alt=media');
  const length=Number(response.headers.get('Content-Length'));if(length>MAX_FILE_BYTES)throw new Error('雲端備份超過大小上限。');
  const reader=response.body.getReader(),parts=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_FILE_BYTES)throw new Error('雲端備份超過大小上限。');parts.push(value);}}catch(error){await reader.cancel();throw error;}
  return new Blob(parts,{type:'application/json'});
}


// Immutable appData sync files. Existing encrypted manual backups remain separate.
export async function createAppDataFile(blob,{name,appProperties},signal){
 if(blob.size>MAX_FILE_BYTES)throw new Error('同步檔案超過大小上限。');
 const boundary='life-'+crypto.randomUUID(),body=new Blob(['--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',JSON.stringify({name,parents:['appDataFolder'],mimeType:'application/json',appProperties}),'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n',blob,'\r\n--'+boundary+'--'],{type:'multipart/related; boundary='+boundary});
 const data=await(await driveRequest('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',body,signal,timeoutMs:120000})).json();if(!/^[a-zA-Z0-9_-]+$/.test(data.id))throw new Error('Google 同步檔案識別碼無效。');return data.id;
}
export async function listSyncFiles(signal,kind='manifest-v1'){if(!['manifest-v1','snapshot-v1'].includes(kind))throw new Error('同步檔案類型不正確。');const files=[];let pageToken;do{const params=new URLSearchParams({spaces:'appDataFolder',q:"trashed = false and appProperties has { key='lifeSystemSync' and value='"+kind+"' }",fields:'nextPageToken,files(id,name,size,createdTime)',pageSize:'1000'});if(pageToken)params.set('pageToken',pageToken);const data=await(await driveRequest('https://www.googleapis.com/drive/v3/files?'+params,{signal,timeoutMs:120000})).json();if(!Array.isArray(data.files))throw new Error('同步版本清單格式不正確。');files.push(...data.files);pageToken=data.nextPageToken;}while(pageToken);return files;}
export async function readAppDataFile(id,limit=MAX_FILE_BYTES,signal){if(typeof id!=='string'||!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('同步檔案ID無效。');const response=await driveRequest('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media',{signal,timeoutMs:120000});if(Number(response.headers.get('Content-Length'))>limit)throw new Error('同步檔案過大。');const reader=response.body.getReader(),parts=[];let size=0;try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw new Error('同步檔案過大。');parts.push(value);}}catch(e){await reader.cancel();throw e;}return new Blob(parts,{type:'application/json'});}

export async function deleteSyncSnapshot(id,signal){if(typeof id!=='string'||!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('同步檔案ID無效。');try{await driveRequest('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id),{method:'DELETE',signal,timeoutMs:120000});}catch(error){if(error.status!==404)throw error;}}

export async function startDriveChanges(signal){const data=await(await driveRequest('https://www.googleapis.com/drive/v3/changes/startPageToken?fields=startPageToken',{signal,timeoutMs:30000,cache:'no-store'})).json();if(typeof data.startPageToken!=='string'||!data.startPageToken)throw new Error('Drive變更游標格式錯誤。');return data.startPageToken;}
export async function readDriveChanges(pageToken,signal){const params=new URLSearchParams({pageToken,spaces:'appDataFolder',pageSize:'1000',fields:'nextPageToken,newStartPageToken,changes(fileId,removed,file(id,appProperties))'});const data=await(await driveRequest('https://www.googleapis.com/drive/v3/changes?'+params,{signal,timeoutMs:30000,cache:'no-store'})).json();if(!Array.isArray(data.changes)||!(data.nextPageToken||data.newStartPageToken))throw new Error('Drive變更清單格式錯誤。');return data;}
