import {getSharedAIConnection} from './ai-runtime.mjs?v=wallet-20261031';
import {createChatController,chatConnected} from './chat-controller.mjs?v=wallet-20261031';
import {CHAT_DOM_LIMIT,CHAT_INPUT_LIMIT} from './chat-model.mjs?v=wallet-20261031';
export function mountChat(root,context,{store,getCharacter,getSnapshot,images,onDraft}){
 const $=s=>root.querySelector(s),input=$('#chat-input'),send=$('#chat-send'),cancel=$('#chat-cancel'),area=$('#chat-messages'),status=$('#chat-status');
 const connection=getSharedAIConnection(),drafts=new Map(),positions=new Map(),nodes=new Map();let viewed=null,rendered=null,subscription=null,active=false,ui={turns:[],messages:[],busy:false,loading:false,connection:connection.getState()},sending=false,scrollBottom=true;
 const visible=()=>context.active&&!$('#chat-panel').hidden;
 const error=message=>{status.textContent=message;};
 function saveView(){if(viewed){drafts.set(viewed,input.value);positions.set(viewed,area.scrollTop);}}
 const key=c=>c?c.characterId+':'+c.createdAt:null;
 function eligibility(){const c=getCharacter(),state=getSnapshot();return Boolean(c&&!c.archived&&state.companion.activeCharacterId===c.characterId);}
 function controls(){const c=getCharacter(),connected=chatConnected(ui.connection),ready=eligibility();input.disabled=!ready;input.maxLength=CHAT_INPUT_LIMIT;input.placeholder=ready?'輸入訊息（最多 800 字元）':'先將此角色設為夥伴再開始聊天';
  send.disabled=!ready||!connected||ui.busy||ui.connection.busy||sending||!input.value.trim()||ui.turns.some(t=>t.phase==='ready');cancel.hidden=!ui.busy;cancel.disabled=!ui.busy;
  for(const button of area.querySelectorAll('[data-chat-retry]')){const turn=ui.turns.find(t=>t.chatTurnId===button.dataset.chatRetry),recover=Boolean(turn?.assistant)&&!turn?.invalid;button.disabled=!turn||ui.busy||sending||(!recover&&(!ready||!connected||ui.connection.busy))||(turn.phase==='generating'&&ui.activeTurnId===turn.chatTurnId);}
  $('#chat-connection-help').textContent=!c?'請先新增或選擇角色。':!ready?'目前僅預覽；請先設為夥伴，未封存角色才能發起新聊天。':!connected?'請至「設定 → AI 連線」連接 AI 並選擇模型。聊天草稿會保留。':ui.busy?'正在生成；離開聊天室會取消，不會自動重送。':'透過目前共用 AI 連線生成；每次送出一次請求，訊息各自保留 24 小時且不備份。';
 }
 function messageNode(m){let row=nodes.get(m.messageId);if(!row){row=document.createElement('article');row.className='chat-message '+(m.role==='assistant'?'chat-message-character':'chat-message-user');row.dataset.messageId=m.messageId;row.dataset.messageRole=m.role;
   if(m.role==='assistant'){const avatar=document.createElement('span');avatar.className='chat-message-avatar';avatar.dataset.avatarPurpose='message-emotion';avatar.dataset.emotionId=m.emotionId;avatar.setAttribute('role','img');avatar.setAttribute('aria-label','此訊息的情緒頭像');const icon=root.querySelector('[data-avatar-purpose=header-neutral] svg');if(icon)avatar.append(icon.cloneNode(true));row.append(avatar);}
   const content=document.createElement('div');content.className='chat-message-content';const text=document.createElement('p');text.dataset.chatText='';const footer=document.createElement('footer');const time=document.createElement('time');time.dateTime=new Date(m.createdAt).toISOString();time.textContent=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit'}).format(m.createdAt);const state=document.createElement('span');state.dataset.chatState='';footer.append(time,state);content.append(text,footer);row.append(content);nodes.set(m.messageId,row);}
  row.querySelector('[data-chat-text]').textContent=m.text;row.querySelector('[data-chat-state]').textContent=m.formatFallback?'格式備援 · 中性 0':({complete:'已完成',generating:'正在生成',pending:'已送出，等待回覆',failed:'生成失敗',cancelled:'已取消，可重試',ready:'等待本機提交',blocked:'先前回覆已失效，可手動重試'})[m.status]??'尚未完成';
  row.querySelector('[data-chat-retry]')?.remove();const turn=ui.turns.find(t=>t.chatTurnId===m.chatTurnId);
  if(m.role==='user'&&m.status!=='complete'&&turn){const button=document.createElement('button');button.type='button';button.dataset.chatRetry=m.chatTurnId;const recover=Boolean(turn.assistant)&&!turn.invalid;button.textContent=recover?'恢復本機提交':'手動重試';button.disabled=ui.busy||sending||(!recover&&(!eligibility()||!chatConnected(ui.connection)))||turn.phase==='generating'&&ui.activeTurnId===turn.chatTurnId;button.onclick=()=>void run(()=>controller.retry(m.chatTurnId,recover));row.querySelector('footer').append(button);}
  return row;
 }
 function render(next){ui=next;if(!visible())return;const c=getCharacter(),newKey=key(c);if(newKey!==viewed){saveView();viewed=newKey;input.value=drafts.get(viewed)??'';nodes.clear();rendered=null;scrollBottom=true;}
  const signature=JSON.stringify(next.messages.map(m=>[m.messageId,m.status]));const near=area.scrollHeight-area.scrollTop-area.clientHeight<64,oldTop=area.scrollTop,areaTop=area.getBoundingClientRect().top,anchor=[...area.querySelectorAll('[data-message-id]')].find(node=>node.getBoundingClientRect().bottom>areaTop),anchorId=anchor?.dataset.messageId,anchorOffset=anchor?anchor.getBoundingClientRect().top-areaTop:0;
  if(signature!==rendered){const fragment=document.createDocumentFragment(),keep=new Set();for(const m of next.messages.slice(-CHAT_DOM_LIMIT)){keep.add(m.messageId);fragment.append(messageNode(m));}for(const id of nodes.keys())if(!keep.has(id))nodes.delete(id);
   if(!next.messages.length){const empty=document.createElement('p');empty.className='chat-empty';empty.textContent=next.loading?'正在讀取此角色的短期訊息…':'目前沒有有效的短期訊息。訊息各自保留 24 小時，不納入備份。';fragment.append(empty);}area.replaceChildren(fragment);rendered=signature;
   if(scrollBottom){area.scrollTop=positions.get(viewed)??area.scrollHeight;scrollBottom=false;}else if(near)area.scrollTop=area.scrollHeight;else{const retained=anchorId?nodes.get(anchorId):null;area.scrollTop=retained?area.scrollTop+retained.getBoundingClientRect().top-area.getBoundingClientRect().top-anchorOffset:oldTop;}
  }else for(const m of next.messages)messageNode(m);
  const last=next.messages.findLast(m=>m.role==='assistant');images.displayEmotion(last?.emotionId??'neutral');images.update();
  const pending=ui.turns.find(t=>t.assistant&&t.phase!=='complete'&&!t.invalid)??(controller.pending&&ui.turns.some(t=>t.chatTurnId===controller.pending.chatTurnId&&!t.invalid)?controller.pending:null);$('#chat-local-recover').dataset.turnId=pending?.chatTurnId??'';$('#chat-local-recover').hidden=!pending;$('#chat-local-recover').disabled=ui.busy;
  area.dataset.loading=String(next.loading);const empty=area.querySelector('.chat-empty');if(empty&&!next.messages.length)empty.textContent=next.loading?'正在讀取此角色的短期訊息…':'目前沒有有效的短期訊息。訊息各自保留 24 小時，不納入備份。';controls();
 }
 const controller=createChatController({store,connection,getCharacter,isVisible:visible,onChange:next=>render(next),onError:error,onUserSaved:turn=>{const origin=turn.characterId+':'+turn.snapshot.characterCreatedAt;if(drafts.get(origin)?.trim()===turn.user.text)drafts.set(origin,'');if(viewed===origin&&input.value.trim()===turn.user.text)input.value='';onDraft();}});
 async function run(work){if(sending)return;sending=true;status.textContent='';controls();try{await work();}catch(e){error(e.message);}finally{sending=false;render(ui);}}
 input.addEventListener('input',()=>{if(viewed)drafts.set(viewed,input.value);controls();onDraft();});
 send.onclick=()=>void run(()=>controller.send(input.value));
 input.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&!send.disabled){event.preventDefault();send.click();}});
 cancel.onclick=()=>controller.cancel();$('#chat-local-recover').onclick=()=>void run(()=>controller.retry($('#chat-local-recover').dataset.turnId,true));
 area.addEventListener('scroll',()=>{if(viewed)positions.set(viewed,area.scrollTop);},{passive:true});
 function activate(){if(!visible()){controller.suspend();active=false;saveView();subscription?.();subscription=null;return;}if(!active){active=true;subscription=controller.observe();controller.update(getSnapshot());void controller.resume();}else controller.update(getSnapshot());}
 context.listen(document,'visibilitychange',()=>{if(!document.hidden&&visible())void controller.refresh();});
 context.onSuspend(()=>{saveView();controller.suspend();subscription?.();subscription=null;active=false;});context.onResume(activate);
 return {update(){const c=getCharacter(),changed=key(c)!==viewed;if(changed){saveView();controller.cancel();viewed=key(c);input.value=drafts.get(viewed)??'';nodes.clear();rendered=null;scrollBottom=true;ui={...ui,turns:[],messages:[]};}controller.update(getSnapshot());if(changed&&visible())void controller.refresh();},activate,hasDraft:()=>[...drafts.values()].some(s=>s.trim())||Boolean(input.value.trim()),busy:()=>false};
}
