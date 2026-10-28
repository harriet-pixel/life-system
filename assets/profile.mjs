import {bindProfileValidation} from './validation.mjs?v=storage-rescue-20261028';
import { holdDraft } from './coordination.mjs?v=storage-rescue-20261028';
import { createProfileImages } from './profile-images.mjs?v=storage-rescue-20261028';
import { imageURL, prepareImageReferences } from './image-store.mjs?v=storage-rescue-20261028';
import { ABILITIES, validateManualStats, createInitialStats } from './abilities.mjs?v=storage-rescue-20261028';
import { undoManager } from './undo.mjs?v=storage-rescue-20261028';
import { dataStore, formatSI, validateProfile, abilityRatios, profileSummary, visibleExperience } from './data.mjs?v=storage-rescue-20261028';

export function mountProfile(root,context){
const $ = selector => root.querySelector(selector);
const notice = message => { $('#operation-status').hidden = false; $('#operation-status').textContent = message; };
let renderedImageVersion = 0;
const photoFrame = $('.photo-frame');
const photoImage = $('#user-photo');
const defaultAvatar = $('#default-avatar');
const avatarImage = $('#user-avatar'), avatarPlaceholder = $('#avatar-placeholder');
async function renderPhoto() {
  const version=++renderedImageVersion;
  const current=dataStore.get();
  let photo,avatar;
  try { [photo,avatar]=await Promise.all([imageURL(current.photo),imageURL(current.avatar)]); }
  catch(error) { notice(error.message);return; }
  if(version!==renderedImageVersion)return;
  const avatarFrame = $('.user-avatar-frame');
  if (avatar) { avatarImage.removeAttribute('hidden'); if (avatarImage.getAttribute('src') !== avatar) avatarImage.src = avatar; avatarFrame.replaceChildren(avatarImage); }
  else { avatarFrame.replaceChildren(avatarPlaceholder); }
  // Keep only one element in the frame. A stale stylesheet or SVG visibility
  // difference cannot leave the placeholder occupying a second grid row.
  if (photo) {
    photoImage.removeAttribute('hidden');
    if (photoImage.getAttribute('src') !== photo) photoImage.src = photo;
    photoFrame.replaceChildren(photoImage);
  } else {
    photoImage.removeAttribute('src');
    defaultAvatar.removeAttribute('hidden');
    photoFrame.replaceChildren(defaultAvatar);
  }
}
function element(tag, text) { const el = document.createElement(tag); el.textContent = text; return el; }
function renderRadar() {
  const container = $('#ability-radar');
  const abilities = dataStore.get().stats.abilities;
  const width = container.getBoundingClientRect().width;
  if (!width || abilities.length !== 5) return;
  // Work in rendered pixels so labels retain the normal body size at every width.
  const fontSize = parseFloat(getComputedStyle(container).fontSize);
  const values = abilities.map(a => formatSI(a.value));
  const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
  context.font = `${fontSize}px ${getComputedStyle(container).fontFamily}`;
  let labelWidth = Math.max(...abilities.map(a => context.measureText(a.name).width));
  context.font = `${fontSize * .75}px ${getComputedStyle(container).fontFamily}`;
  labelWidth = Math.max(labelWidth, ...values.map(value => context.measureText(value).width));
  const availableRadius = Math.max(0, (width / 2 - labelWidth / 2 - 12) / Math.sin(2*Math.PI/5));
  const gap = Math.min(Math.max(36, fontSize * 2.5), availableRadius / 2);
  const radius = Math.max(0,Math.min(width * .34, availableRadius - gap));
  const labelRadius = radius + gap, verticalLabelRadius = Math.max(labelRadius, fontSize * 4);
  const cx = width / 2, cy = verticalLabelRadius + fontSize + 12;
  const height = cy + verticalLabelRadius + fontSize * 2.5 + 12;
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', abilities.map(a => `${a.name}：${a.value}`).join('，'));
  const draw = (tag, attrs) => { const node = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([key,value]) => node.setAttribute(key,value)); svg.append(node); return node; };
  const point = (i, distance) => { const angle = -Math.PI/2 + i*2*Math.PI/5; return [cx+Math.cos(angle)*distance, cy+Math.sin(angle)*distance]; };
  for (const scale of [.25,.5,.75,1]) draw('polygon', {points: abilities.map((_,i)=>point(i,radius*scale).join(',')).join(' '),fill:'none',stroke:'var(--color-border)'});
  abilities.forEach((_,i)=>{const [x,y]=point(i,radius);draw('line',{x1:cx,y1:cy,x2:x,y2:y,stroke:'var(--color-border)'});});
  draw('polygon', {class:'ability-shape',points:abilityRatios(abilities).map((ratio,i)=>point(i,radius*ratio).join(',')).join(' '),fill:'var(--color-primary)','fill-opacity':'.15',stroke:'var(--color-primary)'});
  abilities.forEach((ability,i)=>{
    const angle = -Math.PI/2 + i*2*Math.PI/5;
    const x = cx + Math.cos(angle)*labelRadius, y = cy + Math.sin(angle)*verticalLabelRadius;
    const name = draw('text',{class:'ability-name',x,y,'text-anchor':'middle','dominant-baseline':'middle'});
    name.style.fontSize = `${fontSize}px`; name.textContent = ability.name;
    const value = draw('text',{class:'ability-value',x,y:y+fontSize*1.4,'text-anchor':'middle','dominant-baseline':'middle'});
    value.style.fontSize = `${fontSize*.75}px`; value.textContent = values[i];
    const title = document.createElementNS(ns,'title'); title.textContent = String(ability.value); value.append(title);
  });
  container.replaceChildren(svg);
}
context.observe(new ResizeObserver(renderRadar),[$('#ability-radar')]);
document.fonts.ready.then(renderRadar);
function render() {
  const state = dataStore.get();
  $('#profile-name').textContent = state.profile.name || '尚未設定稱呼';
  const motto=(state.profile.motto ?? '').trim();
  $('#profile-motto').textContent=motto;$('#profile-motto').hidden=!motto;
  renderPhoto();
  const { experience, level, currency, abilities } = state.stats;
  const [experienceText,levelText,currencyText]=profileSummary(state.stats).split(' ｜ ');
  const levelLabel=element('span',levelText);levelLabel.id='profile-level';
  $('#profile-stats').replaceChildren(levelLabel,element('span',` ｜ ${experienceText}｜ ${currencyText}`));
  $('#profile-stats').setAttribute('aria-label', `等級：${level}，累積總經驗值：${visibleExperience(experience)}，貨幣：${currency}`);
  $('#profile-stats').title = `等級：${level}，累積總經驗值：${visibleExperience(experience)}，貨幣：${currency}`;
  const missing=ABILITIES.filter(def=>!abilities.some(a=>a.id===def.id&&a.name===def.name&&Number.isSafeInteger(a.value)&&a.value>=0));
  const valid = ABILITIES.length===5&&missing.length===0;
  $('#abilities-missing').textContent=valid?'':`能力資料不完整：${missing.map(a=>a.name).join('、')||'能力定義'}，請檢查已保存資料。`;
  $('#abilities-missing').hidden = valid; $('.ability-charts').hidden = !valid;
  if (valid) renderRadar();

}
const desktopPanels = matchMedia('(min-width:1024px)');
function positionResponsiveContent(){(desktopPanels.matches?$('.profile-portrait-column'):$('.profile-content')).append($('#operation-status'));}
positionResponsiveContent();context.listen(desktopPanels,'change',positionResponsiveContent);context.onResume(positionResponsiveContent);
const dialog = $('#profile-dialog'), form = $('#profile-form');
const personalKeys = ['name', 'age', 'gender', 'bio', 'boundaries', 'motto'];
const genderChoices=[...form.querySelectorAll('[name="gender-choice"]')];
function syncGenderChoices(){genderChoices.forEach(input=>input.checked=input.value===form.elements.gender.value);}
genderChoices.forEach(input=>input.addEventListener('change',()=>{form.elements.gender.value=input.checked?input.value:'';syncGenderChoices();}));
const numericFields = [{ id:'currency', name:'貨幣量' }, { id:'level', name:'等級' }, ...ABILITIES];
for (const field of numericFields) {
  const label = element('label', field.name);
  const input = document.createElement('input'); input.name = field.id; input.inputMode = 'numeric'; input.setAttribute('aria-describedby', `${field.id}-error`);
  const error = element('span', ''); error.id = `${field.id}-error`; error.className = 'field-error';
  label.append(input,error); $(ABILITIES.some(a=>a.id===field.id) ? '#manual-abilities' : '#manual-fields').append(label);
}
const settingTabs = [...$('#settings-tabs').querySelectorAll('button')];
function selectSetting(index) {
  settingTabs.forEach((tab,i) => { tab.setAttribute('aria-selected',String(i===index)); tab.tabIndex = i===index ? 0 : -1; root.querySelector("#"+CSS.escape(tab.getAttribute('aria-controls'))).hidden = i!==index; });
}
settingTabs.forEach((tab,i) => {
  tab.addEventListener('click',()=>selectSetting(i));
  tab.addEventListener('keydown',event=>{
    const target={ArrowLeft:(i+2)%3,ArrowRight:(i+1)%3,Home:0,End:2}[event.key];
    if (target === undefined) return;
    event.preventDefault();selectSetting(target);settingTabs[target].focus();
  });
});
const imageTabs=[...$('#image-tabs').querySelectorAll('button')];
function selectImage(index) {
  imageTabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;root.querySelector("#"+CSS.escape(tab.getAttribute('aria-controls'))).hidden=i!==index;});
}
imageTabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>selectImage(index));
  tab.addEventListener('keydown',event=>{const next={ArrowLeft:(index+imageTabs.length-1)%imageTabs.length,ArrowRight:(index+1)%imageTabs.length,Home:0,End:imageTabs.length-1}[event.key];if(next===undefined)return;event.preventDefault();selectImage(next);imageTabs[next].focus();});
});
let releaseDraft,openingProfile=false;
bindProfileValidation(form,()=>baseState?.profile);
let baseState,saving=false,saveVersion=0,imageBusy=false,initialFields={};
const unsavedDialog=$('#unsaved-settings-dialog');
let backdropPointer=null,settingsFocus=null,restoreSettingsFocus=true;
function hasUnsavedChanges(){
  if(Object.entries(initialFields).some(([key,value])=>form.elements[key].value!==value)||imageDraft.hasChanges)return true;
  return false;
}
function syncSaveButtons(){
  context.notify();$('#save-settings').disabled=saving||imageBusy;$('#save-unsaved-settings').disabled=saving||imageBusy;}
function requestBackdropClose(focus){
  if(!dialog.open||saving||unsavedDialog.open)return;
  if(!hasUnsavedChanges()){dialog.close();return;}
  settingsFocus=focus?.isConnected?focus:$('#settings-tabs button[aria-selected="true"]');
  restoreSettingsFocus=true;syncSaveButtons();unsavedDialog.showModal();
}
function outsideSettings(event){const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;}
dialog.addEventListener('pointerdown',event=>{
  backdropPointer=event.isPrimary&&event.button===0&&event.target===dialog&&outsideSettings(event)?{id:event.pointerId,x:event.clientX,y:event.clientY,focus:dialog.contains(document.activeElement)&&document.activeElement!==dialog?document.activeElement:null}:null;
});
dialog.addEventListener('pointerup',event=>{
  const down=backdropPointer;backdropPointer=null;
  if(down&&down.id===event.pointerId&&event.target===dialog&&outsideSettings(event)&&Math.hypot(event.clientX-down.x,event.clientY-down.y)<=8)requestBackdropClose(down.focus);
});
dialog.addEventListener('pointercancel',()=>backdropPointer=null);
unsavedDialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const buttons=[...unsavedDialog.querySelectorAll('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});
function restoreFocusToSettings(){
  if(!restoreSettingsFocus||!dialog.open||unsavedDialog.open)return;
  const target=settingsFocus?.isConnected&&settingsFocus.getClientRects().length&&!settingsFocus.disabled?settingsFocus:$('#settings-tabs button[aria-selected="true"]');
  target.focus({preventScroll:true});
}
function cancelUnsavedPrompt(){unsavedDialog.close();restoreFocusToSettings();}
unsavedDialog.addEventListener('close',restoreFocusToSettings);
unsavedDialog.addEventListener('cancel',event=>{event.preventDefault();cancelUnsavedPrompt();});
$('#cancel-unsaved-settings').addEventListener('click',cancelUnsavedPrompt);
$('#save-unsaved-settings').addEventListener('click',()=>{if(saving||imageBusy)return;restoreSettingsFocus=false;unsavedDialog.close();form.requestSubmit($('#save-settings'));});
function clearErrors() {
  form.querySelectorAll('.field-error').forEach(el=>el.textContent='');
  form.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));
  $('#form-error').textContent='';
}
function fieldError(key,message,index) {
  selectSetting(index);if(ABILITIES.some(a=>a.id===key))$('#ability-edit-details').open=true;
  if(key==='photo')selectImage(0);if(key==='avatar')selectImage(1);if(key==='portraits')selectImage(2);
  $('#form-error').textContent=message;const input=key==='photo'?$('#choose-photo'):key==='avatar'?$('#choose-avatar'):key==='portraits'?$('#portrait-library'):form.elements[key];
  root.querySelector("#"+CSS.escape(`${key}-error`)).textContent=message;input.setAttribute('aria-invalid','true');input.focus();
}
const imageDraft=createProfileImages({root,onError:(key,message)=>fieldError(key,message,1),onSelect:selectImage,onBusy:busy=>{imageBusy=busy;syncSaveButtons();}});
function lockSave(value){saving=value;syncSaveButtons();$('.settings-scroll').inert=value;$('#settings-tabs').inert=value;}
$('#edit-profile').addEventListener('click',async()=>{
  if(openingProfile||dialog.open)return;openingProfile=true;
  try {releaseDraft=await holdDraft();} catch(error){notice(error.message);return;} finally{openingProfile=false;}
  if(!context.active){releaseDraft?.();releaseDraft=null;return;}
  baseState=dataStore.get();$('#values-reset-status').textContent='';saveVersion++;lockSave(false);$('#ability-edit-details').open=false;
  personalKeys.forEach(key=>{form.elements[key].value=baseState.profile[key];form.elements[key].dispatchEvent(new Event('profile-populate'));});
  syncGenderChoices();
  numericFields.forEach(({id})=>form.elements[id].value=id in baseState.stats?baseState.stats[id]:baseState.stats.abilities.find(a=>a.id===id).value);
  initialFields=Object.fromEntries([...personalKeys,...numericFields.map(field=>field.id)].map(key=>[key,form.elements[key].value]));
  backdropPointer=null;clearErrors();selectSetting(0);selectImage(0);dialog.showModal();imageDraft.open(baseState);
});
const restartDialog=$('#restart-confirm');let restarting=false;
$('#restart-values').addEventListener('click',()=>{
 if(saving||imageBusy||restarting)return;
 const dirty=numericFields.some(({id})=>form.elements[id].value!==initialFields[id]);
 $('#restart-draft-warning').textContent=dirty?'尚未保存的數值草稿將被初始值取代；基本資料與圖片草稿保留。':'確認後立即保存，不需再按使用者設定的儲存；之後取消設定也不會撤銷。';
 $('#restart-error').textContent='';restartDialog.showModal();
});
$('#cancel-restart').addEventListener('click',()=>restartDialog.close());
restartDialog.addEventListener('cancel',event=>{if(restarting)event.preventDefault();});
restartDialog.addEventListener('close',()=>{if(dialog.open)$('#restart-values').focus();});
$('#confirm-restart').addEventListener('click',async()=>{
 if(restarting)return;restarting=true;$('#confirm-restart').disabled=true;$('#cancel-restart').disabled=true;lockSave(true);
 try{
  // A draft shared lock does not conflict with the write lock. No maintenance
  // lock is acquired, and the existing personal/image draft stays protected.
  if(dataStore.get().revision!==baseState.revision)throw new Error('資料已在其他頁面更新；草稿保留，請取消後重新開啟設定。');
  const stats=createInitialStats();await dataStore.transact({type:'stats.restart',label:'已重新開始數值',target:'user',fields:['restart'],changes:{stats}});
  baseState={...baseState,stats:dataStore.get().stats,revision:dataStore.get().revision};
  numericFields.forEach(({id})=>{const value=id in baseState.stats?baseState.stats[id]:baseState.stats.abilities.find(a=>a.id===id).value;form.elements[id].value=String(value);initialFields[id]=String(value);});
  clearErrors();$('#values-reset-status').textContent='數值已立即重設並保存；如需撤銷，請使用 Undo。';restartDialog.close();
 }catch(error){$('#restart-error').textContent=error.message;}
 finally{restarting=false;$('#confirm-restart').disabled=false;$('#cancel-restart').disabled=false;lockSave(false);}
});
$('#cancel-profile').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{releaseDraft?.();releaseDraft=null;backdropPointer=null;if(unsavedDialog.open){restoreSettingsFocus=false;unsavedDialog.close();}if(restartDialog.open)restartDialog.close();saveVersion++;imageDraft.close();lockSave(false);$('#edit-profile').focus();});
form.addEventListener('submit',async event=>{
  event.preventDefault();if(saving)return;clearErrors();
  let profile,stats;
  try{profile=validateProfile(Object.fromEntries(new FormData(form)),baseState.profile);}catch(error){fieldError(error.field??'age',error.message,0);return;}
  try{stats=validateManualStats(Object.fromEntries(new FormData(form)),baseState.stats);}catch(error){fieldError(error.field,error.message,2);return;}
  if(imageBusy){$('#form-error').textContent='圖片處理中，請稍候再儲存。';return;}
  const version=++saveVersion;lockSave(true);
  try{
    const images=await imageDraft.collect();
    const storedImages=await prepareImageReferences(images);
    if(!dialog.open||version!==saveVersion)return;
    if(dataStore.get().revision!==baseState.revision)throw new Error('資料已在其他頁面更新；草稿已保留，請取消後重新開啟設定，以免覆蓋新資料。');
    const changed=personalKeys.filter(key=>profile[key]!==baseState.profile[key]);
    for(const{id}of numericFields){const before=id in baseState.stats?baseState.stats[id]:baseState.stats.abilities.find(a=>a.id===id).value;const after=id in stats?stats[id]:stats.abilities.find(a=>a.id===id).value;if(before!==after)changed.push(id);}
    for(const[key,value]of Object.entries(storedImages))if(JSON.stringify(value)!==JSON.stringify(baseState[key]??null))changed.push(key);
    const saved=await dataStore.transact({type:'settings.update',label:'已更新使用者設定',target:'user',fields:changed,changes:{profile,stats,...storedImages}});
    dialog.close();notice(saved?'使用者設定已儲存。':'沒有變更需要儲存。');
  }catch(error){if(dialog.open&&version===saveVersion){lockSave(false);if(error.field)fieldError(error.field,error.message,1);else $('#form-error').textContent=error.message;}}
  finally{if(version===saveVersion)lockSave(false);}
});

context.subscribe(dataStore,render);

context.setHooks({hasDraft:()=>dialog.open&&hasUnsavedChanges(),busy:()=>saving||imageBusy||restarting});

}
