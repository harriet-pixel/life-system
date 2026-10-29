import {dataStore,profileSummary,visibleExperience} from './data.mjs?v=persona-20261029';
// Move the existing controls; keep their listeners, data source and desktop homes.
export function mountDailyHeader(root,context,kind){
 const main=root.querySelector('#main'),media=matchMedia('(width < 1024px)'),header=document.createElement('header');header.className='daily-mobile-header';header.hidden=true;
 header.innerHTML='<div class="daily-header-date"></div><div class="daily-header-info"><div class="daily-notice-content" data-daily-notice></div><div class="daily-header-actions"></div></div><div class="daily-header-stats"></div><div class="daily-header-tabs"></div>';
 main.prepend(header);const find=s=>root.querySelector(s),slot=s=>header.querySelector(s),anchors=new Map();
 const remember=node=>{if(!node)return;const anchor=document.createComment('desktop position');node.before(anchor);anchors.set(node,anchor);};
 let date=find('.date-block');if(!date){date=document.createElement('div');date.className='date-block';date.innerHTML='<time><span class="date-numbers"><span class="date-month"></span><span class="date-divider">/</span><span class="date-day"></span></span><span class="date-detail"></span></time>';slot('.daily-header-date').append(date);}else remember(date);
 const notice=find('#operation-status'),tabs=find(kind==='tasks'?'.task-content-tabs':kind==='habits'?'.habit-content-tabs':'.activity-tabs'),stats=kind==='home'?find('#home-stats'):document.createElement('div');
 if(kind!=='home'){stats.id='daily-stats';stats.className='profile-summary';stats.setAttribute('role','group');}else remember(stats);remember(tabs);
 const summary=kind==='tasks'?find('.task-notice-group'):kind==='habits'?find('#monthly-mobile'):notice;
 const controls=kind==='tasks'?[find('#toggle-calendar'),find('#task-settings')]:kind==='habits'?[find('#open-habit-settings'),find('#add-bonus')]:[];
 if(kind==='habits'){remember(summary);remember(notice);}controls.forEach(remember);
 if(kind!=='home')context.subscribe(dataStore,({stats:data})=>{const [experience,level,currency]=profileSummary(data).split(' ｜ ');stats.textContent=`${level} ｜ ${experience}｜ ${currency}`;stats.setAttribute('aria-label',`累積總經驗值：${visibleExperience(data.experience)}，等級：${data.level}，貨幣：${data.currency}`);},{changesOnly:true,keys:['stats'],distinct:true});
 let raw=notice.textContent,shown=raw,frame;
 function clamp(){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(!context.active)return;if(notice.textContent!==shown)raw=notice.textContent;let text=raw;notice.textContent=text;
  if(media.matches&&notice.scrollHeight>notice.clientHeight+1){const chars=[...raw];let low=0,high=chars.length;while(low<high){const mid=Math.ceil((low+high)/2);notice.textContent=chars.slice(0,mid).join('')+'....';if(notice.scrollHeight<=notice.clientHeight+1&&notice.scrollWidth<=notice.clientWidth+1)low=mid;else high=mid-1;}text=chars.slice(0,low).join('')+'....';}
  shown=text;if(notice.textContent!==text)notice.textContent=text;notice.title=text===raw?'':raw;if(text!==raw)notice.setAttribute('aria-description',raw);else notice.removeAttribute('aria-description');});}
 const mutation=new MutationObserver(()=>{if(notice.textContent!==shown)clamp();});const watch=()=>mutation.observe(notice,{childList:true,subtree:true,characterData:true});watch();context.onSuspend(()=>{mutation.disconnect();cancelAnimationFrame(frame);});context.onResume(()=>{watch();clamp();});
 const resize=new ResizeObserver(clamp);context.observe(resize,[header]);
 function layout(){header.hidden=!media.matches;main.classList.toggle('daily-mobile-active',media.matches);
  if(media.matches){slot('.daily-header-date').append(date);slot('[data-daily-notice]').append(summary);if(kind==='habits')slot('[data-daily-notice]').append(notice);slot('.daily-header-actions').append(...controls.filter(Boolean));slot('.daily-header-stats').append(stats);slot('.daily-header-tabs').append(tabs);notice.hidden=false;}
  else{for(const [node,anchor]of anchors)if(anchor.parentNode)anchor.after(node);}clamp();}
 context.listen(media,'change',layout);context.onResume(layout);layout();
 const refresh=()=>globalThis.LifeHomeDate?.render(root);refresh();if(kind!=='home'){let timer;const start=()=>{refresh();clearInterval(timer);timer=setInterval(refresh,60000);};start();context.onSuspend(()=>clearInterval(timer));context.onResume(start);context.listen(window,'focus',refresh);context.listen(document,'visibilitychange',()=>{if(!document.hidden)refresh();});}
}
