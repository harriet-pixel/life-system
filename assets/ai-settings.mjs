import {MODEL_REASONS} from './ai-capabilities.mjs?v=provider-audit-3';
import {getSharedAIConnection} from './ai-runtime.mjs?v=personal-worker-5';
import {mountAITestPanel} from './ai-test-panel.mjs?v=personal-worker-5';
const providerNotes={
 gemini:'Gemini 官方 SDK 支援瀏覽器；實際可用性仍依金鑰、地區與官方跨來源政策。',
 openai:'OpenAI／GPT：官方 SDK 要求明確啟用危險瀏覽器模式；本測試採官方 REST 直連，僅在你啟用後送出金鑰。',
 claude:'Claude：僅此測試模式加入官方 anthropic-dangerous-direct-browser-access 標頭；仍受帳戶與跨來源政策限制。',
 deepseek:'DeepSeek：目前已回報直連連線成功；生成、跨頁與其他帳戶仍須分別驗收，本站不使用非官方代理。',
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
  const personal=state.mode==='backend'&&state.personal?.configured;
  $('ai-worker-login').hidden=state.mode==='browser';$('ai-worker-login').disabled=!state.personal?.configured||state.personal?.busy;
  $('ai-worker-logout').hidden=state.mode==='browser';$('ai-worker-logout').disabled=!state.personal?.authenticated||state.personal?.busy;
  $('ai-worker-summary').textContent=state.mode==='browser'?'目前使用手動瀏覽器直連備用模式。':!state.personal?.configured?'個人 Workers 後端尚未設定；瀏覽器直連仍可使用。':state.personal.authenticated?'本人已登入個人後端；AI 金鑰保留在 Cloudflare Secret。':'個人後端已設定，請先以 GitHub 本人帳號登入。';
  $('ai-key-controls').hidden=Boolean(personal);$('ai-key-label').hidden=Boolean(personal);
  if(personal){$('ai-lifecycle').textContent='AI 金鑰只由 Cloudflare Worker Secret 送往所選官方服務，不會傳回瀏覽器；本站登入工作階段最多一小時，以本分頁暫存支援跨頁。';$('ai-provider-help').textContent='僅已於後端設定 Secret 的服務商可用。後端失敗時請手動切換直連；不自動重送生成。';}
  $('ai-panel').setAttribute('aria-busy',String(state.busy));$('ai-state').textContent=state.message;
  const diagnostic=state.diagnostics;$('ai-model-diagnostics').hidden=!diagnostic;
  $('ai-model-counts').textContent=diagnostic?`官方取得 ${diagnostic.received} 筆，本站保留 ${diagnostic.retained} 筆，排除 ${diagnostic.excluded.length} 筆。`:'';
  $('ai-model-excluded').replaceChildren();for(const item of diagnostic?.excluded??[]){const row=document.createElement('li');row.textContent=item.id+'：'+MODEL_REASONS[item.reason];$('ai-model-excluded').append(row);}
  $('ai-fetched').textContent=state.fetchedAt?'清單取得時間：'+new Date(state.fetchedAt).toLocaleString('zh-TW')+'；清單僅限記憶體。':'';
  $('ai-expiry').textContent=state.expiresAt?'此組測試金鑰到期時間：'+new Date(state.expiresAt).toLocaleString('zh-TW')+'；讀取、切頁與重新整理不延長期限。':'';
  const selected=$('ai-model');selected.replaceChildren(new Option(state.busy?'正在取得模型…':state.sessionModel?'已暫存 '+state.sessionModel+'（待重新驗證）':'請選擇模型',''));state.models.forEach(model=>selected.append(new Option(model.name+'（'+model.id+'）',model.id)));selected.value=state.model;selected.disabled=state.busy||!state.models.length;
  key.disabled=!state.configured||Boolean(personal);key.placeholder=state.hasKey&&!key.value?'此分頁已有暫存金鑰，可直接取得模型':'';
  $('ai-toggle-key').disabled=key.disabled;
  $('ai-connect').disabled=!state.configured||!(personal?state.backendReady:state.hasKey)||state.busy;$('ai-refresh').disabled=$('ai-connect').disabled;
  $('ai-test').disabled=state.busy||Boolean(personal&&!state.backendReady)||!(state.connected&&state.model||state.restorableModel||state.restorableBackendModel);
  $('ai-connect').textContent=personal?'取得模型':'連接並取得模型';
  $('ai-disconnect').textContent=personal?'中斷模型連線':'中斷連線並清除金鑰';$('ai-disconnect').disabled=personal?!state.connected&&!state.busy:!state.hasKey&&!state.busy;
 });
 $('ai-worker-login').addEventListener('click',()=>connection.login());$('ai-worker-logout').addEventListener('click',()=>connection.logout());
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
 mountAITestPanel($('ai-text-test'),connection,{statusElement:$('ai-state')});return connection;
}
