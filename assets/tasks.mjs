import {dataStore} from './data.mjs?v=tasks-data-2';
import {localDate,addDays,rowsForDate,categoryName,weekday,isOverdue} from './tasks-model.mjs?v=three-day-3';
import {taskActions} from './task-actions.mjs?v=three-day-3';
import {mountTaskCompanion} from './task-companion.mjs';
import {createTaskEditor} from './task-editor.mjs?v=three-day-3';
import {createCategoryManager} from './task-categories.mjs?v=three-day-3';
export function mountTasks(root,context){
 const $=s=>root.querySelector(s),actions=taskActions(root,context);mountTaskCompanion(root,context);
 const desktop=matchMedia('(min-width:1024px)');let mobileCalendarOpen=false;
 const syncCalendar=()=>{const expanded=desktop.matches||mobileCalendarOpen,calendar=$('#task-calendar');if(!expanded&&calendar.contains(document.activeElement))$('#toggle-calendar').focus({preventScroll:true});calendar.hidden=!expanded;$('#toggle-calendar').setAttribute('aria-expanded',String(expanded));};
 let lastToday=localDate();
 let selected=localDate(),followToday=true,month=selected.slice(0,7),selection=new Map(),limits={},renderingData;
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
 const button=(text,handler)=>{const node=el('button',text);node.type='button';node.onclick=()=>Promise.resolve().then(handler).catch(e=>actions.say(e.message));return node;};
 const run=work=>actions.attempt(work).catch(()=>{});
 const completionBusy=context.hooks.busy;
 const editor=createTaskEditor(root,context,actions),categories=createCategoryManager(root,context,actions);
 const openEditor=(task=null,date=null)=>editor.open(task,date);
 context.setHooks({hasDraft:()=>editor.hasDraft()||categories.hasDraft(),busy:()=>context.active&&(editor.busy()||categories.busy()||Boolean(completionBusy?.()))});
 const dateDialog=el('dialog');dateDialog.className='task-dialog';dateDialog.setAttribute('aria-labelledby','schedule-dialog-title');dateDialog.innerHTML='<form><h2 id="schedule-dialog-title">安排日期</h2><label>日期<input name="date" type="date" required></label><p role="alert"></p><div class="task-buttons"><button type="button">取消</button><button type="submit">確認安排</button></div></form>';root.append(dateDialog);let scheduleWork,focus;
 dateDialog.querySelector('[type=button]').onclick=()=>dateDialog.close();dateDialog.addEventListener('close',()=>focus?.focus({preventScroll:true}));
 function askDate(work){scheduleWork=work;focus=document.activeElement;dateDialog.querySelector('input').value=selected;dateDialog.querySelector('p').textContent='';dateDialog.showModal();}
 dateDialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=dateDialog.querySelector('[type=submit]');b.disabled=true;try{await scheduleWork(dateDialog.querySelector('input').value);dateDialog.close();actions.say('日期安排已儲存。');}catch(error){dateDialog.querySelector('p').textContent=error.message;}finally{b.disabled=false;}};
 const confirm=message=>window.confirm(message);
 function row(task,o=null){const data=renderingData??dataStore.get().tasks,c=o?.status==='done'?data.completions.find(c=>c.id===o.completionId):null,node=el('article',undefined,'task-item');node.dataset.taskId=task.id;if(o)node.dataset.date=o.date;
 const heading=el('label',undefined,'task-item-heading'),done=el('input');done.type='checkbox';done.checked=Boolean(c);done.setAttribute('aria-label',`${c?'取消完成':'完成'} ${c?.name??task.name}`);done.onchange=()=>{done.checked=Boolean(c);if(c)run(()=>actions.cancel(task.id,o.date));else actions.complete(task.id,o?.date);};heading.append(done,el('span',c?.name??task.name,'task-item-name'));node.append(heading,el('p',`${c?.category??categoryName(data,task)} · ${c?.points??task.points} 點${c?' · ✓ 已完成':''}`,'small-note'));
 if(isOverdue(o)){const select=el('label','選取逾期事項'),input=el('input');input.type='checkbox';input.checked=selection.has(o.id);input.onchange=()=>{if(input.checked)selection.set(o.id,{taskId:task.id,date:o.date});else selection.delete(o.id);$('#selected-count').textContent=`已選 ${selection.size} 筆逾期`;};select.prepend(input);node.append(el('p',`原訂 ${o.originalDate}${o.originalDate!==o.date?' · 目前 '+o.date:''}`,'small-note'),select);}
 const controls=el('div',undefined,'task-item-controls');if(!c){controls.append(button('安排日期',()=>askDate(date=>actions.service.arrange(task.id,date,o?.date))),button('編輯',()=>openEditor(task,o?.date??null)));if(isOverdue(o))controls.append(button('不再處理',()=>confirm('將此筆逾期事項標記為不再處理？不發放獎勵。')&&run(()=>actions.service.batch([{taskId:task.id,date:o.date}]))));if(o)controls.append(button('刪除本次',()=>confirm('只刪除此日期安排；重複週期及完成歷史會保留。')&&run(()=>actions.service.remove(task.id,o.date))));else controls.append(button('刪除事項',()=>confirm(task.kind==='repeat'?'刪除整個重複事項及未完成安排？既有完成歷史與獎勵會保留。':'刪除此事項？完成歷史會保留。')&&run(()=>actions.service.remove(task.id))));node.draggable=matchMedia('(min-width:1024px)').matches;node.ondragstart=e=>e.dataTransfer.setData('text/plain',JSON.stringify({taskId:task.id,date:o?.date??null}));}node.append(controls);return node;}
 const menu=el('dialog');menu.className='task-dialog';menu.id='task-item-menu';menu.setAttribute('aria-labelledby','task-item-menu-title');let menuFocus;
 menu.addEventListener('close',()=>{if(menuFocus?.isConnected)menuFocus.focus({preventScroll:true});else $('#new-task').focus({preventScroll:true});});root.append(menu);
 function openMenu(task,o){menuFocus=document.activeElement;menu.replaceChildren(el('h2',task.name));menu.firstElementChild.id='task-item-menu-title';const controls=el('div',undefined,'task-menu-actions');
  controls.append(button('編輯事項',()=>{menu.close();return openEditor(task,o.date);}));
  const removeOne=button(task.kind==='repeat'?'刪除此日安排':'刪除事項',async()=>{if(!confirm(task.kind==='repeat'?'只刪除此日安排？其他日期及重複週期會保留。':'刪除此事項？'))return;await actions.attempt(()=>actions.service.remove(task.id,o.date));menu.close();});removeOne.disabled=o.status==='done';controls.append(removeOne);
  if(task.kind==='repeat')controls.append(button('刪除整個重複事項',async()=>{if(!confirm('刪除整個重複事項及全部未完成安排？既有完成歷史與獎勵會保留。'))return;await actions.attempt(()=>actions.service.remove(task.id));menu.close();}));
  if(o.status==='done')menu.append(el('p','已完成紀錄保留歷史；須先安全取消完成，才能刪除此日安排。','small-note'));
  controls.append(button('關閉',()=>menu.close()));menu.append(controls);menu.showModal();
 }
 function dailyRow(r){const {task,occurrence:o}=r,node=el('article',undefined,'task-daily-row');node.dataset.taskId=task.id;node.dataset.date=o.date;
  const check=el('label',undefined,'task-check-control'),input=el('input');input.type='checkbox';input.checked=o.status==='done';input.setAttribute('aria-label',`${input.checked?'取消完成':'完成'} ${r.name}`);input.onchange=()=>{input.checked=o.status==='done';if(input.checked)actions.cancel(task.id,o.date).catch(()=>{});else actions.complete(task.id,o.date);};check.append(input);
  const name=button(r.name,()=>openMenu(task,o));name.className='task-daily-name';const category=renderingData.categories.find(c=>c.id===task.categoryId);if(category?.color)name.style.color=category.color;node.append(check,name);return node;
 }
 function choose(date,follow=false){selected=date;followToday=follow;month=date.slice(0,7);limits={};render();}
 function render(){syncCalendar();const focused=document.activeElement,focusedDate=focused?.closest('#month-grid')?focused.getAttribute('aria-label')?.slice(0,10):null,focusedRow=focused?.closest('.task-daily-row'),focusedTask=focusedRow?.dataset.taskId,focusedRowDate=focusedRow?.dataset.date,focusedCheckbox=focused?.matches('input[type=checkbox]');const today=localDate();if(today!==lastToday){if(followToday&&month===lastToday.slice(0,7))month=today.slice(0,7);if(followToday&&selected===lastToday)selected=today;lastToday=today;}const data=dataStore.get().tasks;renderingData=data;const definitionsById=new Map(data.definitions.map(t=>[t.id,t])),scheduledTasks=new Set(data.occurrences.map(o=>o.taskId));const visible=[addDays(selected,-1),selected,addDays(selected,1)];
 $('#schedule').replaceChildren(...visible.map(date=>{
  const day=el('section',undefined,'task-day'),heading=el('div',undefined,'task-day-heading');day.dataset.date=date;
  const title=`${date}（${['日','一','二','三','四','五','六'][weekday(date)]}）${date===today?' 今天':date===addDays(today,-1)?' 昨天':date===addDays(today,1)?' 明天':''}`;
  const add=button('＋',()=>openEditor(null,date));add.className='task-day-add';add.setAttribute('aria-label',`新增 ${date} 的事項`);heading.append(el('h2',title),add);day.append(heading);
  const rows=rowsForDate(data,date);if(!rows.length)day.append(el('p','尚無事項','small-note'));const limit=limits[date]??30;
  rows.slice(0,limit).forEach(r=>day.append(dailyRow(r)));if(rows.length>limit)day.append(button(`顯示更多（共 ${rows.length} 筆）`,()=>{limits[date]=limit+30;render();}));
  day.ondragover=e=>e.preventDefault();day.ondrop=e=>{e.preventDefault();try{const item=JSON.parse(e.dataTransfer.getData('text/plain'));run(()=>actions.service.arrange(item.taskId,date,item.date));}catch{actions.say('無法辨識拖曳的事項。');}};return day;
 }));
 const filter=$('#category-filter');let cat=filter.value;filter.replaceChildren(new Option('全部分類',''),new Option('未定義','none'),...data.categories.map(c=>new Option(c.name,c.id)));filter.value=cat;cat=filter.value;
 const matches=t=>t.name.toLocaleLowerCase().includes($('#task-search').value.toLocaleLowerCase())&&(!cat||(cat==='none'?t.categoryId===null:t.categoryId===cat))&&(!$('#type-filter').value||t.kind===$('#type-filter').value);
 const sort=(a,b)=>$('#task-sort').value==='points'?b.task.points-a.task.points:($('#task-sort').value==='old'?1:-1)*a.task.createdAt.localeCompare(b.task.createdAt);
 const overdue=data.occurrences.filter(o=>isOverdue(o,today)).map(o=>({task:definitionsById.get(o.taskId),o})).filter(r=>r.task&&!r.task.deleted);
 const ids=new Set(overdue.map(r=>r.o.id));for(const id of selection.keys())if(!ids.has(id))selection.delete(id);$('#selected-count').textContent=`已選 ${selection.size} 筆逾期`;
 const sections=[['未安排事項',data.definitions.filter(t=>!t.deleted&&t.kind==='once'&&!t.date&&!data.occurrences.some(o=>o.taskId===t.id&&o.status!=='unarranged')).map(task=>({task}))],['逾期未完成',overdue],['重複事項庫',data.definitions.filter(t=>!t.deleted&&t.kind==='repeat').map(task=>({task}))]];
 $('#pool-lists').replaceChildren(...sections.map(([name,items])=>{const section=el('section'),all=items.filter(r=>matches(r.task)).sort(sort),limit=limits[name]??40;section.append(el('h2',`${name}（${all.length}）`));if(!all.length)section.append(el('p','目前沒有事項','small-note'));all.slice(0,limit).forEach(r=>section.append(row(r.task,r.o)));if(all.length>limit)section.append(button('顯示更多',()=>{limits[name]=limit+40;render();}));return section;}));
 $('#month-label').textContent=month;const first=month+'-01',next=new Date(first+'T12:00:00');next.setMonth(next.getMonth()+1);const count=Number(addDays(localDate(next),-1).slice(-2));const cells=[];for(const name of ['一','二','三','四','五','六','日'])cells.push(el('span',name));for(let i=0;i<(weekday(first)+6)%7;i++)cells.push(el('span',''));for(let i=1;i<=count;i++){const date=month+'-'+String(i).padStart(2,'0');const b=button(String(i),()=>choose(date));b.setAttribute('aria-label',`${date}${date===today?' 今天':''}${date===selected?' 已選取':''}`);if(date===today)b.setAttribute('aria-current','date');b.setAttribute('aria-pressed',String(date===selected));cells.push(b);}$('#month-grid').replaceChildren(...cells);
 if(!focused?.isConnected&&!root.querySelector('dialog[open]')){const replacement=focusedDate?[...$('#month-grid').querySelectorAll('button')].find(b=>b.getAttribute('aria-label').startsWith(focusedDate)):focusedTask?[...$('#schedule').querySelectorAll('.task-daily-row')].find(n=>n.dataset.taskId===focusedTask&&n.dataset.date===focusedRowDate)?.querySelector(focusedCheckbox?'input':'.task-daily-name'):null;replacement?.focus({preventScroll:true});}
 }
 $('#new-task').onclick=()=>openEditor().catch(e=>actions.say(e.message));$('#manage-categories').onclick=()=>categories.open().catch(e=>actions.say(e.message));$('#today').onclick=()=>choose(localDate(),true);$('#toggle-calendar').onclick=()=>{mobileCalendarOpen=!mobileCalendarOpen;syncCalendar();};
 for(const [id,delta]of [['previous-month',-1],['next-month',1]])$('#'+id).onclick=()=>{const d=new Date(month+'-01T12:00:00');d.setMonth(d.getMonth()+delta);month=localDate(d).slice(0,7);render();};
 for(const id of ['task-search','category-filter','type-filter','task-sort'])$('#'+id).addEventListener('input',()=>{limits={};render();});
 $('#batch-skip').onclick=()=>{const items=[...selection.values()];if(confirm(`將 ${items.length} 筆逾期事項標記為不再處理？不發放獎勵。`))run(()=>actions.service.batch(items));};$('#batch-arrange').onclick=()=>{const items=[...selection.values()];if(!items.length){actions.say('請先選取逾期事項。');return;}askDate(date=>confirm(`確認將 ${items.length} 筆事項全部安排到 ${date}？任一衝突將整批取消。`)?actions.service.batch(items,date):Promise.reject(new Error('已取消批次安排。')));};
 context.subscribe(dataStore,render);context.listen(desktop,'change',render);context.onResume(render);
}
