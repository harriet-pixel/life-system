import {validateHistoryPage} from './validation.mjs?v=task-compact-14';
import {ABILITIES} from './abilities.mjs?v=task-compact-14';
const fields = { name: '稱呼', age: '年齡', gender: '性別', bio: '個人簡介', boundaries: '禁忌', motto: '一句話已變更', experience: '總經驗值', currency: '貨幣', photo: '使用者立繪', avatar: '使用者頭像', portraits:'立繪收藏', photoEdit:'立繪裁切', avatarEdit:'頭像裁切', currentPortraitId:'選用立繪', level: '等級', restart:'重新開始', ...Object.fromEntries(ABILITIES.map(a => [a.id, a.name])) };
const element=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
export function historyRow(record,state) {
    const li = element('li', ''); const validTime=Number.isFinite(Date.parse(record.time));const time = element('time',validTime?new Intl.DateTimeFormat('zh-TW',{dateStyle:'short',timeStyle:'medium'}).format(new Date(record.time)):'原始操作時間無法辨識');if(validTime)time.dateTime=record.time;
    li.append(time, element('p', record.fields.length===1&&record.fields[0]==='motto' ? '一句話已變更' : `${record.label}${record.fields.length ? `（${record.fields.map(key=>fields[key] ?? key).join('、')}）` : ''}`));
    const deltas = Object.entries(record.delta).filter(([key,value])=>key !== 'abilities' && value).map(([key,value])=>`${({experience:'Exp',level:'Lv',currency:'$'})[key]} ${value>0?'+':''}${value}`);
    record.delta.abilities.filter(a=>a.value).forEach(a=>deltas.push(`${state.stats.abilities.find(x=>x.id===a.id)?.name ?? a.id} ${a.value>0?'+':''}${a.value}`));
    const metadata = element('p',''); metadata.className = 'history-metadata';
    metadata.append(element('span', deltas.join(' ｜ ') || '數值無變動'), element('span', record.undone ? `已撤銷 · ${new Date(record.undoneAt).toLocaleString('zh-TW')}` : state.undoHistory?.some(r=>r.id===record.id)?'可撤銷':'行動紀錄（無復原資料）'));
    li.append(metadata);
    return li;
}

export function createHistoryView({store:dataStore,afterRender=()=>{},root=document,context}) {
const $=selector=>root.querySelector(selector);
const HISTORY_PAGE_SIZE = 5;
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
  $('#history-page-error').hidden=true;
  $('#history-next').disabled = historyPage >= pageCount;
  $('#history-list').start=(historyPage-1)*HISTORY_PAGE_SIZE+1;
  $('#history-list').replaceChildren(...[...state.history].reverse().slice((historyPage-1)*HISTORY_PAGE_SIZE,historyPage*HISTORY_PAGE_SIZE).map(record => historyRow(record,state)));
  afterRender(state);
}
$('#history-jump').addEventListener('change',event=>{try{historyPage=validateHistoryPage(event.target.value,Math.ceil(dataStore.get().history.length/HISTORY_PAGE_SIZE));renderHistory();}catch(error){$('#history-page-error').textContent=error.message;$('#history-page-error').hidden=false;}});
$('#history-previous').addEventListener('click',()=>{historyPage--;renderHistory();});
$('#history-next').addEventListener('click',()=>{historyPage++;renderHistory();});

const desktopPanels=matchMedia('(min-width:1024px)');
function positionHistory(){
  const pagination = $('#history-pagination'), list = $('#history-list'), retention = $('#history-retention-note');
  if (desktopPanels.matches) {
    list.before(retention); list.after(pagination);
  } else {
    list.before(pagination); list.after(retention);
  }
}
positionHistory();if(context){context.listen(desktopPanels,'change',positionHistory);context.onResume(positionHistory);}else desktopPanels.addEventListener('change',positionHistory);
return {render:renderHistory};
}
