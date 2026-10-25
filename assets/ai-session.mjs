// Explicitly opt-in developer session only. Never use the general settings store.
export const AI_SESSION_KEY='life-system.ai-test.v1';
const LEGACY_SESSION_TTL=2*60*60*1000;
const providers=['gemini','deepseek','openai','claude'];
export function createAISession(storage,{now=Date.now}={}){
 const clear=()=>storage.removeItem(AI_SESSION_KEY);
 function write(value){storage.setItem(AI_SESSION_KEY,JSON.stringify(value));}
 function read(){
  const raw=storage.getItem(AI_SESSION_KEY);if(!raw)return null;
  try{
   if(raw.length>16384)throw 0;
   let value=JSON.parse(raw);
   if(!value||![1,2].includes(value.version)||value.enabled!==true||Object.keys(value).some(k=>!['version','enabled','provider','apiKey','model','issuedAt','expiresAt'].includes(k))||!providers.includes(value.provider)||typeof value.apiKey!=='string'||value.apiKey.length>4096||typeof value.model!=='string'||value.model.length>207)throw 0;
   if(value.apiKey){
    if(!Number.isSafeInteger(value.issuedAt)||value.issuedAt>now())throw 0;
    if(value.version===1){if(value.expiresAt!==value.issuedAt+LEGACY_SESSION_TTL||now()>=value.expiresAt)throw 0;}
    else if(value.expiresAt!==null)throw 0;
   }else if(value.issuedAt!==null||value.expiresAt!==null||value.model)throw 0;
   // Preserve live legacy sessions; never revive expired or malformed credentials.
   if(value.version===1){value={...value,version:2,expiresAt:null};write(value);}
   return value;
  }catch{clear();return null;}
 }
 return {read,clear,
  enable(provider){write({version:2,enabled:true,provider,apiKey:'',model:'',issuedAt:null,expiresAt:null});},
  setKey(provider,apiKey){const old=read();const issuedAt=apiKey?(old?.apiKey?old.issuedAt:now()):null;write({version:2,enabled:true,provider,apiKey,model:'',issuedAt,expiresAt:null});},
  setModel(model){const value=read();if(value?.apiKey){value.model=model;write(value);}},
 };
}
