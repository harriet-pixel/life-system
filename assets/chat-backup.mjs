import {allChatTurns,stageRestoredChats,turnMessages} from './chat-store.mjs?v=amount-images-20261031';
import {liveMessage,CHAT_TTL} from './chat-model.mjs?v=amount-images-20261031';
const check=(ok)=>{if(!ok)throw new Error('短期聊天備份格式或角色關聯無法驗證。');};
export function validateChatBackup(rows,document,now=Date.now()){
 check(Array.isArray(rows)&&rows.length<=10000);const identities=new Set();
 return rows.map(row=>{
  check(row&&Object.keys(row).every(k=>['id','characterId','characterCreatedAt','messages'].includes(k))&&typeof row.id==='string'&&row.id.length<=100&&!identities.has(row.id));identities.add(row.id);
  check(document.companion?.characters.some(c=>c.characterId===row.characterId&&c.createdAt===row.characterCreatedAt));
  check(Array.isArray(row.messages)&&row.messages.length>=1&&row.messages.length<=2&&['user','assistant'].includes(row.messages[0].role)&&(row.messages.length===1||row.messages[0].role==='user'&&row.messages[1].role==='assistant'));
  for(const m of row.messages){check(m&&Object.keys(m).every(k=>['role','text','createdAt','expiresAt','emotionId'].includes(k))&&typeof m.text==='string'&&m.text.length<=2000&&Number.isSafeInteger(m.createdAt)&&m.expiresAt===m.createdAt+CHAT_TTL&&m.createdAt<=now+300000&&(!m.emotionId||['neutral','happy','calm','thinking','surprised','concerned','determined','playful'].includes(m.emotionId)));}
  return structuredClone(row);
 });
}
export async function exportChatBackup(document,now=Date.now()){
 const rows=[];
 for(const turn of await allChatTurns(now)){
  const character=document.companion?.characters.find(c=>c.characterId===turn.characterId&&c.createdAt===turn.snapshot?.characterCreatedAt);
  if(!character||turn.snapshot.epoch!==document.affinity?.chatEpoch)continue;
  const messages=turnMessages([turn],document.affinity?.chatAssessments,now).map(m=>({role:m.role,text:m.text,createdAt:m.createdAt,expiresAt:m.expiresAt,...(m.role==='assistant'?{emotionId:m.emotionId??'neutral'}:{})}));
  if(messages.length)rows.push({id:turn.chatTurnId,characterId:character.characterId,characterCreatedAt:character.createdAt,messages});
 }
 return validateChatBackup(rows,document,now);
}
export async function stageChatBackup(rows,document,epoch,now=Date.now()){
 const turns=validateChatBackup(rows,document,now).flatMap(row=>{
  const messages=row.messages.filter(m=>liveMessage(m,now));if(!messages.length)return [];
  const id=crypto.randomUUID(),make=m=>({...m,characterId:row.characterId,chatTurnId:id,messageId:crypto.randomUUID(),status:'complete'});
  return [{chatTurnId:id,characterId:row.characterId,snapshot:{characterCreatedAt:row.characterCreatedAt,epoch},restoredDisplayOnly:true,phase:'complete',createdAt:messages[0].createdAt,expiresAt:Math.max(...messages.map(m=>m.expiresAt)),user:messages[0].role==='user'?make(messages[0]):make({role:'user',text:'',createdAt:messages[0].createdAt-CHAT_TTL,expiresAt:messages[0].createdAt}),...(messages.find(m=>m.role==='assistant')?{assistant:make(messages.find(m=>m.role==='assistant'))}:{})}];
 });
 // A fresh epoch + fresh IDs stages data invisibly. Primary publication is the
 // commit point; failed publication leaves original rows and epoch untouched.
 await stageRestoredChats(turns);
}
