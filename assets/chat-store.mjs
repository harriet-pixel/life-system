// Separate short-lived database; exported only by explicit full backups.
import {CHAT_TTL,CHAT_DOM_LIMIT,liveMessage} from './chat-model.mjs?v=amount-images-20261031';
export const CHAT_DATABASE='life-system.chat.v1';let database;
const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('life-system.chat.changed.v1'):null,listeners=new Set();
channel?.unref?.();
channel?.addEventListener('message',event=>{if(typeof event.data==='string')listeners.forEach(fn=>fn(event.data));});
const announce=id=>{channel?.postMessage(id);listeners.forEach(fn=>fn(id));};
export const subscribeChats=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
function open(){return database??=new Promise((resolve,reject)=>{const r=indexedDB.open(CHAT_DATABASE,1);r.onupgradeneeded=()=>{const s=r.result.createObjectStore('turns',{keyPath:'chatTurnId'});s.createIndex('roleExpiry',['characterId','expiresAt']);s.createIndex('expiry','expiresAt');};r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();database=null;};resolve(r.result);};r.onerror=()=>{database=null;reject(new Error('短期聊天儲存空間無法開啟，其他生活資料未更動。'));};r.onblocked=()=>{database=null;reject(new Error('其他分頁尚未釋放聊天資料庫，請關閉舊分頁後再試。'));};});}
export async function saveTurn(turn){const db=await open();await new Promise((resolve,reject)=>{const tx=db.transaction('turns','readwrite');tx.objectStore('turns').put(turn);tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(new Error('短期訊息未能儲存；請使用本機恢復，不需再次呼叫 AI。'));});announce(turn.characterId);}
export async function getTurn(id){const db=await open();return new Promise((resolve,reject)=>{const r=db.transaction('turns').objectStore('turns').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('短期聊天讀取失敗。'));});}
export async function pruneChats(now=Date.now()){
 const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('turns','readwrite'),request=tx.objectStore('turns').index('expiry').openCursor(IDBKeyRange.upperBound(now));let count=0;request.onsuccess=()=>{const cursor=request.result;if(cursor&&count<256){cursor.delete();count++;cursor.continue();}};tx.oncomplete=()=>resolve(count);tx.onabort=tx.onerror=()=>reject(new Error('短期聊天清理尚未完成；原有生活資料未更動。'));});
}
export async function roleTurns(character,epoch,now=Date.now()){
 if(!character||!epoch)return [];const db=await open();return new Promise((resolve,reject)=>{const result=[],r=db.transaction('turns').objectStore('turns').index('roleExpiry').openCursor(IDBKeyRange.bound([character.characterId,now],[character.characterId,Number.MAX_SAFE_INTEGER],true,false),'prev');let visited=0;r.onsuccess=()=>{const c=r.result;if(!c||visited++>=CHAT_DOM_LIMIT){resolve(result.sort((a,b)=>a.createdAt-b.createdAt));return;}const t=c.value;if(t.snapshot?.characterCreatedAt===character.createdAt&&t.snapshot.epoch===epoch&&t.characterId===character.characterId&&typeof t.chatTurnId==='string'&&t.user?.chatTurnId===t.chatTurnId&&[t.user,t.assistant].filter(Boolean).some(m=>liveMessage(m,now)))result.push(t);c.continue();};r.onerror=()=>reject(new Error('此角色的短期聊天無法讀取。'));});
}
export function turnMessages(turns,receipts,now=Date.now()){
 return turns.flatMap(t=>{
  const proof=receipts?.[t.chatTurnId],proven=t.restoredDisplayOnly===true||t.phase==='complete'&&proof?.responseHash===t.responseHash&&proof.characterCreatedAt===t.snapshot.characterCreatedAt&&proof.epoch===t.snapshot.epoch;
  return [t.user,...(proven&&t.assistant?[t.assistant]:[])].filter(m=>m.characterId===t.characterId&&m.chatTurnId===t.chatTurnId&&['user','assistant'].includes(m.role)&&typeof m.text==='string'&&m.text.length<=2000&&liveMessage(m,now)).map(m=>({...m,status:proven?'complete':t.phase,...(t.restoredDisplayOnly?{restoredDisplayOnly:true}:{})}));
 }).sort((a,b)=>a.createdAt-b.createdAt).slice(-CHAT_DOM_LIMIT);
}
export const newUserMessage=(text,snapshot,id=crypto.randomUUID(),now=Date.now())=>({chatTurnId:id,characterId:snapshot.characterId,snapshot,phase:'pending',attempt:0,createdAt:now,expiresAt:now+CHAT_TTL,user:{messageId:crypto.randomUUID(),characterId:snapshot.characterId,chatTurnId:id,role:'user',text,createdAt:now,expiresAt:now+CHAT_TTL,status:'pending'}});
export function withChatLock(characterId,work){if(!navigator.locks)throw new Error('此瀏覽器缺少安全聊天協調能力。');return navigator.locks.request('life-system.chat.turn.'+characterId,{ifAvailable:true},lock=>{if(!lock)throw new Error('另一分頁正在處理此角色的聊天；未重送 AI。');return work();});}
// Backup reads are explicit and bounded by the backup validator, never homepage work.
export async function allChatTurns(now=Date.now()){const db=await open();return new Promise((resolve,reject)=>{const r=db.transaction('turns').objectStore('turns').index('expiry').getAll(IDBKeyRange.lowerBound(now,true),10001);r.onsuccess=()=>r.result.length>10000?reject(new Error('短期聊天超過備份安全筆數，原資料保留。')):resolve(r.result);r.onerror=()=>reject(new Error('聊天備份讀取失敗，未建立不完整備份。'));});}
export async function stageRestoredChats(turns){const db=await open();await new Promise((resolve,reject)=>{const tx=db.transaction('turns','readwrite');for(const turn of turns)tx.objectStore('turns').add(turn);tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(new Error('聊天還原儲存失敗，原本正式資料未更動。'));});}
