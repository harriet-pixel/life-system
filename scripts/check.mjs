import {readdir,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const files=await readdir('assets',{recursive:true});
for(const file of files.filter(p=>/\.(mjs|js)$/.test(p)))execFileSync(process.execPath,['--check','assets/'+file],{stdio:'inherit'});
for(const name of ['index.html','profile.html','settings.html','tasks.html','habits.html','companion.html']){
 const html=await readFile(name,'utf8');
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 if(new Set(ids).size!==ids.length)throw new Error(name+': duplicate IDs');
 for(const match of html.matchAll(/(?:src|href)="(assets\/[^"?]+)(?:\?[^" ]*)?"/g))await readFile(match[1]);
}
for(const file of (await readdir('backend',{recursive:true})).filter(p=>p.endsWith('.mjs')&&!p.split('/').some(part=>['node_modules','.wrangler'].includes(part))))execFileSync(process.execPath,['--check','backend/'+file],{stdio:'inherit'});
console.log('PASS: JavaScript syntax, HTML IDs and local entry assets');
