import {documentTime} from './cloud-backup-policy.mjs';
import {cloudBackupLabel} from './cloud-backup-display.mjs';
import {initializeTaskDialogs} from './task-dialog-viewport.mjs?v=habits-20261026';
import {getCloudBackup} from './cloud-backup.mjs?v=habit-float-20261027';
import {initializeAISettings} from './ai-settings.mjs?v=habit-float-20261027';
import {validateNewPassword,validateRestorePassword,validHex} from './validation.mjs?v=habits-20261026';
import {dataStore,persistentUndo} from './data.mjs?v=habits-20261026';
import {createMobileTabPositioner} from './tab-position.mjs?v=habits-20261026';
import {createHistoryView} from './history-view.mjs?v=habits-20261026';
import {auditImages,deleteUnusedImages} from './image-references.mjs?v=habits-20261026';
import {normalizeSettings,applyAppearance} from './settings-model.mjs?v=habits-20261026';
import {holdDraft} from './coordination.mjs?v=habits-20261026';
import {withBackup,inspectBackupFile,readBackup,restoreBackup,downloadBlob} from './backup.mjs?v=habits-20261026';
import {driveConfigured,driveAuth,getDriveState,prepareDriveAuth,connectDrive,disconnectDrive} from './google-drive.mjs?v=habit-float-20261027';

export function mountSettings(root,context){
initializeTaskDialogs(root,context);
const $=selector=>root.querySelector(selector);
const element=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const notice=message=>{$('#operation-status').hidden=false;$('#operation-status').textContent=message;};
const bytes=value=>value<1024?value+' B':value<1024**2?(value/1024).toFixed(1)+' KiB':(value/1024**2).toFixed(2)+' MiB';
const time=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('zh-TW'):'建立時間未記錄';
let busy=false,aiConnection;
async function run(work,scope='page'){
  if(busy)return;const priorError=root.querySelector('dialog[open] [data-dialog-error]');if(priorError)priorError.textContent='';busy=true;root.setAttribute('aria-busy','true');document.body.setAttribute('aria-busy','true');context.notify();
  const buttons=[...root.querySelectorAll('button,input,select')].map(e=>[e,e.disabled]);buttons.forEach(([e])=>e.disabled=true);syncRestoreControls();
  try{return await work();}catch(error){const message=error.message||'操作失敗；原資料未清除。';if(scope==='drive')driveNotice(message);else notice(message);const target=root.querySelector('dialog[open] [data-dialog-error]');if(target)target.textContent=message;}
  finally{busy=false;root.removeAttribute('aria-busy');document.body.removeAttribute('aria-busy');context.notify();buttons.forEach(([e,disabled])=>{if(root.contains(e)&&!e.matches('[data-undo],[data-redo],#restore-confirm button,#restore-password'))e.disabled=disabled;});syncSelection();syncDrive();syncRestoreControls();if($('#restore-confirm').open)(prepared?$('#confirm-restore'):restoreEncrypted?$('#restore-password'):$('#cancel-restore')).focus({preventScroll:true});dataStore.notify();aiConnection?.notify();}
}
context.setHooks({busy:()=>busy});
const history=createHistoryView({store:dataStore,root,context});
const tabs=[...$('.settings-content > .activity-tabs').children],positionTabs=createMobileTabPositioner(tabs[0].parentElement);
let selectedTab=-1,storageLoaded=false;
const storageVisible=()=>context.active&&selectedTab===1&&$('#storage-section').open;
function selectTab(index,event){
  const changed=index!==selectedTab;selectedTab=index;
  tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;const panel=root.querySelector('#'+tab.getAttribute('aria-controls'));panel.hidden=i!==index;panel.inert=i!==index;});
  if(changed&&storageVisible()&&!storageLoaded)refreshStorage({preserveSelection:true});
  if(event)positionTabs(event);
}
root.querySelectorAll('.settings-disclosure > summary').forEach(summary=>summary.addEventListener('click',()=>positionTabs.cancel()));
tabs.forEach((tab,index)=>{tab.addEventListener('click',event=>selectTab(index,event));tab.addEventListener('keydown',event=>{const next={ArrowLeft:(index+1)%2,ArrowRight:(index+1)%2,Home:0,End:1}[event.key];if(next===undefined)return;event.preventDefault();selectTab(next,event);tabs[next].focus({preventScroll:true});});});
$('#storage-section').addEventListener('toggle',()=>{if(storageVisible()&&!storageLoaded)refreshStorage({preserveSelection:true});});
function reveal(url){
  const target=new URL(url,location.href),raw=(target.searchParams.get('tab')||target.searchParams.get('section')||target.hash.slice(1)).replace(/-(?:tab|panel|section)$/,'');
  const aliases={appearance:'appearance',ai:'ai',drive:'drive','drive-backup-title':'drive',backup:'backup',storage:'storage',history:'history',general:'general',management:'management'};
  const key=aliases[raw];if(!key)return null;
  selectTab(['backup','storage','history','management'].includes(key)?1:0);
  const section=$('#'+key+'-section');if(section){section.open=true;if(key==='storage'&&!storageLoaded)refreshStorage();return $('#'+key+'-tab');}
  return $('#'+key+'-tab');
}
context.onSuspend(()=>{positionTabs.cancel();storageVersion++;});
context.onResume(()=>{if(storageVisible()&&!storageLoaded)refreshStorage({preserveSelection:true});});

let unused=[],selected=new Set(),thumbnailURLs=[],storageVersion=0;
function releaseThumbnails(){thumbnailURLs.forEach(url=>URL.revokeObjectURL(url));thumbnailURLs=[];}
function syncSelection(){
  const count=selected.size,size=unused.filter(a=>selected.has(a.id)).reduce((n,a)=>n+a.blob.size,0);
  $('#selected-assets').textContent=`已選取 ${count} 張，預計釋放 ${bytes(size)}`;
  $('#delete-assets').disabled=!count||busy;
  $('#select-all-assets').disabled=!unused.length||busy;$('#select-no-assets').disabled=!count||busy;
  $('#asset-list').querySelectorAll('input').forEach(input=>input.checked=selected.has(input.value));
}
async function refreshStorage(options={}){
  storageLoaded=false;
  const retained=options.preserveSelection?new Set(selected):new Set();
  const version=++storageVersion;releaseThumbnails();unused=[];selected=retained;$('#asset-list').replaceChildren();syncSelection();
  $('#storage-state').textContent='正在載入圖片與檢查完整引用…';
  for(const id of ['asset-total','asset-bytes','unused-total','unused-bytes'])$('#'+id).textContent='—';
  try{
    const result=await auditImages(dataStore);if(version!==storageVersion||!context.active)return;storageLoaded=true;
    unused=result.unused;selected=new Set([...selected].filter(id=>unused.some(asset=>asset.id===id)));
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

let appearanceDraft={...dataStore.get().settings.appearance},appearanceDirty=false,appearanceInput=false,appearanceRevision,releaseAppearance,draftPromise,previewVersion=0;
function renderAppearanceControls(){
  $('#theme-color').value=appearanceDraft.color;$('#theme-hex').value=appearanceDraft.color;$('#theme-font').value=appearanceDraft.font;
  applyAppearance(appearanceDraft,$('#appearance-preview'));
  const selected=appearanceDraft.font;$('#font-load-state').textContent='字型載入中；可繼續操作。';
  const family=getComputedStyle($('#appearance-preview')).fontFamily.split(',')[0];
  const load=()=>document.fonts.load('16px '+family,'繁體中文 Life 123').then(fonts=>{if(appearanceDraft.font===selected)$('#font-load-state').textContent=selected==='device'?'使用裝置字型。':fonts.length?'預覽字型已載入。':'目前使用備援字型；可繼續操作。';}).catch(()=>{if(appearanceDraft.font===selected)$('#font-load-state').textContent='字型載入失敗，使用備援字型；可繼續操作。';});
  const link=document.querySelector(`link[data-selected-font="${selected}"]`);
  if(link&&!link.sheet){link.addEventListener('load',load,{once:true});link.addEventListener('error',()=>{if(appearanceDraft.font===selected)$('#font-load-state').textContent='字型載入失敗，使用備援字型；可繼續操作。';},{once:true});}else load();
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
function cancelAppearance(){previewVersion++;releaseAppearance?.();releaseAppearance=null;draftPromise=null;appearanceDirty=false;appearanceInput=false;appearanceDraft={...dataStore.get().settings.appearance};$('#appearance-error').textContent='';renderAppearanceControls();}
for(const color of ['#104a7a','#315e46','#744251','#605079','#eddfbc']){
  const button=element('button');button.type='button';button.style.setProperty('--swatch',color);button.setAttribute('aria-label','預覽主題色 '+color);button.addEventListener('click',()=>previewAppearance({color}));$('#theme-swatches').append(button);
}
$('#theme-color').addEventListener('input',event=>previewAppearance({color:event.target.value}));
$('#theme-hex').addEventListener('input',event=>{appearanceInput=true;if(validHex(event.target.value))previewAppearance({color:event.target.value});else $('#appearance-error').textContent='請輸入完整 HEX 色碼，例如 #104A7A。';});
$('#theme-font').addEventListener('change',event=>previewAppearance({font:event.target.value}));
$('#cancel-appearance').addEventListener('click',cancelAppearance);
$('#save-appearance').addEventListener('click',()=>run(async()=>{
  if($('#appearance-error').textContent)throw new Error('請先修正外觀設定格式，或取消預覽。');
  if(!appearanceDirty){notice('沒有外觀變更需要儲存。');return;}
  if(dataStore.get().revision!==appearanceRevision)throw new Error('預覽期間資料已變更，請取消預覽後重新設定，避免覆蓋新資料。');
  const saved=await dataStore.transact({type:'appearance.update',label:'已更新外觀設定',target:'settings',fields:[],changes:{settings:{...dataStore.get().settings,appearance:appearanceDraft}}});
  cancelAppearance();notice(saved?'外觀已儲存並套用全站。':'沒有外觀變更需要儲存。');
}));

async function downloadCurrent(){
  const secret=validateNewPassword($('#backup-password').value);
  try{await withBackup(dataStore,secret,blob=>downloadBlob(blob));notice('已觸發備份下載；請確認瀏覽器是否已將檔案存入裝置。');}
  finally{$('#backup-password').value='';}
}
$('#download-backup').addEventListener('click',()=>run(downloadCurrent));
let prepared=null,restoreRevision=null,restoreFile=null,restoreGeneration=0,restoreEncrypted=false;
function syncRestoreControls(){
  const open=$('#restore-confirm').open,ready=open&&Boolean(prepared),unlock=open&&restoreEncrypted&&!ready;
  $('#restore-unlock').hidden=!unlock;
  $('#unlock-restore').hidden=!unlock;$('#unlock-restore').disabled=busy||!unlock;
  $('#confirm-restore').hidden=!ready;$('#confirm-restore').disabled=busy||!ready;
  $('#restore-password').disabled=busy||!unlock;$('#cancel-restore').disabled=busy;
  $('#restore-warning').hidden=!ready;
}
function clearRestore(){restoreGeneration++;prepared=null;restoreRevision=null;restoreFile=null;restoreEncrypted=false;$('#restore-password').value='';$('#restore-summary').textContent='';syncRestoreControls();}
async function validateRestore(){
  if(!$('#restore-confirm').open||!restoreFile||prepared)return;
  const generation=restoreGeneration,file=restoreFile;prepared=null;syncRestoreControls();
  try{
    const result=await readBackup(file,validateRestorePassword($('#restore-password').value));
    if(generation!==restoreGeneration||!$('#restore-confirm').open)return;
    prepared=result;restoreRevision=dataStore.get().revision;$('#restore-password').value='';
    const p=result.payload;$('#restore-summary').textContent=`備份時間：${time(p.createdAt)}；資料 ${p.dataCount} 筆，圖片 ${p.imageCount} 張；格式 v${p.formatVersion}、資料 v${p.dataVersion}。`;
  }catch(error){if(generation===restoreGeneration)throw error;}
  finally{if(generation===restoreGeneration){$('#restore-password').value='';syncRestoreControls();}}
}
async function previewRestore(file){
  clearRestore();const generation=restoreGeneration;const outer=await inspectBackupFile(file);if(generation!==restoreGeneration)return;restoreFile=file;restoreEncrypted=outer.encrypted;
  $('#restore-confirm [data-dialog-error]').textContent='';$('#restore-confirm').showModal();syncRestoreControls();
  if(outer.encrypted){$('#restore-summary').textContent='請輸入此備份的還原密碼。';$('#restore-password').focus();}
  else await validateRestore();
}
$('#restore-file').addEventListener('change',()=>{if($('#restore-confirm').open)$('#restore-confirm').close();clearRestore();const file=$('#restore-file').files[0];if(file)run(async()=>{await inspectBackupFile(file);notice('已辨識備份外層格式；點擊「驗證與還原」繼續。');});});
$('#read-backup').addEventListener('click',()=>run(async()=>{const file=$('#restore-file').files[0];if(!file){document.dispatchEvent(new Event('life-system:restore-cloud-latest'));return;}await previewRestore(file);}));
$('#unlock-restore').addEventListener('click',()=>run(validateRestore));
$('#restore-password').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();run(validateRestore);}});
$('#cancel-restore').addEventListener('click',()=>$('#restore-confirm').close());
$('#restore-confirm').addEventListener('close',()=>{if(!$('#restore-confirm').open)clearRestore();});
$('#confirm-restore').addEventListener('click',()=>run(async()=>{
  if(!prepared)throw new Error('請先解密並完成備份驗證。');
  await restoreBackup(dataStore,prepared,restoreRevision);cloudBackup.setLocalDataTime(documentTime(prepared.payload.document)??prepared.payload.createdAt);$('#restore-confirm').close();$('#restore-file').value='';cancelAppearance();
  notice('完整還原已完成，資料、設定、圖片與歷史已重新載入；不包含還原前的歷史。');if(selectedTab===0)await refreshStorage();
}));
const cloudBackup=getCloudBackup();let versionsLoading=false,versionsGeneration=0,listedAt=0,connectedBefore=false;
function driveNotice(message){$('#cloud-backup-status').textContent=String(message??'');}
function syncDrive(){const auth=getDriveState();$('#connect-drive').disabled=!driveConfigured||busy||!auth.sdkReady;$('#disconnect-drive').disabled=busy||!auth.connected;$('#upload-drive').disabled=!driveConfigured||busy||!auth.connected;$('#drive-version').disabled=busy||!auth.connected||versionsLoading;$('#restore-cloud-latest').disabled=busy||!auth.connected;}
async function refreshDriveVersions({quiet=false}={}){if(!getDriveState().connected||versionsLoading)return;versionsLoading=true;const generation=++versionsGeneration,selected=$('#drive-version').value,oldLabel=$('#drive-version').selectedOptions[0]?.textContent;syncDrive();try{const files=await cloudBackup.list();if(generation!==versionsGeneration||!getDriveState().connected)return;const select=$('#drive-version');select.replaceChildren(new Option(files.length?'雲端版本':'尚無雲端版本',''));for(const file of files)select.append(new Option(cloudBackupLabel(file),file.id));if(selected&&!files.some(file=>file.id===selected)){const option=new Option((oldLabel??'所選版本')+'（已不存在）',selected);option.disabled=true;select.append(option);}select.value=selected;listedAt=Date.now();if(!quiet&&!files.length)driveNotice('尚無可還原的雲端備份。');}catch(error){if(generation===versionsGeneration)driveNotice(error.message);}finally{if(generation===versionsGeneration){versionsLoading=false;syncDrive();}}}
context.subscribe(cloudBackup,state=>{if(state.busy||state.pending||/失敗|未完成|已更新|錯誤|暫停|較舊|比最新/.test(state.message))driveNotice(state.message+(state.pending?'（待備份 '+state.pending+' 筆）':''));if(!state.busy&&!state.pending&&/已更新/.test(state.message)&&context.active)void refreshDriveVersions({quiet:true});});
context.subscribe(driveAuth,auth=>{const connected=auth.connected;$('#drive-state').textContent='連接狀態：'+(connected?'Google Drive 已連接。':'尚未連接 Google Drive。');if(auth.sdkState==='loading')driveNotice('正在準備 Google 登入…');else if(auth.sdkError)driveNotice(auth.sdkError);if(connected&&!connectedBefore)void refreshDriveVersions();if(!connected&&connectedBefore){versionsGeneration++;versionsLoading=false;$('#drive-version').replaceChildren(new Option('雲端版本',''));}connectedBefore=connected;syncDrive();});
$('#connect-drive').addEventListener('click',()=>run(async()=>{await connectDrive();driveNotice('Google Drive 已連接。');await refreshDriveVersions();},'drive'));
$('#upload-drive').addEventListener('click',()=>run(async()=>{await cloudBackup.backupNow();driveNotice('雲端備份已更新。');await refreshDriveVersions({quiet:true});},'drive'));
$('#restore-cloud-latest').addEventListener('click',()=>document.dispatchEvent(new CustomEvent('life-system:restore-cloud-latest',{detail:{versionId:$('#drive-version').value||null}})));
$('#drive-version').addEventListener('focus',()=>{if(Date.now()-listedAt>30000)void refreshDriveVersions({quiet:true});});
$('#disconnect-drive').addEventListener('click',()=>{disconnectDrive();driveNotice('已中斷連接，既有雲端備份保留。');});
context.listen(document,'life-system:cloud-restore-status',event=>driveNotice(event.detail.message));
if(driveConfigured)void prepareDriveAuth().then(()=>{if(!getDriveState().connected)driveNotice('Google 登入已準備好，請點選連接Google。');syncDrive();}).catch(error=>{driveNotice(error.message);syncDrive();});else driveNotice('Google 連接尚未設定；本機備份仍可使用。');
let storageRevision=dataStore.get().revision;
context.subscribe(dataStore,state=>{if(state.revision!==storageRevision){storageRevision=state.revision;storageLoaded=false;}history.render(state);if(!appearanceDirty&&!appearanceInput){appearanceDraft={...state.settings.appearance};renderAppearanceControls();}});
context.listen(window,'pagehide',()=>{storageVersion++;releaseThumbnails();releaseAppearance?.();clearRestore();for(const id of ['backup-password'])$('#'+id).value='';});
context.listen(window,'pageshow',event=>{if(event.persisted){cancelAppearance();if(storageVisible())refreshStorage();}});
aiConnection=initializeAISettings(root,context);
renderAppearanceControls();syncDrive();selectTab(0);
const hasAIInput=context.hooks.hasDraft;
context.setHooks({hasDraft:()=>Boolean(appearanceDirty||appearanceInput||$('#backup-password').value||$('#restore-file').files.length||hasAIInput?.()),reveal});
return {reveal};

}
