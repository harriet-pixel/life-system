import {getSharedAIConnection} from './ai-runtime.mjs?v=sync-live-20261028';
import {categoryKey,DEFAULT_REPLY_POOLS} from './reply-manifest.mjs?v=sync-live-20261028';
import {replyPersonaKey,usableReplies,pickReply,replyPrompt,parseDailyReply} from './reply-model.mjs?v=sync-live-20261028';
import {readReplyCategory,editReplyCategory} from './reply-service.mjs?v=sync-live-20261028';
import {claimReplyEvent,pruneReplyEvents} from './reply-store.mjs?v=sync-live-20261028';
import {validDailySource} from './daily-events.mjs?v=sync-live-20261028';
const last=new Map();export const DAILY_FALLBACK='慢慢來，依照自己的步調繼續就好。';
export async function dailyResponse(store,event,{valid=()=>true,random=Math.random,connection=getSharedAIConnection()}={}){
 const validNow=()=>valid()&&validDailySource(store.get(),event);
 const fallback=(emotion=event.emotionId??'neutral')=>({dialogue:DAILY_FALLBACK,emotion,characterId:event.characterId,characterCreatedAt:event.characterCreatedAt,daily:true});
 if(!validNow())return null;
 const pools=store.get().replyLibrary?.characters[event.characterId]?.pools??DEFAULT_REPLY_POOLS,side=event.eventType.endsWith('.incomplete')?'negative':'positive';event.emotionId??=pools[side][Math.min(pools[side].length-1,Math.floor(random()*pools[side].length))];
 const signature=await replyPersonaKey(event.character,event.stageId);
 const claimed=await claimReplyEvent(event.sourceEventId,{characterId:event.characterId,characterCreatedAt:event.characterCreatedAt,configVersion:event.configVersion,operationId:event.operationId,epoch:event.epoch,signature,stageId:event.stageId,eventType:event.eventType,emotionId:event.emotionId});if(!claimed)return null;
 void pruneReplyEvents().catch(()=>{});const key=categoryKey(event.stageId,event.eventType,event.emotionId),lock='life-system.reply.category.'+event.characterId+':'+key;
 const play=rows=>{const chosen=pickReply(rows,last.get(lock),random);if(chosen){last.set(lock,chosen.replyId);if(last.size>128)last.delete(last.keys().next().value);return {...fallback(),dialogue:chosen.dialogue,replyId:chosen.replyId};}return fallback();};
 const work=async locked=>{
  let base=await readReplyCategory(store,event.characterId,key);if(base.signature!==signature||!validNow())return null;let rows=usableReplies(base.rows,signature);
  const ai=connection.getState();if(!locked||rows.length>=20||base.rows.length>=60||side==='negative'||ai.busy||!ai.configured||!(ai.model||ai.sessionModel||ai.restorableModel||ai.restorableBackendModel))return play(rows);
  let owns=false;const unsubscribe=store.subscribe(state=>{if(owns&&(!valid()||!validDailySource(state,event)||JSON.stringify([state.companion.characters.find(c=>c.characterId===event.characterId)?.settings,state.companion.characters.find(c=>c.characterId===event.characterId)?.stages?.[event.stageId]])!==JSON.stringify([event.character.settings,event.character.stages[event.stageId]]))){connection.cancel();owns=false;}},{changesOnly:true});
  try{
   if(!validNow())return null;owns=true;const result=await connection.generate({text:replyPrompt(event.character,event.stageId,event.eventType,event.emotionId),maxOutputTokens:128});owns=false;
   if(!validNow()||!result?.text)return validNow()?play(rows):null;const dialogue=parseDailyReply(result.text);
   // Re-read under the category generation lock. The short data lock is acquired
   // only by setReplyLibrary, never held while the network is outstanding.
   base=await readReplyCategory(store,event.characterId,key);if(base.signature!==signature||!validNow())return null;rows=usableReplies(base.rows,signature);if(rows.length>=20)return play(rows);
   await editReplyCategory(store,{characterId:event.characterId,key,expectedRef:base.ref,expectedEpoch:base.epoch,expectedSignature:signature,action:'write',values:{stageId:event.stageId,eventType:event.eventType,emotionId:event.emotionId,dialogue,source:'ai',enabled:true},guard:validNow});
   return {...fallback(),dialogue};
  }catch{return validNow()?play(rows):null;}finally{owns=false;unsubscribe();}
 };
 return navigator.locks.request(lock,{ifAvailable:true},l=>work(Boolean(l)));
}
