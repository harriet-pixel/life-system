import {createAIConnection} from './ai-service.mjs?v=provider-audit-3';
import {createAISession} from './ai-session.mjs?v=provider-audit-3';
import {createProviderAdapter} from './ai-providers.mjs?v=provider-audit-3';
// One controller for formal backend and explicitly enabled browser testing.
export function createPageAIConnection({storage,now=Date.now,fetcher=fetch,endpoint='',getAccessToken,preference={},savePreference,timeoutMs}={}){
 const session=createAISession(storage,{now}),listeners=new Set();
 let core,unsubscribe,mode='backend',epoch=0,timer=null,override='';
 function read(){try{return session.read();}catch{return null;}}
 const initial=read();
 function state(){const value=mode==='browser'?read():null,current=core.getState();const message=mode==='browser'&&['unset','key_stored'].includes(current.status)?(current.hasKey?'金鑰已暫存於此分頁；可取得模型，跨頁生成會先重新驗證模型。':'測試模式已啟用，請輸入測試專用金鑰。'):current.message;return {...current,message,mode,configured:core.configured,expiresAt:value?.expiresAt??null,restorableModel:Boolean(value?.apiKey&&value.model),sessionModel:value?.model??'',...(override?{message:override}:{})};}
 const emit=()=>listeners.forEach(listener=>listener(state()));
 function deadline(){clearTimeout(timer);const value=read();if(mode==='browser'&&(value?.expiresAt||!value)){timer=setTimeout(checkExpiry,value?Math.max(1,value.expiresAt-now()):1);timer.unref?.();}}
 function install(browser,value=null){
  epoch++;unsubscribe?.();core?.disconnect();mode=browser?'browser':'backend';override='';
  core=createAIConnection({endpoint,getAccessToken,fetcher,timeoutMs,
   preference:browser?{provider:value?.provider??'gemini',model:value?.model??''}:preference,
   savePreference:browser?async p=>{session.setModel(p.model);deadline();}:savePreference,
   transport:browser?async request=>{
    if(!checkExpiry())throw {code:'expired'};
    const adapter=createProviderAdapter(request.provider,request.apiKey,{fetcher,signal:request.signal,browser:true});
    if(request.operation==='models')return adapter.listModels();
    const result=await adapter.generate({model:request.model,text:request.operation==='test'?'Reply only with OK.':request.text,maxOutputTokens:request.operation==='test'?64:request.maxOutputTokens,descriptor:request.descriptor});
    return request.operation==='test'?{ok:true}:result;
   }:null,
  });
  if(browser&&value?.apiKey)core.setKey(value.apiKey);
  unsubscribe=core.subscribe(emit);deadline();emit();
 }
 function checkExpiry(){
  if(mode!=='browser')return true;
  if(read())return true;
  install(false);override='瀏覽器測試連線已到期或暫存已清除，請重新啟用並輸入金鑰。';emit();return false;
 }
 function storageFailure(){try{session.clear();}catch{}install(false);override='無法使用此分頁的 sessionStorage，已清除連線；請確認瀏覽器允許分頁暫存。';emit();}
 async function execute(operation,options){
  if(!checkExpiry())return;
  const version=epoch,current=core;
  if(mode==='browser'&&['test','generate'].includes(operation)&&!current.getState().connected){await current.connect();if(version!==epoch||!checkExpiry())return;}
  if(version!==epoch)return;
  return current[operation](options);
 }
 install(Boolean(initial),initial);
 return {
  getState(){checkExpiry();return state();},notify(){checkExpiry();emit();},subscribe(listener){checkExpiry();listeners.add(listener);listener(state());return()=>listeners.delete(listener);},
  setBrowserMode(enabled){try{session.clear();if(enabled){session.enable(core.getState().provider);install(true,read());}else install(false);}catch{storageFailure();}},
  setProvider(provider){if(!['gemini','deepseek','openai','claude'].includes(provider))return;if(mode==='browser'){try{session.enable(provider);install(true,read());}catch{storageFailure();}}else core.setProvider(provider);},
  setKey(value){if(!checkExpiry())return;override='';if(mode==='browser'){if(typeof value!=='string'||value.length>4096)return;try{session.setKey(core.getState().provider,value);deadline();}catch{storageFailure();return;}}core.setKey(value);},
  selectModel(model){if(checkExpiry())core.selectModel(model);},
  connect:()=>execute('connect'),refresh:()=>execute('refresh'),test:()=>execute('test'),generate:options=>execute('generate',options),
  cancel(){epoch++;core.cancel();},
  disconnect(){try{session.clear();}catch{}if(mode==='browser')install(false);else core.disconnect();},
  checkExpiry,
  suspend(){epoch++;unsubscribe?.();core.disconnect();clearTimeout(timer);},
  resume(){const value=read();install(Boolean(value),value);},
 };
}
