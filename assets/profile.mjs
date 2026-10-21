import { createMobileTabPositioner } from './tab-position.mjs?v=mobile-tabs-8';
import { createAvatarCropper, readImageFile, decodeImage } from './avatar-crop.mjs?v=profile-5';
import { ABILITIES, validateManualStats } from './abilities.mjs?v=redo-17';
import { undoManager } from './undo.mjs?v=redo-17';
import { dataStore, formatSI, validateProfile, abilityRatios, profileSummary } from './data.mjs?v=redo-17';
import { initializeNavigation } from './navigation.mjs?v=redo-17';
const $ = selector => document.querySelector(selector);
const fields = { name: '稱呼', age: '年紀', gender: '性別', bio: '個人簡介', boundaries: '禁忌', motto: '一句話已變更', experience: '總經驗值', currency: '貨幣', photo: '使用者立繪', avatar: '使用者頭像', level: '等級', ...Object.fromEntries(ABILITIES.map(a => [a.id, a.name])) };
const notice = message => { $('#operation-status').hidden = false; $('#operation-status').textContent = message; };
let photoSelection = 0;
const photoFrame = $('.photo-frame');
const photoImage = $('#user-photo');
const defaultAvatar = $('#default-avatar');
const avatarImage = $('#user-avatar'), avatarPlaceholder = $('#avatar-placeholder');
function renderPhoto() {
  const {photo,avatar} = dataStore.get();
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
  const radius = Math.min(width * .26775, availableRadius - gap);
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
new ResizeObserver(renderRadar).observe($('#ability-radar'));
document.fonts.ready.then(renderRadar);
function render() {
  const state = dataStore.get();
  $('#profile-name').textContent = state.profile.name || '尚未設定稱呼';
  $('#profile-age').textContent = state.profile.age === '' ? '' : `${state.profile.age} 歲`;
  const motto=(state.profile.motto ?? '').trim();
  $('#profile-motto').textContent=motto;$('#profile-motto').hidden=!motto;
  renderPhoto();
  const { experience, level, currency, abilities } = state.stats;
  $('#profile-stats').textContent = profileSummary(state.stats);
  $('#profile-stats').setAttribute('aria-label', `累積總經驗值：${experience}，等級：${level}，貨幣：${currency}`);
  $('#profile-stats').title = `累積總經驗值：${experience}，等級：${level}，貨幣：${currency}`;
  const valid = abilities.length === 5;
  $('#abilities-missing').hidden = valid; $('.ability-charts').hidden = !valid;
  if (valid) renderRadar();
  renderHistory(state);
}
const HISTORY_PAGE_SIZE = 10;
let historyPage = 1, lastHistoryId = null;
function renderHistory(state = dataStore.get()) {
  const newest = state.history.at(-1)?.id ?? null;
  if (newest !== lastHistoryId) historyPage = 1;
  lastHistoryId = newest;
  const pageCount = Math.ceil(state.history.length / HISTORY_PAGE_SIZE);
  historyPage = Math.max(1,Math.min(historyPage,pageCount));
  $('#history-empty').hidden = state.history.length > 0;
  $('#history-pagination').hidden = !pageCount;
  $('#history-page').textContent = pageCount ? `${historyPage} / ${pageCount}` : '';
  $('#history-jump').replaceChildren(...Array.from({length:pageCount},(_,i)=>{const option=element('option',String(i+1));option.value=String(i+1);return option;}));
  $('#history-jump').value=String(historyPage);
  $('#history-previous').disabled = historyPage <= 1;
  $('#history-next').disabled = historyPage >= pageCount;
  $('#history-list').start=(historyPage-1)*HISTORY_PAGE_SIZE+1;
  $('#history-list').replaceChildren(...[...state.history].reverse().slice((historyPage-1)*HISTORY_PAGE_SIZE,historyPage*HISTORY_PAGE_SIZE).map(record => historyRow(record,state)));
  syncDesktopPanels(state);
}
function historyRow(record,state) {
    const li = element('li', ''); const time = element('time', new Intl.DateTimeFormat('zh-TW',{dateStyle:'short',timeStyle:'medium'}).format(new Date(record.time))); time.dateTime = record.time;
    li.append(time, element('p', record.fields.length===1&&record.fields[0]==='motto' ? '一句話已變更' : `${record.label}${record.fields.length ? `（${record.fields.map(key=>fields[key] ?? key).join('、')}）` : ''}`));
    const deltas = Object.entries(record.delta).filter(([key,value])=>key !== 'abilities' && value).map(([key,value])=>`${({experience:'Exp',level:'Lv',currency:'$'})[key]} ${value>0?'+':''}${value}`);
    record.delta.abilities.filter(a=>a.value).forEach(a=>deltas.push(`${state.stats.abilities.find(x=>x.id===a.id)?.name ?? a.id} ${a.value>0?'+':''}${a.value}`));
    const metadata = element('p',''); metadata.className = 'history-metadata';
    metadata.append(element('span', deltas.join(' ｜ ') || '數值無變動'), element('span', record.undone ? `已撤銷 · ${new Date(record.undoneAt).toLocaleString('zh-TW')}` : '尚未撤銷'));
    li.append(metadata);
    return li;
}

const desktopPanels = matchMedia('(min-width:1024px)');
function positionNotice() {
  const status = $('#operation-status');
  (desktopPanels.matches ? $('.profile-portrait-column') : $('.profile-content')).append(status);
}
positionNotice();
desktopPanels.addEventListener('change', positionNotice);

function syncDesktopPanels(state = dataStore.get()) {
  const content=$('.profile-content'), tabs=content.querySelector('.activity-tabs');
  if (!desktopPanels.matches) { content.style.removeProperty('--profile-panel-height'); return; }
  const dashboard=$('.profile-dashboard');dashboard.style.removeProperty('--profile-tabs-height');
  const tabHeight=Math.max(tabs.getBoundingClientRect().height,$('.profile-summary-area').getBoundingClientRect().height);
  dashboard.style.setProperty('--profile-tabs-height',`${tabHeight}px`);
  // Measure every retained page without showing it or changing the selected tab.
  const probe=element('div','');probe.className='history-measure';probe.inert=true;probe.setAttribute('aria-hidden','true');probe.style.width=`${content.getBoundingClientRect().width}px`;
  probe.append(element('p','保留最近 50 筆操作紀錄'));probe.firstChild.className='small-note';
  const list=element('ol','');list.className='history-list';probe.append(list);
  const footer=$('#history-pagination').cloneNode(true);footer.removeAttribute('hidden');footer.removeAttribute('id');footer.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));footer.querySelectorAll('[aria-live]').forEach(el=>el.removeAttribute('aria-live'));const selectStyle=getComputedStyle($('#history-jump'));const probeSelect=footer.querySelector('select');for(const property of ['font','min-width','min-height','padding','border'])probeSelect.style.setProperty(property,selectStyle.getPropertyValue(property));probe.append(footer);content.append(probe);
  const blanks=Array.from({length:HISTORY_PAGE_SIZE},()=>{
    const li=element('li',''),metadata=element('p','');metadata.className='history-metadata';metadata.append(element('span','\u00a0'),element('span','\u00a0'));li.append(element('time','\u00a0'),element('p','\u00a0'),metadata);return li;
  });
  list.replaceChildren(...blanks);let maximum=probe.getBoundingClientRect().height;
  const records=[...state.history].reverse();
  for(let start=0;start<records.length;start+=HISTORY_PAGE_SIZE){
    list.start=start+1;list.replaceChildren(...records.slice(start,start+HISTORY_PAGE_SIZE).map(record=>historyRow(record,state)));
    maximum=Math.max(maximum,probe.getBoundingClientRect().height);
  }
  probe.remove();content.style.setProperty('--profile-panel-height',`${Math.ceil(maximum)}px`);
}
let observedPanelWidth=-1,observedTabHeight=-1;
const panelObserver=new ResizeObserver(()=>{
  const width=$('.profile-content').getBoundingClientRect().width,height=$('.profile-content > .activity-tabs').getBoundingClientRect().height;
  if(width!==observedPanelWidth || height!==observedTabHeight){observedPanelWidth=width;observedTabHeight=height;syncDesktopPanels();}
});
panelObserver.observe($('.profile-content'));panelObserver.observe($('.profile-content > .activity-tabs'));
desktopPanels.addEventListener('change',()=>syncDesktopPanels());
document.fonts.ready.then(()=>syncDesktopPanels());
const dialog = $('#profile-dialog'), form = $('#profile-form');
const personalKeys = ['name', 'age', 'gender', 'bio', 'boundaries', 'motto'];
const numericFields = [{ id:'currency', name:'貨幣量' }, { id:'level', name:'等級' }, ...ABILITIES];
for (const field of numericFields) {
  const label = element('label', field.name);
  const input = document.createElement('input'); input.name = field.id; input.inputMode = 'numeric'; input.setAttribute('aria-describedby', `${field.id}-error`);
  const error = element('span', ''); error.id = `${field.id}-error`; error.className = 'field-error';
  label.append(input,error); $(ABILITIES.some(a=>a.id===field.id) ? '#manual-abilities' : '#manual-fields').append(label);
}
const settingTabs = [...$('#settings-tabs').querySelectorAll('button')];
function selectSetting(index) {
  settingTabs.forEach((tab,i) => { tab.setAttribute('aria-selected',String(i===index)); tab.tabIndex = i===index ? 0 : -1; document.getElementById(tab.getAttribute('aria-controls')).hidden = i!==index; });
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
  imageTabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;document.getElementById(tab.getAttribute('aria-controls')).hidden=i!==index;});
}
imageTabs.forEach((tab,index)=>{
  tab.addEventListener('click',()=>selectImage(index));
  tab.addEventListener('keydown',event=>{const next={ArrowLeft:1-index,ArrowRight:1-index,Home:0,End:1}[event.key];if(next===undefined)return;event.preventDefault();selectImage(next);imageTabs[next].focus();});
});
let draftPhoto = null, draftAvatar = null, photoError = '', avatarError = '', loadingPhoto = false, loadingAvatar = false, baseState;
let avatarSelection = 0, cropActive = false, cropDirty = false;
function renderDraftPhoto() {
  const image = $('#draft-photo'); image.hidden = !draftPhoto; $('#draft-photo-empty').hidden = Boolean(draftPhoto);
  if (draftPhoto) image.src = draftPhoto; else image.removeAttribute('src');
  $('#draft-avatar').hidden = !draftAvatar; $('#draft-avatar-empty').hidden = Boolean(draftAvatar);
  if (draftAvatar) $('#draft-avatar').src = draftAvatar; else $('#draft-avatar').removeAttribute('src');
  $('#crop-from-photo').disabled = !draftPhoto || loadingPhoto;
  $('#crop-source-help').textContent = draftPhoto ? '以目前設定中的立繪作為裁切來源。' : '尚無可用立繪，請先上傳立繪。';
}
function clearErrors() {
  form.querySelectorAll('.field-error').forEach(el=>{el.textContent='';});
  form.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));
  $('#form-error').textContent='';
}
function fieldError(key,message,index) {
  selectSetting(index);if(ABILITIES.some(a=>a.id===key)) $('#ability-edit-details').open=true;if(key==='photo')selectImage(0);if(key==='avatar')selectImage(1); $('#form-error').textContent = message;
  const input = key === 'photo' ? $('#photo-input') : key === 'avatar' ? $('#avatar-input') : form.elements[key];
  document.getElementById(`${key}-error`).textContent = message;
  input.setAttribute('aria-invalid','true'); input.focus();
}
$('#edit-profile').addEventListener('click', () => {
  baseState = dataStore.get();
  $('#ability-edit-details').open=false;
  personalKeys.forEach(key => { form.elements[key].value = baseState.profile[key]; });
  numericFields.forEach(({id})=>{ form.elements[id].value = id in baseState.stats ? baseState.stats[id] : baseState.stats.abilities.find(a=>a.id===id).value; });
  draftPhoto = baseState.photo; draftAvatar = baseState.avatar; photoError = ''; avatarError = ''; loadingPhoto = false; loadingAvatar = false; photoSelection++; avatarSelection++;closeCrop();
  $('#photo-input').value = ''; $('#avatar-input').value = ''; $('#save-settings').disabled = false;
  clearErrors(); renderDraftPhoto();selectSetting(0);selectImage(0);dialog.showModal();
});
$('#cancel-profile').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { photoSelection++;avatarSelection++;closeCrop(); draftPhoto = null; draftAvatar = null; photoError = ''; avatarError = ''; loadingPhoto = false; loadingAvatar = false; $('#edit-profile').focus(); });
form.addEventListener('submit', event => {
  event.preventDefault(); clearErrors();
  let profile,stats;
  try { profile = validateProfile(Object.fromEntries(new FormData(form))); }
  catch(error) { fieldError('age',error.message,0); return; }
  try { stats = validateManualStats(Object.fromEntries(new FormData(form)),baseState.stats); }
  catch(error) { fieldError(error.field,error.message,2); return; }
  if (loadingPhoto || photoError) { fieldError('photo',photoError || '圖片讀取中，請稍候。',1); return; }
  if (loadingAvatar || avatarError || cropDirty) { fieldError('avatar',avatarError || (loadingAvatar ? '頭像讀取中，請稍候。' : '請先確認或取消裁切，再儲存設定。'),1); return; }
  try {
    if (dataStore.get().revision !== baseState.revision) throw new Error('資料已在其他頁面更新；草稿已保留，請取消後重新開啟設定，以免覆蓋新資料。');
    const changed = personalKeys.filter(key=>profile[key]!==baseState.profile[key]);
    for (const {id} of numericFields) {
      const before = id in baseState.stats ? baseState.stats[id] : baseState.stats.abilities.find(a=>a.id===id).value;
      const after = id in stats ? stats[id] : stats.abilities.find(a=>a.id===id).value;
      if (before !== after) changed.push(id);
    }
    if (draftPhoto !== baseState.photo) changed.push('photo');
    if (draftAvatar !== baseState.avatar) changed.push('avatar');
    const saved = dataStore.transact({type:'settings.update',label:'已更新使用者設定',target:'user',fields:changed,changes:{profile,stats,photo:draftPhoto,avatar:draftAvatar}});
    dialog.close(); notice(saved ? '使用者設定已儲存。' : '沒有變更需要儲存。');
  } catch(error) { $('#form-error').textContent = error.message; }
});
$('#photo-input').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  const selection = ++photoSelection; loadingPhoto = true; photoError = ''; $('#photo-error').textContent = ''; $('#save-settings').disabled = true;
  try {
    const {url} = await readImageFile(file);
    if (selection !== photoSelection || !dialog.open) return;
    draftPhoto = url; $('#photo-input').removeAttribute('aria-invalid');renderDraftPhoto();
  } catch(error) {
    if (selection !== photoSelection || !dialog.open) return;
    photoError = error.message; fieldError('photo',photoError,1);
  } finally {
    if (selection === photoSelection) { loadingPhoto = false; $('#save-settings').disabled = loadingAvatar; renderDraftPhoto(); }
  }
});
const cropper = createAvatarCropper({canvas:$('#crop-canvas'),preview:$('#crop-preview'),zoomInput:$('#crop-zoom'),xInput:$('#crop-x'),yInput:$('#crop-y'),onChange:()=>{if(cropActive)cropDirty=true;}});
function closeCrop() { cropActive=false;cropDirty=false;$('#avatar-crop').hidden=true;cropper.clear(); }
async function beginCrop(source) {
  const selection=++avatarSelection;loadingAvatar=true;avatarError='';$('#save-settings').disabled=true;
  try {
    const image=await source();
    if(selection!==avatarSelection || !dialog.open)return;
    cropActive=true;cropDirty=true;cropper.setImage(image);$('#avatar-crop').hidden=false;
    $('#avatar-error').textContent='';$('#avatar-input').removeAttribute('aria-invalid');$('#crop-canvas').focus();
  }catch(error){if(selection===avatarSelection && dialog.open){avatarError=error.message;fieldError('avatar',avatarError,1);}}
  finally{if(selection===avatarSelection){loadingAvatar=false;$('#save-settings').disabled=loadingPhoto;}}
}
$('#avatar-input').addEventListener('change',event=>{const file=event.target.files[0];if(file)beginCrop(async()=> (await readImageFile(file)).image);});
$('#crop-from-photo').addEventListener('click',()=>{if(draftPhoto)beginCrop(()=>decodeImage(draftPhoto));});
$('#confirm-crop').addEventListener('click',()=>{
  try{draftAvatar=cropper.export();avatarError='';closeCrop();renderDraftPhoto();$('#avatar-input').value='';$('#avatar-error').textContent='';$('#avatar-input').removeAttribute('aria-invalid');$('#crop-from-photo').focus();}
  catch(error){avatarError=error.message;fieldError('avatar',avatarError,1);}
});
$('#cancel-crop').addEventListener('click',()=>{avatarSelection++;loadingAvatar=false;avatarError='';closeCrop();$('#avatar-error').textContent='';$('#avatar-input').value='';$('#save-settings').disabled=loadingPhoto;$('#avatar-input').focus();});
$('#history-jump').addEventListener('change',event=>{historyPage=Number(event.target.value);renderHistory();});
$('#history-previous').addEventListener('click',()=>{historyPage--;renderHistory();});
$('#history-next').addEventListener('click',()=>{historyPage++;renderHistory();});
const tabs = [$('#abilities-tab'),$('#history-tab')];
const positionProfileTabs = createMobileTabPositioner(tabs[0].parentElement);
function select(index) { tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;const panel=document.getElementById(tab.getAttribute('aria-controls'));panel.hidden=i!==index;panel.inert=i!==index;panel.setAttribute('aria-hidden',String(i!==index));}); }
tabs.forEach((tab,i)=>{tab.addEventListener('click',event=>{select(i);positionProfileTabs(event);});tab.addEventListener('keydown',e=>{const map={ArrowLeft:1-i,ArrowRight:1-i,Home:0,End:1};if(e.key in map){e.preventDefault();select(map[e.key]);tabs[map[e.key]].focus();}});});
initializeNavigation({undoManager});
dataStore.subscribe(render);
select(0);
