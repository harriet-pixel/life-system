import {createPersonalBackend} from './ai-worker-auth.mjs?v=sync-live-20261028';
import {AI_WORKER_URL} from './ai-worker-config.mjs?v=sync-live-20261028';
import {createPageAIConnection} from './ai-client.mjs?v=sync-live-20261028';
import {AI_BACKEND_URL} from './ai-config.mjs?v=sync-live-20261028';
import {getAIAccessToken} from './ai-auth.mjs?v=sync-live-20261028';
import {dataStore} from './data.mjs?v=sync-live-20261028';
let shared;
export function getSharedAIConnection(){
 if(!shared){
  const storage={getItem:key=>sessionStorage.getItem(key),setItem:(key,value)=>sessionStorage.setItem(key,value),removeItem:key=>sessionStorage.removeItem(key)};
  const personalBackend=createPersonalBackend({endpoint:AI_WORKER_URL,storage});
  shared=createPageAIConnection({storage,personalBackend,endpoint:AI_BACKEND_URL,getAccessToken:getAIAccessToken,preference:dataStore.get().settings.ai,savePreference:value=>dataStore.setAIPreferences(value)});
  window.addEventListener('pagehide',()=>shared.suspend());
  window.addEventListener('pageshow',event=>{if(event.persisted)shared.resume();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){personalBackend.checkExpiry();shared.checkExpiry();}});
 }
 return shared;
}
