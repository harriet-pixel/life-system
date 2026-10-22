import {createAIConnection} from './ai-service.mjs?v=ai-connection-1';
import {AI_BACKEND_URL} from './ai-config.mjs?v=ai-connection-1';
import {getAIAccessToken} from './ai-auth.mjs?v=ai-connection-1';
export function initializeAISettings(store) {
 const $=id=>document.getElementById(id), key=$('ai-key');
 const connection=createAIConnection({endpoint:AI_BACKEND_URL,getAccessToken:getAIAccessToken,preference:store.get().settings.ai,savePreference:value=>store.setAIPreferences(value)});
 function hideKey(){key.type='password';$('ai-toggle-key').textContent='顯示金鑰';$('ai-toggle-key').setAttribute('aria-pressed','false');}
 connection.subscribe(state=>{
  $('ai-provider').value=state.provider;
  $('ai-panel').setAttribute('aria-busy',String(state.busy));
  $('ai-state').textContent=state.message;
  $('ai-fetched').textContent=state.fetchedAt?'清單取得時間：'+new Date(state.fetchedAt).toLocaleString('zh-TW')+'；僅限本頁記憶體。':'';
  const selected=$('ai-model');selected.replaceChildren(new Option(state.busy?'正在取得模型…':'請選擇模型',''));
  state.models.forEach(model=>selected.append(new Option(model.name+'（'+model.id+'）',model.id)));
  selected.value=state.model;selected.disabled=state.busy||!state.models.length;
  key.disabled=!connection.configured;
  $('ai-toggle-key').disabled=!connection.configured;
  $('ai-connect').disabled=!connection.configured||!state.hasKey||state.busy;
  $('ai-refresh').disabled=!connection.configured||!state.hasKey||state.busy;
  $('ai-test').disabled=!state.connected||!state.model||state.busy;
  $('ai-disconnect').disabled=!state.hasKey&&!state.busy;
 });
 $('ai-provider').addEventListener('change',()=>{key.value='';hideKey();connection.setProvider($('ai-provider').value);});
 key.addEventListener('input',()=>connection.setKey(key.value));
 $('ai-toggle-key').addEventListener('click',()=>{const show=key.type==='password';key.type=show?'text':'password';$('ai-toggle-key').textContent=show?'隱藏金鑰':'顯示金鑰';$('ai-toggle-key').setAttribute('aria-pressed',String(show));});
 $('ai-connect').addEventListener('click',()=>connection.connect());
 $('ai-refresh').addEventListener('click',()=>connection.refresh());
 $('ai-model').addEventListener('change',()=>connection.selectModel($('ai-model').value));
 $('ai-test').addEventListener('click',()=>connection.test());
 const clear=()=>{key.value='';hideKey();connection.disconnect();};
 $('ai-disconnect').addEventListener('click',clear);
 window.addEventListener('pagehide',clear);
 window.addEventListener('pageshow',event=>{if(event.persisted)clear();});
 // Shared interface for future explicit callers; no automatic product generation.
 return connection;
}
