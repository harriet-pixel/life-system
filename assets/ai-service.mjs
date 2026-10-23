import {MODEL_ID,MODEL_REASONS} from './ai-capabilities.mjs?v=provider-audit-3';
export const AI_PROVIDERS = Object.freeze(['gemini','deepseek','openai','claude']);
export const AI_MESSAGES = Object.freeze({
 unconfigured:'尚未設定：需要部署 HTTPS AI 後端及本站登入。', login_required:'請先完成本站登入；目前尚未設定登入整合。', auth_unavailable:'本站登入驗證服務暫時無法使用，請稍後重試。', unauthenticated:'本站登入已失效，請重新登入。', forbidden:'目前帳戶未獲本站 AI 使用授權。',
 provider_auth:'API 金鑰驗證失敗，請重新輸入。', permission:'服務商權限不足，請檢查帳戶權限。', model_unavailable:'模型不存在、已停用或明確無權使用；請重新選擇模型。',
 rate_limit:'請求過於頻繁，請稍後手動重試。', quota:'服務商額度或餘額不足，請檢查自己的服務商帳戶。', network:'網路請求未完成，無法判定是否為連線、跨來源或服務問題；沒有自動重試。', timeout:'連線逾時，請稍後重試。', provider_service:'AI 服務暫時故障，請稍後重試。',
 empty_response:'服務已回應但沒有可用文字；可能達到測試輸出限制，請確認模型相容性。', key_format:'請輸入有效格式的 API 金鑰。', model_limit:'模型清單超過安全上限或分頁格式異常，未使用不完整清單。',
 response_size:'服務回應超過大小上限。', provider_response:'服務回應格式無法辨識。', provider_request:'服務商拒絕此請求，請確認帳戶與模型相容性。', input:'請確認服務商、金鑰及模型設定。', busy:'服務忙碌，請稍後手動重試。', internal:'連線失敗；未變更任何網站資料。', preference:'連線偏好未能儲存；金鑰不會因此保存。',
});
const safeCode=code=>Object.hasOwn(AI_MESSAGES,code)?code:'internal';
export function createAIConnection({endpoint='',getAccessToken=async()=>null,fetcher=fetch,preference={},savePreference=async()=>{},timeoutMs=25000,transport=null}={}) {
 let configured=typeof transport==='function';
 if(endpoint){const url=new URL(endpoint);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/v1/ai')throw new Error('Invalid HTTPS AI endpoint');configured=true;}
 let apiKey='',generation=0,controller=null,desiredModel=preference.model||'';
 const listeners=new Set(),blocked=new Set();
 let state={provider:AI_PROVIDERS.includes(preference.provider)?preference.provider:'gemini',models:[],model:'',diagnostics:null,fetchedAt:null,busy:false,connected:false,hasKey:false,status:configured?'unset':'unconfigured',message:configured?'尚未設定本頁連線。':AI_MESSAGES.unconfigured};
 const snapshot=()=>structuredClone(state);
 const emit=()=>listeners.forEach(listener=>listener(snapshot()));
 const cancel=()=>{generation++;controller?.abort();controller=null;state.busy=false;};
 const clearList=()=>{state.models=[];state.model='';state.diagnostics=null;state.fetchedAt=null;state.connected=false;};
 async function remember(model){const version=generation;try{await savePreference({provider:state.provider,model});}catch{if(version===generation){state.message=AI_MESSAGES.preference;emit();}}}
 async function request(operation, model, extra, context) {
  if(!configured)throw {code:'unconfigured'};
  if(transport)return transport({operation,model,...extra,...context});
  if(!context.apiKey)throw {code:'key_format'};
  let aborted;
  const cancelled=new Promise((_,reject)=>{aborted=()=>reject({code:'cancelled'});context.signal.addEventListener('abort',aborted,{once:true});if(context.signal.aborted)aborted();});
  let token;
  try{token=await Promise.race([getAccessToken({signal:context.signal}),cancelled]);}
  finally{context.signal.removeEventListener('abort',aborted);}
  if(context.signal.aborted)throw {code:'cancelled'};
  if(!token||typeof token!=='string')throw {code:'login_required'};
  const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',redirect:'error',signal:context.signal,body:JSON.stringify({provider:context.provider,apiKey:context.apiKey,operation,...(model?{model}:{}),...extra})});
  if(Number(response.headers.get('content-length'))>1048576)throw {code:'response_size'};
  const reader=response.body?.getReader();if(!reader)throw {code:'provider_response'};
  let text='',size=0;const decoder=new TextDecoder();
  try{while(true){const{value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>1048576)throw {code:'response_size'};text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
  catch(error){await reader.cancel().catch(()=>{});throw error;}
  finally{reader.releaseLock();}
  let value;try{value=JSON.parse(text);}catch{throw {code:'provider_response'};}
  if(!response.ok)throw {code:safeCode(value?.error?.code)};
  return value;
 }
 async function operate(operation,extra={}) {
  cancel();const version=generation;
  if(operation==='models')clearList();
  state.busy=true;state.status='loading';state.message=operation==='models'?'正在連接並取得官方模型清單…':'正在測試連線…';controller=new AbortController();const active=controller;
  const timer=setTimeout(()=>active.abort(),timeoutMs);emit();
  try {
   const value=await request(operation,state.model,extra,{provider:state.provider,apiKey,signal:active.signal,descriptor:state.models.find(model=>model.id===state.model)});
   if(version!==generation)return;
   if(operation==='models'){
    if(!Array.isArray(value.models)||value.models.length>2000||!value.models.every(m=>m&&typeof m.id==='string'&&m.id.length<=207&&typeof m.name==='string'&&m.name.length<=200)||!Number.isFinite(Date.parse(value.fetchedAt)))throw {code:'provider_response'};
    const protocols=['deepseek-messages','chat-completions','gemini-generate','openai-responses','claude-messages'];
    state.models=value.models.filter(m=>!blocked.has(m.id)).map(m=>({id:m.id,name:m.name,...(protocols.includes(m.protocol)?{protocol:m.protocol}:{}),...(Number.isSafeInteger(m.outputLimit)&&m.outputLimit>0?{outputLimit:m.outputLimit}:{})}));state.fetchedAt=value.fetchedAt;state.connected=true;
    const raw=value.diagnostics??{received:value.models.length,retained:value.models.length,excluded:[]};
    if(!Number.isSafeInteger(raw.received)||raw.received<0||raw.received>2000||raw.retained!==value.models.length||!Array.isArray(raw.excluded)||raw.excluded.length!==raw.received-raw.retained||!raw.excluded.every(item=>item&&typeof item.id==='string'&&item.id.length<=207&&Object.hasOwn(MODEL_REASONS,item.reason)))throw {code:'provider_response'};
    const privateId=id=>apiKey.length>=8&&Array.from({length:apiKey.length-7},(_,i)=>apiKey.slice(i,i+8)).some(part=>id.includes(part));
    state.diagnostics={received:raw.received,retained:state.models.length,excluded:[...raw.excluded.map(item=>({id:privateId(item.id)?'（已隱藏）':MODEL_ID.test(item.id)?item.id:'（無有效 ID）',reason:item.reason})),...value.models.filter(m=>blocked.has(m.id)).map(m=>({id:m.id,reason:'unavailable'}))]};
    const missing=Boolean(desiredModel)&&!state.models.some(m=>m.id===desiredModel);state.model=missing?'':desiredModel;
    state.status=state.models.length?(state.model?'model_selected':'models_loaded'):raw.received?'models_filtered':'models_empty';
    state.message=missing?'模型查詢成功；已保存模型不在最新有效清單中，請重新選擇。':state.models.length?(state.model?'模型查詢成功，已恢復模型選取；尚未執行生成。':'模型查詢成功；請選取模型，尚未執行生成。'):raw.received?'模型查詢成功，但官方回傳的模型已被本站全部過濾；請查看模型診斷。':'模型查詢成功：官方回傳空清單（取得 0 筆）。';
    if(missing){desiredModel='';await remember('');}
   }else if(operation==='test'){
    if(value.ok!==true)throw {code:'provider_response'};
    state.status='generation_succeeded';state.message='生成成功（文字測試成功）；未傳送個人資料，也未修改數值。';
   }else{
    if(typeof value.text!=='string')throw {code:'provider_response'};
    state.status='generation_succeeded';state.message='生成成功；回應僅作文字顯示。';return {text:value.text};
   }
  }catch(error){
   if(version!==generation)return;
   const code=active.signal.aborted?'timeout':safeCode(error?.code??'network');
   state.status='error';state.message=AI_MESSAGES[code];
   if(operation==='models')clearList();
   if(code==='provider_auth'||code==='unauthenticated'||code==='forbidden'){clearList();}
   if(code==='model_unavailable'&&operation!=='models'){
    blocked.add(state.model);desiredModel='';state.model='';await remember('');
    if(version!==generation)return;
    await operate('models');if(version+1===generation){state.status='error';state.message=AI_MESSAGES.model_unavailable;emit();}return;
   }
  }finally{clearTimeout(timer);if(version===generation){state.busy=false;controller=null;emit();}}
 }
 const api={
  getState:snapshot,
  subscribe(listener){listeners.add(listener);listener(snapshot());return()=>listeners.delete(listener);},
  setProvider(provider){if(!AI_PROVIDERS.includes(provider))return;cancel();apiKey='';blocked.clear();desiredModel='';clearList();state={...state,provider,hasKey:false,status:configured?'unset':'unconfigured',message:configured?'服務商已切換，請重新輸入金鑰。':AI_MESSAGES.unconfigured};emit();void remember('');},
  setKey(value){cancel();apiKey=typeof value==='string'?value:'';blocked.clear();clearList();state.hasKey=Boolean(apiKey);state.status=configured?(apiKey?'key_stored':'unset'):'unconfigured';state.message=configured?(apiKey?'金鑰已暫存；尚未查詢模型。':'尚未輸入金鑰。'):AI_MESSAGES.unconfigured;emit();},
  selectModel(model){if(!state.models.some(item=>item.id===model)||state.busy)return;state.model=model;desiredModel=model;state.status='model_selected';state.message='模型已選取；尚未執行生成，生成測試可能產生費用。';emit();void remember(model);},
  connect(){return operate('models');},refresh(){return operate('models');},
  test(){if(!state.model||!state.connected||state.busy)return;return operate('test');},
  generate({text,maxOutputTokens=64}={}){if(!state.model||!state.connected||state.busy)return;return operate('generate',{text,maxOutputTokens});},
  disconnect(){cancel();apiKey='';blocked.clear();clearList();state.hasKey=false;state.status=configured?'unset':'unconfigured';state.message=configured?'已中斷連線並清除本頁金鑰。':AI_MESSAGES.unconfigured;emit();},
  cancel(){cancel();state.status='cancelled';state.message='已取消本次 AI 請求。';emit();},
  configured,
 };
 return api;
}
