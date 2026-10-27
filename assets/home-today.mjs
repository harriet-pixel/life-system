import {dataStore} from './data.mjs?v=chat-20261027';
import {rowsForDate,localDate} from './tasks-model.mjs?v=companion-images-20261027';

import {sortDay,listSettings} from './task-view-model.mjs?v=task-home-polish-20261027';

// One renderer and one validated store for early reading and interactive mounting.
export function renderHomeToday(root,actions=null){
 const todayList=root.querySelector('.task-list');
 if(actions){
  todayList.dataset.todayInteractive='true';
  todayList.dispatchEvent(new Event('life-system:home-tasks-ready'));
 }
 globalThis.LifeHomeDate?.render(root);
 const snapshot=dataStore.get(),rows=sortDay(snapshot.tasks,rowsForDate(snapshot.tasks,localDate()),listSettings(snapshot.tasks));
 todayList.replaceChildren(...rows.map(row=>{
  const li=document.createElement('li'),label=document.createElement('div');
  li.dataset.rewardTask=row.task.id;li.dataset.rewardDate=row.occurrence.date;
  label.className='task-row';
  const input=document.createElement('input');input.type='checkbox';input.dataset.task='';
  const pending=Boolean(actions?.isPending(row.task.id,row.occurrence.date));
  input.checked=row.occurrence.status==='done'||pending;input.disabled=!actions||pending;
  input.setAttribute('aria-busy',String(!actions||pending));
  li.classList.toggle('is-processing',pending);li.setAttribute('aria-busy',String(pending));
  input.setAttribute('aria-label',!actions?`操作準備中：${row.name}`:pending?`處理中，尚未提交完成 ${row.name}`:`${input.checked?'取消完成':'完成'} ${row.name}`);
  if(actions)input.onchange=()=>{
   const done=row.occurrence.status==='done';
   if(actions.isPending(row.task.id,row.occurrence.date))return;
   input.checked=true;
   if(done)actions.cancel(row.task.id,row.occurrence.date).catch(()=>{});
   else actions.complete(row.task.id,row.occurrence.date);
  };
  const name=document.createElement('button');name.type='button';name.disabled=!actions;name.onclick=()=>actions?.openMenu(row.task,row.occurrence);name.className='task-content';name.textContent=row.name;
  const color=snapshot.tasks.categories.find(c=>c.id===row.task.categoryId)?.color;
  if(color)name.style.setProperty('--home-task-color',color);
  if(row.brief){
   const brief=document.createElement('span');brief.className='task-occurrence-brief';
   brief.textContent=row.brief;name.append(brief);
  }
  const category=document.createElement('span');category.className='task-time';
  category.textContent=row.category+(row.occurrence.status==='done'?' · 已完成':'');
  label.append(input,name,category);li.append(label);return li;
 }));
 if(!rows.length){
  const li=document.createElement('li');li.className='small-note';
  li.textContent='今天尚無待辦，點選「新增事件」安排生活。';todayList.append(li);
 }
 root.querySelector('#task-count').textContent=`${rows.filter(r=>r.occurrence.status==='done').length} / ${rows.length} 完成`;
}
