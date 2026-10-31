import {fail,readJSON} from '../../assets/ai-errors.mjs?v=stats-affinity-20261031';
export const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
export const validToken=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');}
export async function challenge(value){const data=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));return btoa(String.fromCharCode(...data)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
export function configuration(env){
 const site=new URL(env.SITE_URL),worker=new URL(env.WORKER_URL);
 if(site.protocol!=='https:'||worker.protocol!=='https:'||site.username||site.password||site.search||site.hash||!site.pathname.endsWith('/')||worker.username||worker.password||worker.search||worker.hash||worker.pathname!=='/'||!/^\d+$/.test(env.ALLOWED_GITHUB_ID??'')||!env.GITHUB_CLIENT_ID||!env.GITHUB_CLIENT_SECRET||!env.PERSONAL_GATE)fail('backend_unconfigured',503);
 return {site,worker,callback:worker.origin+'/auth/callback'};
}
export async function jsonBody(request,limit=6144){
 if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')??''))fail('input',415);
 const length=Number(request.headers.get('Content-Length'));if(length>limit)fail('input_size',413);
 const timer=AbortSignal.timeout(10000);let abort;
 const cancelled=new Promise((_,reject)=>{abort=()=>{try{fail('timeout',504);}catch(error){reject(error);}};timer.addEventListener('abort',abort,{once:true});});
 try{return await Promise.race([readJSON(request,limit),cancelled]);}catch(error){if(error?.code==='response_size')fail('input_size',413);if(error?.code==='provider_response')fail('input',400);throw error;}finally{timer.removeEventListener('abort',abort);}
}
export const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
// workerd supports manual/follow, not redirect:error. Reject redirects ourselves
// so credentials can never follow a provider or OAuth response to another host.
export async function edgeFetch(input,options={}){const response=await fetch(input,{...options,redirect:'manual'});if(response.status>=300&&response.status<400)fail('destination',502);return response;}
