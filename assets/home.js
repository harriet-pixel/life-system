import { createMobileTabPositioner } from './tab-position.mjs?v=tab-center-35';
import { undoManager } from './undo.mjs?v=exp-zero-37';
import { createCompanionController, generateMockReply } from './companion.mjs?v=undo-1';
import { dataStore, profileSummary, visibleExperience } from './data.mjs?v=exp-zero-37';
import { initializeNavigation } from './navigation.mjs?v=redo-17';

// Development slots, not approved character emotions. Only use licensed assets.
const emotionPortraits = {
  neutral: { label: '平靜', src: null },
  pleased: { label: '欣喜', src: null },
  calm: { label: '放鬆', src: null },
};
const portrait = document.querySelector('.companion-portrait');
const portraitImage = document.querySelector('#companion-image');
const placeholder = document.querySelector('#portrait-placeholder');
const emotionLabel = document.querySelector('#portrait-emotion');
const dialogue = document.querySelector('#companion-dialogue');
const status = document.querySelector('#companion-status');
function showPlaceholder(label) {
  portraitImage.hidden = true;
  placeholder.hidden = false;
  portrait.setAttribute('aria-label', `夥伴頭像佔位：${label}，尚未提供情緒立繪`);
}
const companion = createCompanionController({
  generate: generateMockReply,
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
});

// Future adapters emit this event only AFTER their data operation succeeds.
// There are deliberately no pointer, scroll, focus, or menu listeners.
document.addEventListener('life-system:action-succeeded', (event) => {
  companion.recordSuccess(event.detail);
});
function emitDemoSuccess(type, input, index, label) {
  if (!input.checked) return;
  document.dispatchEvent(new CustomEvent('life-system:action-succeeded', {
    detail: { type, actionId: `${type}-${index}`, label, source: 'demo' },
  }));
}

// Shared persistent activity state and journal; demo labels and companion remain unchanged.
const taskInputs = [...document.querySelectorAll('[data-task]')];
const habitInputs = [...document.querySelectorAll('[data-habit]')];
const entries = [
  ...taskInputs.map((input, index) => ({ input, index, id: `task-${index}`, type: 'task', label: input.closest('label').querySelector('.task-name').textContent })),
  ...habitInputs.map((input, index) => ({ input, index, id: `habit-${index}`, type: 'habit', label: input.closest('label').querySelector('.habit-name').textContent })),
];
const defaults = Object.fromEntries(entries.map(({ input, id }) => [id, input.defaultChecked]));
const activityStore = { get: id => ({ checked: dataStore.get().activities[id] ?? defaults[id] }) };
const taskCount = document.querySelector('#task-count');
function renderActivities() {
  entries.forEach(({ input, id, type }) => {
    input.checked = activityStore.get(id).checked;
    if (type === 'habit') input.nextElementSibling.textContent = input.checked ? '已打卡' : '未打卡';
  });
  const completed = entries.filter(({ id, type }) => type === 'task' && activityStore.get(id).checked).length;
  taskCount.textContent = `${completed} / ${taskInputs.length} 完成`;
}
entries.forEach((entry) => entry.input.addEventListener('change', () => {
  if (undoManager.getState().busy) { renderActivities(); return; }
  try {
    dataStore.transact({ type: `${entry.type}.set-completed`, target: entry.id,
      label: `${entry.type === 'task' ? (entry.input.checked ? '完成待辦' : '取消完成待辦') : (entry.input.checked ? '習慣打卡' : '取消習慣打卡')}：${entry.label}`,
      changes: { activities: { ...defaults, ...dataStore.get().activities, [entry.id]: entry.input.checked } } });
  } catch (error) {
    const notice = document.querySelector('#operation-status'); notice.hidden = false; notice.textContent = error.message;
    renderActivities(); return;
  }
  renderActivities();
  emitDemoSuccess(entry.type === 'task' ? 'task.completed' : 'habit.checked-in', entry.input, entry.index, entry.label);
}));
initializeNavigation({
  undoManager,
  onUndoSuccess: () => companion.cancelPending(),
  onRedoSuccess: () => companion.cancelPending(),
  onBusyChange: (busy) => entries.forEach(({ input }) => { input.disabled = busy; }),
});
dataStore.subscribe(() => {
  renderActivities();
  const stats = dataStore.get().stats;
  const summary = document.querySelector('#home-stats');
  const [experience, level, currency] = profileSummary(stats).split(' ｜ ');
  summary.textContent = `${level} ｜ ${experience}｜ ${currency}`;
  summary.setAttribute('aria-label', `累積總經驗值：${visibleExperience(stats.experience)}，等級：${stats.level}，貨幣：${stats.currency}`);
  summary.title = summary.getAttribute('aria-label');
});

// Responsive tabs share the existing DOM, so switching never resets selections
// and never emits a successful-action event or triggers companion generation.
const activityTabs = document.querySelector('.activity-tabs');
const tabButtons = [...activityTabs.querySelectorAll('button')];
const positionActivityTabs = createMobileTabPositioner(activityTabs);
const activityPanels = tabButtons.map((button) => document.getElementById(button.dataset.panel));
const desktopLayout = window.matchMedia('(min-width: 1024px)');
let selectedPanel = 0;
function syncActivityTabs() {
  document.querySelector('#main').dataset.activityTabs = 'true';
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
desktopLayout.addEventListener('change', syncActivityTabs);
syncActivityTabs();
