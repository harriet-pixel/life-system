import {createAISession,AI_SESSION_KEY} from './ai-session.mjs?v=daily-polish-20261029';
import {createPersonalBackend} from './ai-worker-auth.mjs?v=daily-polish-20261029';
import {AI_WORKER_URL} from './ai-worker-config.mjs?v=daily-polish-20261029';
import {createPageAIConnection} from './ai-client.mjs?v=daily-polish-20261029';
import {AI_BACKEND_URL} from './ai-config.mjs?v=daily-polish-20261029';
import {getAIAccessToken} from './ai-auth.mjs?v=daily-polish-20261029';
import {dataStore} from './data.mjs?v=companion-actions-20261029';
let shared;
export function getSharedAIConnection(){
 if(!shared){
  const storage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key)};
  try{if(!storage.getItem(AI_SESSION_KEY)){const legacy=createAISession(sessionStorage).read();if(legacy)storage.setItem(AI_SESSION_KEY,JSON.stringify(legacy));}if(storage.getItem(AI_SESSION_KEY))sessionStorage.removeItem(AI_SESSION_KEY);}catch{}
  const personalBackend=createPersonalBackend({endpoint:AI_WORKER_URL,storage:sessionStorage});
  shared=createPageAIConnection({storage,defaultBrowser:true,personalBackend,endpoint:AI_BACKEND_URL,getAccessToken:getAIAccessToken,preference:dataStore.getFields(['settings']).settings.ai,savePreference:value=>dataStore.setAIPreferences(value)});
  if(shared.getState().hasKey)void shared.connect();
  window.addEventListener('storage',event=>{if(event.key===AI_SESSION_KEY)shared.resume();});
  window.addEventListener('pagehide',()=>shared.suspend());
  window.addEventListener('pageshow',event=>{if(event.persisted)shared.resume();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){personalBackend.checkExpiry();shared.checkExpiry();}});
 }
 return shared;
}
