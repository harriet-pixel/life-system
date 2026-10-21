const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.BASE_URL || 'http://127.0.0.1:3000/';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {
  for(const width of [320,390,768,1024,1280]) {
   const page=await browser.newPage({viewport:{width,height:900}});
   const mobile=width<1024;
   const toolbar=mobile?'.mobile-navigation':'.desktop-navigation';
   const undo=page.locator(toolbar+' [data-undo]');
   await page.goto(base);await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('.desktop-navigation').isVisible(),!mobile);
   assert.equal(await page.locator('.mobile-navigation').isVisible(),mobile);
   assert.equal(await undo.isDisabled(),true);
   assert.equal(await page.locator('.profile-display-name').count(),0);
   assert.deepEqual(await page.locator('.summary-stat').allTextContents(),['Lv—','｜$ —']);
   if(!mobile) {
    const bar=await page.locator('.desktop-navigation').boundingBox();
    const dashboard=await page.locator('.dashboard').boundingBox();
    const portrait=await page.locator('.companion').boundingBox();
    const content=await page.locator('.daily-panel').boundingBox();
    assert.equal(bar.x,dashboard.x);assert.equal(bar.width,dashboard.width);
    assert.equal(portrait.y,content.y);assert.equal(portrait.y-bar.y-bar.height,24);
    const before=await page.locator('.daily-panel').boundingBox();
    assert.equal(await page.locator('#navigation-toggle').getAttribute('aria-expanded'),'false');
    assert.equal(await page.locator('#current-page-name').textContent(),'｜首頁 Home');
    assert.equal(await page.locator('#current-page-name').isVisible(),true);
    assert.equal(await page.locator('#current-page-name').evaluate(e=>getComputedStyle(e).fontSize),await page.locator('#tasks-tab').evaluate(e=>getComputedStyle(e).fontSize));
    await page.locator('#navigation-toggle').click();
    assert.equal(await page.locator('#current-page-name').isVisible(),false);
    assert.equal(await page.locator('#navigation-toggle').getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('#desktop-links').isVisible(),true);
    const after=await page.locator('.daily-panel').boundingBox();
    assert.equal(before.width,after.width);assert.equal(before.x,after.x);
    const centered=await page.locator('.tasks .section-kicker').boundingBox();
    const panel=await page.locator('.tasks').boundingBox();
    assert.ok(Math.abs(centered.x+centered.width/2-panel.x-panel.width/2)<1);
    const row=await page.locator('.task-row').first().boundingBox();
    const checkbox=await page.locator('[data-task]').first().boundingBox();
    assert.equal(checkbox.x-row.x,16);
   }
   const nav=page.locator(mobile?'#mobile-links':'#desktop-links');
   assert.deepEqual(await nav.locator('.navigation-item').evaluateAll(items=>items.map(item=>item.firstChild.textContent)),['首頁','待辦事項','習慣打卡','陪讀系統','錢包帳本','我的夥伴','我的資料','聊天室','設定']);
   assert.equal(await nav.locator('[aria-current=page]').count(),1);
   assert.equal(await nav.locator('[aria-disabled=true]').count(),8);
   assert.equal(await nav.locator('a').count(),1);
   const beforeScroll=await undo.boundingBox();
   await nav.evaluate(e=>e.scrollLeft=e.scrollWidth);
   const afterScroll=await undo.boundingBox();
   assert.deepEqual(afterScroll,beforeScroll,'Undo stays fixed when options scroll');
   const oldURL=page.url();
   await nav.locator('[aria-disabled=true]').last().click({force:true});assert.equal(page.url(),oldURL);
   assert.equal(await undo.isDisabled(),true);
   await page.locator('[data-task]').first().check();
   assert.equal(await page.locator('#task-count').textContent(),'2 / 4 完成');
   assert.equal(await undo.isEnabled(),true);
   await undo.click();
   await page.waitForFunction(()=>document.querySelector('#operation-status').textContent.includes('已撤銷'));
   const notice=await page.locator('#operation-status').boundingBox();
   const activity=await page.locator('.activity-region').boundingBox();
   assert.ok(notice.y>=activity.y+activity.height,'undo notice appears below tasks and habits');
   assert.equal(await page.locator('[data-task]').first().isChecked(),false);
   assert.equal(await page.locator('#task-count').textContent(),'1 / 4 完成');
   assert.equal(await undo.isDisabled(),true);
   await page.waitForTimeout(1200);
   assert.equal(await page.locator('.companion-portrait').getAttribute('data-emotion'),'neutral','undo cancels stale companion reply');
   await page.locator('#habits-tab').click();await page.locator('[data-habit]').first().check();
   assert.equal(await undo.isEnabled(),true);
   // The same record remains available after responsive UI switching.
   await page.setViewportSize({width:mobile?1280:390,height:900});
   const otherUndo=page.locator((mobile?'.desktop-navigation':'.mobile-navigation')+' [data-undo]');
   await otherUndo.waitFor({state:'visible'});assert.equal(await otherUndo.isEnabled(),true);
   await otherUndo.click();
   await page.waitForFunction(()=>!document.querySelector('[data-habit]').checked);
   assert.equal(await page.locator('.habit-state').first().textContent(),'未打卡');
   await page.setViewportSize({width,height:900});
   await page.locator(toolbar).waitFor({state:'visible'});
   if(!mobile) {
    await page.reload();assert.equal(await page.locator('#navigation-toggle').getAttribute('aria-expanded'),'true');
    await page.locator('#navigation-toggle').click();assert.equal(await page.locator('#desktop-links').isVisible(),false);
   }
   await page.evaluate(()=>document.documentElement.style.fontSize='200%');
   if(!mobile) {
    await page.locator('#navigation-toggle').click();
    const u1=await undo.boundingBox();await nav.evaluate(e=>e.scrollLeft=e.scrollWidth);const u2=await undo.boundingBox();
    assert.deepEqual(u1,u2,'expanded desktop navigation cannot push Undo away');
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(mobile) {
    await page.waitForFunction(()=>Math.abs(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bottom-nav-height'))-document.querySelector('.mobile-navigation').getBoundingClientRect().height)<1);
    const u1=await undo.boundingBox();await nav.evaluate(e=>e.scrollLeft=0);const u2=await undo.boundingBox();assert.deepEqual(u1,u2);
    await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
    const last=await page.locator('.habit-note').boundingBox();
    const bottom=await page.locator('.mobile-navigation').boundingBox();
    assert.ok(last.y+last.height<=bottom.y,'last content remains above fixed navigation');
   }
   await page.evaluate(()=>document.documentElement.style.fontSize='');
   if(process.env.SCREENSHOT_DIR){fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,`navigation-${width}.png`),fullPage:true});}
   console.log(`${width}px PASS: responsive nav, current route, disabled future pages, stationary Undo, source restore, shared responsive history, zoom`);
   await page.close();
  }
  const page=await browser.newPage({viewport:{width:390,height:900}});
  await page.route('**/assets/undo.mjs*',async route=>{
   const response=await route.fetch();
   const source=(await response.text()).replace('restore({ id, before, after }) {','restore({ id, before, after }) { throw new Error("測試還原失敗");');
   await route.fulfill({response,body:source});
  });
  await page.goto(base);await page.locator('[data-task]').first().check();
  await page.locator('.mobile-navigation [data-undo]').click();
  await page.waitForFunction(()=>document.querySelector('#operation-status').textContent.includes('測試還原失敗'));
  assert.equal(await page.locator('[data-task]').first().isChecked(),true);
  assert.equal(await page.locator('#task-count').textContent(),'2 / 4 完成');
  assert.equal(await page.locator('.mobile-navigation [data-undo]').isEnabled(),true);
  assert.equal(await page.locator('[data-task]').first().isEnabled(),true);
  console.log('UI restore failure PASS: data unchanged, retry remains available, inputs re-enabled');
  await page.close();
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
