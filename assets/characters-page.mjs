import {mountCharacterImages} from './character-images-ui.mjs?v=replies-20261027';
import {DEFAULT_PENALTIES,validatePenaltySettings} from './affinity-model.mjs?v=replies-20261027';
import {dataStore} from './data.mjs?v=replies-20261027';
import {holdDraft} from './coordination.mjs?v=characters-20261027';
import {createCharacterService} from './characters-service.mjs?v=replies-20261027';
import {CHARACTER_FIELDS,STYLE_FIELDS,RELATIONSHIP_STAGES,relationshipStage,normalizeCharacter} from './characters-model.mjs?v=replies-20261027';

// The shared shell keeps this module lazy. Its CSS is loaded only on this route.
if(typeof document!=='undefined'){
 const url=new URL('./characters.css?v=replies-20261027',import.meta.url).href;
 const existing=[...document.querySelectorAll('link[rel=stylesheet]')].find(link=>link.href===url);
 if(!existing?.sheet){
  existing?.remove();
  await new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href=url;link.onload=resolve;link.onerror=()=>{link.remove();reject(new Error('夥伴頁面樣式載入失敗，請稍後再試。'));};document.head.append(link);});
 }
}

// One mounted editor and one selected character draft. Tabs never read the ledger
// or write data; all formal operations still belong to the existing services.
export function mountCharacters(root,context){
 const $=selector=>root.querySelector(selector),service=createCharacterService(dataStore);
 const form=$('#character-form'),select=$('#character-select'),policyForm=$('#affinity-policy-form');
 const settingInputs=new Map(),stageInputs=new Map(),stageButtons=[];
 let snapshot,selected=null,base=null,draft=null,stage=1,current=null,readError=false;
 let roleDirty=false,policyDirty=false,policyBase=null,busy=false,release=null,held=null,draftToken=0,optionSignature='';
 let images,chat=null,chatImport=null,replies=null,replyImport=null;
 const loadChat=()=>{if(chat)return Promise.resolve(chat);return chatImport??=import('./chat-page.mjs?v=replies-20261027').then(module=>{chat=module.mountChat(root,context,{store:dataStore,getCharacter:()=>readError?null:current,getSnapshot:()=>snapshot,images,onDraft:()=>context.notify()});chat.activate();return chat;}).catch(error=>{chatImport=null;$('#chat-status').textContent='聊天室載入失敗，角色設定仍可使用；請切換頁籤後重試。';throw error;});};
 const dirty=()=>roleDirty||policyDirty||Boolean(images?.hasDraft())||Boolean(replies?.hasDraft());
 const notify=message=>{$('#operation-status').textContent=message;};
 const policySignature=settings=>JSON.stringify(['enabled','chat','tasks','habits','limit'].map(k=>settings[k]));
 function draftNotice(){
  $('#character-draft').textContent=dirty()?'尚未儲存：'+[roleDirty?'角色設定':'',policyDirty?'全站扣分設定':''].filter(Boolean).join('、')+'。站內切頁會保留草稿。':'';
  context.notify();
 }
 function free(scope){
  if(scope==='role')roleDirty=false;else if(scope==='policy')policyDirty=false;
  if(!roleDirty&&!policyDirty){draftToken++;release?.();release=null;}
  draftNotice();
 }
 async function protect(kind){
  if(kind==='role')roleDirty=true;else policyDirty=true;
  draftNotice();if(release||held)return;
  const token=++draftToken;
  let stale=false;
  held=holdDraft('companion').then(fn=>{if(token!==draftToken){stale=true;fn();return;}release=fn;}).catch(error=>notify(error.message)).finally(()=>{held=null;if(stale&&dirty()&&!release)void protect(roleDirty?'role':'policy');});
  await held;
 }
 function fitMany(inputs){
  const visible=[...inputs].filter(input=>input.getClientRects().length);
  for(const input of visible)input.style.height='auto';
  const heights=visible.map(input=>Math.min(input.scrollHeight,Math.max(160,innerHeight*.55)));
  visible.forEach((input,index)=>input.style.height=heights[index]+'px');
 }
 const fitVisible=()=>fitMany(root.querySelectorAll('#character-form textarea'));
 function sizeChat(){
  if($('#chat-panel').hidden||innerWidth>=1024)return;
  const height=window.visualViewport?.height??innerHeight;
  const top=$('#chat-panel').getBoundingClientRect().top+scrollY;
  const navigation=document.querySelector('.mobile-navigation')?.getBoundingClientRect().height??64;
  $('.chat-room').style.setProperty('--chat-room-space',Math.max(0,height-top-navigation-24)+'px');
 }

 function fields(container,definitions,values,prefix,inputs){
  const nodes=[];inputs.clear();
  for(const [key,title]of Object.entries(definitions)){
   const label=document.createElement('label'),caption=document.createElement('span');caption.textContent=title;
   const input=document.createElement(key==='name'||key==='address'?'input':'textarea');
   input.name=prefix+key;input.value=values?.[key]??'';
   if(input.tagName==='TEXTAREA')input.rows=2;
   const hint=document.createElement('span');hint.className='small-note';hint.textContent=(key==='name'||key==='address'?'100':'4000')+' 字以內';
   hint.id='character-help-'+input.name.replaceAll('.','-');input.setAttribute('aria-describedby',hint.id);
   label.append(caption,input,hint);nodes.push(label);inputs.set(key,input);
  }
  container.replaceChildren(...nodes);
 }
 const basic=Object.fromEntries(Object.entries(CHARACTER_FIELDS).slice(0,5));
 const core=Object.fromEntries(Object.entries(CHARACTER_FIELDS).slice(5));
 const basicInputs=new Map(),coreInputs=new Map();
 fields($('#character-basic-fields'),basic,{},'settings.',basicInputs);
 fields($('#character-core-fields'),core,{},'settings.',coreInputs);
 for(const [key,input]of [...basicInputs,...coreInputs])settingInputs.set(key,input);
 function stageLabel(number){const definition=RELATIONSHIP_STAGES[number-1],next=RELATIONSHIP_STAGES[number];return definition.name+'（'+definition.min+(next?'–'+(next.min-1):' 以上')+'）';}
 function updateStages(){
  const actual=current?relationshipStage(current.affinity).stage:null;
  stageButtons.forEach((button,index)=>{
   const number=index+1,value=String(number===stage);if(button.getAttribute('aria-selected')!==value)button.setAttribute('aria-selected',value);button.tabIndex=number===stage?0:-1;
   button.dataset.currentStage=String(number===actual);const marker=button.querySelector('.stage-current'),label=number===actual?'目前關係':'';if(marker.textContent!==label)marker.textContent=label;
  });
  $('#character-stage-panel').setAttribute('aria-labelledby','character-stage-'+stage);
  $('#character-stage-title').textContent='正在編輯：'+stageLabel(stage);
 }
 function showStage(number){
  stage=number;
  fields($('#character-stage-fields'),STYLE_FIELDS,draft?.stages[number]??{},'stage.'+number+'.',stageInputs);
  updateStages();fitMany(stageInputs.values());
 }
 function capture(){
  if(!draft)return;
  for(const [key,input]of settingInputs)draft.settings[key]=input.value;
  for(const [key,input]of stageInputs)draft.stages[stage][key]=input.value;
 }
 for(const definition of RELATIONSHIP_STAGES){
  const button=document.createElement('button');button.type='button';button.id='character-stage-'+definition.stage;
  button.setAttribute('role','tab');button.setAttribute('aria-controls','character-stage-panel');
  const name=document.createElement('span');name.textContent=definition.stage+' '+definition.name;
  const marker=document.createElement('span');marker.className='stage-current';button.append(name,marker);
  const change=number=>{if(number!==stage){capture();showStage(number);}};
  button.onclick=()=>change(definition.stage);
  button.onkeydown=event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
   const number=event.key==='Home'?1:event.key==='End'?7:(stage-1+(event.key==='ArrowRight'?1:6))%7+1;
   change(number);stageButtons[number-1].focus({preventScroll:true});
   const region=$('#character-stage-tabs'),rect=stageButtons[number-1].getBoundingClientRect(),outer=region.getBoundingClientRect();
   region.scrollLeft+=rect.left<outer.left?rect.left-outer.left:rect.right>outer.right?rect.right-outer.right:0;
  };
  stageButtons.push(button);$('#character-stage-tabs').append(button);
 }
 function sameConfig(a,b){
  return a?.characterId===b?.characterId&&a.configVersion===b.configVersion&&a.createdAt===b.createdAt&&
   Object.keys(CHARACTER_FIELDS).every(k=>a.settings[k]===b.settings[k])&&RELATIONSHIP_STAGES.every(s=>Object.keys(STYLE_FIELDS).every(k=>a.stages[s.stage][k]===b.stages[s.stage][k]));
 }
 function loadEditor(character){
  base=character;draft={settings:{...character.settings},stages:structuredClone(character.stages)};
  for(const [key,input]of settingInputs)input.value=draft.settings[key];
  showStage(stage);fitVisible();
 }
 function controls(){
  const disabled=busy||readError;
  for(const node of root.querySelectorAll('.character-toolbar button,#character-select,#character-form input,#character-form textarea,#character-form button,#affinity-policy-form input,#affinity-policy-form button'))node.disabled=disabled;
  select.disabled=busy||!Array.isArray(snapshot?.companion?.characters)||(!snapshot.companion.characters.length&&!base);
  for(const button of stageButtons)button.disabled=disabled||!base;
  $('#character-save').disabled=disabled||!current;
  $('#character-cancel').disabled=busy||!base;
  $('#character-activate').disabled=disabled||!current||current.archived||snapshot?.companion.activeCharacterId===selected||roleDirty;
  $('#character-archive').disabled=disabled||!current||roleDirty;
  $('#character-delete').disabled=disabled||!current||roleDirty;
  $('#character-archive').textContent=current?.archived?'取消封存':'封存角色';
 }
 function render(state){
  snapshot=state;readError=false;
  try{
   const doc=state.companion;
   if(doc?.version!==1||!Array.isArray(doc.characters)||!Array.isArray(doc.switchHistory)||!Array.isArray(doc.deletedCharacterIds))throw new Error('角色資料無法安全讀取，原資料已保留。');
   if(doc.characters.some(c=>!c||typeof c.characterId!=='string')||new Set(doc.characters.map(c=>c.characterId)).size!==doc.characters.length)throw new Error('角色識別資料無法安全讀取，原資料已保留。');
   if(!roleDirty&&!doc.characters.some(c=>c.characterId===selected))selected=doc.characters[0]?.characterId??null;
   const raw=doc.characters.find(c=>c.characterId===selected);
   current=raw?normalizeCharacter(raw):null;
   if(current&&!roleDirty&&!sameConfig(current,base))loadEditor(current);
   else if(!current&&!roleDirty){base=null;draft=null;}
   const missing=roleDirty&&!current;
   const options=doc.characters.map(c=>[c.characterId,typeof c.settings?.name==='string'?c.settings.name:'無法讀取的角色',Boolean(c.archived),c.characterId===doc.activeCharacterId]);
   if(missing)options.push([selected,'已刪除角色（草稿保留）',false,false]);
   const signature=JSON.stringify(options);
   if(signature!==optionSignature){
    const nodes=options.map(([id,name,archived,active])=>{const option=document.createElement('option');option.value=id;option.textContent=name+(archived?'（已封存）':'')+(active?' · 出場中':'');return option;});
    if(!nodes.length){const option=document.createElement('option');option.value='';option.textContent='尚無角色';nodes.push(option);}
    select.replaceChildren(...nodes);optionSignature=signature;
   }
   select.value=selected??'';
   const active=doc.characters.find(c=>c.characterId===doc.activeCharacterId&&!c.archived);
   $('#character-active').textContent='目前出場：'+(typeof active?.settings?.name==='string'?active.settings.name:'尚未設定');
   $('#character-preview-state').textContent=missing?'此角色已在其他分頁刪除，草稿仍保留。請先複製需要的內容，再取消角色草稿。':current?'正在查看：'+current.settings.name+' · '+(current.archived?'已封存':current.characterId===doc.activeCharacterId?'出場中':'僅預覽')+' · '+relationshipStage(current.affinity).name+' · 好感度 '+current.affinity:'尚未建立角色。';
   $('#character-empty').hidden=Boolean(current||base);
   $('#character-empty-title').textContent='還沒有角色';$('#character-empty-help').textContent='從上方「新增角色」開始，手動設定一位夥伴。';
   form.hidden=!base;$('#character-future-settings').hidden=!current;
   const relation=current?relationshipStage(current.affinity):null,next=relation?RELATIONSHIP_STAGES[relation.stage]:null;
   $('#character-summary').textContent=current?`好感度 ${current.affinity} · ${relation.name} · 最高階段 ${RELATIONSHIP_STAGES[current.highestStage-1].name} · 設定 v${current.configVersion}${next?' · 距離下一階段 '+(next.min-current.affinity)+' 點':''}`:'尚無可顯示的角色好感度。';
   $('#chat-character-name').textContent=current?.settings.name??'尚未選擇角色';
   $('#chat-character-relation').textContent=current?relation.name+' · 好感度 '+current.affinity+(current.archived?' · 已封存':''):'請先新增或選擇角色。';
   updateStages();
   if(state.affinity&&(state.affinity.version!==1||!Array.isArray(state.affinity.policies)))throw new Error('好感度資料無法安全讀取，原資料已保留。');
   const settings=validatePenaltySettings(state.affinity?.policies.at(-1)?.settings??DEFAULT_PENALTIES);
   if(!policyDirty){policyBase=policySignature(settings);for(const key of ['enabled','tasks','habits','chat'])policyForm.elements[key].checked=settings[key];policyForm.elements.limit.value=String(settings.limit);}
   $('#affinity-policy-status').textContent=state.affinity?.diagnostics.at(-1)?.code==='clock-unreliable'?'裝置時間異常，未完成扣分已暫停；請校正日期後重試。':'';
   if(missing)notify('角色已刪除，尚未儲存的內容保留於此頁；不會重新建立角色。');
  }catch(error){readError=true;notify(error.message);if(!base){form.hidden=true;$('#character-future-settings').hidden=true;$('#character-empty').hidden=false;$('#character-empty-title').textContent='無法讀取角色';$('#character-empty-help').textContent='原資料已保留，請確認資料後再重試。';}}
  controls();sizeChat();images?.update();chat?.update();void replies?.update();
 }
 async function run(work){
  if(busy)return;busy=true;controls();context.notify();
  try{await held;if(dirty()&&!release)release=await holdDraft('companion');await work();}
  catch(error){notify(error.message);}
  finally{busy=false;render(snapshot);context.notify();}
 }
 function discardRole(){if(roleDirty&&!confirm('捨棄目前角色尚未儲存的草稿？全站扣分草稿會保留。'))return false;free('role');return true;}
 form.addEventListener('input',event=>{capture();if(event.target.tagName==='TEXTAREA')fitMany([event.target]);void protect('role');controls();});
 form.addEventListener('toggle',fitVisible,true);
 select.addEventListener('change',()=>{const next=select.value;if(next===selected)return;if(replies&&!replies.beforeSelection()){select.value=selected??'';return;}if(!images.beforeSelection()){select.value=selected??'';return;}if(!discardRole()){select.value=selected??'';return;}selected=next;base=null;draft=null;render(snapshot);});
 $('#character-create').onclick=()=>{
  if((replies&&!replies.beforeSelection())||!images.beforeSelection()||!discardRole())return;
  void run(async()=>{const before=new Set(snapshot.companion.characters.map(c=>c.characterId));await service.act({type:'create'});selected=snapshot.companion.characters.find(c=>!before.has(c.characterId))?.characterId??selected;base=null;draft=null;tab(1);$('#character-basic-section').open=true;notify('已新增角色。');});
 };
 form.onsubmit=event=>{
  event.preventDefault();if(!base||!draft)return;capture();
  const action={type:'edit',characterId:selected,expectedVersion:base.configVersion,expectedConfig:JSON.stringify([base.createdAt,base.settings,base.stages]),settings:structuredClone(draft.settings),stages:structuredClone(draft.stages)};
  void run(async()=>{await service.act(action);free('role');notify('角色設定已儲存。');});
 };
 $('#character-cancel').onclick=()=>{if(!discardRole())return;base=null;draft=null;render(snapshot);};
 $('#character-activate').onclick=()=>void run(async()=>{await service.act({type:'switch',characterId:selected});notify('已切換出場夥伴。');});
 function replacement(){if(snapshot.companion.activeCharacterId!==selected)return {};return confirm('這是目前出場角色。繼續會先取消出場；之後可另選角色設為夥伴。')?{replacementId:null}:null;}
 $('#character-archive').onclick=()=>{if(!current)return;const archived=current.archived,extra=archived?{}:replacement();if(!extra)return;void run(async()=>{await service.act({type:archived?'unarchive':'archive',characterId:selected,...extra});notify(archived?'已取消封存。':'已封存，設定及歷史保留。');});};
 $('#character-delete').onclick=()=>{
  if(!current||!confirm('永久刪除將移除這位角色的全部設定與好感度，無法復原；出場歷史只保留匿名角色 ID，既有備份不會一併刪除。'))return;
  const extra=replacement();if(!extra)return;if(prompt('再次確認：請輸入角色名稱「'+current.settings.name+'」')!==current.settings.name){notify('未刪除角色。');return;}
  void run(async()=>{await service.act({type:'delete',characterId:selected,...extra});free('role');base=null;draft=null;notify('角色已永久刪除。');});
 };
 policyForm.addEventListener('input',()=>void protect('policy'));
 policyForm.onsubmit=event=>{
  event.preventDefault();const settings=Object.fromEntries(['enabled','tasks','habits','chat'].map(k=>[k,policyForm.elements[k].checked]));settings.limit=Number(policyForm.elements.limit.value);
  void run(async()=>{validatePenaltySettings(settings);const actual=dataStore.get().affinity?.policies.at(-1)?.settings??DEFAULT_PENALTIES;if(policySignature(actual)!==policyBase)throw new Error('扣分設定已在其他分頁修改；草稿保留，請先取消後重新讀取。');await dataStore.setAffinityPolicy(settings);free('policy');notify('扣分設定已儲存，僅影響後續適用的結算。');});
 };
 $('#affinity-policy-cancel').onclick=()=>{if(policyDirty&&!confirm('捨棄尚未儲存的全站扣分設定？角色草稿會保留。'))return;free('policy');render(snapshot);};
 const tabs=[$('#chat-tab'),$('#character-tab')];
 function tab(index){
  tabs.forEach((button,i)=>{button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;$('#'+button.getAttribute('aria-controls')).hidden=i!==index;});
  if(index===1)fitVisible();else{sizeChat();void loadChat().catch(()=>{});}chat?.activate();
 }
 tabs.forEach((button,index)=>{button.onclick=()=>tab(index);button.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?1:1-index;tab(next);tabs[next].focus({preventScroll:true});};});
 images=mountCharacterImages(root,context,{getCharacter:()=>readError?null:current,getSettings:()=>snapshot?.settings,store:dataStore,notify,onState:()=>{draftNotice();}});
 context.setHooks({hasDraft:()=>dirty()||Boolean(chat?.hasDraft()),busy:()=>busy||images.busy()||Boolean(replies?.busy())});
 $('#reply-library-section').addEventListener('toggle',()=>{if(!$('#reply-library-section').open)return;replyImport??=import('./reply-page.mjs?v=replies-20261027').then(m=>{replies=m.mountReplyManager(root,context,{store:dataStore,getCharacter:()=>readError?null:current,notify,onState:()=>context.notify()});return replies;}).catch(e=>{replyImport=null;notify(e.message);throw e;});void replyImport.then(r=>r.update()).catch(()=>{});});
 context.subscribe(dataStore,render,{changesOnly:true});
 context.listen(window,'resize',()=>{fitVisible();sizeChat();},{passive:true});
 if(window.visualViewport)context.listen(window.visualViewport,'resize',sizeChat,{passive:true});
 if(document.fonts)context.listen(document.fonts,'loadingdone',()=>{fitVisible();sizeChat();});
 context.onResume(()=>{fitVisible();sizeChat();});
}
