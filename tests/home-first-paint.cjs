const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base=process.env.BASE_URL||'http://127.0.0.1:3014/work/build/';
const ready=p=>p.waitForSelector('body[data-shell=ready]');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  for(const width of [375,1280])for(const font of ['device','serif','sans','rounded']){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',timezoneId:'Asia/Taipei'});
   const writer=await context.newPage();await writer.goto(base);await ready(writer);
   await writer.evaluate(async({font,width})=>{
    const {dataStore}=await import('./assets/data.mjs?v=action-ready-20261028'),{createTaskService}=await import('./assets/tasks-service.mjs?v=action-ready-20261028'),{localDate}=await import('./assets/tasks-model.mjs?v=action-ready-20261028');
    const service=createTaskService(dataStore);await service.edit({name:'先顯示本機今日事件',categoryId:null,points:1,kind:'once',date:localDate(),start:localDate(),end:null,days:[],overdue:'keep'});
    await dataStore.transact({type:'appearance.update',changes:{settings:{...dataStore.get().settings,appearance:{font,color:width===375?'#ffeedd':'#104a7a'}}}});
   },{font,width});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   let release;const gate=new Promise(r=>release=r);
   // Hold a dependency unrelated to reading local tasks; shell cannot mount yet.
   await page.route('**/assets/cloud-restore.mjs?v=action-ready-20261028',async route=>{await gate;await route.continue();});
   await page.goto(base,{waitUntil:'commit'});
   await page.waitForFunction(()=>document.querySelector('.task-list')?.textContent.includes('先顯示本機今日事件'));
   assert.equal(await page.locator('body').getAttribute('data-shell'),null);
   assert.ok(await page.locator('.task-list input').isDisabled());assert.ok(await page.locator('#home-new-event').isDisabled());
   const before=await page.evaluate(()=>localStorage.getItem('life-system.data.v1'));
   await writer.evaluate(async()=>{const {dataStore}=await import('./assets/data.mjs?v=action-ready-20261028'),{createTaskService}=await import('./assets/tasks-service.mjs?v=action-ready-20261028'),{localDate}=await import('./assets/tasks-model.mjs?v=action-ready-20261028');await createTaskService(dataStore).edit({name:'其他分頁新增',categoryId:null,points:1,kind:'once',date:localDate(),start:localDate(),end:null,days:[],overdue:'keep'});});
   await page.waitForFunction(()=>document.querySelector('.task-list')?.textContent.includes('其他分頁新增'));
   assert.notEqual(await page.evaluate(()=>localStorage.getItem('life-system.data.v1')),before);
   const latest=await page.evaluate(()=>localStorage.getItem('life-system.data.v1'));
   release();await ready(page);assert.equal(await page.evaluate(()=>localStorage.getItem('life-system.data.v1')),latest,'read and hydration must not write data');
   assert.ok(await page.locator('.task-list input').first().isEnabled());assert.ok(await page.locator('#home-new-event').isEnabled());
   const beforeReward=await page.evaluate(()=>JSON.parse(localStorage.getItem('life-system.data.v1')).stats.currency);
   await page.locator('.task-list input').first().check();
   const allocation=page.locator('#completion-allocation');await allocation.waitFor();await allocation.locator('[name=wisdom][value="1"]').check();await allocation.locator('[type=submit]').click();
   await page.waitForFunction(n=>JSON.parse(localStorage.getItem('life-system.data.v1')).stats.currency===n+1,beforeReward);
   await page.locator(width<1024?'.mobile-navigation [data-undo]':'.desktop-navigation [data-undo]').click();
   await page.waitForFunction(n=>JSON.parse(localStorage.getItem('life-system.data.v1')).stats.currency===n,beforeReward);
   assert.ok(await page.locator('.task-list input').first().isEnabled(),'preview subscription cannot disable mounted controls on store updates');
   for(const route of ['tasks','profile','settings','home']){
    await page.locator(width<1024?'#mobile-links':'.desktop-navigation').getByRole('link',{name:{tasks:'待辦事項',profile:'我的資料',settings:'設定',home:'首頁'}[route],exact:true}).click();
    await page.waitForFunction(id=>document.body.dataset.page===id,route);
   }
   assert.equal(await page.locator('.task-list input').count(),2);assert.ok(await page.locator('.task-list input').first().isEnabled());
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
   await context.close();console.log('PASS early real local list, cross-tab updates, hydration, complete/undo and four routes '+width+'px '+font);
  }
  // Do not bypass a migration/write lock to show a potentially invalid snapshot.
  const context=await browser.newContext(),writer=await context.newPage();await writer.goto(base);await ready(writer);
  await writer.evaluate(()=>{window.writeHeld=false;navigator.locks.request('life-system.write.v2',()=>{window.writeHeld=true;return new Promise(r=>window.releaseWrite=r);});});await writer.waitForFunction(()=>window.writeHeld);
  const waiting=await context.newPage();await waiting.goto(base,{waitUntil:'commit'});await waiting.waitForFunction(()=>performance.getEntriesByType('resource').some(r=>r.name.includes('/data.mjs')));
  assert.match(await waiting.locator('.task-list').textContent(),/正在讀取/);await writer.evaluate(()=>releaseWrite());await ready(waiting);assert.match(await waiting.locator('.task-list').textContent(),/今天尚無待辦/);await context.close();
  const broken=await browser.newContext();await broken.addInitScript(()=>localStorage.setItem('life-system.data.v1','{"corrupt":true}'));const page=await broken.newPage();await page.goto(base);await page.waitForFunction(()=>document.querySelector('.task-list')?.textContent.includes('無法讀取今日待辦'));assert.equal(await page.evaluate(()=>localStorage.getItem('life-system.data.v1')),'{"corrupt":true}');assert.ok(await page.locator('#home-new-event').isDisabled());await broken.close();
  console.log('PASS waiting for coordinated migration, empty state and corrupt-data failure preserve storage');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
