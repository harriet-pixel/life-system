// The local list does not wait for the shell's editor, AI or backup dependency graph.
// Import errors are handled so unavailable/corrupt storage never stays 'loading'.
import('./home-today.mjs?v=affinity-20261027').then(async({renderHomeToday})=>{
 const root=document.querySelector('main[data-page-view=home]'),list=root?.querySelector('.task-list');
 if(!list||list.dataset.todayInteractive)return;
 const {dataStore}=await import('./data.mjs?v=affinity-20261027');
 if(list.dataset.todayInteractive)return;
 const stop=dataStore.subscribe(()=>renderHomeToday(root),{changesOnly:true});
 list.addEventListener('life-system:home-tasks-ready',stop,{once:true});
}).catch(()=>{
 const list=document.querySelector('main[data-page-view=home] .task-list');
 if(!list||list.dataset.todayInteractive)return;
 const message=document.createElement('li');message.className='small-note';
 message.textContent='無法讀取今日待辦，原資料已保留。請確認瀏覽器儲存權限與網路後重新整理。';
 list.replaceChildren(message);
});
