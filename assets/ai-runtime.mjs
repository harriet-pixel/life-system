import {createPageAIConnection} from './ai-client.mjs?v=browser-ai-2';
import {AI_BACKEND_URL} from './ai-config.mjs?v=ai-connection-1';
import {getAIAccessToken} from './ai-auth.mjs?v=ai-connection-1';
import {dataStore} from './data.mjs?v=ai-connection-1';
let shared;
export function getSharedAIConnection(){
 if(!shared){
  const storage={getItem:key=>sessionStorage.getItem(key),setItem:(key,value)=>sessionStorage.setItem(key,value),removeItem:key=>sessionStorage.removeItem(key)};
  shared=createPageAIConnection({storage,endpoint:AI_BACKEND_URL,getAccessToken:getAIAccessToken,preference:dataStore.get().settings.ai,savePreference:value=>dataStore.setAIPreferences(value)});
  window.addEventListener('pagehide',()=>shared.suspend());
  window.addEventListener('pageshow',event=>{if(event.persisted)shared.resume();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)shared.checkExpiry();});
 }
 return shared;
}
