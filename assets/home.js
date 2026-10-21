import { createCompanionController, generateMockReply } from './companion.mjs';

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

// Existing operations remain memory-only demonstrations; nothing is persisted.
const taskInputs = [...document.querySelectorAll('[data-task]')];
const taskCount = document.querySelector('#task-count');

function updateTaskCount() {
  const completed = taskInputs.filter((input) => input.checked).length;
  taskCount.textContent = `${completed} / ${taskInputs.length} 完成`;
}

taskInputs.forEach((input, index) => input.addEventListener('change', () => {
  updateTaskCount();
  emitDemoSuccess('task.completed', input, index, input.closest('label').querySelector('.task-name').textContent);
}));
document.querySelectorAll('[data-habit]').forEach((input, index) => {
  const update = () => {
    input.nextElementSibling.textContent = input.checked ? '已打卡' : '未打卡';
  };
  input.addEventListener('change', () => {
    update();
    emitDemoSuccess('habit.checked-in', input, index, input.closest('label').querySelector('.habit-name').textContent);
  });
  update();
});
updateTaskCount();

// Responsive tabs share the existing DOM, so switching never resets selections
// and never emits a successful-action event or triggers companion generation.
const activityTabs = document.querySelector('.activity-tabs');
const tabButtons = [...activityTabs.querySelectorAll('button')];
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
  button.addEventListener('click', () => selectActivity(index));
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
