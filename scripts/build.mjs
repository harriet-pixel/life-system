import {mkdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
await rm('work/build',{recursive:true,force:true});
await mkdir('work/build',{recursive:true});
for(const path of ['index.html','profile.html','settings.html','tasks.html','habits.html','assets'])await cp(path,'work/build/'+path,{recursive:true});
const client=process.env.GOOGLE_OAUTH_CLIENT_ID;
if(client){if(!/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(client))throw new Error('Invalid Google OAuth public client ID');await writeFile('work/build/assets/google-config.mjs','export const GOOGLE_CLIENT_ID='+JSON.stringify(client)+';\n');}
const aiBackend=process.env.AI_BACKEND_URL;
if(aiBackend){const url=new URL(aiBackend);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/v1/ai')throw new Error('Invalid public HTTPS AI endpoint');await writeFile('work/build/assets/ai-config.mjs','export const AI_BACKEND_URL='+JSON.stringify(aiBackend)+';\n');}
const worker=process.env.AI_WORKER_URL;
if(worker){const {validateWorkerURL}=await import('../assets/ai-worker-auth.mjs');validateWorkerURL(worker);await writeFile('work/build/assets/ai-worker-config.mjs','export const AI_WORKER_URL='+JSON.stringify(worker)+';\n');}
console.log('PASS: static site built in work/build (no credentials included)');
