import {getSharedAIConnection} from './ai-runtime.mjs?v=daily-polish-20261029';
import {readReplyCategory} from './reply-service.mjs?v=daily-polish-20261029';
import {validateCategoryKey} from './reply-manifest.mjs?v=daily-polish-20261029';
import {libraryPrompt,parseLibraryReply} from './reply-model.mjs?v=daily-polish-20261029';
import {relationshipStage} from './characters-model.mjs?v=daily-polish-20261029';
export async function generateLibraryPreview(store,id,key,{connection=getSharedAIConnection(),valid=()=>true,onCancel=()=>{}}={}){
 const base=await readReplyCategory(store,id,key),scope=validateCategoryKey(key),stage=relationshipStage(base.character.affinity).stage;if(scope.legacy||base.character.archived)throw new Error('此角色或分類無法生成。');
 const current=connection.getState();if(current.busy)throw new Error('共用AI忙碌，沒有排隊或取消其他聊天。');if(!current.configured||!(current.model||current.sessionModel||current.restorableModel||current.restorableBackendModel))throw new Error('請先設定共用AI連線；原回覆保留。');
 return navigator.locks.request('life-system.reply.generate.'+id+':'+key,{ifAvailable:true},async lock=>{if(!lock)throw new Error('其他分頁正在生成此分類。');let owns=false;const isValid=()=>{const s=store.getFields?store.getFields(['companion','replyLibrary']):store.get(),c=s.companion.characters.find(c=>c.characterId===id);return valid()&&c&&!c.archived&&c.createdAt===base.character.createdAt&&c.configVersion===base.character.configVersion&&relationshipStage(c.affinity).stage===stage&&(s.replyLibrary?.epoch??null)===base.epoch&&(s.replyLibrary?.characters[id]?.categories[key]??null)===base.ref;};
 const cancel=()=>{if(owns){owns=false;connection.cancel();}};onCancel(cancel);const off=store.subscribe(()=>{if(!isValid())cancel();},{changesOnly:true,keys:['companion','replyLibrary']});
 try{if(!isValid())throw new Error('生成前角色或分類已變更。');owns=true;const result=await connection.generate({text:libraryPrompt(base.character,stage,scope.direction,scope.emotionId),maxOutputTokens:1024,purpose:'reply-library'});owns=false;if(!isValid())throw new Error('生成期間角色、分類或還原版本已變更，原資料保留。');if(!result?.text)throw new Error('生成未完成；原回覆保留，沒有自動重送。');return{...parseLibraryReply(result.text),base,key,id,stage};}finally{owns=false;off();onCancel(null);}
 });
}
