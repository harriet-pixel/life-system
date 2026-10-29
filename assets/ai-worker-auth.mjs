import {readJSON} from './ai-errors.mjs?v=daily-polish-20261029';
export const WORKER_SESSION_KEY='life-system.ai-worker-session.v1';
const tokenPattern=/^[a-f0-9]{64}$/;
export function validateWorkerURL(value){if(value==='')return '';const url=new URL(value);if(url.protocol!=='https:'||!url.hostname.endsWith('.workers.dev')||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash)throw new Error('Personal HTTPS workers.dev URL required');return url.origin;}
export function createPersonalBackend({endpoint='',storage,fetcher=fetch,now=Date.now,browser=globalThis.window}={}){
 const origin=validateWorkerURL(endpoint),listeners=new Set();let pending=null,controller=null,epoch=0,message='';
 const clear=()=>{try{storage.removeItem(WORKER_SESSION_KEY);}catch{}};
 function read(){if(!origin)return null;try{const raw=storage.getItem(WORKER_SESSION_KEY);if(!raw)return null;const value=JSON.parse(raw);if(Object.keys(value).some(k=>!['token','origin','issuedAt','expiresAt'].includes(k))||value.origin!==origin||!tokenPattern.test(value.token)||!Number.isFinite(value.issuedAt)||!Number.isFinite(value.expiresAt)||value.issuedAt>now()||value.expiresAt<=now()||value.expiresAt-value.issuedAt>3600000||value.expiresAt<=value.issuedAt){clear();return null;}return value;}catch{clear();return null;}}
 const state=()=>{const session=read();return {configured:Boolean(origin),authenticated:Boolean(session),expiresAt:session?.expiresAt??null,busy:Boolean(pending),message:!session&&message.startsWith('已登入')?'登入已到期或清除，請重新登入個人後端。':message||(!origin?'個人 Workers 後端尚未設定；可手動啟用瀏覽器直連備用模式。':session?'已登入個人後端；每次請求仍會驗證工作階段。':'請使用 GitHub 登入個人後端。')};};
 const emit=()=>listeners.forEach(listener=>listener(state()));
 async function call(path,body,token,signal){
  let response;
  try{response=await fetcher(origin+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',signal});}catch{throw {code:signal?.aborted?'timeout':'backend_unavailable'};}
  let value;try{value=await readJSON(response);}catch{throw {code:response.status===429?'backend_rate_limit':'backend_unavailable'};}
  if(!response.ok){if(response.status===401){clear();message='登入已失效，請重新登入個人後端。';emit();}throw {code:typeof value?.error?.code==='string'?value.error.code:'backend_unavailable'};}return value;
 }
 function cancel(){epoch++;controller?.abort();controller=null;pending?.cancel();pending=null;}
 return {
  getState:state,subscribe(listener){listeners.add(listener);listener(state());return()=>listeners.delete(listener);},
  cancel,
  async login(){
   if(!origin||pending)return;cancel();const version=epoch,nonce=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
   const popup=browser.open(origin+'/auth/start?nonce='+nonce,'life-system-personal-login','popup,width=520,height=700');
   if(!popup){message='無法開啟登入視窗；請允許本站彈出視窗後重試。';emit();return false;}
   message='正在等待 GitHub 登入…';controller=new AbortController();const signal=controller.signal;
   return new Promise(resolve=>{
    let timer,closed;
    const done=result=>{browser.removeEventListener('message',receive);clearTimeout(timer);clearInterval(closed);try{popup.close();}catch{}if(version===epoch){pending=null;controller=null;emit();}resolve(result);};
    const receive=async event=>{
     const value=event.data;if(event.origin!==origin||event.source!==popup||value?.type!=='life-ai-login'||value.nonce!==nonce||!tokenPattern.test(value.token)||!Number.isFinite(value.expiresAt)||value.expiresAt<=now()||value.expiresAt>now()+3600000)return;
     browser.removeEventListener('message',receive);clearInterval(closed);message='正在驗證本人工作階段…';emit();
     try{const verified=await call('/auth/session',{},value.token,signal);if(version!==epoch||signal.aborted)return done(false);if(verified.authenticated!==true||verified.expiresAt!==value.expiresAt)throw new Error('invalid session');storage.setItem(WORKER_SESSION_KEY,JSON.stringify({origin,token:value.token,issuedAt:now(),expiresAt:value.expiresAt}));message='已登入個人後端；尚未查詢模型。';done(true);}catch{if(version===epoch){clear();message='個人登入驗證失敗，請確認帳號授權與後端設定。';}done(false);}
    };
    pending={cancel:()=>{message='已取消登入。';done(false);}};browser.addEventListener('message',receive);timer=setTimeout(()=>{if(version===epoch)message='登入逾時，請重新開啟登入。';done(false);},120000);closed=setInterval(()=>{if(popup.closed){if(version===epoch)message='登入視窗已關閉；尚未完成登入。';done(false);}},500);emit();
   });
  },
  async logout(){cancel();const value=read();clear();message='已登出個人後端。';emit();if(value)try{await call('/auth/logout',{},value.token,AbortSignal.timeout(10000));}catch{message='本分頁已登出；後端撤銷尚未確認，舊工作階段最長一小時後失效。';emit();}},
  async request(request){const value=read();if(!value){emit();throw {code:'unauthenticated'};}const body={provider:request.provider,operation:request.operation,...(request.model?{model:request.model}:{}),...(request.operation==='generate'?{text:request.text,maxOutputTokens:request.maxOutputTokens}:{})};return call('/v1/ai',body,value.token,request.signal);},
  checkExpiry(){const was=Boolean(read());emit();return was;},
 };
}
