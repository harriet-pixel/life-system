import { ABILITIES, validateManualStats, integerValue, levelFromExperience } from './abilities.mjs?v=settings-4';
import { undoManager } from './undo.mjs?v=settings-4';
import { dataStore, formatSI, validateProfile, abilityRatios } from './data.mjs?v=settings-4';
import { initializeNavigation } from './navigation.mjs?v=profile-1';
const $ = selector => document.querySelector(selector);
const fields = { name: '稱呼', age: '年紀', gender: '性別', bio: '個人簡介', boundaries: '無法接受的事情', experience: '總經驗值', currency: '貨幣', photo: '使用者立繪', ...Object.fromEntries(ABILITIES.map(a => [a.id, a.name])) };
const notice = message => { $('#operation-status').hidden = false; $('#operation-status').textContent = message; };
let photoSelection = 0;
const photoFrame = $('.photo-frame');
const photoImage = $('#user-photo');
const defaultAvatar = $('#default-avatar');
function renderPhoto() {
  const photo = dataStore.get().photo;
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
function render() {
  const state = dataStore.get();
  $('#profile-name').textContent = state.profile.name || '尚未設定稱呼';
  $('#profile-age').textContent = state.profile.age === '' ? '' : `${state.profile.age} 歲`;
  renderPhoto();
  const { experience, level, currency, abilities } = state.stats;
  $('#profile-stats').replaceChildren(...[['累積總經驗值', experience, `Exp${formatSI(experience)}`], ['等級', level, `Lv${level ?? '—'}`], ['貨幣', currency, `$ ${currency ?? '—'}`]].map(([label, value, text], index) => {
    const span = element('span', `${index ? '｜ ' : ''}${text}`); span.title = `${label}：${value ?? '尚無資料'}`; span.setAttribute('aria-label', span.title); return span;
  }));
  const valid = abilities.length === 5;
  $('#abilities-missing').hidden = valid; $('.ability-charts').hidden = !valid;
  if (valid) {
    const ratios = abilityRatios(abilities);
    $('#ability-bars').replaceChildren(...abilities.map((ability, index) => {
      const row = element('div', ''); row.className = 'ability-row';
      const value = element('span', formatSI(ability.value)); value.title = String(ability.value); value.setAttribute('aria-label', `${ability.name}：${ability.value}`);
      const track = element('div', ''); track.className = 'ability-track'; track.setAttribute('aria-hidden', 'true');
      const fill = element('div', ''); fill.className = 'ability-fill'; fill.style.width = `${ratios[index] * 100}%`; track.append(fill);
      row.append(element('span', ability.name), value, track); return row;
    }));
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 320 320'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', abilities.map(a => `${a.name}：${a.value}`).join('，'));
    const point = (i, ratio) => { const angle = -Math.PI/2 + i * 2*Math.PI/5; return [160 + Math.cos(angle)*90*ratio, 160 + Math.sin(angle)*90*ratio]; };
    const draw = (tag, attrs) => { const node = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([k,v]) => node.setAttribute(k,v)); svg.append(node); return node; };
    for (const scale of [.25,.5,.75,1]) draw('polygon', { points: abilities.map((_,i)=>point(i,scale).join(',')).join(' '), fill:'none', stroke:'var(--color-border)' });
    abilities.forEach((a,i) => { const [x,y] = point(i,1); draw('line',{x1:160,y1:160,x2:x,y2:y,stroke:'var(--color-border)'}); const [tx,ty] = point(i,1.4); draw('text',{x:tx,y:ty,'text-anchor':'middle','dominant-baseline':'middle'}).textContent = a.name; });
    draw('polygon', { points: ratios.map((ratio,i)=>point(i,ratio).join(',')).join(' '), fill:'var(--color-primary)', 'fill-opacity':'.15', stroke:'var(--color-primary)' });
    $('#ability-radar').replaceChildren(svg);
  }
  $('#history-empty').hidden = state.history.length > 0;
  $('#history-list').replaceChildren(...[...state.history].reverse().map(record => {
    const li = element('li', ''); const time = element('time', new Intl.DateTimeFormat('zh-TW',{dateStyle:'short',timeStyle:'medium'}).format(new Date(record.time))); time.dateTime = record.time;
    li.append(time, element('p', `${record.label}${record.fields.length ? `（${record.fields.map(key=>fields[key] ?? key).join('、')}）` : ''}`));
    const deltas = Object.entries(record.delta).filter(([key,value])=>key !== 'abilities' && value).map(([key,value])=>`${({experience:'Exp',level:'Lv',currency:'$'})[key]} ${value>0?'+':''}${value}`);
    record.delta.abilities.filter(a=>a.value).forEach(a=>deltas.push(`${state.stats.abilities.find(x=>x.id===a.id)?.name ?? a.id} ${a.value>0?'+':''}${a.value}`));
    li.append(element('p', deltas.join(' ｜ ') || '數值無變動'));
    li.append(element('p', record.undone ? `已撤銷 · ${new Date(record.undoneAt).toLocaleString('zh-TW')}` : '尚未撤銷'));
    return li;
  }));
}
const dialog = $('#profile-dialog'), form = $('#profile-form');
const personalKeys = ['name', 'age', 'gender', 'bio', 'boundaries'];
const numericFields = [{ id:'experience', name:'總經驗值' }, { id:'currency', name:'貨幣' }, ...ABILITIES];
for (const field of numericFields) {
  const label = element('label', field.name);
  const input = document.createElement('input'); input.name = field.id; input.inputMode = 'numeric'; input.setAttribute('aria-describedby', `${field.id}-error`);
  const error = element('span', ''); error.id = `${field.id}-error`; error.className = 'field-error';
  label.append(input,error); $('#manual-fields').append(label);
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
let draftPhoto = null, photoError = '', loadingPhoto = false, baseState;
function renderDraftPhoto() {
  const image = $('#draft-photo'); image.hidden = !draftPhoto; $('#draft-photo-empty').hidden = Boolean(draftPhoto);
  if (draftPhoto) image.src = draftPhoto; else image.removeAttribute('src');
}
function clearErrors() {
  form.querySelectorAll('.field-error').forEach(el=>{el.textContent='';});
  form.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));
  $('#form-error').textContent='';
}
function fieldError(key,message,index) {
  selectSetting(index); $('#form-error').textContent = message;
  const input = key === 'photo' ? $('#photo-input') : form.elements[key];
  document.getElementById(`${key}-error`).textContent = message;
  input.setAttribute('aria-invalid','true'); input.focus();
}
function updateLevel() {
  try { $('#draft-level').textContent = `Lv${levelFromExperience(integerValue(form.elements.experience.value,'experience'))}`; }
  catch { $('#draft-level').textContent = '—'; }
}
form.elements.experience.addEventListener('input',updateLevel);
$('#edit-profile').addEventListener('click', () => {
  baseState = dataStore.get();
  personalKeys.forEach(key => { form.elements[key].value = baseState.profile[key]; });
  numericFields.forEach(({id})=>{ form.elements[id].value = id in baseState.stats ? baseState.stats[id] : baseState.stats.abilities.find(a=>a.id===id).value; });
  draftPhoto = baseState.photo; photoError = ''; loadingPhoto = false; photoSelection++;
  $('#photo-input').value = ''; $('#save-settings').disabled = false;
  clearErrors(); renderDraftPhoto();updateLevel();selectSetting(0);dialog.showModal();
});
$('#cancel-profile').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { photoSelection++; draftPhoto = null; photoError = ''; loadingPhoto = false; $('#edit-profile').focus(); });
form.addEventListener('submit', event => {
  event.preventDefault(); clearErrors();
  let profile,stats;
  try { profile = validateProfile(Object.fromEntries(new FormData(form))); }
  catch(error) { fieldError('age',error.message,0); return; }
  try { stats = validateManualStats(Object.fromEntries(new FormData(form)),baseState.stats); }
  catch(error) { fieldError(error.field,error.message,1); return; }
  if (loadingPhoto || photoError) { fieldError('photo',photoError || '圖片讀取中，請稍候。',2); return; }
  try {
    if (dataStore.get().revision !== baseState.revision) throw new Error('資料已在其他頁面更新；草稿已保留，請取消後重新開啟設定，以免覆蓋新資料。');
    const changed = personalKeys.filter(key=>profile[key]!==baseState.profile[key]);
    for (const {id} of numericFields) {
      const before = id in baseState.stats ? baseState.stats[id] : baseState.stats.abilities.find(a=>a.id===id).value;
      const after = id in stats ? stats[id] : stats.abilities.find(a=>a.id===id).value;
      if (before !== after) changed.push(id);
    }
    if (draftPhoto !== baseState.photo) changed.push('photo');
    const saved = dataStore.transact({type:'settings.update',label:'已更新使用者設定',target:'user',fields:changed,changes:{profile,stats,photo:draftPhoto}});
    dialog.close(); notice(saved ? '使用者設定已儲存。' : '沒有變更需要儲存。');
  } catch(error) { $('#form-error').textContent = error.message; }
});
$('#photo-input').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  const selection = ++photoSelection; loadingPhoto = true; photoError = ''; $('#photo-error').textContent = ''; $('#save-settings').disabled = true;
  try {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('請選擇 JPEG、PNG 或 WebP 圖片。');
    if (file.size > 500*1024) throw new Error('照片不可超過 500 KB，請縮小後重試。');
    const url = await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('圖片讀取失敗。'));reader.readAsDataURL(file);});
    const image = new Image(); image.src = url;
    try { await image.decode(); } catch { throw new Error('圖片損壞或格式不受支援。'); }
    if (selection !== photoSelection || !dialog.open) return;
    draftPhoto = url; $('#photo-input').removeAttribute('aria-invalid');renderDraftPhoto();
  } catch(error) {
    if (selection !== photoSelection || !dialog.open) return;
    photoError = error.message; fieldError('photo',photoError,2);
  } finally {
    if (selection === photoSelection) { loadingPhoto = false; $('#save-settings').disabled = false; }
  }
});
const tabs = [$('#abilities-tab'),$('#history-tab')];
function select(index) { tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;document.getElementById(tab.getAttribute('aria-controls')).hidden=i!==index;}); }
tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>select(i));tab.addEventListener('keydown',e=>{const map={ArrowLeft:1-i,ArrowRight:1-i,Home:0,End:1};if(e.key in map){e.preventDefault();select(map[e.key]);tabs[map[e.key]].focus();}});});
initializeNavigation({undoManager});
dataStore.subscribe(render);
