import {mkdir,cp,readFile,writeFile} from 'node:fs/promises';
await mkdir('work/build',{recursive:true});
for(const path of ['index.html','profile.html','settings.html','assets'])await cp(path,'work/build/'+path,{recursive:true});
const client=process.env.GOOGLE_OAUTH_CLIENT_ID;
if(client){if(!/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(client))throw new Error('Invalid Google OAuth public client ID');await writeFile('work/build/assets/google-config.mjs','export const GOOGLE_CLIENT_ID='+JSON.stringify(client)+';\n');}
console.log('PASS: static site built in work/build (no credentials included)');
