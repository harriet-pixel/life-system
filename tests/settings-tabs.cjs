const {chromium}=require('playwright'),assert=require('node:assert/strict'),{openSettingsSection}=require('./settings-ui.cjs');
const base=(process.env.BASE_URL||'http://127.0.0.1:3013/').replace(/\/?$/,'/');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});let cases=0;try{
for(const width of [320,375,390,450,451,768,1024,1280])for(const font of ['device','serif','sans','rounded']){
 const c=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'settings.html');await p.waitForSelector('body[data-shell=ready]');await p.evaluate(async font=>{const{dataStore:s}=await import('./assets/data.mjs?v=tasks-data-1');await s.transact({type:'appearance',changes:{settings:{...s.get().settings,appearance:{...s.get().settings.appearance,font}}}});await document.fonts.ready;},font);
 assert.deepEqual(await p.locator('.settings-content > [role=tablist] [role=tab]').allTextContents(),['一般設定','資料管理']);
 await p.evaluate(()=>{window.tabScrollCalls=[];const original=window.scrollTo;window.scrollTo=function(...args){tabScrollCalls.push(args);return original.apply(this,args);};});
 const snapshot=()=>p.evaluate(()=>{const r=document.querySelector('.settings-content > .activity-tabs').getBoundingClientRect();return{height:r.height,top:r.top,calls:tabScrollCalls.length};});
 for(const group of ['management','general','management']){await p.locator('#'+group+'-tab').click();await p.waitForTimeout(80);const result=await snapshot();assert.ok(result.height<90);assert.ok(result.calls<=1);if(width>450)assert.equal(result.calls,0);if(width<=450&&group==='management')assert.ok(Math.abs(result.top-12)<=1);await p.evaluate(()=>tabScrollCalls=[]);}
 await p.locator('#management-tab').focus({preventScroll:true});await p.keyboard.press('Home');assert.equal(await p.locator('#general-tab').getAttribute('aria-selected'),'true');await p.keyboard.press('End');assert.equal(await p.locator('#management-tab').getAttribute('aria-selected'),'true');assert.equal((await snapshot()).calls,0);
 for(const section of ['backup','storage','history','appearance','ai']){await openSettingsSection(p,section);await p.evaluate(()=>tabScrollCalls=[]);await p.locator('#'+section+'-tab').click();await p.waitForTimeout(30);assert.equal((await snapshot()).calls,0,`${width}/${font}/${section}: disclosure must not run tab positioning`);await p.locator('#'+section+'-tab').click();await p.waitForTimeout(30);assert.equal((await snapshot()).calls,0);}
 await p.evaluate(()=>{const extra=document.createElement('div');extra.style.height='1800px';document.querySelector('#ai-panel').append(extra);tabScrollCalls=[];});await p.waitForTimeout(40);assert.equal((await snapshot()).calls,0,'async expansion does not reposition');
 await p.evaluate(()=>document.documentElement.style.fontSize='200%');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 if(width===375){await p.evaluate(()=>document.documentElement.style.removeProperty('font-size'));await p.setViewportSize({width:812,height:375});await p.locator('#management-tab').click();await p.setViewportSize({width:375,height:812});await p.locator('#general-tab').click();assert.ok((await snapshot()).height<90);}
 assert.deepEqual(errors,[]);await c.close();cases++;
}
console.log(`PASS settings groups/disclosures: ${cases} width/font cases, 450/451 positioning, keyboard, no toggle/async scrolling, rotation and 200% text`);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
