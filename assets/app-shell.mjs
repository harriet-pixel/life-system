import {createCloudRestore} from './cloud-restore.mjs?v=habits-20261026';
import {getCloudBackup} from './cloud-backup.mjs?v=habits-20261026';
import {setOperationNotice} from './operation-notice.mjs?v=habits-20261026';
import {initializeUIFeedback} from './ui-feedback.mjs?v=habits-20261026';
import {ownsCompletionAI} from './task-completion.mjs?v=habits-20261026';
import {navigationItems,isCurrentRoute,initializeNavigation} from './navigation.mjs?v=habits-20261026';
import {persistentUndo,dataStore} from './data.mjs?v=habits-20261026';
import {createPageLifecycle} from './page-lifecycle.mjs?v=habits-20261026';
import {initializeNavigationSize} from './navigation-size.mjs?v=habits-20261026';
import {mountAIPage} from './ai-page.mjs?v=habits-20261026';
import {getSharedAIConnection} from './ai-runtime.mjs?v=habits-20261026';
const routes={habits:{mount:()=>import('./habits.mjs?v=habits-polish-20261026'),export:'mountHabits'},tasks:{mount:()=>import('./tasks.mjs?v=habits-polish-20261026'),export:'mountTasks'},home:{mount:()=>import('./home.js?v=habits-20261026'),export:'mountHome'},profile:{mount:()=>import('./profile.mjs?v=habits-20261026'),export:'mountProfile'},settings:{mount:()=>import('./settings.mjs?v=habits-20261026'),export:'mountSettings'}};
const moduleRetries=new Map(),loadedModules=new Map();
async function importPage(id){if(loadedModules.has(id))return loadedModules.get(id);let module;try{module=await routes[id].mount();}catch(error){const attempt=(moduleRetries.get(id)??0)+1;moduleRetries.set(id,attempt);const file={habits:'habits.mjs',home:'home.js',tasks:'tasks.mjs',profile:'profile.mjs',settings:'settings.mjs'}[id];try{module=await import('./'+file+'?v='+ (id==='home'?'habits-20261026':'habits-20261026')+'&retry='+attempt);}catch(retryError){if(/dynamically imported module|module script|loading dynamically imported/i.test(retryError.message))retryError.code='module';throw retryError;}}loadedModules.set(id,module);return module;}
const refreshURL=new URL(location.href);if(refreshURL.searchParams.has('__life_reload')){refreshURL.searchParams.delete('__life_reload');history.replaceState(history.state,'',refreshURL.href);}
const pageFor=url=>navigationItems.find(item=>item.available&&isCurrentRoute(item.href,url))?.id;
const shell=document.querySelector('.page-shell'),desktop=document.querySelector('.desktop-navigation'),views=new Map(),positions=new Map();
const host=document.createElement('div');host.id='app-view';const announcement=document.createElement('p');announcement.id='route-status';announcement.className='small-note';announcement.setAttribute('role','status');announcement.hidden=true;
let queuedNavigation=null,active=null,navigation,sequence=0,loading=null,navigating=false,index=history.state?.lifeShell?.index??0;
history.scrollRestoration='manual';
const connection=getSharedAIConnection(),cloudRestore=createCloudRestore();
document.addEventListener('life-system:restore-cloud-latest',()=>cloudRestore.open());
function announce(message){const target=active?.id==='tasks'?active.root.querySelector('#operation-status'):announcement;setOperationNotice(target,message);if(target!==announcement)announcement.hidden=true;}

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
 if(!view.mounted){const module=await importPage(view.id);module[routes[view.id].export](view.root,view.context);if(view.id!=='settings')mountAIPage(view.root,view.context);view.mounted=true;}
 else view.context.resume();
 for(const dialog of view.dialogs)if(!dialog.open)dialog.showModal();view.dialogs=[];
}
async function load(url,id,signal){
 if(views.has(id))return views.get(id);
 const response=await fetch(url,{signal,credentials:'same-origin',cache:'no-cache'});if(!response.ok)throw new Error('Page unavailable');
 const doc=new DOMParser().parseFromString(await response.text(),'text/html');
 if(doc.querySelector('meta[name=life-system-shell]')?.content!==document.querySelector('meta[name=life-system-shell]')?.content)throw Object.assign(new Error('Version mismatch'),{code:'version'});
 // Import only our known mount modules; fetched scripts are never executed.
 const view=collect(doc,id);await importPage(id);views.set(id,view);return view;
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
  document.dispatchEvent(new CustomEvent('life-system:route-ready',{detail:{page:id}}));return true;
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
