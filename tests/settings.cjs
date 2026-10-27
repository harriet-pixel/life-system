const {openSettingsSection}=require('./settings-ui.cjs');
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=(process.env.BASE_URL||'http://127.0.0.1:3000/').replace(/\/?$/, '/');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:375,height:900},acceptDownloads:true});
const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
try{
 const page=await context.newPage();await page.goto(base+'settings.html');await openSettingsSection(page,'storage');await page.waitForSelector('#asset-total:text("0")');
 const profile=await context.newPage();await profile.goto(base+'profile.html');await profile.waitForSelector('#profile-name');
 const home=await context.newPage();await home.goto(base);await home.waitForSelector('body[data-navigation=ready]');
 // Preview never writes; a single save propagates to all pages and across reload.
 await openSettingsSection(page,'appearance');
 await page.locator('#theme-color').evaluate(e=>{e.value='#ffffff';e.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.waitForTimeout(100);
 assert.equal(await home.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim()),'#104a7a');
 await page.locator('#theme-font').selectOption('rounded');await page.locator('#save-appearance').click();
 await home.waitForFunction(()=>document.documentElement.dataset.font==='rounded');await profile.waitForFunction(()=>document.documentElement.dataset.font==='rounded');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('life-system.data.v1')).history.length),1);
 await page.reload();await page.waitForSelector('body[data-navigation=ready]');assert.equal(await page.evaluate(()=>document.documentElement.dataset.font),'rounded');
 await page.locator('.mobile-navigation [data-undo]').click();await home.waitForFunction(()=>document.documentElement.dataset.font==='serif');
 await require('./settings-ui.cjs').redoFromHistory(page);await home.waitForFunction(()=>document.documentElement.dataset.font==='rounded');
 console.log('PASS appearance: preview/save/reload/cross-page/cross-tab/Undo/Redo');
 // Recovery is fixed by the system; no history recording toggle remains.
 await openSettingsSection(page,'history');assert.equal(await page.locator('#history-record-all').count(),0);
 await home.evaluate(async()=>{const{habitService}=await import('./assets/habit-actions.mjs?v=replies-20261027');const id=await habitService.saveBonus({name:'測試額外行動',description:'',points:1});await habitService.evaluateBonus(id,async()=>({physique:1,wisdom:0,charisma:0,resilience:0,perception:0}));});
 const count=await page.evaluate(()=>JSON.parse(localStorage.getItem('life-system.data.v1')).history.length);
 await home.locator('#habits-tab').click();await home.locator('#habits-panel').getByRole('button',{name:'加分打卡',exact:true}).click();await home.locator('#home-bonus-picker [data-home-bonus-items] button').first().click();await home.waitForTimeout(200);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('life-system.data.v1')).history.length),count+1);
 console.log('PASS fixed journaling and homepage data changes');
 // Build real, content-addressed image fixtures, including history-only and redo references.
 const fixture=await page.evaluate(async()=>{
  const {dataStore:s}=await import('./assets/data.mjs?v=replies-20261027'),images=await import('./assets/image-store.mjs?v=companion-images-20261027');
  const ids=[];
  for(let i=0;i<8;i++){const c=document.createElement('canvas');c.width=c.height=4;const x=c.getContext('2d');x.fillStyle=`rgb(${i*30},30,90)`;x.fillRect(0,0,4,4);ids.push(await images.storeImage(c.toDataURL()));}
  const change=photo=>s.transact({type:'image.test',label:'圖片',target:'user',fields:[],changes:{photo}});
  await change(ids[0]);await change(ids[1]);await change(ids[2]);await s.undo();
  await s.transact({type:'image.refs',label:'圖片引用',target:'user',fields:[],changes:{avatar:ids[3],portraits:[{id:'portrait-1',source:ids[4],image:ids[4],crop:{left:0,top:0,width:4,height:4}}]}});
  // A separate redo record retains a currently unselected image.
  await change(ids[2]);await s.undo();
  const db=await images.openDatabase();await new Promise((resolve,reject)=>{const tx=db.transaction('images','readwrite');const store=tx.objectStore('images');ids.forEach((id,index)=>{const r=store.get(id);r.onsuccess=()=>{const a=r.result;a.protectedUntil=index===7?Date.now()+86400000:0;delete a.name;delete a.createdAt;store.put(a);};});tx.oncomplete=resolve;tx.onerror=reject;});
  return {ids};
 });
 await openSettingsSection(page,'storage');await page.locator('#refresh-storage').click();await page.waitForFunction(()=>document.querySelectorAll('.asset-row').length===2);
 const visible=await page.locator('.asset-row input').evaluateAll(nodes=>nodes.map(n=>n.value));assert.deepEqual(visible.sort(),[fixture.ids[5],fixture.ids[6]].sort());
 assert.ok((await page.locator('.asset-row').first().innerText()).includes('建立時間未記錄'));
 // Candidate becomes referenced between listing and final confirmation: skip it.
 await page.locator('.asset-row input').evaluateAll((nodes,id)=>nodes.find(n=>n.value===id).click(),fixture.ids[5]);
 await page.locator('#delete-assets').click();
 await page.evaluate(async id=>{const {dataStore:s}=await import('./assets/data.mjs?v=replies-20261027');await s.transact({type:'image.test',target:'user',label:'新引用',fields:[],changes:{photo:id}});},fixture.ids[5]);
 await page.locator('#confirm-delete').click();await page.waitForFunction(()=>document.querySelector('#operation-status').textContent.includes('跳過 1'));
 // A draft in another tab blocks cleanup/backup; closing the tab releases it.
 await profile.locator('#edit-profile').click();await profile.waitForSelector('#profile-dialog[open]');
 await page.locator('#refresh-storage').click();await page.waitForFunction(()=>document.querySelector('#storage-state').textContent.includes('我的資料'));
 await openSettingsSection(page,'backup');await page.locator('#download-backup').click();await page.waitForFunction(()=>document.querySelector('#operation-status').textContent.includes('使用者設定'));
 await profile.close();
 await openSettingsSection(page,'storage');await page.locator('#refresh-storage').click();await page.waitForFunction(()=>document.querySelectorAll('.asset-row').length===2);
 await page.locator('.asset-row input').evaluateAll((nodes,id)=>nodes.find(n=>n.value===id).click(),fixture.ids[6]);await page.locator('#delete-assets').click();await page.locator('#confirm-delete').click();await page.waitForFunction(()=>document.querySelector('#operation-status').textContent.includes('已永久刪除 1'));
 const state=await page.evaluate(async()=>{const {dataStore:s}=await import('./assets/data.mjs?v=replies-20261027');const {listImageAssets}=await import('./assets/image-store.mjs?v=companion-images-20261027');return {doc:s.get(),ids:(await listImageAssets()).map(a=>a.id)};});
 assert.ok(!state.ids.includes(fixture.ids[6]));for(const i of [0,1,2,3,4,5,7])assert.ok(state.ids.includes(fixture.ids[i]));
 // Unknown reference source must fail closed.
 const closed=await page.evaluate(async()=>{const refs=await import('./assets/image-references.mjs?v=replies-20261027'),{dataStore:s}=await import('./assets/data.mjs?v=replies-20261027');const off=refs.registerImageReferenceSource('failing',()=>{throw new Error('引用來源失敗');});try{await refs.deleteUnusedImages(s,[]);return false;}catch{return true;}finally{off();}});assert.equal(closed,true);
 console.log('PASS storage: current/history/Undo/Redo/lease protection, stale selection, draft tab close, failed provider, only unused deletion');
 // Encrypted round trip preserves IDs, history branch metadata, settings and image bytes.
 const roundtrip=await page.evaluate(async()=>{
  const backup=await import('./assets/backup.mjs?v=replies-20261027'),{dataStore:s}=await import('./assets/data.mjs?v=replies-20261027');
  const text=await backup.withBackup(s,'test password',blob=>blob.text());const before=s.get();const prepared=await backup.readBackup(new Blob([text]),'test password');
  await s.transact({type:'profile.test',label:'暫時名稱',target:'user',fields:[],changes:{profile:{...s.get().profile,name:'changed'}}});
  await backup.restoreBackup(s,prepared,s.get().revision);const after=s.get();
  return {before,after,imageCount:prepared.payload.imageCount,text};
 });
 const {revision:a,...before}=roundtrip.before,{revision:b,...after}=roundtrip.after;assert.deepEqual(after,before);assert.ok(roundtrip.imageCount>=5);
 // Invalid backups do not modify storage; inject a publication failure after staging.
 const protections=await page.evaluate(async text=>{
  const b=await import('./assets/backup.mjs?v=replies-20261027'),{dataStore:s,STORAGE_KEY}=await import('./assets/data.mjs?v=replies-20261027');const original=localStorage.getItem(STORAGE_KEY);const out=[];
  for(const [file,password] of [[new Blob([text]),'wrong'],[new Blob(['broken']),'']]){try{await b.readBackup(file,password);out.push(false);}catch{out.push(localStorage.getItem(STORAGE_KEY)===original);}}
  const prepared=await b.readBackup(new Blob([text]),'test password');
  const native=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===STORAGE_KEY)throw new DOMException('quota','QuotaExceededError');return native.call(this,k,v);};
  try{await b.restoreBackup(s,prepared,s.get().revision);out.push(false);}catch{out.push(localStorage.getItem(STORAGE_KEY)===original);}finally{Storage.prototype.setItem=native;}
  let release,started;const ready=new Promise(r=>started=r);const active=b.withBackup(s,'',()=>new Promise(r=>{release=r;started();}));await ready;
  const refs=await import('./assets/image-references.mjs?v=replies-20261027');try{await refs.deleteUnusedImages(s,[]);out.push(false);}catch{out.push(true);}finally{release();await active;}
  const {payload}=prepared;payload.images.pop();payload.imageCount=payload.images.length;
  try{await b.readBackup(await b.encodeBackup(payload));out.push(false);}catch{out.push(localStorage.getItem(STORAGE_KEY)===original);}
  payload.dataVersion=999;try{await b.readBackup(await b.encodeBackup(payload));out.push(false);}catch{out.push(true);}
  return out;
 },roundtrip.text);assert.ok(protections.every(Boolean));
 console.log('PASS backup: encrypted round trip, wrong password/corruption/missing image/version rejection, failed publication rollback, cleanup concurrency');
 await openSettingsSection(page,'backup');assert.ok((await page.locator('#drive-state').innerText()).match(/尚未連接|失效/));assert.equal(await page.locator('#upload-drive').isDisabled(),true);
 const downloadEvent=page.waitForEvent('download');await page.locator('#download-backup').click();const download=await downloadEvent;assert.ok(download.suggestedFilename().startsWith('Life system '));
 await page.locator('#restore-file').setInputFiles(await download.path());await page.locator('#read-backup').click();await page.waitForSelector('#restore-confirm[open]');await page.keyboard.press('Escape');await page.waitForSelector('#restore-confirm:not([open])',{state:'attached'});
 await page.locator('#read-backup').click();await page.waitForSelector('#restore-confirm[open]');
 const blocker=await context.newPage();await blocker.goto(base+'profile.html');await blocker.waitForSelector('body[data-navigation=ready]');await blocker.locator('#edit-profile').click();await blocker.waitForSelector('#profile-dialog[open]');
 const intact=await page.evaluate(()=>localStorage.getItem('life-system.data.v1'));await page.locator('#confirm-restore').click();await page.waitForFunction(()=>document.querySelector('#restore-confirm [data-dialog-error]').textContent.includes('使用者設定'));assert.equal(await page.evaluate(()=>localStorage.getItem('life-system.data.v1')),intact);
 await blocker.close();await page.locator('#confirm-restore').click();await page.waitForSelector('#restore-confirm:not([open])',{state:'attached'});await page.waitForFunction(()=>document.querySelector('#operation-status').textContent.includes('完整還原已完成'));
 console.log('PASS local download and explicit restore confirmation; unconfigured cloud does not pretend success');
 // All four fonts, each page, responsive widths, 200% text, keyboard and failed fonts.
 const fonts=['device','serif','sans','rounded'];
 for(const font of fonts){await openSettingsSection(page,'appearance');await page.locator('#theme-font').selectOption(font);await page.locator('#save-appearance').click();await home.waitForFunction(f=>document.documentElement.dataset.font===f,font);await page.evaluate(()=>document.fonts.ready);}
 fs.mkdirSync('work/screenshots',{recursive:true});
 for(const width of [320,375,390,768,1280]){
  for(const name of ['index.html','profile.html','settings.html']){const p=await context.newPage();await p.setViewportSize({width,height:900});await p.goto(base+name);await p.waitForSelector('body[data-navigation=ready]');await p.evaluate(()=>document.fonts.ready);
   if(name==='settings.html'){for(const id of ['storage','history','backup','appearance']){await openSettingsSection(p,id);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' '+width+' '+id);}}
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' '+width);
   await p.evaluate(()=>document.documentElement.style.fontSize='200%');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' zoom '+width);
   await p.evaluate(()=>document.documentElement.style.removeProperty('font-size'));if(width===375||width===1280)await p.screenshot({path:'work/screenshots/'+name+'-'+width+'.png',fullPage:true});await p.close();
  }
 }
 const failed=await browser.newContext({viewport:{width:375,height:900},reducedMotion:'reduce'});await failed.route('**/*.woff2',route=>route.abort());const p=await failed.newPage();await p.goto(base+'settings.html');await p.waitForSelector('body[data-navigation=ready]');await openSettingsSection(p,'appearance');await p.locator('#theme-font').selectOption('sans');await p.locator('#save-appearance').click();await p.waitForFunction(()=>!document.querySelector('#save-appearance').disabled);await p.locator('#general-tab').focus();await p.keyboard.press('End');assert.equal(await p.locator('#management-tab').getAttribute('aria-selected'),'true');await openSettingsSection(p,'appearance');assert.ok(await p.locator('#save-appearance').isEnabled());await failed.close();
 assert.deepEqual(errors,[]);console.log('PASS 320/375/390/768/1280 all pages, 200% text, 4 font choices, keyboard, reduced motion and font failure');
}finally{await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
