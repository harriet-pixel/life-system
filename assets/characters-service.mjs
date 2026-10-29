import {changeCharacters,validateCharacters} from './characters-model.mjs?v=persona-20261029';
export function createCharacterService(store){return {
 read:()=>validateCharacters(store.get().companion),
 async act(action){const state=store.get(),next=changeCharacters(state.companion,action);return store.transact({type:'character.'+action.type,label:({create:'新增角色',edit:'編輯角色設定',switch:'切換出場夥伴',archive:'封存角色',unarchive:'取消封存角色',delete:'永久刪除角色'})[action.type],target:action.characterId??'companion',changes:{companion:next,...(action.type==='delete'&&state.replyLibrary?{replyLibrary:{...state.replyLibrary,characters:Object.fromEntries(Object.entries(state.replyLibrary.characters).filter(([id])=>id!==action.characterId))}}:{})},expectedRevision:state.revision,reversible:false});}
};}
