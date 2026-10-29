import {mountColorField} from './color-field.mjs?v=storage-rescue-20261028';
import {beginSaveTrace,captureSubmitStart,setSaving} from './save-diagnostics.mjs?v=storage-rescue-20261028';
import {dataStore} from './data.mjs?v=persona-20261029';
import {holdDraft} from './coordination.mjs?v=interaction-perf-20261028';

export function createCategoryManager(root,context,actions){
 const dialog=document.createElement('dialog');
 dialog.className='task-dialog';dialog.id='category-manager';dialog.setAttribute('aria-labelledby','category-manager-title');
 dialog.innerHTML='<h2 id="category-manager-title">管理分類</h2><div data-category-list></div><p data-category-list-error role="alert" hidden></p><div class="task-buttons"><button type="button" data-category-new>新增分類</button><button type="button" data-category-close>關閉</button></div>';
 const editor=document.createElement('dialog');
 editor.className='task-dialog';editor.id='category-editor';editor.setAttribute('aria-labelledby','category-editor-title');
 editor.innerHTML='<form><h2 id="category-editor-title">新增分類</h2><label>分類名稱<input name="categoryName" required></label><label>文字顏色<input name="categoryColor" placeholder="#222222" spellcheck="false"></label><p class="small-note">留白使用預設文字色。</p><label>選擇顏色<input type="color" name="colorPicker" value="#222222"></label><p data-category-preview>分類文字預覽</p><p data-category-error role="alert"></p><div class="task-buttons"><button type="button" data-category-cancel>取消</button><button type="submit">儲存分類</button></div></form>';
 root.append(dialog,editor);
 const form=editor.querySelector('form'),submitStart=captureSubmitStart(form),field=name=>form.elements.namedItem(name),error=editor.querySelector('[data-category-error]'),listError=dialog.querySelector('[data-category-list-error]');
 let listRoot=dialog;
 let editing=null,release,focus,busy=false,opening=false,mode='closed',ignoredListCloses=0,editorTrigger=null,externalReturn=null,savedId=null,embedded=null;
 const icons={edit:'<path d="m15 4 5 5M4 20l4-1L20 7a2 2 0 0 0-5-5L3 14l-1 7Z"/>',remove:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>'};
 function iconButton(kind,label){const button=document.createElement('button');button.type='button';button.className='category-icon-button';button.setAttribute('aria-label',label);button.title=label;button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+icons[kind]+'</svg>';return button;}
 mountColorField(field('colorPicker'));const updateColorPreview=mountColorField(field('categoryColor'));
 function preview(){updateColorPreview();const color=field('categoryColor').value;editor.querySelector('[data-category-preview]').style.color=/^#[0-9a-f]{6}$/i.test(color)?color:'';if(/^#[0-9a-f]{6}$/i.test(color))field('colorPicker').value=color;}
 field('colorPicker').oninput=()=>{field('categoryColor').value=field('colorPicker').value;preview();};field('categoryColor').oninput=preview;
 function restoreListFocus(){const target=editorTrigger?.kind==='edit'?[...listRoot.querySelectorAll('[data-category-edit]')].find(b=>b.dataset.categoryEdit===editorTrigger.id):null;(target??listRoot.querySelector('[data-category-new]')).focus({preventScroll:true});}
 function openEditor(category=null){
  if(busy||mode!=='list')return;
  editing=category?structuredClone(category):null;editorTrigger=category?{kind:'edit',id:category.id}:{kind:'new'};
  savedId=null;form.reset();field('categoryName').value=category?.name??'';field('categoryColor').value=category?.color??'';editor.querySelector('h2').textContent=category?'編輯分類':'新增分類';error.textContent='';preview();
  // Keep the draft lease across this transition, while only one modal owns focus.
  mode='form';if(embedded)embedded.pause();else{ignoredListCloses++;dialog.close();}editor.showModal();context.notify();
 }
 function render(){
  const list=listRoot.querySelector('[data-category-list]'),focused=document.activeElement,focusId=focused?.dataset.categoryEdit??focused?.dataset.categoryRemove,focusKind=focused?.hasAttribute('data-category-edit')?'edit':'remove';
  list.replaceChildren();
  for(const category of dataStore.getFields(['tasks']).tasks.categories){
   const row=document.createElement('div');row.className='category-management-row';
   const name=document.createElement('span');name.textContent=category.name;name.style.color=category.color??'';
   const edit=iconButton('edit',`編輯分類 ${category.name}`);edit.dataset.categoryEdit=category.id;edit.onclick=()=>openEditor(category);
   const remove=iconButton('remove',`刪除分類 ${category.name}`);remove.dataset.categoryRemove=category.id;
   remove.onclick=async()=>{
    if(busy||!window.confirm(`刪除「${category.name}」分類？事件不會刪除，將改為未定義；完成獎勵保持不變。`))return;
    busy=true;listError.hidden=true;context.notify();
    try{await actions.service.removeCategory(category.id,category);actions.say('分類已刪除，原事件保留並改為未定義。');}
    catch(e){listError.textContent=e.message;listError.hidden=false;}
    finally{busy=false;context.notify();}
   };
   const moves=[-1,1].map(direction=>{const b=document.createElement('button');b.type='button';b.className='category-icon-button';b.textContent=direction<0?'↑':'↓';b.setAttribute('aria-label',`${direction<0?'上移':'下移'}分類 ${category.name}`);const all=dataStore.getFields(['tasks']).tasks.categories,index=all.findIndex(c=>c.id===category.id);b.disabled=direction<0?index===0:index===all.length-1;b.onclick=async()=>{if(busy)return;busy=true;context.notify();try{await actions.service.moveCategory(category.id,direction);actions.say('分類順序已更新。');}catch(e){listError.textContent=e.message;listError.hidden=false;}finally{busy=false;context.notify();}};return b;});row.append(name,...moves,edit,remove);list.append(row);
  }
  if(!list.childElementCount){const note=document.createElement('p');note.className='small-note';note.textContent='尚無分類。';list.append(note);}
  if(mode==='list'&&(dialog.open||embedded)&&focusId&&!focused.isConnected){const target=[...listRoot.querySelectorAll(focusKind==='edit'?'[data-category-edit]':'[data-category-remove]')].find(b=>(b.dataset.categoryEdit??b.dataset.categoryRemove)===focusId);(target??listRoot.querySelector('[data-category-new]')).focus({preventScroll:true});}
 }
 form.onsubmit=async event=>{
  event.preventDefault();if(busy)return;const timing=beginSaveTrace(editing?'category.edit':'category.create',submitStart());let outcome='failed';busy=true;setSaving(form,true);context.notify();
  try{const values={name:field('categoryName').value,color:field('categoryColor').value||null};if(editing){await actions.service.updateCategory(editing.id,values,editing);savedId=editing.id;}else savedId=await actions.service.category(values.name,values.color);const noticeAt=performance.now();actions.say('分類已儲存。');timing.phase('notice',noticeAt);const closeAt=performance.now();editor.close();timing.phase('close',closeAt);outcome='success';}
  catch(e){error.textContent=e.message;}
  finally{busy=false;setSaving(form,false);context.notify();timing.finish(outcome);}
 };
 editor.querySelector('[data-category-cancel]').onclick=()=>{if(!busy)editor.close();};editor.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 editor.addEventListener('close',()=>{if(externalReturn){const back=externalReturn;externalReturn=null;mode=embedded?'list':'closed';back(savedId);context.notify();return;}mode='list';render();if(context.active){if(embedded)embedded.resume();else dialog.showModal();restoreListFocus();}context.notify();});
 listRoot.querySelector('[data-category-new]').onclick=()=>openEditor();
 dialog.querySelector('[data-category-close]').onclick=()=>{if(!busy){if(embedded)embedded.close();else dialog.close();}};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 dialog.addEventListener('close',()=>{
  if(ignoredListCloses){ignoredListCloses--;return;}
  mode='closed';release?.();release=null;
  if(context.active)(focus?.isConnected?focus:root.querySelector('#manage-categories')).focus({preventScroll:true});context.notify();
 });
 context.subscribe(dataStore,render,{changesOnly:true,keys:[]});
 context.onResume(()=>{if(mode==='list'&&!embedded&&!dialog.open){dialog.showModal();restoreListFocus();}});
 return {
  attach(container,callbacks){embedded=callbacks;while(dialog.firstChild)container.append(dialog.firstChild);listRoot=container;mode='list';render();},
  detach(){while(listRoot!==dialog&&listRoot.firstChild)dialog.append(listRoot.firstChild);listRoot=dialog;embedded=null;mode='closed';},
  async create(back){if(busy||editor.open)return;externalReturn=back;savedId=null;editing=null;mode='external';form.reset();editor.querySelector('h2').textContent='新增分類';error.textContent='';preview();editor.showModal();context.notify();},
  async open(){if(mode!=='closed'||opening)return;opening=true;try{release=await holdDraft('tasks');focus=document.activeElement;mode='list';listError.hidden=true;render();dialog.showModal();context.notify();}finally{opening=false;}},
  hasDraft:()=>mode!=='closed',busy:()=>busy,
 };
}
