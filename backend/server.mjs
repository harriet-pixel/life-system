import {AI_TEST_TEXT} from '../assets/ai-prompts.mjs?v=daily-polish-20261029';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {createJWTVerifier} from './auth.mjs';
import {AIError,fail} from './errors.mjs';
import {createProviderAdapter,PROVIDERS} from './providers.mjs';
export function createAIHandler({authenticate,origins,trustedProxyIPs=[],fetcher=fetch,now=Date.now,timeoutMs=20000,rateLimit=10,concurrency=2}) {
  if(typeof authenticate!=='function'||!origins?.length)throw new Error('Authentication and explicit origins required');
  for(const origin of origins)if(new URL(origin).origin!==origin||!origin.startsWith('https://'))throw new Error('Exact HTTPS origins required');
  const identities=new Map();
  return async (req,res)=>{
    const origin=req.headers.origin;
    const send=(status,body)=>{if(!res.destroyed&&!res.writableEnded){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'",'Vary':'Origin',...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{} )});res.end(JSON.stringify(body));}};
    let entry,controller,timer;
    try {
      const secure=Boolean(req.socket.encrypted)||(trustedProxyIPs.includes(req.socket.remoteAddress)&&req.headers['x-forwarded-proto']==='https');
      if(!secure)fail('https_required',400);
      if(req.url!=='/v1/ai')fail('route',404);
      if(!origins.includes(origin))fail('origin',403);
      if(req.method==='OPTIONS') {res.writeHead(204,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'300','Vary':'Origin','Cache-Control':'no-store'});res.end();return;}
      if(req.method!=='POST')fail('method',405);
      const identity=await authenticate(req.headers.authorization);
      if(typeof identity!=='string'||!identity)fail('unauthenticated',401);
      for(const[id,item]of identities)if(!item.active&&now()-item.start>=60000)identities.delete(id);
      entry=identities.get(identity);
      if(!entry){if(identities.size>=10000)fail('busy',503);entry={start:now(),count:0,active:0};identities.set(identity,entry);}
      if(now()-entry.start>=60000){entry.start=now();entry.count=0;}
      if(entry.count>=rateLimit)fail('rate_limit',429);
      if(entry.active>=concurrency)fail('busy',429);
      entry.count++;entry.active++;
      // Release only after this request actually acquired a concurrency slot.
      const slot=entry;entry=null;
      try {
        controller=new AbortController();timer=setTimeout(()=>controller.abort(),timeoutMs);
        req.on('aborted',()=>controller.abort());res.on('close',()=>{if(!res.writableEnded)controller.abort();});
        if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))fail('input',415);
        if(Number(req.headers['content-length'])>12288)fail('input_size',413);
        const chunks=[];let size=0;
        const bodyTimeout=setTimeout(()=>req.destroy(),Math.min(timeoutMs,10000));
        try {for await(const chunk of req){size+=chunk.length;if(size>12288)fail('input_size',413);chunks.push(chunk);}}finally{clearTimeout(bodyTimeout);}
        let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('input',400);}
        if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['provider','apiKey','operation','model','text','maxOutputTokens'].includes(k))||!Object.hasOwn(PROVIDERS,body.provider)||!['models','test','generate'].includes(body.operation))fail('input');
        if(body.operation!=='generate'&&(body.text!==undefined||body.maxOutputTokens!==undefined))fail('input');
        const adapter=createProviderAdapter(body.provider,body.apiKey,{fetcher,signal:controller.signal});
        const listing=await adapter.listModels();
        if(body.operation==='models'){send(200,listing);return;}
        if(!listing.models.some(model=>model.id===body.model))fail('model_unavailable',404);
        const result=await adapter.generate({descriptor:listing.models.find(model=>model.id===body.model),model:body.model,text:body.operation==='test'?AI_TEST_TEXT:body.text,maxOutputTokens:body.operation==='test'?64:body.maxOutputTokens});
        send(200,body.operation==='test'?{ok:true}:result);
      } finally {slot.active--;}
    } catch(error) {
      // No request/body/header/error logging. Never serialize arbitrary exceptions.
      const safe=error instanceof AIError?error:new AIError(controller?.signal.aborted?'timeout':'internal',controller?.signal.aborted?504:500);
      send(safe.status,{error:{code:safe.code}});
    } finally {clearTimeout(timer);}
  };
}
export function startServer(env=process.env){
  if(!env.AI_ISSUER||!env.AI_AUDIENCE||!env.AI_JWKS_URL||!env.AI_ALLOWED_ORIGINS)throw new Error('AI backend not configured: issuer, audience, JWKS and origins required');
  const handler=createAIHandler({authenticate:createJWTVerifier({issuer:env.AI_ISSUER,audience:env.AI_AUDIENCE,jwksURL:env.AI_JWKS_URL,scope:env.AI_SCOPE||'life:ai'}),origins:env.AI_ALLOWED_ORIGINS.split(','),trustedProxyIPs:(env.AI_TRUSTED_PROXY_IPS||'').split(',').filter(Boolean)});
  const server=createServer(handler);server.headersTimeout=10000;server.requestTimeout=30000;server.maxHeadersCount=30;
  server.listen(Number(env.PORT||8787),env.HOST||'127.0.0.1');return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{startServer();console.info('AI service started; HTTPS reverse proxy and authenticated access required.');}catch{console.error('AI service not configured; no listener started.');process.exitCode=1;}}
