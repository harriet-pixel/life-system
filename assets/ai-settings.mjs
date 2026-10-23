import {getSharedAIConnection} from './ai-runtime.mjs?v=browser-ai-2';
import {mountAITestPanel} from './ai-test-panel.mjs?v=browser-ai-2';
const providerNotes={
 gemini:'Gemini 官方 SDK 支援瀏覽器；實際可用性仍依金鑰、地區與官方跨來源政策。',
 openai:'OpenAI／GPT：官方 SDK 要求明確啟用危險瀏覽器模式；本測試採官方 REST 直連，僅在你啟用後送出金鑰。',
 claude:'Claude：僅此測試模式加入官方 anthropic-dangerous-direct-browser-access 標頭；仍受帳戶與跨來源政策限制。',
 deepseek:'DeepSeek：官方跨來源支援未能確認，可嘗試官方 API 直連；若瀏覽器拒絕，本站不使用代理繞過。',
};
export function initializeAISettings(){
 const $=id=>document.getElementById(id),key=$('ai-key'),connection=getSharedAIConnection();
 function hideKey(){key.type='password';$('ai-toggle-key').textContent='顯示金鑰';$('ai-toggle-key').setAttribute('aria-pressed','false');}
 let priorProvider,priorMode;
 connection.subscribe(state=>{
  if(priorProvider!==state.provider||priorMode!==state.mode||!state.hasKey){key.value='';hideKey();}priorProvider=state.provider;priorMode=state.mode;
  $('ai-browser-mode').checked=state.mode==='browser';$('ai-provider').value=state.provider;
  $('ai-provider-help').textContent=state.mode==='browser'?providerNotes[state.provider]:'正式後端模式需本站 HTTPS 後端與登入；目前未部署。';
  $('ai-lifecycle').textContent=state.mode==='browser'?'測試金鑰以明文 sessionStorage 暫存於此分頁，最長兩小時；不是加密保管庫，不保證關閉分頁即可靠清除。':'正式模式金鑰僅本頁記憶體；離頁或重新整理後需重輸，會經本站後端轉送至官方 AI 服務。';
  $('ai-panel').setAttribute('aria-busy',String(state.busy));$('ai-state').textContent=state.message;
  $('ai-fetched').textContent=state.fetchedAt?'清單取得時間：'+new Date(state.fetchedAt).toLocaleString('zh-TW')+'；清單僅限記憶體。':'';
  $('ai-expiry').textContent=state.expiresAt?'此組測試金鑰到期時間：'+new Date(state.expiresAt).toLocaleString('zh-TW')+'；讀取、切頁與重新整理不延長期限。':'';
  const selected=$('ai-model');selected.replaceChildren(new Option(state.busy?'正在取得模型…':state.sessionModel?'已暫存 '+state.sessionModel+'（待重新驗證）':'請選擇模型',''));state.models.forEach(model=>selected.append(new Option(model.name+'（'+model.id+'）',model.id)));selected.value=state.model;selected.disabled=state.busy||!state.models.length;
  key.disabled=!state.configured;key.placeholder=state.hasKey&&!key.value?'此分頁已有暫存金鑰，可直接取得模型':'';
  $('ai-toggle-key').disabled=!state.configured;
  $('ai-connect').disabled=!state.configured||!state.hasKey||state.busy;$('ai-refresh').disabled=$('ai-connect').disabled;
  $('ai-test').disabled=state.busy||!(state.connected&&state.model||state.restorableModel);
  $('ai-disconnect').disabled=!state.hasKey&&!state.busy;
 });
 const dialog=$('ai-mode-confirm');
 $('ai-browser-mode').addEventListener('change',()=>{if($('ai-browser-mode').checked){$('ai-browser-mode').checked=false;if(!dialog.open)dialog.showModal();}else connection.setBrowserMode(false);});
 $('ai-enable-browser').addEventListener('click',()=>{connection.setBrowserMode(true);dialog.close();});
 $('ai-cancel-browser').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>$('ai-browser-mode').focus({preventScroll:true}));
 $('ai-provider').addEventListener('change',()=>{key.value='';hideKey();connection.setProvider($('ai-provider').value);});
 key.addEventListener('input',()=>connection.setKey(key.value));
 $('ai-toggle-key').addEventListener('click',()=>{const show=key.type==='password';key.type=show?'text':'password';$('ai-toggle-key').textContent=show?'隱藏金鑰':'顯示金鑰';$('ai-toggle-key').setAttribute('aria-pressed',String(show));});
 $('ai-connect').addEventListener('click',()=>connection.connect());$('ai-refresh').addEventListener('click',()=>connection.refresh());$('ai-model').addEventListener('change',()=>connection.selectModel($('ai-model').value));$('ai-test').addEventListener('click',()=>connection.test());
 $('ai-disconnect').addEventListener('click',()=>connection.disconnect());
 window.addEventListener('pagehide',()=>{key.value='';hideKey();});
 mountAITestPanel($('ai-text-test'),connection);return connection;
}
