import {AI_TEST_TEXT} from './ai-prompts.mjs?v=sync-live-20261028';
import {createAIConnection} from './ai-service.mjs?v=sync-live-20261028';
import {createAISession} from './ai-session.mjs?v=sync-live-20261028';
import {createProviderAdapter} from './ai-providers.mjs?v=sync-live-20261028';
// One controller for formal backend and explicitly enabled browser testing.
export function createPageAIConnection({storage,now=Date.now,fetcher=fetch,endpoint='',getAccessToken,preference={},savePreference,timeoutMs,personalBackend=null}={}){
 const session=createAISession(storage,{now}),listeners=new Set();
 let core,unsubscribe,mode='backend',epoch=0,override='';
 function read(){try{return session.read();}catch{return null;}}
 const initial=read();
 function state(){const value=mode==='browser'?read():null,current=core.getState();const message=mode==='browser'&&['unset','key_stored'].includes(current.status)?(current.hasKey?'金鑰已暫存於此分頁；可取得模型，跨頁生成會先重新驗證模型。':'測試模式已啟用，請輸入測試專用金鑰。'):current.message;const personal=mode==='backend'&&personalBackend?.getState().configured?personalBackend.getState():null;return {...current,message:personal&&['unset','unconfigured'].includes(current.status)?personal.message:message,mode,personal:personalBackend?.getState()??null,backendReady:Boolean(personal?.authenticated),restorableBackendModel:Boolean(personal?.authenticated&&preference.model),configured:core.configured,expiresAt:value?.expiresAt??null,restorableModel:Boolean(value?.apiKey&&value.model),sessionModel:value?.model??'',...(override?{message:override}:{})};}
 const emit=()=>listeners.forEach(listener=>listener(state()));
 function install(browser,value=null){
  epoch++;personalBackend?.cancel();unsubscribe?.();core?.disconnect();mode=browser?'browser':'backend';override='';
  core=createAIConnection({endpoint,getAccessToken,fetcher,timeoutMs,
   preference:browser?{provider:value?.provider??'gemini',model:value?.model??''}:preference,
   savePreference:browser?async p=>{session.setModel(p.model);}:async p=>{preference={...p};await savePreference?.(p);},
   transport:browser?async request=>{
    if(!checkExpiry())throw {code:'expired'};
    const adapter=createProviderAdapter(request.provider,request.apiKey,{fetcher,signal:request.signal,browser:true});
    if(request.operation==='models')return adapter.listModels();
    const result=await adapter.generate({model:request.model,text:request.operation==='test'?AI_TEST_TEXT:request.text,maxOutputTokens:request.operation==='test'?64:request.maxOutputTokens,descriptor:request.descriptor,prompt:request.prompt});
    return request.operation==='test'?{ok:true}:result;
   }:personalBackend?.getState().configured?request=>personalBackend.request(request):null,
  });
  if(browser&&value?.apiKey)core.setKey(value.apiKey);
  unsubscribe=core.subscribe(emit);emit();
 }
 // Retain the public validity guard for callers; browser sessions have no deadline.
 function checkExpiry(){
  if(mode!=='browser')return true;
  if(read())return true;
  install(false);override='瀏覽器直連暫存已清除或無效，請重新啟用並輸入金鑰。';emit();return false;
 }
 function storageFailure(){try{session.clear();}catch{}install(false);override='無法使用此分頁的 sessionStorage，已清除連線；請確認瀏覽器允許分頁暫存。';emit();}
 async function execute(operation,options){
  if(!checkExpiry())return;
  const version=epoch,current=core;
  if((mode==='browser'||personalBackend?.getState().configured)&&['test','generate'].includes(operation)&&!current.getState().connected){await current.connect();if(version!==epoch||!checkExpiry())return;}
  if(version!==epoch)return;
  return current[operation](options);
 }
 install(Boolean(initial),initial);
 personalBackend?.subscribe(()=>emit());
 return {
  getState(){checkExpiry();return state();},notify(){checkExpiry();emit();},subscribe(listener){checkExpiry();listeners.add(listener);listener(state());return()=>listeners.delete(listener);},
  setBrowserMode(enabled){try{session.clear();if(enabled){session.enable(core.getState().provider);install(true,read());}else install(false);}catch{storageFailure();}},
  setProvider(provider){if(!['gemini','deepseek','openai','claude'].includes(provider))return;if(mode==='browser'){try{session.enable(provider);install(true,read());}catch{storageFailure();}}else core.setProvider(provider);},
  setKey(value){if(mode==='backend'&&personalBackend?.getState().configured)return;if(!checkExpiry())return;override='';if(mode==='browser'){if(typeof value!=='string'||value.length>4096)return;try{session.setKey(core.getState().provider,value);}catch{storageFailure();return;}}core.setKey(value);},
  selectModel(model){if(checkExpiry())core.selectModel(model);},
  connect:()=>execute('connect'),refresh:()=>execute('refresh'),test:()=>execute('test'),generate:options=>execute('generate',options),
  cancel(){epoch++;core.cancel();},
  disconnect(){try{session.clear();}catch{}if(mode==='browser')install(false);else core.disconnect();},
  async login(){if(mode!=='backend')return;const result=await personalBackend?.login();if(result)install(false);return result;},
  async logout(){epoch++;core.disconnect();await personalBackend?.logout();install(false);},
  checkExpiry,
  suspend(){epoch++;personalBackend?.cancel();unsubscribe?.();core.disconnect();},
  resume(){const value=read();install(Boolean(value),value);},
 };
}
