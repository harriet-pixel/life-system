import {personaFingerprintInput} from './persona-prompt.mjs?v=restore-images-20261031';
import {getSharedAIConnection} from './ai-runtime.mjs?v=restore-images-20261031';
import {categoryKey,DEFAULT_REPLY_POOLS} from './reply-manifest.mjs?v=restore-images-20261031';
import {usableReplies,pickReply,replyPrompt,parseDailyReply,substituteReply} from './reply-model.mjs?v=restore-images-20261031';
import {readReplyCategory} from './reply-service.mjs?v=restore-images-20261031';
import {claimReplyEvent,pruneReplyEvents} from './reply-store.mjs?v=restore-images-20261031';
import {validDailySource,dailyContext} from './daily-events.mjs?v=restore-images-20261031';
const last=new Map();export const DAILY_FALLBACK='慢慢來，依照自己的步調繼續就好。';
const snapshot=(store,event)=>store.getFields?store.getFields(event?.domain==='wallet'?['revision','companion','replyLibrary','walletRecord:'+event.sourceId]:['revision','companion','replyLibrary','tasks','habits','profile']):store.get();
export async function dailyResponse(store,event,{valid=()=>true,random=Math.random,connection=getSharedAIConnection(),batch=[event],onCancel=()=>{}}={}){
 let invalidated=false;const original=JSON.stringify([event.characterCreatedAt,event.configVersion,personaFingerprintInput(event.character)]);
 const validNow=()=>{const s=snapshot(store,event),c=s.companion.characters.find(c=>c.characterId===event.characterId);return !invalidated&&valid()&&validDailySource(s,event)&&c&&JSON.stringify([c.createdAt,c.configVersion,personaFingerprintInput(c)])===original;};
 if(!validNow())return null;const state=snapshot(store,event),side=event.eventType.endsWith('.incomplete')?'negative':'positive',pool=(state.replyLibrary?.characters[event.characterId]?.pools??DEFAULT_REPLY_POOLS)[side];event.emotionId??=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];
 const context=dailyContext(state,event);context.names=[...new Set([...(context.names??[]),...batch.filter(e=>e.characterId===event.characterId).flatMap(e=>dailyContext(state,e).names)])].slice(0,3);
 const baseReply={emotion:event.emotionId,characterId:event.characterId,characterCreatedAt:event.characterCreatedAt,daily:true};
 const claim=await claimReplyEvent(event.sourceEventId,{characterId:event.characterId,characterCreatedAt:event.characterCreatedAt,configVersion:event.configVersion,operationId:event.operationId,epoch:event.epoch,stageId:event.stageId,eventType:event.eventType,emotionId:event.emotionId});if(!claim)return null;void pruneReplyEvents().catch(()=>{});
 const key=categoryKey(side,event.emotionId),lock=event.characterId+':'+key;
 const fallback=async()=>{if(!validNow())return null;if(event.domain==='wallet')return {...baseReply,emotion:'neutral',dialogue:'已記下這次兌換，留點空間給自己享用吧。',fallback:true};if(event.domain==='change')return {...baseReply,emotion:'calm',dialogue:'紀錄已調整，照現在的步調繼續就好。',fallback:true};try{const base=await readReplyCategory(store,event.characterId,key);if(!validNow())return null;const rows=usableReplies(base.rows,base.signature).filter(r=>substituteReply(r.dialogue,context.names[0]));const row=pickReply(rows,last.get(lock),random);if(row){last.set(lock,row.replyId);if(last.size>128)last.delete(last.keys().next().value);return {...baseReply,dialogue:substituteReply(row.dialogue,context.names[0]),replyId:row.replyId,fallback:true};}}catch{}return validNow()?{...baseReply,emotion:'neutral',dialogue:DAILY_FALLBACK,fallback:true}:null;};
 const ai=connection.getState();if(ai.busy||!ai.configured||!(ai.model||ai.sessionModel||ai.restorableModel||ai.restorableBackendModel))return fallback();
 let owns=false;const cancel=()=>{invalidated=true;if(owns){owns=false;connection.cancel();}};onCancel(cancel);const off=store.subscribe(()=>{if(owns&&!validNow()){invalidated=true;owns=false;connection.cancel();}},{changesOnly:true,keys:[]});
 try{if(!validNow())return null;owns=true;const result=await connection.generate({text:replyPrompt(event.character,event.stageId,event.eventType,event.emotionId,context),maxOutputTokens:128});owns=false;if(!validNow())return null;if(!result?.text)return fallback();return {...baseReply,dialogue:parseDailyReply(result.text)};}catch{return fallback();}finally{owns=false;off();onCancel(null);}
}
