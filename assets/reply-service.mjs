import {emptyReplyLibrary,upgradeReplyManifest,validateCategoryKey,validateReplyManifest,DEFAULT_REPLY_POOLS,categoryKey,validateReplyPools} from './reply-manifest.mjs?v=daily-polish-20261029';
import {readReplyRows,stageReplyRows} from './reply-store.mjs?v=daily-polish-20261029';
import {replyPersonaKey,writeReply,usableReplies} from './reply-model.mjs?v=daily-polish-20261029';
import {holdDraft} from './coordination.mjs?v=daily-polish-20261029';
export async function readReplyCategory(store,characterId,key){const state=store.getFields?store.getFields(['companion','replyLibrary','revision']):store.get(),c=state.companion.characters.find(c=>c.characterId===characterId);if(!c)throw new Error('角色已刪除。');validateReplyManifest(state.replyLibrary,state.companion);const ref=state.replyLibrary?.version===2?(state.replyLibrary?.characters[characterId]?.categories[key]??null):null;return {character:c,ref,epoch:state.replyLibrary?.epoch??null,rows:await readReplyRows(ref,{characterId,key}),signature:await replyPersonaKey(c)};}
export async function editReplyCategory(store,{characterId,key,expectedRef,expectedEpoch,expectedSignature,action,values,guard=()=>true}){
 const release=await holdDraft('companion');try{
  const base=await readReplyCategory(store,characterId,key);if(base.ref!==expectedRef||base.epoch!==expectedEpoch||base.signature!==expectedSignature||!guard())throw new Error('回覆庫或人格已更新；草稿保留，請取消後重新讀取。');
  let rows=base.rows;if(action==='clear')rows=[];else if(action==='purge')rows=usableReplies(rows,base.signature);else if(action==='delete')rows=rows.filter(r=>r.replyId!==values.replyId);else if(action==='replace'){rows=[];for(const dialogue of values.dialogues)rows=writeReply(rows,{...validateCategoryKey(key),dialogue,source:'ai'},base.character,base.signature);}else{const scope=validateCategoryKey(key);if(scope.legacy)throw new Error('舊分類只供檢視或匯出。');rows=writeReply(rows,{...values,...scope},base.character,base.signature);}
  const ref=rows.length?await stageReplyRows(rows):null;
  const state=store.getFields?store.getFields(['companion','replyLibrary','revision']):store.get(),root=upgradeReplyManifest(validateReplyManifest(state.replyLibrary,state.companion)),c=state.companion.characters.find(c=>c.characterId===characterId);
  if(!c||c.createdAt!==base.character.createdAt||await replyPersonaKey(c)!==base.signature||(state.replyLibrary?.epoch??null)!==base.epoch||(root.characters[characterId]?.categories[key]??null)!==base.ref||!guard())throw new Error('提交期間角色、還原版本或分類已變更，舊資料保留。');
  const owner=root.characters[characterId]??={createdAt:c.createdAt,revision:0,pools:structuredClone(DEFAULT_REPLY_POOLS),categories:{}};owner.revision++;if(ref)owner.categories[key]=ref;else delete owner.categories[key];
  await store.setReplyLibrary(root,state.revision,guard);return ref;
 }finally{release();}
}
export async function saveReplyPools(store,id,pools,expected){validateReplyPools(pools);const state=store.getFields?store.getFields(['companion','replyLibrary','revision']):store.get(),root=upgradeReplyManifest(validateReplyManifest(state.replyLibrary,state.companion)),c=state.companion.characters.find(c=>c.characterId===id);if(!c||JSON.stringify(root.characters[id]?.pools??DEFAULT_REPLY_POOLS)!==expected)throw new Error('情緒池已變更，請重新讀取。');const owner=root.characters[id]??={createdAt:c.createdAt,revision:0,pools:structuredClone(DEFAULT_REPLY_POOLS),categories:{}};owner.pools=structuredClone(pools);owner.revision++;await store.setReplyLibrary(root,state.revision);}

export async function upgradeReplyLibrary(store){const s=store.getFields?store.getFields(['replyLibrary','revision']):store.get();if(s.replyLibrary?.version===1)await store.setReplyLibrary(upgradeReplyManifest(s.replyLibrary),s.revision);}
