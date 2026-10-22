// Reproduce a warm HTTP cache across the input -> select history UI release.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const site=path.resolve(process.env.SITE_ROOT||'work/build');
(async()=>{let legacy=true;const requests=[];
 const current=fs.readFileSync(path.join(site,'settings.html'),'utf8');
 const oldHTML=current.replace(/<nav id="history-pagination"[\s\S]*?<\/nav>/,fs.readFileSync('tests/fixtures/history-pagination-before-select.html','utf8')).replace(/\?v=[^"']+/g,'?v=restore-actions-20261023');
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),file=url.pathname.slice(1)||'settings.html';requests.push(req.url);res.setHeader('Cache-Control',file.endsWith('.html')?'no-store':'public,max-age=86400');res.setHeader('Content-Type',/\.(mjs|js)$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');try{
  let content=fs.readFileSync(path.join(site,file));
  if(legacy&&file==='settings.html')content=oldHTML;
  if(legacy&&file==='assets/settings.mjs')content=content.toString().replace(/history-view\.mjs\?v=[^']+/,'history-view.mjs');
  if(legacy&&file==='assets/history-view.mjs')content=fs.readFileSync('tests/fixtures/history-view-before-select.mjs');
  res.end(content);
 }catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 for(const width of [375,1280]){legacy=true;const context=await browser.newContext({viewport:{width,height:900}}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const base='http://127.0.0.1:'+server.address().port+'/settings.html';await p.goto(base);await p.waitForSelector('#asset-total:text("0")');assert.equal(await p.locator('#history-input').count(),1);await p.evaluate(async()=>{const {dataStore:s}=await import('./assets/data.mjs?v=ai-connection-1');await s.transact({type:'profile',label:'原有稱呼',fields:['name'],changes:{profile:{...s.get().profile,name:'保留原有資料'}}});});
  // Keep the browser cache and storage; only switch the server release.
  legacy=false;await p.goto(base+'?release=current');await p.waitForSelector('#asset-total:text("0")');assert.equal(await p.locator('#history-input').count(),0);assert.deepEqual(errors,[]);assert.equal(await p.evaluate(async()=>(await import('./assets/data.mjs?v=ai-connection-1')).dataStore.get().profile.name),'保留原有資料');
  for(const tab of ['history','backup','appearance','storage']){await p.locator('#'+tab+'-tab').click();assert.equal(await p.locator('#'+tab+'-tab').getAttribute('aria-selected'),'true');assert.ok(await p.locator('#'+tab+'-panel').isVisible());}
  await p.evaluate(async()=>{const {storeImage}=await import('./assets/image-store.mjs');const canvas=document.createElement('canvas');canvas.width=10;canvas.height=10;await storeImage(canvas.toDataURL());});await p.locator('#refresh-storage').click();await p.waitForSelector('#asset-total:text("1")');assert.deepEqual(errors,[]);await context.close();
 }
 assert.ok(requests.includes('/assets/history-view.mjs'));assert.ok(requests.some(s=>s.startsWith('/assets/history-view.mjs?v=')));console.log('PASS warm-cache upgrade at 375/1280: old input module never breaks new select DOM; all tabs and real IndexedDB image audit work without clearing data');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
