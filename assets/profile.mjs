import { undoManager } from './undo.mjs';
import { dataStore, formatSI, validateProfile, abilityRatios } from './data.mjs';
import { initializeNavigation } from './navigation.mjs?v=profile-1';
const $ = selector => document.querySelector(selector);
const fields = { name: '稱呼', age: '年紀', gender: '性別', bio: '個人簡介', boundaries: '無法接受的事情' };
const notice = message => { $('#operation-status').hidden = false; $('#operation-status').textContent = message; };
let pendingPhoto = null;
let photoSelection = 0;
const photoFrame = $('.photo-frame');
const photoImage = $('#user-photo');
const defaultAvatar = $('#default-avatar');
function renderPhoto() {
  const photo = pendingPhoto ?? dataStore.get().photo;
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
$('#edit-profile').addEventListener('click', () => { const profile = dataStore.get().profile; Object.keys(fields).forEach(key => { form.elements[key].value = profile[key]; }); $('#form-error').textContent = ''; dialog.showModal(); });
$('#cancel-profile').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => $('#edit-profile').focus());
form.addEventListener('submit', event => {
  event.preventDefault();
  try {
    const profile = validateProfile(Object.fromEntries(new FormData(form))); const before = dataStore.get().profile;
    dataStore.transact({type:'profile.edit',label:'已更新個人資料',target:'profile',fields:Object.keys(fields).filter(key=>profile[key]!==before[key]),changes:{profile}});
    dialog.close(); notice('個人資料已儲存。');
  } catch(error) { $('#form-error').textContent = error.message; }
});
$('#photo-input').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  const selection = ++photoSelection;
  pendingPhoto = null; renderPhoto(); $('#photo-actions').hidden = true;
  try {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('請選擇 JPEG、PNG 或 WebP 圖片。');
    if (file.size > 500*1024) throw new Error('照片不可超過 500 KB，請縮小後重試。');
    const url = await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('圖片讀取失敗。'));reader.readAsDataURL(file);});
    const image = new Image(); image.src = url; await image.decode();
    if (selection !== photoSelection) return;
    pendingPhoto = url; renderPhoto(); $('#photo-actions').hidden = false;
  } catch(error) { if (selection !== photoSelection) return; notice(error.message === 'The source image cannot be decoded.' ? '圖片損壞或格式不受支援。' : error.message); event.target.value = ''; }
});
function cancelPhoto() { photoSelection++; pendingPhoto = null; $('#photo-actions').hidden = true; $('#photo-input').value = ''; renderPhoto(); }
$('#cancel-photo').addEventListener('click',cancelPhoto);
$('#save-photo').addEventListener('click', () => { try { dataStore.transact({type:'photo.set',label:'已更新照片',target:'profile.photo',changes:{photo:pendingPhoto}}); cancelPhoto(); notice('照片已儲存。'); } catch(error) { notice(error.message); } });
const tabs = [$('#abilities-tab'),$('#history-tab')];
function select(index) { tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;document.getElementById(tab.getAttribute('aria-controls')).hidden=i!==index;}); }
tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>select(i));tab.addEventListener('keydown',e=>{const map={ArrowLeft:1-i,ArrowRight:1-i,Home:0,End:1};if(e.key in map){e.preventDefault();select(map[e.key]);tabs[map[e.key]].focus();}});});
initializeNavigation({undoManager,onUndoSuccess:cancelPhoto});
dataStore.subscribe(render);
