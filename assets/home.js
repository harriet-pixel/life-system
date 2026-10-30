import {nextHomeGreeting} from './characters-model.mjs?v=restore-images-20261031';
import {mountHabitQuick} from './habit-quick.mjs?v=restore-images-20261031';
import {renderHomeToday} from './home-today.mjs?v=restore-images-20261031';
import {initializeTaskDialogs} from './task-dialog-viewport.mjs?v=restore-images-20261031';
import {createTaskEditor} from './task-editor.mjs?v=restore-images-20261031';
import {createCategoryManager} from './task-categories.mjs?v=restore-images-20261031';
import {mountHomeCompanionFloat} from './home-companion-float.mjs?v=restore-images-20261031';
import {taskActions} from './task-actions.mjs?v=restore-images-20261031';
import {localDate} from './tasks-model.mjs?v=restore-images-20261031';
import { createMobileTabPositioner } from './tab-position.mjs?v=restore-images-20261031';
import { createActivityHeightSync } from './activity-height.mjs?v=restore-images-20261031';
import { undoManager } from './undo.mjs?v=restore-images-20261031';
import {createSharedCompanionView} from './companion-events.mjs?v=restore-images-20261031';
import { dataStore, profileSummary, visibleExperience } from './data.mjs?v=restore-images-20261031';


export function mountHome(root,context){
let currentGreeting=nextHomeGreeting(dataStore.getFields(['activeCharacter']).activeCharacter);
const floating=mountHomeCompanionFloat(root,context,{greetingText:()=>currentGreeting});
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
let dailyVisual=null,visualRequest=0;
let greetingIdentity='';
function showDaily(reply){const request=++visualRequest;void import('./daily-visuals.mjs?v=restore-images-20261031').then(m=>{if(!context.active||request!==visualRequest)return;dailyVisual??=m.mountDailyVisuals(root,context,dataStore);dailyVisual.show(reply);}).catch(()=>{});}
context.onSuspend(()=>visualRequest++);
function showHomeGreeting(actor){dialogue.textContent=currentGreeting;if(actor)showDaily({characterId:actor.characterId,characterCreatedAt:actor.createdAt,emotion:'neutral',daily:true});else visualRequest++;}
context.subscribe(dataStore,({activeCharacter:c})=>{const signature=JSON.stringify([c?.characterId,c?.createdAt,c?.settings?.name,c?.greetings,c?.imageSettings]);if(signature!==greetingIdentity){if(greetingIdentity)currentGreeting=nextHomeGreeting(c);greetingIdentity=signature;showHomeGreeting(c);}},{changesOnly:true,keys:['activeCharacter'],distinct:true});
context.onResume(()=>{currentGreeting=nextHomeGreeting(dataStore.getFields(['activeCharacter']).activeCharacter);showHomeGreeting(dataStore.getFields(['activeCharacter']).activeCharacter);});
const companion = createSharedCompanionView({
  getContext: () => ({ character: null, affinity: null }),
  render(reply,actions,meta) {
    if(!meta?.replayed)floating.reply();
    if(reply.daily){portrait.dataset.emotion=reply.emotion;dialogue.textContent=reply.dialogue;showDaily(reply);return;}
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
      queued: '正在合併正式生活事件；保留上一則對話。',
      generating: '正在準備夥伴回應；保留上一則對話。',
      ready: '夥伴回應已更新。',
      fallback: '已顯示安全備援短句；正式生活操作已完成。',
    };
    status.textContent = messages[state];
  },
},context);

// Daily responses are driven by committed data, never by UI success events.
const tasks=taskActions(root,context);
const completionBusy=context.hooks.busy;
const editor=createTaskEditor(root,context,tasks),categories=createCategoryManager(root,context,tasks);
initializeTaskDialogs(root,context);
const itemMenu=document.createElement('dialog');itemMenu.id='home-task-item-menu';itemMenu.className='task-dialog task-item-menu';itemMenu.setAttribute('aria-labelledby','home-task-menu-title');root.append(itemMenu);let menuTrigger;
const menuButton=(label,work)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>Promise.resolve().then(work).catch(e=>tasks.say(e.message));return b;};
itemMenu.addEventListener('click',e=>{const r=itemMenu.getBoundingClientRect();if(e.target===itemMenu&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))itemMenu.close();});
itemMenu.addEventListener('close',()=>{(menuTrigger?.isConnected?menuTrigger:root.querySelector('#home-new-event'))?.focus({preventScroll:true});});
tasks.openMenu=(task,o)=>{menuTrigger=document.activeElement;const title=document.createElement('h2');title.id='home-task-menu-title';title.textContent=task.name;const close=menuButton('×',()=>itemMenu.close());close.className='task-item-close';close.setAttribute('aria-label','關閉');const controls=document.createElement('div');controls.className='task-menu-actions';controls.append(menuButton('編輯事件',()=>{itemMenu.close();return editor.open(task,o.date);}),menuButton(task.kind==='repeat'?'刪除此日安排':'刪除事件',async()=>{if(o.status==='done'){itemMenu.close();return tasks.deleteCompleted(task.id,o.date);}if(!window.confirm('刪除此日安排？其他日期與完成歷史保留。'))return;await tasks.attempt(()=>tasks.service.remove(task.id,o.date));itemMenu.close();}));if(task.kind==='repeat')controls.append(menuButton('刪除整個重複事項',async()=>{if(!window.confirm('刪除整個重複事項及全部未完成安排？已完成歷史與獎勵保留。'))return;await tasks.attempt(()=>tasks.service.remove(task.id));itemMenu.close();}));itemMenu.replaceChildren(title,close,controls);itemMenu.showModal();};
let selectedPanel=0;
const homeNotice=root.querySelector('#operation-status'),noticeAnchor=document.createComment('home notice');homeNotice.before(noticeAnchor);const noticeMedia=matchMedia('(min-width:1024px)');const homeNoticeTop=document.createElement('div');homeNoticeTop.className='home-notice-top';homeNoticeTop.setAttribute('aria-label','首頁通知');root.querySelector('.intro').append(homeNoticeTop);const syncHomeNotice=()=>{homeNotice.hidden=false;if(noticeMedia.matches)root.querySelector('.companion').append(homeNotice);else (root.querySelector('[data-daily-notice]')??homeNoticeTop).append(homeNotice);};context.listen(noticeMedia,'change',syncHomeNotice);context.onResume(syncHomeNotice);


root.querySelector('#home-new-event').disabled=false;
root.querySelector('#home-new-event').onclick=()=>editor.open(null,localDate()).catch(error=>tasks.say(error.message));
editor.element.querySelector('#task-add-category').onclick=()=>{const trigger=editor.element.querySelector('#task-add-category');editor.pause();categories.create(id=>{editor.updateCategories();if(id)editor.selectCategory(id);editor.resume();trigger.focus({preventScroll:true});});};
context.setHooks({hasDraft:()=>editor.hasDraft()||categories.hasDraft(),busy:()=>editor.busy()||categories.busy()||Boolean(completionBusy?.())});
function renderToday(){renderHomeToday(root,tasks);}
context.subscribe(tasks.completions,renderToday);
mountHabitQuick(root,context,{beforeRender:()=>noticeAnchor.after(homeNotice),afterRender:syncHomeNotice});
context.subscribe(dataStore,({stats}) => {
  renderToday();
  const summary = root.querySelector('#home-stats');
  const [experience, level, currency] = profileSummary(stats).split(' ｜ ');
  summary.textContent = `${level} ｜ ${experience}｜ ${currency}`;
  summary.setAttribute('aria-label', `累積總經驗值：${visibleExperience(stats.experience)}，等級：${stats.level}，目前貨幣：${stats.currency}，累積取得貨幣：${stats.currencyEarned}`);summary.title=summary.getAttribute('aria-label');
  summary.title = summary.getAttribute('aria-label');
},{changesOnly:true,keys:['stats']});

// Responsive tabs share the existing DOM, so switching never resets selections
// and never emits a successful-action event or triggers companion generation.
const activityTabs = root.querySelector('.activity-tabs');
const tabButtons = [...activityTabs.querySelectorAll('button')];
const activityPanels = tabButtons.map((button) => root.querySelector("#"+CSS.escape(button.dataset.panel)));
const updateActivityHeight = createActivityHeightSync(root.querySelector('.home-grid'),activityPanels,context);
const positionActivityTabs = createMobileTabPositioner(activityTabs, updateActivityHeight,{scrollPage:false});
context.onSuspend(()=>positionActivityTabs.cancel());
context.subscribe(dataStore,updateActivityHeight,{changesOnly:true,keys:[]});
const desktopLayout = window.matchMedia('(min-width: 1024px)');

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
  syncHomeNotice();
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
