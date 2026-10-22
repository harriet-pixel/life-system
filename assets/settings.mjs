import {dataStore,persistentUndo} from './data.mjs';
import {initializeNavigation} from './navigation.mjs';
import {createMobileTabPositioner} from './tab-position.mjs';
import {createHistoryView} from './history-view.mjs';
import {auditImages,deleteUnusedImages} from './image-references.mjs';
import {DEFAULT_APPEARANCE,normalizeSettings,applyAppearance} from './settings-model.mjs';
import {holdDraft} from './coordination.mjs';
import {withBackup,readBackup,restoreBackup,downloadBlob} from './backup.mjs';
import {driveConfigured,connectDrive,disconnectDrive,revokeDrive,uploadDriveBackup,listDriveBackups,downloadDriveBackup} from './google-drive.mjs';
const $=selector=>document.querySelector(selector);
const element=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const notice=message=>{$('#operation-status').hidden=false;$('#operation-status').textContent=message;};
const bytes=value=>value<1024?value+' B':value<1024**2?(value/1024).toFixed(1)+' KiB':(value/1024**2).toFixed(2)+' MiB';
const time=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('zh-TW'):'建立時間未記錄';
let busy=false;
async function run(work){
  if(busy)return;const priorError=document.querySelector('dialog[open] [data-dialog-error]');if(priorError)priorError.textContent='';busy=true;document.body.setAttribute('aria-busy','true');
  const buttons=[...document.querySelectorAll('button,input,select')].map(e=>[e,e.disabled]);buttons.forEach(([e])=>e.disabled=true);
  try{return await work();}catch(error){const message=error.message||'操作失敗；原資料未清除。';notice(message);const target=document.querySelector('dialog[open] [data-dialog-error]');if(target)target.textContent=message;}
  finally{busy=false;document.body.removeAttribute('aria-busy');buttons.forEach(([e,disabled])=>{if(e.isConnected&&!e.matches('[data-undo],[data-redo]'))e.disabled=disabled;});syncSelection();syncDrive();dataStore.notify();}
}
initializeNavigation({undoManager:{...persistentUndo,getState:()=>({...persistentUndo.getState(),busy:busy||persistentUndo.getState().busy})}});
const history=createHistoryView({store:dataStore});
const tabs=[...$('.settings-content > .activity-tabs').children],positionTabs=createMobileTabPositioner(tabs[0].parentElement);
let selectedTab=0;
function selectTab(index,event){
  selectedTab=index;
  tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;const panel=document.getElementById(tab.getAttribute('aria-controls'));panel.hidden=i!==index;panel.inert=i!==index;});
  if(index===0)refreshStorage();else{storageVersion++;releaseThumbnails();$('#asset-list').replaceChildren();}
  if(event)positionTabs(event);
}
tabs.forEach((tab,index)=>{tab.addEventListener('click',event=>selectTab(index,event));tab.addEventListener('keydown',event=>{const next={ArrowLeft:(index+3)%4,ArrowRight:(index+1)%4,Home:0,End:3}[event.key];if(next===undefined)return;event.preventDefault();selectTab(next);tabs[next].focus();});});

let unused=[],selected=new Set(),thumbnailURLs=[],storageVersion=0;
function releaseThumbnails(){thumbnailURLs.forEach(url=>URL.revokeObjectURL(url));thumbnailURLs=[];}
function syncSelection(){
  const count=selected.size,size=unused.filter(a=>selected.has(a.id)).reduce((n,a)=>n+a.blob.size,0);
  $('#selected-assets').textContent=`已選取 ${count} 張，預計釋放 ${bytes(size)}`;
  $('#delete-assets').disabled=!count||busy;
  $('#select-all-assets').disabled=!unused.length||busy;$('#select-no-assets').disabled=!count||busy;
  $('#asset-list').querySelectorAll('input').forEach(input=>input.checked=selected.has(input.value));
}
async function refreshStorage(){
  const version=++storageVersion;releaseThumbnails();unused=[];selected.clear();$('#asset-list').replaceChildren();syncSelection();
  $('#storage-state').textContent='正在載入圖片與檢查完整引用…';
  for(const id of ['asset-total','asset-bytes','unused-total','unused-bytes'])$('#'+id).textContent='—';
  try{
    const result=await auditImages(dataStore);if(version!==storageVersion||selectedTab!==0)return;
    unused=result.unused;
    $('#asset-total').textContent=String(result.assets.length);$('#asset-bytes').textContent=bytes(result.assets.reduce((n,a)=>n+a.blob.size,0));
    $('#unused-total').textContent=String(unused.length);$('#unused-bytes').textContent=bytes(unused.reduce((n,a)=>n+a.blob.size,0));
    $('#storage-state').textContent=!result.assets.length?'尚未儲存任何圖片。':!unused.length?'沒有可安全清理的未使用圖片。':'以下圖片未被已保存資料、歷史、Undo／Redo 或編輯引用；暫存保護期內的圖片也不列入。';
    for(const asset of unused){const row=element('li');row.className='asset-row';const label=element('label'),input=element('input');input.type='checkbox';input.value=asset.id;input.setAttribute('aria-label','選取未使用圖片 '+asset.id);label.append(input);
      input.addEventListener('change',()=>{if(input.checked)selected.add(asset.id);else selected.delete(asset.id);syncSelection();});
      const image=element('img');image.alt='未使用圖片縮圖';image.loading='lazy';const url=URL.createObjectURL(asset.blob);thumbnailURLs.push(url);image.src=url;
      const info=element('div');info.append(element('p',asset.name||'檔名／名稱未記錄'),element('p',asset.id),element('p',time(asset.createdAt)),element('p',bytes(asset.blob.size)));row.append(label,image,info);$('#asset-list').append(row);
    }syncSelection();
  }catch(error){if(version===storageVersion)$('#storage-state').textContent='檢查失敗：'+error.message+' 沒有刪除任何圖片。';}
}
$('#refresh-storage').addEventListener('click',refreshStorage);
$('#select-all-assets').addEventListener('click',()=>{selected=new Set(unused.map(a=>a.id));syncSelection();});
$('#select-no-assets').addEventListener('click',()=>{selected.clear();syncSelection();});
let deleteSelection=[];
$('#delete-assets').addEventListener('click',()=>{deleteSelection=[...selected];$('#delete-confirm [data-dialog-error]').textContent='';$('#delete-summary').textContent=$('#selected-assets').textContent;$('#delete-confirm').showModal();});
$('#cancel-delete').addEventListener('click',()=>$('#delete-confirm').close());
$('#confirm-delete').addEventListener('click',()=>run(async()=>{
  const result=await deleteUnusedImages(dataStore,deleteSelection);$('#delete-confirm').close();
  notice(`已永久刪除 ${result.deleted} 張，實際釋放 ${bytes(result.bytes)}；跳過 ${result.skipped} 張已被引用、保護或不存在的圖片。`);await refreshStorage();
}));
for(const [id,trigger] of [['delete-confirm','delete-assets'],['restore-confirm','read-backup']]){
  const dialog=$('#'+id);dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});dialog.addEventListener('close',()=>$('#'+trigger).focus({preventScroll:true}));
}

let appearanceDraft={...dataStore.get().settings.appearance},appearanceDirty=false,appearanceRevision,releaseAppearance,draftPromise,previewVersion=0;
function renderAppearanceControls(){
  $('#theme-color').value=appearanceDraft.color;$('#theme-hex').value=appearanceDraft.color;$('#theme-font').value=appearanceDraft.font;
  applyAppearance(appearanceDraft,$('#appearance-preview'));
}
async function previewAppearance(changes){
  const version=previewVersion;
  try{
    normalizeSettings({appearance:{...appearanceDraft,...changes}});
    if(!appearanceDirty){
      if(!draftPromise)draftPromise=holdDraft('appearance');
      const release=await draftPromise;
      if(version!==previewVersion){release();return;}
      if(!appearanceDirty){releaseAppearance=release;appearanceRevision=dataStore.get().revision;appearanceDirty=true;}
    }
    appearanceDraft=normalizeSettings({appearance:{...appearanceDraft,...changes}}).appearance;
    $('#appearance-error').textContent='';renderAppearanceControls();
  }catch(error){$('#appearance-error').textContent=error.message;draftPromise=null;}
}
function cancelAppearance(){previewVersion++;releaseAppearance?.();releaseAppearance=null;draftPromise=null;appearanceDirty=false;appearanceDraft={...dataStore.get().settings.appearance};$('#appearance-error').textContent='';renderAppearanceControls();}
for(const color of ['#104a7a','#315e46','#744251','#605079','#b58a36','#eddfbc']){
  const button=element('button');button.type='button';button.style.setProperty('--swatch',color);button.setAttribute('aria-label','預覽主題色 '+color);button.addEventListener('click',()=>previewAppearance({color}));$('#theme-swatches').append(button);
}
$('#theme-color').addEventListener('input',event=>previewAppearance({color:event.target.value}));
$('#theme-hex').addEventListener('input',event=>{if(/^#[a-f0-9]{6}$/i.test(event.target.value))previewAppearance({color:event.target.value});else $('#appearance-error').textContent='請輸入完整 HEX 色碼，例如 #104A7A。';});
$('#theme-font').addEventListener('change',event=>previewAppearance({font:event.target.value}));
$('#reset-color').addEventListener('click',()=>previewAppearance({color:DEFAULT_APPEARANCE.color}));
$('#reset-font').addEventListener('click',()=>previewAppearance({font:DEFAULT_APPEARANCE.font}));
$('#reset-appearance').addEventListener('click',()=>previewAppearance({...DEFAULT_APPEARANCE}));
$('#cancel-appearance').addEventListener('click',cancelAppearance);
$('#save-appearance').addEventListener('click',()=>run(async()=>{
  if($('#appearance-error').textContent)throw new Error('請先修正外觀設定格式，或取消預覽。');
  if(!appearanceDirty){notice('沒有外觀變更需要儲存。');return;}
  if(dataStore.get().revision!==appearanceRevision)throw new Error('預覽期間資料已變更，請取消預覽後重新設定，避免覆蓋新資料。');
  const saved=await dataStore.transact({type:'appearance.update',label:'已更新外觀設定',target:'settings',fields:[],changes:{settings:{...dataStore.get().settings,appearance:appearanceDraft}}});
  cancelAppearance();notice(saved?'外觀已儲存並套用全站。':'沒有外觀變更需要儲存。');
}));
window.addEventListener('beforeunload',event=>{if(appearanceDirty){event.preventDefault();event.returnValue='';}});

function password(){const value=$('#backup-password').value;if(!value)throw new Error('請先輸入備份密碼。');return value;}
async function downloadCurrent(){
  const secret=$('#encrypt-backup').checked?password():'';
  await withBackup(dataStore,secret,blob=>downloadBlob(blob));
  $('#backup-password').value='';notice('已觸發備份下載；請確認瀏覽器是否已將檔案存入裝置。');
}
$('#download-backup').addEventListener('click',()=>run(downloadCurrent));
$('#download-before-restore').addEventListener('click',()=>run(async()=>{await withBackup(dataStore,$('#safety-backup-password').value,blob=>downloadBlob(blob));$('#safety-backup-password').value='';$('#safety-backup-status').textContent='已觸發目前資料備份下載，請確認裝置是否存檔。';}));
let prepared=null,restoreRevision=null;
async function previewRestore(file){
  // No writes occur before complete validation and explicit confirmation.
  prepared=await readBackup(file,$('#backup-password').value);$('#backup-password').value='';restoreRevision=dataStore.get().revision;
  $('#restore-confirm [data-dialog-error]').textContent='';$('#safety-backup-status').textContent='';$('#safety-backup-password').value='';
  const p=prepared.payload;$('#restore-summary').textContent=`備份時間：${time(p.createdAt)}；資料 ${p.dataCount} 筆，圖片 ${p.imageCount} 張；格式 v${p.formatVersion}、資料 v${p.dataVersion}。`;
  $('#restore-confirm').showModal();
}
$('#read-backup').addEventListener('click',()=>run(async()=>{const file=$('#restore-file').files[0];if(!file)throw new Error('請先選取本機備份檔。');await previewRestore(file);}));
$('#cancel-restore').addEventListener('click',()=>$('#restore-confirm').close());
$('#restore-confirm').addEventListener('close',()=>{prepared=null;restoreRevision=null;$('#safety-backup-password').value='';});
$('#confirm-restore').addEventListener('click',()=>run(async()=>{
  if(!prepared)throw new Error('請重新選取並驗證備份。');
  await restoreBackup(dataStore,prepared,restoreRevision);$('#restore-confirm').close();$('#restore-file').value='';cancelAppearance();
  notice('完整還原已完成，資料、設定、圖片與歷史已重新載入；不包含還原前的歷史。');if(selectedTab===0)await refreshStorage();
}));
function syncDrive(){for(const id of ['connect-drive','upload-drive','list-drive','disconnect-drive','revoke-drive'])$('#'+id).disabled=!driveConfigured||busy;}
$('#drive-state').textContent=driveConfigured?'已設定 Google OAuth；尚未連接。只在你主動操作時授權、上傳或讀取。':'Google 雲端備份尚未設定 OAuth client ID；本機備份與還原可正常使用。';
$('#connect-drive').addEventListener('click',()=>run(async()=>{const result=await connectDrive();$('#drive-state').textContent=result.needsClick?'Google 授權程式已載入，請再次點擊「連接 Google Drive」以開啟授權視窗。':'Google Drive 已連接；短期授權僅存於本頁記憶體。';}));
$('#upload-drive').addEventListener('click',()=>run(async()=>{const secret=password();await withBackup(dataStore,secret,(blob,payload)=>uploadDriveBackup(blob,payload));$('#backup-password').value='';notice('加密備份已上傳至 Google Drive 應用程式專用隱藏空間；本機資料與舊備份保留。');}));
$('#list-drive').addEventListener('click',()=>run(async()=>{
  const files=await listDriveBackups();$('#drive-list').replaceChildren();if(!files.length)$('#drive-list').append(element('li','尚無此應用程式建立的雲端備份。'));
  for(const file of files){const row=element('li'),button=element('button','驗證並預覽還原');button.type='button';
    row.append(element('p',file.name),element('p',`${time(file.appProperties?.backupTime??file.createdTime)} · ${bytes(Number(file.size)||0)} · 格式 v${file.appProperties?.lifeSystemFormat??'未知'}`),button);
    button.addEventListener('click',()=>run(async()=>previewRestore(await downloadDriveBackup(file))));$('#drive-list').append(row);
  }
}));
$('#disconnect-drive').addEventListener('click',()=>{disconnectDrive();$('#drive-list').replaceChildren();$('#drive-state').textContent='已中斷本頁連接；既有雲端備份沒有刪除。';});
$('#revoke-drive').addEventListener('click',()=>run(async()=>{await revokeDrive();$('#drive-list').replaceChildren();$('#drive-state').textContent='已撤銷授權；既有雲端備份沒有刪除。';}));
dataStore.subscribe(state=>{history.render(state);if(!appearanceDirty){appearanceDraft={...state.settings.appearance};renderAppearanceControls();}});
window.addEventListener('pagehide',()=>{storageVersion++;releaseThumbnails();releaseAppearance?.();});
window.addEventListener('pageshow',event=>{if(event.persisted){cancelAppearance();if(selectedTab===0)refreshStorage();}});
renderAppearanceControls();syncDrive();selectTab(0);
