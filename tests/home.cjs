const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const base=(process.env.BASE_URL||'http://127.0.0.1:3000/').replace(/\/?$/, '/');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
for(const width of [320,375,390,768,1280]){
 const p=await b.newPage({viewport:{width,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.waitForSelector('body[data-navigation=ready]');await p.evaluate(()=>document.fonts.ready);
 assert.equal(await p.locator('h1').innerText(),'慢慢成長，慢慢變好');assert.equal((await p.locator('#home-stats').innerText()).trim(),'Lv 1 ｜ Exp —｜ $ —');
 assert.equal(await p.locator('[data-task]').count(),4);assert.equal(await p.locator('[data-habit]').count(),3);
 const portrait=await p.locator('.companion').boundingBox(),daily=await p.locator('.daily-panel').boundingBox();if(width>=1024)assert.ok(portrait.x<daily.x);else assert.ok(portrait.y<daily.y);
 await p.locator('[data-task]').first().check();await p.waitForFunction(()=>document.querySelector('#task-count').textContent.includes('2 / 4'));
 await p.waitForFunction(()=>!document.querySelector('#companion-dialogue').textContent.includes('完成待辦或習慣打卡後'));
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('life-system.data.v1')).history.length),1);
 await p.reload();await p.waitForFunction(()=>document.querySelector('#task-count').textContent.includes('2 / 4'));
 await p.locator('#habits-tab').click();assert.ok(await p.locator('#habits-panel').isVisible());await p.locator('[data-habit]').first().check();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('life-system.data.v1')).history.length===2);
 await p.evaluate(()=>document.documentElement.style.fontSize='200%');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 await p.close();console.log(width+'px PASS: existing homepage activities, mock reply, persistence, responsive layout and 200% text');
}
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
