import {MODEL_REASONS} from './ai-capabilities.mjs?v=storage-rescue-20261028';
import {getSharedAIConnection} from './ai-runtime.mjs?v=mobile-daily-20261028';
const providerNotes={
 gemini:'Gemini 官方 SDK 支援瀏覽器；實際可用性仍依金鑰、地區與官方跨來源政策。',
 openai:'OpenAI／GPT：官方 SDK 要求明確啟用危險瀏覽器模式；本站採官方 REST 直連，以你設定的金鑰連接。',
 claude:'Claude：瀏覽器直連使用官方 anthropic-dangerous-direct-browser-access 標頭；仍受帳戶與跨來源政策限制。',
 deepseek:'DeepSeek：目前已回報直連連線成功；生成、跨頁與其他帳戶仍須分別驗收，本站不使用非官方代理。',
};
export function aiStatusSummary(state){
 if(state.busy)return '請求處理中';
 if(state.status==='generation_succeeded')return '生成成功';
 if(state.status==='model_selected')return '模型已選取，尚未生成';
 if(state.status==='models_loaded')return '模型已取得，尚未選取';
 if(state.status==='models_empty')return '模型查詢完成：空清單';
 if(state.status==='models_filtered')return '模型查詢完成：全部被篩除';
 if(state.status==='error')return '操作失敗，請展開查看';
 if(state.status==='cancelled')return '本次請求已取消';
 if(state.hasKey)return '金鑰已保存，尚未查詢模型';
 if(state.backendReady)return '本人已登入，尚未查詢模型';
 return '尚未設定';
}
export function initializeAISettings(root=document,context){
 const $=id=>root.querySelector('#'+CSS.escape(id)),key=$('ai-key'),connection=getSharedAIConnection();
 function clearKeyField(){key.value='';key.type='password';key.placeholder=hasKey?'金鑰已設定，無法檢視；輸入新金鑰可替換':'';}
 let priorProvider,priorMode,hasKey=false;
 const subscribe=fn=>context?context.subscribe(connection,fn):connection.subscribe(fn);
 subscribe(state=>{
  hasKey=state.hasKey;
  if(priorProvider!==state.provider||priorMode!==state.mode||!state.hasKey){clearKeyField();}priorProvider=state.provider;priorMode=state.mode;
  $('ai-provider').value=state.provider;
  $('ai-provider-help').textContent=state.mode==='browser'?providerNotes[state.provider]:'';
  const personal=state.mode==='backend'&&state.personal?.configured;if(personal)$('ai-provider-help').textContent='使用已設定的個人後端服務。';
  $('ai-key-controls').hidden=Boolean(personal);$('ai-key-label').hidden=Boolean(personal);
  if($('ai-collapse-state'))$('ai-collapse-state').textContent=aiStatusSummary(state);
  $('ai-panel').setAttribute('aria-busy',String(state.busy));$('ai-state').textContent=state.status==='unset'&&state.mode==='browser'&&!state.hasKey?'AI 連接已開啟，請輸入 API 金鑰。':state.message;
  const diagnostic=state.diagnostics;$('ai-model-diagnostics').hidden=false;
  $('ai-model-counts').textContent=diagnostic?`官方取得 ${diagnostic.received} 筆，本站保留 ${diagnostic.retained} 筆，排除 ${diagnostic.excluded.length} 筆。`:'官方取得 0 筆，本站保留 0 筆，排除 0 筆。';
  $('ai-model-excluded').replaceChildren();for(const item of diagnostic?.excluded??[]){const row=document.createElement('li');row.textContent=item.id+'：'+MODEL_REASONS[item.reason];$('ai-model-excluded').append(row);}
  const selected=$('ai-model');selected.replaceChildren(new Option(state.busy?'正在取得模型…':state.sessionModel?'已保存 '+state.sessionModel+'（待重新驗證）':'請選擇模型',''));state.models.forEach(model=>selected.append(new Option(model.name+'（'+model.id+'）',model.id)));selected.value=state.model;selected.disabled=state.busy||!state.models.length;
  key.disabled=!state.configured||Boolean(personal);key.placeholder=state.hasKey&&!key.value?'金鑰已設定，無法檢視；輸入新金鑰可替換':'';
  $('ai-connect').disabled=!state.configured||!(personal?state.backendReady:state.hasKey)||state.busy;$('ai-refresh').disabled=$('ai-connect').disabled;
  $('ai-test').disabled=state.busy||Boolean(personal&&!state.backendReady)||!(state.connected&&state.model||state.restorableModel||state.restorableBackendModel);
  $('ai-connect').textContent='連接AI';
  $('ai-disconnect').textContent='中斷連線';$('ai-disconnect').disabled=personal?!state.connected&&!state.busy:!state.hasKey&&!state.busy;
 });
 $('ai-provider').addEventListener('change',()=>{clearKeyField();connection.setProvider($('ai-provider').value);});
 key.addEventListener('input',()=>connection.setKey(key.value));
 key.addEventListener('blur',clearKeyField);
 $('ai-connect').addEventListener('click',()=>{clearKeyField();connection.connect();});$('ai-refresh').addEventListener('click',()=>{clearKeyField();connection.refresh();});$('ai-model').addEventListener('change',()=>connection.selectModel($('ai-model').value));$('ai-test').addEventListener('click',()=>{clearKeyField();connection.test();});
 $('ai-disconnect').addEventListener('click',()=>connection.disconnect());
 if(context){context.listen(window,'pagehide',()=>{clearKeyField();});context.onSuspend(clearKeyField);}else window.addEventListener('pagehide',()=>{clearKeyField();});
 return connection;
}
