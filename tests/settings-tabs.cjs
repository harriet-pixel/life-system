const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base=(process.env.BASE_URL||'http://127.0.0.1:3013/').replace(/\/?$/,'/');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});let cases=0;try{
for(const width of [320,375,390,450,451,1024,1280])for(const font of ['device','serif','sans','rounded']){
 const c=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),p=await c.newPage();
 await p.addInitScript(()=>{window.tabScrollCalls=[];const original=window.scrollTo;window.scrollTo=function(...args){tabScrollCalls.push(args);return original.apply(this,args);};});
 await p.goto(base+'settings.html');await p.waitForSelector('body[data-navigation=ready]');await p.waitForSelector('#asset-total:text("0")');await p.evaluate(async font=>{const {dataStore:s}=await import('./assets/data.mjs');await s.transact({type:'appearance',label:'test font',changes:{settings:{...s.get().settings,appearance:{...s.get().settings.appearance,font}}}});await document.fonts.ready;},font);
 const snapshot=()=>p.evaluate(()=>{const t=document.querySelector('.activity-tabs'),r=t.getBoundingClientRect(),b=t.querySelector('[aria-selected=true]'),br=b.getBoundingClientRect();return {height:r.height,top:r.top,y:scrollY,x:scrollX,doc:document.documentElement.scrollWidth,viewport:innerWidth,calls:tabScrollCalls.length,visible:br.left>=r.left-1&&br.right<=r.right+1,buttonHeight:br.height,border:getComputedStyle(b).borderBottomWidth};});
 let height;
 for(const id of ['history','backup','appearance','storage','history']){
  await p.evaluate(()=>window.tabScrollCalls=[]);await p.locator('#'+id+'-tab').click();await p.waitForTimeout(100);const a=await snapshot();
  height??=a.height;assert.ok(Math.abs(a.height-height)<1,`${width}/${font}/${id} tab row stretched`);assert.ok(a.height<80);assert.equal(a.border,'2px');assert.ok(a.visible);assert.equal(a.x,0);assert.ok(a.doc<=a.viewport);assert.ok(a.calls<=1);if(width>450)assert.equal(a.calls,0);
  if(width<=450&&id==='history')assert.ok(Math.abs(a.top-12)<=1,'history remains top aligned');
  await p.locator('#'+id+'-tab').click();await p.waitForTimeout(100);const b=await snapshot();assert.equal(b.calls,a.calls,'repeat click must not request another scroll');assert.ok(Math.abs(b.y-a.y)<=1);
 }
 // Focus movement reveals the tab locally, without vertical ancestor scrolling.
 const y=(await snapshot()).y;await p.locator('#history-tab').focus({preventScroll:true});await p.keyboard.press('End');await p.waitForTimeout(70);assert.equal(await p.locator('#appearance-tab').getAttribute('aria-selected'),'true');assert.ok((await snapshot()).visible);assert.ok(Math.abs((await snapshot()).y-y)<=1);
 // A long panel is top aligned; later data expansion never calls the positioner.
 await p.evaluate(()=>{const extra=document.createElement('div');extra.id='test-long-list';extra.style.height='1800px';document.querySelector('#storage-panel').append(extra);tabScrollCalls=[];});
 await p.locator('#storage-tab').click();await p.waitForTimeout(100);const long=await snapshot();if(width<=450)assert.ok(Math.abs(long.top-12)<=1);assert.ok(long.height<80);
 await p.evaluate(()=>{window.scrollTo({top:350,behavior:'instant'});tabScrollCalls=[];document.querySelector('#test-long-list').style.height='2200px';});await p.waitForTimeout(100);assert.equal((await snapshot()).calls,0,'async content must not reposition');
 // Short content can center without making every panel as tall as the longest.
 await p.evaluate(()=>{document.querySelector('#storage-panel').style.height='120px';document.querySelector('#storage-panel').style.overflow='clip';});await p.locator('#history-tab').click();await p.locator('#storage-tab').click();await p.waitForTimeout(100);if(width<=450)assert.ok((await snapshot()).top>12,'short panel centers');
 if(width===375){await p.setViewportSize({width:812,height:375});await p.locator('#history-tab').click();await p.waitForTimeout(80);await p.setViewportSize({width:375,height:812});await p.locator('#backup-tab').click();await p.waitForTimeout(80);assert.ok((await snapshot()).height<80);}
 await c.close();cases++;
}
// Normal motion schedules at most one vertical scroll and remains still afterwards.
const p=await browser.newPage({viewport:{width:375,height:812}});await p.goto(base+'settings.html');await p.waitForSelector('body[data-navigation=ready]');await p.evaluate(()=>document.fonts.ready);await p.locator('#history-tab').click();await p.waitForTimeout(700);const y=await p.evaluate(()=>scrollY);await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>scrollY),y);await p.close();
console.log(`PASS settings tabs: ${cases} width/font combinations, underline geometry, local horizontal reveal, repeated click, keyboard, long/short content, async updates, rotation, reduced/normal motion`);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
