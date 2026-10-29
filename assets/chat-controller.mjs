import {CHAT_TTL,CHAT_INPUT_LIMIT,chatHash,parseChatResponse,chatPrompt,liveMessage} from './chat-model.mjs?v=persona-20261029';
import {chatRoleSnapshot,validChatRole} from './chat-affinity.mjs?v=persona-20261029';
import {getTurn,saveTurn,newUserMessage,roleTurns,turnMessages,pruneChats,subscribeChats,withChatLock} from './chat-store.mjs?v=persona-20261029';
export const connectionIdentity=s=>JSON.stringify([s.mode,s.provider,s.model||s.sessionModel,s.hasKey,s.backendReady]);
export const chatConnected=s=>Boolean(s.configured&&(s.model||s.sessionModel)&&(s.hasKey||s.backendReady));
export function createChatController({store,connection,getCharacter,isVisible,onChange,onError,onUserSaved=()=>{},now=Date.now}){
 let state=store.get(),turns=[],messages=[],loading=false,active=null,sequence=0,suspended=false,pendingMemory=null,expiryTimer=null;
 const emit=()=>onChange({turns,messages,loading,busy:Boolean(active),activeTurnId:active?.turn.chatTurnId,connection:connection.getState()});
 function cancel(){sequence++;if(active?.generating)connection.cancel();active=null;emit();}
 async function refresh(){const token=++loadSequence,c=getCharacter();if(!c||!isVisible()||suspended)return;loading=true;emit();try{await pruneChats(now());const rows=await roleTurns(c,state.affinity?.chatEpoch,now());if(token!==loadSequence||c.characterId!==getCharacter()?.characterId)return;for(const row of rows){row.invalid=Boolean(row.assistant&&!state.affinity.chatAssessments?.[row.chatTurnId]&&!validChatRole(state,row.snapshot));if(row.invalid)row.phase='blocked';}turns=rows;messages=turnMessages(rows,state.affinity.chatAssessments,now());clearTimeout(expiryTimer);if(messages.length)expiryTimer=setTimeout(()=>void refresh(),Math.max(1,Math.min(...messages.map(m=>m.expiresAt))-now()));}catch(error){onError(error.message);}finally{if(token===loadSequence){loading=false;emit();}}}
 let loadSequence=0;
 function update(next){if(!next?.affinity||!Array.isArray(next.companion?.characters)){state=next;turns=[];messages=[];cancel();onError('聊天關聯資料無法讀取，原資料保留。');return;}turns=turns.filter(t=>t.characterId===getCharacter()?.characterId&&t.snapshot.characterCreatedAt===getCharacter()?.createdAt&&t.snapshot.epoch===next.affinity.chatEpoch);const previousEpoch=state.affinity.chatEpoch;state=next;if(previousEpoch!==next.affinity.chatEpoch){turns=[];messages=[];void refresh();}if(active&&!validChatRole(next,active.turn.snapshot))cancel();for(const row of turns){row.invalid=Boolean(row.assistant&&!next.affinity.chatAssessments?.[row.chatTurnId]&&!validChatRole(next,row.snapshot));if(row.invalid)row.phase='blocked';else if(row.phase==='blocked')row.phase='ready';}if(isVisible()&&!suspended){messages=turnMessages(turns,next.affinity.chatAssessments,now());emit();}}
 function currentValid(ticket){return active===ticket&&ticket.sequence===sequence&&!suspended&&isVisible()&&getCharacter()?.characterId===ticket.turn.characterId&&validChatRole(state,ticket.turn.snapshot)&&connectionIdentity(connection.getState())===ticket.connection;}
 async function finish(turn,ticket){
  if(await chatHash({dialogue:turn.assistant.text,emotionId:turn.assistant.emotionId,assessment:turn.assistant.assessment,formatFallback:turn.assistant.formatFallback})!==turn.responseHash)throw new Error('短期回覆完整性無法核對，停止本機提交。');
  // Ready response is durable BEFORE the text-free official transaction.
  // Receipt is the authority if the final IDB publication fails.
  const receipt=await store.commitChatAssessment({chatTurnId:turn.chatTurnId,snapshot:turn.snapshot,assessment:turn.assistant.assessment,responseHash:turn.responseHash},()=>currentValid(ticket));
  if(receipt.responseHash!==turn.responseHash)throw new Error('此回合提交證據不一致，已停止。');
  turn.phase='complete';turn.user.status='complete';turn.assistant.status='complete';await saveTurn(turn);pendingMemory=null;
 }
 async function process(turn,{recover=false,renew=false}={}){
  if(active||!isVisible())return;const c=getCharacter();if(!c||c.characterId!==turn.characterId)throw new Error('請返回原角色的聊天室。');
  const ticket={turn,sequence:++sequence,connection:connectionIdentity(connection.getState()),generating:false,claimed:false};active=ticket;emit();
  try{await withChatLock(c.characterId,async()=>{ticket.claimed=true;
   const persisted=await getTurn(turn.chatTurnId);if(persisted){if(!(turn.assistant&&!persisted.assistant))turn=persisted;ticket.turn=turn;}
   const receipt=store.get().affinity.chatAssessments?.[turn.chatTurnId];
   if(renew&&!recover&&turn.assistant&&!receipt&&!validChatRole(state,turn.snapshot)){delete turn.assistant;delete turn.responseHash;turn.phase='pending';}if(renew&&!turn.assistant)turn.snapshot=chatRoleSnapshot(state,c.characterId);
   if(turn.phase==='complete'&&receipt)throw new Error('此聊天回合已完成，不會重送或再次評估。');
   if(receipt&&!turn.assistant)throw new Error('此回合已成立評估但缺少短期回覆；停止重送 AI。');
   if(receipt&&turn.assistant){if(await chatHash({dialogue:turn.assistant.text,emotionId:turn.assistant.emotionId,assessment:turn.assistant.assessment,formatFallback:turn.assistant.formatFallback})!==turn.responseHash)throw new Error('短期回覆完整性不符，停止發布。');if(receipt.responseHash!==turn.responseHash||receipt.epoch!==state.affinity.chatEpoch||receipt.characterCreatedAt!==c.createdAt)throw new Error('還原後無法核對舊回合，不再提交。');turn.phase='complete';await saveTurn(turn);pendingMemory=null;return;}
   if(!currentValid(ticket))throw new Error('角色或連線已變更，此請求已取消。');
   if(turn.assistant){if(!liveMessage(turn.assistant,now()))throw new Error('這則回覆已過期，不再提交。');turn.phase='ready';await saveTurn(turn);await finish(turn,ticket);return;}
   if(recover)throw new Error('沒有已驗證的 AI 結果；請使用手動重試生成。');
   const ai=connection.getState();if(!chatConnected(ai)||ai.busy)throw new Error('請先在設定連接 AI 並選擇模型；未自動重送。');
   if(!liveMessage(turn.user,now()))throw new Error('這則訊息已超過 24 小時，請建立新的聊天。');
   turn.attempt++;turn.requestId=crypto.randomUUID();turn.phase='generating';await saveTurn(turn);if(!currentValid(ticket))throw new Error('此回合已取消。');
   const context=await roleTurns(c,state.affinity?.chatEpoch,now()),text=chatPrompt(state.companion.characters.find(character=>character.characterId===c.characterId),turnMessages(context,state.affinity.chatAssessments,now()),turn.user.text,{now:now(),turnId:turn.chatTurnId,stageNumber:turn.snapshot.stage});
   ticket.generating=true;const result=await connection.generate({text,maxOutputTokens:256});ticket.generating=false;
   if(!currentValid(ticket))throw new Error('此回合已取消，舊結果不會套用。');
   if(!result?.text)throw new Error(connection.getState().message||'AI 未完成回覆；可手動重試。');
   const response=parseChatResponse(result.text),time=now();turn.assistant={messageId:crypto.randomUUID(),characterId:c.characterId,chatTurnId:turn.chatTurnId,role:'assistant',text:response.dialogue,emotionId:response.emotionId,assessment:response.assessment,formatFallback:response.formatFallback,createdAt:time,expiresAt:time+CHAT_TTL,status:'ready'};
   turn.responseHash=await chatHash(response);if(!currentValid(ticket)){delete turn.assistant;delete turn.responseHash;throw new Error('此回合已取消，結果未提交。');}turn.expiresAt=time+CHAT_TTL;turn.phase='ready';pendingMemory=turn;
   await saveTurn(turn);if(!currentValid(ticket))throw new Error('此回合已失效，未提交評估。');await finish(turn,ticket);
  });}catch(error){
   if(ticket.claimed&&!turn.assistant){turn.phase=ticket.sequence!==sequence?'cancelled':'failed';try{await saveTurn(turn);}catch{pendingMemory=turn;}}
   onError(error.message);
  }finally{if(active===ticket)active=null;emit();await refresh();}
 }
 return {
  refresh,update,cancel,
  async send(text){text=text.trim();if(!text||text.length>CHAT_INPUT_LIMIT)throw new Error('請輸入 1–800 字元的訊息。');if(active||connection.getState().busy)throw new Error('已有請求處理中，未重複送出。');if(!chatConnected(connection.getState()))throw new Error('請先在設定連接 AI 並選擇模型。');
   const c=getCharacter();await store.prepareChat();state=store.get();const snapshot=chatRoleSnapshot(state,c?.characterId),turn=newUserMessage(text,snapshot,crypto.randomUUID(),now());await saveTurn(turn);onUserSaved(turn);await process(turn);return turn.chatTurnId;
  },
  async retry(id,recover=false){const turn=pendingMemory?.chatTurnId===id?pendingMemory:await getTurn(id);if(!turn)throw new Error('這則短期訊息已不存在。');if(turn.snapshot.epoch!==state.affinity.chatEpoch||turn.snapshot.characterCreatedAt!==getCharacter()?.createdAt)throw new Error('角色身份或還原版本已變更，舊回合不再有效。');await process(turn,{recover,renew:true});},
  get pending(){return pendingMemory;},get busy(){return Boolean(active);},
  suspend(){suspended=true;clearTimeout(expiryTimer);loadSequence++;cancel();},resume(){suspended=false;return refresh();},
  observe(){const off=subscribeChats(id=>{if(id===getCharacter()?.characterId)void refresh();});const unsub=connection.subscribe(s=>{if(active&&connectionIdentity(s)!==active.connection)cancel();emit();});return()=>{off();unsub();};}
 };
}
