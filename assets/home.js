import {mountHabitQuick} from './habit-quick.mjs?v=habit-chart-labels-20261027';
import {renderHomeToday} from './home-today.mjs?v=habits-20261026';
import {initializeTaskDialogs} from './task-dialog-viewport.mjs?v=habits-20261026';
import {createTaskEditor} from './task-editor.mjs?v=habits-20261026';
import {createCategoryManager} from './task-categories.mjs?v=habits-20261026';
import {mountHomeCompanionFloat} from './home-companion-float.mjs?v=habits-20261026';
import {taskActions} from './task-actions.mjs?v=habits-20261026';
import {localDate} from './tasks-model.mjs?v=habits-20261026';
import { createMobileTabPositioner } from './tab-position.mjs?v=habits-20261026';
import { createActivityHeightSync } from './activity-height.mjs?v=habits-20261026';
import { undoManager } from './undo.mjs?v=habits-20261026';
import {createSharedCompanionView} from './companion-events.mjs?v=habits-20261026';
import { dataStore, profileSummary, visibleExperience } from './data.mjs?v=habits-20261026';


export function mountHome(root,context){
const floating=mountHomeCompanionFloat(root,context);
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
  render(reply,actions,meta) {
    if(!meta?.replayed)floating.reply();
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
      ready: '夥伴回應已更新，正式角色情緒素材尚未設定。',
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
const completionBusy=context.hooks.busy;
const editor=createTaskEditor(root,context,tasks),categories=createCategoryManager(root,context,tasks);
initializeTaskDialogs(root,context);
root.querySelector('#home-new-event').disabled=false;
root.querySelector('#home-new-event').onclick=()=>editor.open(null,localDate()).catch(error=>tasks.say(error.message));
editor.element.querySelector('#task-add-category').onclick=()=>{const trigger=editor.element.querySelector('#task-add-category');editor.pause();categories.create(id=>{editor.updateCategories();if(id)editor.selectCategory(id);editor.resume();trigger.focus({preventScroll:true});});};
context.setHooks({hasDraft:()=>editor.hasDraft()||categories.hasDraft(),busy:()=>editor.busy()||categories.busy()||Boolean(completionBusy?.())});
function renderToday(){renderHomeToday(root,tasks);}
context.subscribe(tasks.completions,renderToday);
mountHabitQuick(root,context);
context.subscribe(dataStore,() => {
  renderToday();
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
