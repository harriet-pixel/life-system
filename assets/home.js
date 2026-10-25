import {mountHomeCompanionFloat} from './home-companion-float.mjs?v=local-clock-23';
import {taskActions} from './task-actions.mjs?v=local-clock-23';
import {rowsForDate,localDate} from './tasks-model.mjs?v=local-clock-23';
import { createMobileTabPositioner } from './tab-position.mjs?v=local-clock-23';
import { createActivityHeightSync } from './activity-height.mjs?v=local-clock-23';
import { undoManager } from './undo.mjs?v=local-clock-23';
import {createSharedCompanionView} from './companion-events.mjs?v=local-clock-23';
import { dataStore, profileSummary, visibleExperience } from './data.mjs?v=local-clock-23';


export function mountHome(root,context){
mountHomeCompanionFloat(root,context);
const refreshDate=()=>{globalThis.LifeHomeDate?.render(root);renderToday();};
context.listen(window,'focus',refreshDate);context.listen(document,'visibilitychange',()=>{if(!document.hidden)refreshDate();});context.onResume(refreshDate);
let dateTimer;const startDateTimer=()=>{clearInterval(dateTimer);dateTimer=setInterval(refreshDate,60000);};startDateTimer();context.onSuspend(()=>clearInterval(dateTimer));context.onResume(startDateTimer);
// Development slots, not approved character emotions. Only use licensed assets.
const emotionPortraits = {
  neutral: { label: '平靜', src: null },
  pleased: { label: '欣喜', src: null },
  calm: { label: '放鬆', src: null },
};
const portrait = root.querySelector('.companion-portrait');
const portraitImage = root.querySelector('#companion-image');
const placeholder = root.querySelector('#portrait-placeholder');
const emotionLabel = root.querySelector('#portrait-emotion');
const dialogue = root.querySelector('#companion-dialogue');
const status = root.querySelector('#companion-status');
function showPlaceholder(label) {
  portraitImage.hidden = true;
  placeholder.hidden = false;
  portrait.setAttribute('aria-label', `夥伴頭像佔位：${label}，尚未提供情緒立繪`);
}
const companion = createSharedCompanionView({
  getContext: () => ({ character: null, affinity: null }),
  render(reply) {
    const asset = emotionPortraits[reply.emotion];
    // Both fields are one validated reply, committed synchronously.
    dialogue.textContent = reply.dialogue;
    // Animate opacity only; text takes its final layout immediately.
    dialogue.classList.remove('dialogue-arrive');
    void dialogue.offsetWidth;
    dialogue.classList.add('dialogue-arrive');
    portrait.dataset.emotion = reply.emotion;
    emotionLabel.textContent = asset.label;
    portraitImage.onerror = () => showPlaceholder(asset.label);
    if (asset.src) {
      portraitImage.src = asset.src;
      portraitImage.hidden = false;
      placeholder.hidden = true;
      portrait.setAttribute('aria-label', `夥伴頭像：${asset.label}`);
    } else {
      portraitImage.removeAttribute('src');
      showPlaceholder(asset.label);
    }
  },
  onStateChange(state) {
    const messages = {
      cancelled: '已撤銷操作，保留原對話。',
      queued: '正在合併示意完成事件；保留上一則對話。',
      generating: '正在產生模擬回應；保留上一則對話。',
      ready: '模擬回應已更新・情緒為開發佔位，未串接 AI。',
      fallback: '模擬回應失敗，已顯示開發備援短句；示意操作不受影響。',
    };
    status.textContent = messages[state];
  },
},context);

// Future adapters emit this event only AFTER their data operation succeeds.
// Companion content remains managed by the shared coordinator.

function emitDemoSuccess(type, input, index, label) {
  if (!input.checked) return;
  document.dispatchEvent(new CustomEvent('life-system:action-succeeded', {
    detail: { type, actionId: `${type}-${index}`, label, source: 'demo' },
  }));
}

// Shared persistent activity state and journal; demo labels and companion remain unchanged.
const taskInputs = [];
const tasks=taskActions(root,context);
const todayList=root.querySelector('.task-list');
function renderToday(){
 globalThis.LifeHomeDate?.render(root);
 const rows=rowsForDate(dataStore.get().tasks,localDate());
 todayList.replaceChildren(...rows.map(row=>{const li=document.createElement('li'),label=document.createElement('label');li.dataset.rewardTask=row.task.id;li.dataset.rewardDate=row.occurrence.date;label.className='task-row';const input=document.createElement('input');input.type='checkbox';input.dataset.task='';const pending=tasks.isPending(row.task.id,row.occurrence.date);input.checked=row.occurrence.status==='done'||pending;input.disabled=pending;input.setAttribute('aria-busy',String(pending));li.classList.toggle('is-processing',pending);li.setAttribute('aria-busy',String(pending));input.setAttribute('aria-label',pending?`處理中，尚未提交完成 ${row.name}`:`${input.checked?'取消完成':'完成'} ${row.name}`);input.onchange=()=>{const done=row.occurrence.status==='done';if(tasks.isPending(row.task.id,row.occurrence.date))return;input.checked=true;if(done)tasks.cancel(row.task.id,row.occurrence.date).catch(()=>{});else tasks.complete(row.task.id,row.occurrence.date);};const name=document.createElement('span');name.className='task-content';name.textContent=row.name;const color=dataStore.get().tasks.categories.find(c=>c.id===row.task.categoryId)?.color;if(color)name.style.setProperty('--home-task-color',color);if(row.brief){const brief=document.createElement('span');brief.className='task-occurrence-brief';brief.textContent=row.brief;name.append(brief);}const category=document.createElement('span');category.className='task-time';category.textContent=row.category+(row.occurrence.status==='done'?' · 已完成':'');label.append(input,name,category);li.append(label);return li;}));
 if(!rows.length){const li=document.createElement('li');li.className='small-note';li.textContent='今天尚無待辦，前往待辦事項安排生活。';todayList.append(li);}
 root.querySelector('#task-count').textContent=`${rows.filter(r=>r.occurrence.status==='done').length} / ${rows.length} 完成`;
}
context.subscribe(tasks.completions,renderToday);
const habitInputs = [...root.querySelectorAll('[data-habit]')];
const entries = [
  ...taskInputs.map((input, index) => ({ input, index, id: `task-${index}`, type: 'task', label: input.closest('label').querySelector('.task-name').textContent })),
  ...habitInputs.map((input, index) => ({ input, index, id: `habit-${index}`, type: 'habit', label: input.closest('label').querySelector('.habit-name').textContent })),
];
const defaults = Object.fromEntries(entries.map(({ input, id }) => [id, input.defaultChecked]));
const activityStore = { get: id => ({ checked: dataStore.get().activities[id] ?? defaults[id] }) };
const taskCount = root.querySelector('#task-count');
function renderActivities() {
  if(undoManager.getState().busy)return;
  entries.forEach(({ input, id, type }) => {
    input.checked = activityStore.get(id).checked;
    if (type === 'habit') input.nextElementSibling.textContent = input.checked ? '已打卡' : '未打卡';
  });
  const completed = entries.filter(({ id, type }) => type === 'task' && activityStore.get(id).checked).length;
  renderToday();
}
entries.forEach((entry) => entry.input.addEventListener('change', async () => {
  if (undoManager.getState().busy) { renderActivities(); return; }
  try {
    await dataStore.transact({ type: `${entry.type}.set-completed`, target: entry.id,
      label: `${entry.type === 'task' ? (entry.input.checked ? '完成待辦' : '取消完成待辦') : (entry.input.checked ? '習慣打卡' : '取消習慣打卡')}：${entry.label}`,
      changes: { activities: { ...defaults, ...dataStore.get().activities, [entry.id]: entry.input.checked } } });
  } catch (error) {
    const notice = root.querySelector('#operation-status'); notice.hidden = false; notice.textContent = error.message;
    renderActivities(); return;
  }
  renderActivities();
  emitDemoSuccess(entry.type === 'task' ? 'task.completed' : 'habit.checked-in', entry.input, entry.index, entry.label);
}));
context.setHooks({onUndoSuccess:()=>companion.cancelPending(),onRedoSuccess:()=>companion.cancelPending(),onBusyChange:busy=>entries.forEach(({input})=>input.disabled=busy)});

context.subscribe(dataStore,() => {
  renderActivities();
  const stats = dataStore.get().stats;
  const summary = root.querySelector('#home-stats');
  const [experience, level, currency] = profileSummary(stats).split(' ｜ ');
  summary.textContent = `${level} ｜ ${experience}｜ ${currency}`;
  summary.setAttribute('aria-label', `累積總經驗值：${visibleExperience(stats.experience)}，等級：${stats.level}，貨幣：${stats.currency}`);
  summary.title = summary.getAttribute('aria-label');
});

// Responsive tabs share the existing DOM, so switching never resets selections
// and never emits a successful-action event or triggers companion generation.
const activityTabs = root.querySelector('.activity-tabs');
const tabButtons = [...activityTabs.querySelectorAll('button')];
const activityPanels = tabButtons.map((button) => root.querySelector("#"+CSS.escape(button.dataset.panel)));
const updateActivityHeight = createActivityHeightSync(root.querySelector('.home-grid'),activityPanels,context);
const positionActivityTabs = createMobileTabPositioner(activityTabs, updateActivityHeight,{scrollPage:false});
context.onSuspend(()=>positionActivityTabs.cancel());
context.subscribe(dataStore,updateActivityHeight);
const desktopLayout = window.matchMedia('(min-width: 1024px)');
let selectedPanel = 0;
function syncActivityTabs() {
  root.querySelector('#main').dataset.activityTabs = 'true';
  activityTabs.hidden = false;
  activityTabs.setAttribute('role', 'tablist');
  placeholder.firstElementChild.textContent = desktopLayout.matches ? '立繪佔位' : '頭像佔位';
  tabButtons.forEach((button, index) => {
    const panel = activityPanels[index];
    panel.hidden = index !== selectedPanel;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', panel.id);
    button.setAttribute('aria-selected', String(index === selectedPanel));
    button.tabIndex = index === selectedPanel ? 0 : -1;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', button.id);
  });
  updateActivityHeight();
}
function selectActivity(index) {
  selectedPanel = index;
  syncActivityTabs();
}
tabButtons.forEach((button, index) => {
  button.addEventListener('click', (event) => { selectActivity(index); positionActivityTabs(event); });
  button.addEventListener('keydown', (event) => {
    const targets = { ArrowRight: (index + 1) % 2, ArrowLeft: (index + 1) % 2, Home: 0, End: 1 };
    if (!(event.key in targets)) return;
    event.preventDefault();
    selectActivity(targets[event.key]);
    tabButtons[selectedPanel].focus();
  });
});
context.listen(desktopLayout,'change',syncActivityTabs);
context.onResume(syncActivityTabs);
syncActivityTabs();

}
