import {backupStatus} from './cloud-sync-status.mjs?v=daily-polish-20261029';
import {getDriveState,driveAuth,prepareDriveAuth} from './google-drive.mjs?v=daily-polish-20261029';
import {createCloudRestore} from './cloud-restore.mjs?v=daily-polish-20261029';
import {getCloudBackup} from './cloud-backup.mjs?v=daily-polish-20261029';
import {setOperationNotice} from './operation-notice.mjs?v=daily-polish-20261029';
import {initializeUIFeedback} from './ui-feedback.mjs?v=daily-polish-20261029';
import {ownsCompletionAI,getCompletionFlow} from './task-completion.mjs?v=daily-polish-20261029';
import {navigationItems,isCurrentRoute,initializeNavigation} from './navigation.mjs?v=daily-polish-20261029';
import {persistentUndo,dataStore} from './data.mjs?v=daily-polish-20261029';
import {createPageLifecycle} from './page-lifecycle.mjs?v=daily-polish-20261029';
import {initializeNavigationSize} from './navigation-size.mjs?v=daily-polish-20261029';
import {mountDailyHeader} from './daily-header.mjs?v=daily-polish-20261029';
import {getSharedAIConnection} from './ai-runtime.mjs?v=daily-polish-20261029';
const routes={companion:{mount:()=>import('./characters-page.mjs?v=daily-polish-20261029'),export:'mountCharacters'},habits:{mount:()=>import('./habits.mjs?v=daily-polish-20261029'),export:'mountHabits'},tasks:{mount:()=>import('./tasks.mjs?v=daily-polish-20261029'),export:'mountTasks'},home:{mount:()=>import('./home.js?v=daily-polish-20261029'),export:'mountHome'},profile:{mount:()=>import('./profile.mjs?v=daily-polish-20261029'),export:'mountProfile'},settings:{mount:()=>import('./settings.mjs?v=daily-polish-20261029'),export:'mountSettings'}};
const moduleRetries=new Map(),loadedModules=new Map(),prefetchedPages=new Map();
async function importPage(id){if(loadedModules.has(id))return loadedModules.get(id);let module;try{module=await routes[id].mount();}catch(error){const attempt=(moduleRetries.get(id)??0)+1;moduleRetries.set(id,attempt);const file={companion:'characters-page.mjs',habits:'habits.mjs',home:'home.js',tasks:'tasks.mjs',profile:'profile.mjs',settings:'settings.mjs'}[id];try{module=await import('./'+file+'?v='+ 'daily-polish-20261029'+'&retry='+attempt);}catch(retryError){if(/dynamically imported module|module script|loading dynamically imported/i.test(retryError.message))retryError.code='module';throw retryError;}}loadedModules.set(id,module);return module;}
const refreshURL=new URL(location.href);if(refreshURL.searchParams.has('__life_reload')){refreshURL.searchParams.delete('__life_reload');history.replaceState(history.state,'',refreshURL.href);}
const pageFor=url=>navigationItems.find(item=>item.available&&isCurrentRoute(item.href,url))?.id;
const shell=document.querySelector('.page-shell'),desktop=document.querySelector('.desktop-navigation'),views=new Map(),positions=new Map();
const host=document.createElement('div');host.id='app-view';const announcement=document.createElement('p');announcement.id='route-status';announcement.className='small-note';announcement.setAttribute('role','status');announcement.hidden=true;
let queuedNavigation=null,active=null,navigation,sequence=0,loading=null,navigating=false,index=history.state?.lifeShell?.index??0;
history.scrollRestoration='manual';
const connection=getSharedAIConnection(),cloudRestore=createCloudRestore();
document.addEventListener('life-system:restore-cloud-latest',event=>cloudRestore.open({versionId:event.detail?.versionId??null}));
function announce(message){const target=['home','tasks','habits'].includes(active?.id)?active.root.querySelector('#operation-status')??announcement:announcement;setOperationNotice(target,message);if(target!==announcement)announcement.hidden=true;}

document.addEventListener('life-system:cloud-restore-status',event=>{if(['home','tasks','habits'].includes(active?.id))announce(event.detail.message);});

document.addEventListener('life-system:cloud-backup-warning',event=>{if(active?.id!=='settings')announce(event.detail.message);});
function collect(doc,id){
 const main=doc.querySelector('#main');if(!main||!routes[id])throw new Error('Unrecognized page');
 main.querySelector('.desktop-navigation')?.remove();const root=document.createElement('div');root.dataset.pageView=id;root.append(main);
 for(const dialog of [...doc.querySelectorAll('body > dialog:not([data-shell-dialog])')])root.append(dialog);
 const skipped=new WeakMap();
 root.addEventListener('close',event=>{const count=skipped.get(event.target)??0;if(count){skipped.set(event.target,count-1);event.stopImmediatePropagation();}},true);
 const context=createPageLifecycle(root,()=>navigation?.refreshControls()),view={id,root,context,title:doc.title,classes:doc.body.className,dialogs:[],skipped,mounted:false};return view;
}
function suspend(view){
 view.dialogs=[...view.root.querySelectorAll('dialog[open]')];for(const dialog of [...view.dialogs].reverse()){view.skipped.set(dialog,(view.skipped.get(dialog)??0)+1);dialog.close();}
 view.context.suspend();view.root.remove();
}
async function activate(view){
 document.body.className=view.classes;host.replaceChildren(view.root);document.title=view.title;document.body.dataset.page=view.id;
 if(!view.mounted){const module=await importPage(view.id);module[routes[view.id].export](view.root,view.context);if(['home','tasks','habits'].includes(view.id))mountDailyHeader(view.root,view.context,view.id);view.mounted=true;}
 else view.context.resume();
 for(const dialog of view.dialogs)if(!dialog.open)dialog.showModal();view.dialogs=[];
}
async function load(url,id,signal){
 if(views.has(id))return views.get(id);
 const moduleReady=importPage(id);moduleReady.catch(()=>{});
 const warmed=prefetchedPages.get(id);prefetchedPages.delete(id);
 const html=warmed?await warmed:await fetch(url,{signal,credentials:'same-origin',cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Page unavailable');return r.text();});
 const doc=new DOMParser().parseFromString(html,'text/html');
 if(doc.querySelector('meta[name=life-system-shell]')?.content!==document.querySelector('meta[name=life-system-shell]')?.content)throw Object.assign(new Error('Version mismatch'),{code:'version'});
 // Import only our known mount modules; fetched scripts are never executed.
 const view=collect(doc,id);await moduleReady;views.set(id,view);return view;
}
function rememberPosition(){if(active)positions.set(index,{x:scrollX,y:scrollY,focus:active.root.contains(document.activeElement)?document.activeElement:null});}
async function go(url,{pop=false,state=null,initial=false}={}){
 const target=new URL(url,location.href),id=pageFor(target);if(!id)return false;
 if(navigating){queuedNavigation={url,options:{pop,state,initial}};return false;}
 if(active?.context.hooks.busy?.()){
  announce('資料操作進行中，請稍候再切換頁面。');if(pop){const difference=index-(state?.lifeShell?.index??index);if(difference)history.go(difference);}return false;
 }
 const ticket=++sequence;loading?.abort();loading=new AbortController();const previous=active,previousURL=active?.url??location.href,targetIndex=pop?(state?.lifeShell?.index??index):initial?index:index+1;
 let view;
 try{
  view=initial?active:await load(target,id,loading.signal);if(ticket!==sequence)return false;
  rememberPosition();const position=pop?positions.get(targetIndex):null;navigating=true;
  if(previous!==view){if(connection.getState().busy&&!ownsCompletionAI())connection.cancel();if(previous)suspend(previous);active=view;await activate(view);}
  if(ticket!==sequence)return false;
  if(!initial&&!pop)history.pushState({lifeShell:{index:targetIndex}},'',target.href);index=targetIndex;view.url=target.href;
  navigation?.refreshRoutes();navigation?.refreshControls();announcement.hidden=true;
  const destination=view.context.hooks.reveal?.(target.href)||(target.hash?view.root.querySelector('#'+CSS.escape(decodeURIComponent(target.hash.slice(1)))):null);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));if(ticket!==sequence)return false;
  if(!initial&&!view.root.querySelector('dialog[open]'))(position?.focus?.isConnected?position.focus:view.root.querySelector('#main')).focus({preventScroll:true});
  if(position)window.scrollTo({left:position.x,top:position.y,behavior:'instant'});
  else if(destination)destination.scrollIntoView({block:'start',behavior:'instant'});
  else if(!initial)window.scrollTo({top:0,left:0,behavior:'instant'});
  history.replaceState({...history.state,lifeShell:{index}},'',target.href);
  document.dispatchEvent(new CustomEvent('life-system:route-ready',{detail:{page:id}}));if(!initial)announce((pop?'已返回':'已前往')+(navigationItems.find(item=>item.id===id)?.label??'頁面')+'。');return true;
 }catch(error){if(ticket===sequence&&error.name!=='AbortError'){
   if(error.code==='version'||error.code==='module'){if(![...views.values()].some(v=>v.context.hooks.hasDraft?.())){const fresh=new URL(target.href);fresh.searchParams.set('__life_reload',String(Date.now()));location.assign(fresh.href);return false;}announce('網站版本或模組已更新，請先儲存或取消草稿，再切換頁面；資料未清除。');return false;}
   if(view&&previous&&view!==previous){view.context.dispose();views.delete(view.id);active=previous;await activate(previous);}
   if(pop&&previousURL!==location.href)history.replaceState({lifeShell:{index}},'',previousURL);
   navigation?.refreshRoutes();announce('頁面載入失敗，原頁面與草稿已保留，請稍後重試。');
  }return false;}finally{if(ticket===sequence){navigating=false;if(queuedNavigation){const next=queuedNavigation;queuedNavigation=null;queueMicrotask(()=>go(next.url,next.options));}}}

}
const initialId=pageFor(location.href);await importPage(initialId);active=collect(document,initialId);views.set(initialId,active);shell.replaceChildren(desktop,host,announcement);await activate(active);
navigation=initializeNavigation({onCloudRestore:()=>cloudRestore.open(),undoManager:{...persistentUndo,getState:()=>({...persistentUndo.getState(),busy:persistentUndo.getState().busy||Boolean(active?.context.hooks.busy?.())})},onUndoSuccess:()=>active?.context.hooks.onUndoSuccess?.(),onRedoSuccess:()=>active?.context.hooks.onRedoSuccess?.(),onBusyChange:busy=>active?.context.hooks.onBusyChange?.(busy)});
initializeNavigationSize(document.querySelector('.mobile-navigation'));
initializeUIFeedback();
document.addEventListener('click',event=>{
 const link=event.target.closest('a[href]');if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey||link.hasAttribute('download')||link.target&&link.target!=='_self'||link.getAttribute('href')==='#main')return;
 const target=new URL(link.href);if(!pageFor(target))return;event.preventDefault();if(target.href!==location.href)go(target);
});
window.addEventListener('popstate',event=>go(location.href,{pop:true,state:event.state}));
window.addEventListener('beforeunload',event=>{if([...views.values()].some(view=>view.context.hooks.hasDraft?.())){event.preventDefault();event.returnValue='';}});
window.addEventListener('scroll',()=>{if(active&&!navigating)rememberPosition();},{passive:true});
await go(location.href,{initial:true});
// One data source, one global navigation and one AI service for this document.
document.body.dataset.shell='ready';
getCloudBackup();
if(getDriveState().linked)void prepareDriveAuth().catch(()=>{});

// Do not put settlement on the first-paint dependency path.
const startAffinity=()=>import('./affinity-runtime.mjs?v=daily-polish-20261029').catch(()=>{});
if(globalThis.requestIdleCallback)requestIdleCallback(startAffinity,{timeout:2000});else setTimeout(startAffinity,0);

// Local successful actions announce only after the authoritative commit.
let lastActionNoticeAt=-Infinity;
dataStore.subscribeCommits((doc,operation)=>{if(operation&&/^(task\.|habit\.)/.test(operation.type)&&['home','tasks','habits'].includes(active?.id)){if(['habit.check','habit.bonus','habit.bonus-cancel'].includes(operation.type)&&operation.delta){const d=operation.delta;getCompletionFlow().showReward({id:operation.id,reward:{currency:d.currency,experience:d.experience,abilities:Object.fromEntries(d.abilities.map(a=>[a.id,a.value]))}});}lastActionNoticeAt=performance.now();const record=operation,points=record.delta?.currency;announce('已儲存：'+(record?.label??'操作')+(points>0?'，獲得 '+points+' 點':points<0?'，扣回 '+Math.abs(points)+' 點':'')+'。');}},{metadataOnly:true});
document.addEventListener('click',event=>{const tab=event.target.closest('[role=tab]');if(tab&&active?.root.contains(tab)&&['home','tasks','habits'].includes(active.id))announce('已切換至'+tab.textContent.trim()+'。');});
document.addEventListener('close',event=>{if(performance.now()-lastActionNoticeAt>500&&!navigating&&event.target.matches?.('dialog')&&active?.root.contains(event.target)&&['home','tasks','habits'].includes(active.id))announce('已返回。');},true);

// Manual backups do not masquerade as an acknowledged cross-device sync baseline.
const iconCloud=getCloudBackup();const updateCloudIcons=()=>{const state=iconCloud.getState(),status=getDriveState().needsReauth?'授權待更新':backupStatus({connected:getDriveState().connected,online:navigator.onLine,busy:state.busy,pending:state.pending,error:/未完成/.test(state.message)});for(const button of document.querySelectorAll('[data-cloud-restore]')){button.dataset.syncState=status;button.title='雲端備份與還原：'+status;button.setAttribute('aria-label',button.title);}};
iconCloud.subscribe(updateCloudIcons);driveAuth.subscribe(updateCloudIcons);window.addEventListener('online',updateCloudIcons);window.addEventListener('offline',updateCloudIcons);

// Read-only prefetch on hover/focus/touch; never mount views or invoke AI/data actions.
function prepareNavigation(event){const a=event.target.closest?.('.navigation-options a[href]');if(!a)return;const id=pageFor(new URL(a.href));if(!id||id===active?.id||views.has(id)||prefetchedPages.has(id)||navigator.connection?.saveData)return;const ready=fetch(a.href,{credentials:'same-origin',cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Page unavailable');return r.text();});prefetchedPages.set(id,ready);ready.catch(()=>prefetchedPages.delete(id));void importPage(id).catch(()=>{});}
for(const event of ['pointerover','focusin','touchstart'])document.addEventListener(event,prepareNavigation,{passive:true});
