// Durable, text-free chat receipts. Existing life reward/reversal rules are untouched.
import {initializeAffinity,affinityTransaction,validateAffinity} from './affinity-model.mjs?v=backup-chat-20261031';
import {relationshipStage} from './characters-model.mjs?v=backup-chat-20261031';
export function chatRoleSnapshot(doc,characterId){const c=doc.companion?.characters.find(c=>c.characterId===characterId);if(!c||c.archived||doc.companion.activeCharacterId!==characterId)throw new Error('請先將未封存的角色設為夥伴。');return {characterId,characterCreatedAt:c.createdAt,configVersion:c.configVersion,stage:relationshipStage(c.affinity).stage,switchCount:doc.companion.switchHistory.length,epoch:doc.affinity.chatEpoch};}
export function validChatRole(doc,snapshot){try{const current=chatRoleSnapshot(doc,snapshot.characterId);return ['characterId','characterCreatedAt','configVersion','switchCount','epoch'].every(k=>current[k]===snapshot[k]);}catch{return false;}}
export function commitChat(doc,turn,time){
 const {chatTurnId,snapshot,assessment,responseHash}=turn;
 if(typeof chatTurnId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(chatTurnId)||!['positive','neutral','negative'].includes(assessment)||!/^([a-f0-9]{64})$/.test(responseHash))throw new Error('聊天評估無法驗證。');
 doc.affinity=validateAffinity(doc.affinity,doc.companion);const old=doc.affinity.chatAssessments?.[chatTurnId];
 if(old){if(old.responseHash!==responseHash||old.characterId!==snapshot.characterId||old.characterCreatedAt!==snapshot.characterCreatedAt||old.epoch!==snapshot.epoch)throw new Error('此回合已有不同的提交證據，已停止。');return {receipt:old,changed:false};}
 if(!validChatRole(doc,snapshot))throw new Error('角色、人格或正式資料已變更，此回合不再有效；不會計分。');
 initializeAffinity(doc,time);const requested={positive:1,neutral:0,negative:-1}[assessment],policy=doc.affinity.policies.at(-1).settings;
 const applied=requested<0&&!(policy.enabled&&policy.chat&&policy.limit>0)?0:requested;
 const transaction=affinityTransaction(doc,{sourceKey:'chat:'+chatTurnId,characterId:snapshot.characterId,requested,applied,time,operationId:'chat:'+chatTurnId,kind:'chat'});
 const receipt={characterId:snapshot.characterId,characterCreatedAt:snapshot.characterCreatedAt,epoch:snapshot.epoch,configVersion:snapshot.configVersion,stage:snapshot.stage,assessment,responseHash,transactionId:transaction.id};
 (doc.affinity.chatAssessments??={})[chatTurnId]=receipt;validateAffinity(doc.affinity,doc.companion);return {receipt,changed:true};
}
