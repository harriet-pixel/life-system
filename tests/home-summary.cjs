const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {
  for (const width of [320,390,768,1280]) {
   const page = await browser.newPage({viewport:{width,height:900}});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   const base=process.env.BASE_URL || 'http://127.0.0.1:3003/';
   await page.goto(base);
   await page.waitForFunction(()=>document.querySelector('#home-stats')?.textContent==='Lv 1 ｜ Exp —｜ $ —');
   await page.evaluate(async()=>{
    const {dataStore,STORAGE_KEY}=await import('./assets/data.mjs?v=companion-actions-20261029');
    const state=dataStore.get();state.stats.level=7;state.stats.experience=1234;state.stats.currency=89;
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
   });
   await page.reload();
   await page.waitForFunction(()=>document.querySelector('#home-stats')?.textContent==='Lv 7 ｜ Exp 1.1K｜ $ 89');
   await page.locator('#habits-tab').click();await page.locator('[data-habit]').first().check();
   const undo=page.locator(width<1024?'.mobile-navigation [data-undo]':'.desktop-navigation [data-undo]');
   await undo.click();
   await page.waitForFunction(()=>!document.querySelector('[data-habit]').checked);
   assert.equal(await page.locator('#home-stats').textContent(),'Lv 7 ｜ Exp 1.1K｜ $ 89');
   await page.evaluate(()=>document.documentElement.style.fontSize='200%');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.goto(new URL('profile.html',base).href);
   await page.waitForFunction(()=>document.querySelector('#profile-stats')?.textContent.includes('1.1K'));
   const originalOrder=await page.locator('#profile-stats').textContent();
   assert.equal(originalOrder,'Lv 7 ｜ Exp 1.1K｜ $ 89','profile keeps existing formatting');
   assert.deepEqual(errors,[]);
   console.log(`${width}px PASS: saved stats, homepage order, Undo, 200% text, profile unaffected`);
   await page.close();
  }
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
