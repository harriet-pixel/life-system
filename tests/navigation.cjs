const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const base=(process.env.BASE_URL||'http://127.0.0.1:3000/').replace(/\/?$/, '/');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
for(const width of [320,390,768,1024,1280]){
 const p=await b.newPage({viewport:{width,height:900}});await p.goto(base);await p.waitForSelector('body[data-navigation=ready]');const toolbar=width<1024?'.mobile-navigation':'.desktop-navigation',nav=p.locator(toolbar+' nav'),undo=p.locator(toolbar+' [data-undo]'),redo=p.locator(toolbar+' [data-redo]');
 assert.equal(await p.locator('.mobile-navigation').isVisible(),width<1024);assert.equal(await p.locator('.desktop-navigation').isVisible(),width>=1024);
 assert.deepEqual(await nav.locator('.navigation-item').evaluateAll(items=>items.map(e=>e.firstChild.textContent)),['首頁','待辦事項','習慣打卡','陪讀系統','錢包帳本','我的夥伴','我的資料','聊天室','設定']);
 assert.equal(await nav.locator('[aria-disabled=true]').count(),5);assert.equal(await nav.locator('a').count(),4);
 const before=await undo.boundingBox();await nav.evaluate(e=>e.scrollLeft=e.scrollWidth);assert.deepEqual(await undo.boundingBox(),before);
 await p.locator('#habits-tab').click();await p.locator('[data-habit]').first().check();await undo.waitFor({state:'visible'});await p.waitForFunction(()=>JSON.parse(localStorage.getItem('life-system.data.v1')||'{"history":[]}').history.length===1);assert.ok(await undo.isEnabled());
 await undo.click();await p.waitForFunction(()=>!document.querySelector('[data-habit]').checked);assert.ok(await redo.isEnabled());await redo.click();await p.waitForFunction(()=>document.querySelector('[data-habit]').checked);
 await nav.locator('a').filter({hasText:'設定'}).click();await p.waitForURL('**/settings.html');await p.waitForSelector('body[data-navigation=ready]');assert.equal(await p.locator(toolbar+' [aria-current=page]').innerText(),'設定');
 await p.locator(toolbar+' a').filter({hasText:'我的資料'}).click();await p.waitForURL('**/profile.html');await p.waitForSelector('body[data-navigation=ready]');assert.equal(await p.locator(toolbar+' [aria-current=page]').innerText(),'我的資料');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.close();console.log(width+'px PASS: shared navigation, fixed controls, Undo/Redo and existing routes');
}
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
