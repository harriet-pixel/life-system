import {AI_TEST_TEXT} from '../../assets/ai-prompts.mjs?v=backup-chat-20261031';
import {AIError,fail} from '../../assets/ai-errors.mjs?v=backup-chat-20261031';
import {createProviderAdapter,PROVIDERS} from '../../assets/ai-providers.mjs?v=backup-chat-20261031';
import {digest,randomToken,validToken,challenge,json,edgeFetch} from './security.mjs';
const secrets={gemini:'GEMINI_API_KEY',deepseek:'DEEPSEEK_API_KEY',openai:'OPENAI_API_KEY',claude:'CLAUDE_API_KEY'};
// Single SQLite-backed object: opaque session hashes, short OAuth attempts and
// atomic rate/concurrency reservations only. No AI keys, prompts or output stored.
export class PersonalGate{
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.fetcher=edgeFetch;this.now=Date.now;}
 async change(action){
  // A rejection escaping blockConcurrencyWhile resets a Durable Object. Return
  // expected denials as data inside the gate, then throw after the block exits.
  const result=await this.ctx.blockConcurrencyWhile(async()=>{try{
   const now=this.now(),data=await this.ctx.storage.get('gate')??{sessions:{},oauth:{},leases:{},minute:{start:0,count:0},day:{start:0,count:0},auth:{start:0,count:0}};
   for(const group of ['sessions','oauth','leases'])for(const[key,value]of Object.entries(data[group]))if(value.exp<=now)delete data[group][key];
   const value=await action(data,now);await this.ctx.storage.put('gate',data);return {value};
  }catch(error){const safe=error instanceof AIError?error:new AIError('backend_unavailable',503);return {error:{code:safe.code,status:safe.status}};}});
  if(result.error)throw new AIError(result.error.code,result.error.status);return result.value;
 }
 async fetch(request){
  let lease;
  try{
   const body=await request.json(),op=new URL(request.url).pathname;
   if(op==='/start'){
    if(!validToken(body.nonce))fail('input');
    const state=randomToken(),verifier=randomToken(),hash=await digest(state);
    await this.change((data,now)=>{if(now-data.auth.start>=60000)data.auth={start:now,count:0};if(data.auth.count>=10)fail('backend_rate_limit',429);data.auth.count++;if(Object.keys(data.oauth).length>=8)fail('backend_rate_limit',429);data.oauth[hash]={nonce:body.nonce,verifier,exp:now+600000};});
    return json({state,challenge:await challenge(verifier)});
   }
   if(op==='/consume'){
    if(!validToken(body.state))fail('unauthenticated',401);const hash=await digest(body.state);
    return json(await this.change(data=>{const value=data.oauth[hash];if(!value)fail('unauthenticated',401);delete data.oauth[hash];return value;}));
   }
   if(op==='/issue'){
    // Only reached by the Worker after /user has matched the configured numeric ID.
    const token=randomToken(),hash=await digest(token);
    const expiresAt=await this.change((data,now)=>{if(Object.keys(data.sessions).length>=8){const oldest=Object.keys(data.sessions).sort((a,b)=>data.sessions[a].exp-data.sessions[b].exp)[0];delete data.sessions[oldest];}const exp=now+3600000;data.sessions[hash]={exp};return exp;});
    return json({token,expiresAt});
   }
   if(!validToken(body.token))fail('unauthenticated',401);const hash=await digest(body.token);
   if(op==='/logout'){await this.change(data=>{delete data.sessions[hash];});return json({ok:true});}
   if(op==='/session'){const expiresAt=await this.change(data=>{if(!data.sessions[hash])fail('unauthenticated',401);return data.sessions[hash].exp;});return json({authenticated:true,expiresAt});}
   if(op!=='/ai')fail('route',404);
   const input=body.input;
   if(!input||Array.isArray(input)||Object.keys(input).some(k=>!['provider','operation','model','text','maxOutputTokens'].includes(k))||!Object.hasOwn(PROVIDERS,input.provider)||!['models','test','generate'].includes(input.operation))fail('input');
   if(input.operation!=='generate'&&(input.text!==undefined||input.maxOutputTokens!==undefined))fail('input');
   if(input.operation!=='models'&&(typeof input.model!=='string'||input.model.length>207))fail('input');
   if(input.operation==='generate'&&(typeof input.text!=='string'||!input.text.trim()||Array.from(input.text).length>1000||!Number.isInteger(input.maxOutputTokens)||input.maxOutputTokens<1||input.maxOutputTokens>256))fail('input');
   const apiKey=this.env[secrets[input.provider]];
   const reservation=randomToken();
   await this.change((data,now)=>{
    if(!data.sessions[hash])fail('unauthenticated',401);
    if(!apiKey)fail('provider_unconfigured',503);
    if(now-data.minute.start>=60000)data.minute={start:now,count:0};
    const day=Math.floor(now/86400000);if(data.day.start!==day)data.day={start:day,count:0};
    if(data.minute.count>=10||data.day.count>=100)fail('backend_rate_limit',429);
    if(Object.keys(data.leases).length>=2)fail('backend_busy',429);
    data.minute.count++;data.day.count++;data.leases[reservation]={exp:now+30000};
   });
   lease=reservation;
   const signal=AbortSignal.any([request.signal,AbortSignal.timeout(20000)]);
   const adapter=createProviderAdapter(input.provider,apiKey,{signal,fetcher:this.fetcher}),listing=await adapter.listModels();
   if(input.operation==='models')return json(listing);
   const descriptor=listing.models.find(model=>model.id===input.model);if(!descriptor)fail('model_unavailable',404);
   const result=await adapter.generate({descriptor,model:input.model,text:input.operation==='test'?AI_TEST_TEXT:input.text,maxOutputTokens:input.operation==='test'?64:input.maxOutputTokens});
   return json(input.operation==='test'?{ok:true}:result);
  }catch(error){const safe=error instanceof AIError?error:new AIError('backend_unavailable',503);return json({error:{code:safe.code}},safe.status);}
  finally{if(lease)await this.change(data=>{delete data.leases[lease];}).catch(()=>{});}
 }
}
