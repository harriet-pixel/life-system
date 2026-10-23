import {GOOGLE_CLIENT_ID} from './google-config.mjs';
import {MAX_FILE_BYTES,backupFilename} from './backup.mjs?v=task-context-7';
const SCOPE='https://www.googleapis.com/auth/drive.appdata';
export const driveConfigured=Boolean(GOOGLE_CLIENT_ID);
let token=null,expires=0,loading;
export function disconnectDrive(){token=null;expires=0;}
export function revokeDrive(){
  if(!token)throw new Error('目前沒有可撤銷的有效授權；可至 Google 帳戶的第三方連線管理移除。');
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
        token=response.access_token;expires=Date.now()+Math.max(0,Number(response.expires_in)-60)*1000;resolve({connected:true});
      },error_callback:()=>reject(new Error('Google 授權視窗已關閉或無法開啟；本機資料未更動。'))});
    client.requestAccessToken({prompt:'consent'});
  });
}
async function request(url,options={}) {
  if(!token||Date.now()>=expires){disconnectDrive();throw new Error('Google 尚未連接或授權已過期，請手動重新連接。');}
  const headers=new Headers(options.headers);headers.set('Authorization','Bearer '+token);
  let response;try{response=await fetch(url,{...options,headers});}catch{throw new Error('Google Drive 網路連線失敗；本機資料與既有備份未更動。');}
  if(!response.ok){if(response.status===401)disconnectDrive();throw new Error(response.status===401?'Google 授權已過期，請重新連接。':response.status===403?'Google Drive 權限或儲存容量不足，操作未完成。':'Google Drive 操作失敗（HTTP '+response.status+'），請稍後重試。');}
  return response;
}
export async function uploadDriveBackup(blob,payload) {
  const envelope=JSON.parse(await blob.text());if(envelope.encrypted!==true)throw new Error('雲端備份必須先在瀏覽器加密。');
  const response=await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',{
    method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':'application/json','X-Upload-Content-Length':String(blob.size)},
    body:JSON.stringify({name:backupFilename(),parents:['appDataFolder'],appProperties:{lifeSystemFormat:'1',backupTime:payload.createdAt},mimeType:'application/json'})});
  const location=response.headers.get('Location');
  if(!location||!/^https:\/\/(www|content)\.googleapis\.com\/upload\/drive\//.test(location))throw new Error('Google 上傳位置驗證失敗，已停止。');
  await request(location,{method:'PUT',headers:{'Content-Type':'application/json'},body:blob});
}
export async function listDriveBackups() {
  const files=[];let pageToken;
  do{const params=new URLSearchParams({spaces:'appDataFolder',q:"trashed = false and appProperties has { key='lifeSystemFormat' and value='1' }",fields:'nextPageToken,files(id,name,size,createdTime,appProperties)',pageSize:'100',orderBy:'createdTime desc'});if(pageToken)params.set('pageToken',pageToken);
    const data=await(await request('https://www.googleapis.com/drive/v3/files?'+params)).json();files.push(...(data.files??[]));pageToken=data.nextPageToken;
    if(files.length>5000)throw new Error('雲端備份清單過多，請先至帳戶管理檢查應用程式資料。');
  }while(pageToken);
  return files;
}
export async function downloadDriveBackup(file) {
  if(!/^[a-zA-Z0-9_-]+$/.test(file.id)||Number(file.size)>MAX_FILE_BYTES)throw new Error('雲端備份大小或 ID 不正確。');
  const response=await request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(file.id)+'?alt=media');
  const length=Number(response.headers.get('Content-Length'));if(length>MAX_FILE_BYTES)throw new Error('雲端備份超過大小上限。');
  const reader=response.body.getReader(),parts=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_FILE_BYTES)throw new Error('雲端備份超過大小上限。');parts.push(value);}}catch(error){await reader.cancel();throw error;}
  return new Blob(parts,{type:'application/json'});
}
if(typeof window!=='undefined')window.addEventListener('pagehide',disconnectDrive);
