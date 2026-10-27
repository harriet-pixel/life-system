import {holdDraft} from './coordination.mjs?v=characters-20261027';
import {validateRoleImageAssets} from './character-image-integrity.mjs?v=companion-images-20261027';
import {validateCharacters} from './characters-model.mjs?v=replies-20261027';
import {updateCharacterImage} from './character-images-model.mjs?v=companion-images-20261027';
import {readImageBlob} from './image-store.mjs?v=companion-images-20261027';
// Editor protects staging; the service also holds the existing draft lock
// through asset verification and commit, including non-UI callers.
// Global revision is checked again inside the existing write lock.
export async function saveCharacterImage(store,action){
 const release=await holdDraft('companion');try{
 if(action.image!==null){const assets=await Promise.all([action.image,action.thumbnail].map(async id=>({id,blob:await readImageBlob(id)})));await validateRoleImageAssets({companion:{characters:[{imageSettings:{version:1,revision:0,emotions:{[action.emotionId]:{image:action.image,thumbnail:action.thumbnail,crop:action.crop,updatedAt:new Date().toISOString()}}}}]}},assets);}
 const state=store.get(),companion=validateCharacters(state.companion),index=companion.characters.findIndex(c=>c.characterId===action.characterId);
 if(index<0)throw new Error('角色已刪除；圖片草稿保留，不會重新建立角色。');
 try{companion.characters[index]=updateCharacterImage(companion.characters[index],action);}catch(error){if(/設定不正確/.test(error.message))throw new Error('角色圖片已變更或草稿不正確；請取消後重新讀取，草稿仍保留。');throw error;}
 return await store.transact({type:'character.image',label:'儲存角色情緒圖片',target:action.characterId,changes:{companion},expectedRevision:state.revision,reversible:false});
 }finally{release();}
}
