import {changeCharacters,validateCharacters} from './characters-model.mjs?v=task-instances-20261103';
export function createCharacterService(store){return {
 read:()=>validateCharacters(store.get().companion),
 async act(action){if(action.type==='sharing')await store.settleAffinities?.();const state=store.get(),next=changeCharacters(state.companion,action);return store.transact({type:'character.'+action.type,label:({create:'新增角色',edit:'編輯角色設定',switch:'切換出場夥伴',archive:'封存角色',unarchive:'取消封存角色',delete:'永久刪除角色','greetings-batch':'批量儲存招呼','page-greetings':'儲存頁面招呼',greetings:'儲存首頁招呼',sharing:'切換好感度計算方式'})[action.type],target:action.characterId??'companion',changes:{companion:next,...(action.type==='delete'&&state.replyLibrary?{replyLibrary:{...state.replyLibrary,characters:Object.fromEntries(Object.entries(state.replyLibrary.characters).filter(([id])=>id!==action.characterId))}}:{})},expectedRevision:state.revision,reversible:false});}
};}
