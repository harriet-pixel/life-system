import {AIError,fail,readJSON} from '../../assets/ai-errors.mjs?v=restore-images-20261031';
import {configuration,jsonBody,json,validToken,edgeFetch} from './security.mjs';
export {PersonalGate} from './gate.mjs';
const cookieName='__Host-life-oauth';
const clearCookie=cookieName+'=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
export function createPersonalWorker({fetcher=edgeFetch}={}){return {async fetch(request,env){
 let config;
 const url=new URL(request.url),origin=request.headers.get('Origin');
 function finish(response){const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('Referrer-Policy','no-referrer');headers.set('X-Content-Type-Options','nosniff');headers.set('Vary','Origin');if(config&&origin===config.site.origin)headers.set('Access-Control-Allow-Origin',origin);return new Response(response.body,{status:response.status,headers});}
 try{
  if(url.protocol!=='https:')fail('https_required',400);config=configuration(env);if(url.origin!==config.worker.origin)fail('origin',403);
  const gate=env.PERSONAL_GATE.get(env.PERSONAL_GATE.idFromName('personal-owner-v1'));
  const internal=async(path,body)=>{const response=await gate.fetch(new Request('https://internal'+path,{method:'POST',body:JSON.stringify(body),signal:request.signal}));const value=await readJSON(response,1048576);if(!response.ok)throw new AIError(value?.error?.code??'backend_unavailable',response.status);return value;};
  if(url.pathname==='/auth/start'&&request.method==='GET'){
   if(url.searchParams.size!==1||!validToken(url.searchParams.get('nonce')))fail('input');
   const state=await internal('/start',{nonce:url.searchParams.get('nonce')});const target=new URL('https://github.com/login/oauth/authorize');
   target.search=new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,redirect_uri:config.callback,state:state.state,scope:'',code_challenge:state.challenge,code_challenge_method:'S256',prompt:'select_account'});
   return finish(new Response(null,{status:302,headers:{Location:target.href,'Set-Cookie':cookieName+'='+state.state+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600'}}));
  }
  if(url.pathname==='/auth/callback'&&request.method==='GET'){
   const state=url.searchParams.get('state'),cookie=request.headers.get('Cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);
   if(!validToken(state)||cookie!==state)fail('unauthenticated',401);const pending=await internal('/consume',{state});
   const code=url.searchParams.get('code');if(typeof code!=='string'||code.length>512||!code||url.searchParams.has('error'))fail('unauthenticated',401);
   const signal=AbortSignal.any([request.signal,AbortSignal.timeout(10000)]);
   let tokenResponse,userResponse;
   try{
    tokenResponse=await fetcher('https://github.com/login/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code,redirect_uri:config.callback,code_verifier:pending.verifier}),signal,redirect:'error'});
    if(!tokenResponse.ok)fail('auth_unavailable',503);const value=await readJSON(tokenResponse,16384);
    if(typeof value.access_token!=='string'||value.access_token.length>4096||value.token_type?.toLowerCase()!=='bearer')fail('unauthenticated',401);
    userResponse=await fetcher('https://api.github.com/user',{headers:{Authorization:'Bearer '+value.access_token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'life-system-personal-ai'},signal,redirect:'error'});
   }catch(error){if(error instanceof AIError)throw error;fail('auth_unavailable',503);}
   if(!userResponse.ok)fail('unauthenticated',401);const user=await readJSON(userResponse,65536);
   if(String(user.id)!==env.ALLOWED_GITHUB_ID)fail('forbidden',403);
   const session=await internal('/issue',{}),nonce=crypto.randomUUID().replaceAll('-','');
   // OAuth code stays on the Worker callback; the opaque site session travels
   // only by postMessage to the exact Pages origin, never in a redirect URL.
   const payload=JSON.stringify({type:'life-ai-login',nonce:pending.nonce,...session}).replaceAll('<','\\u003c');
   const html='<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>Life system 登入</title><p>登入完成，請返回 Life system。</p><script nonce="'+nonce+'">history.replaceState(null,"","/auth/complete");if(window.opener){window.opener.postMessage('+payload+','+JSON.stringify(config.site.origin)+');window.close();}</script></html>';
   return finish(new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Set-Cookie':clearCookie,'Content-Security-Policy':"default-src 'none'; script-src 'nonce-"+nonce+"'; base-uri 'none'; frame-ancestors 'none'",'Cross-Origin-Opener-Policy':'unsafe-none'}}));
  }
  if(!['/v1/ai','/auth/session','/auth/logout'].includes(url.pathname)||url.search)fail('route',404);
  if(origin!==config.site.origin)fail('origin',403);
  if(request.method==='OPTIONS')return finish(new Response(null,{status:204,headers:{'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'300'}}));
  if(request.method!=='POST')fail('method',405);
  const authorization=request.headers.get('Authorization');if(!authorization?.startsWith('Bearer ')||!validToken(authorization.slice(7)))fail('unauthenticated',401);
  const input=await jsonBody(request),token=authorization.slice(7);if(!input||Array.isArray(input))fail('input');
  if(url.pathname!=='/v1/ai'&&Object.keys(input).length)fail('input');
  return finish(json(await internal(url.pathname==='/v1/ai'?'/ai':url.pathname==='/auth/session'?'/session':'/logout',{token,input})));
 }catch(error){const safe=error instanceof AIError?error:new AIError('backend_unavailable',503);return finish(json({error:{code:safe.code}},safe.status));}
}};}
export default createPersonalWorker();
