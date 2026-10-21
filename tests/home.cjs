const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.BASE_URL || 'http://127.0.0.1:3000/';
const screenshotDir = process.env.SCREENSHOT_DIR;
if (screenshotDir) fs.mkdirSync(screenshotDir, { recursive: true });
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
 try {
  for (const width of [320, 390, 768, 1280]) {
   const page = await browser.newPage({ viewport: { width, height: 900 } });
   const errors = [], failedResponses = [];
   page.on('pageerror', (e) => errors.push(e.message));
   page.on('response', (r) => { if (r.status() >= 400) failedResponses.push(`${r.status()} ${r.url()}`); });
   assert.equal((await page.goto(base)).status(), 200);
   await page.evaluate(() => document.fonts.ready);
   await page.waitForFunction(() => document.querySelector('#companion-status').textContent.includes('尚未產生'));
   assert.equal(await page.locator('button:disabled').count(), 1);
   assert.equal(await page.locator('[data-task]').count(), 4);
   assert.equal(await page.locator('[data-habit]').count(), 3);
   const checkLayout = async () => {
    const layout = await page.evaluate(() => {
     const boxes = {};
     for (const name of ['companion', 'intro', 'profile-summary', 'tasks', 'habits', 'companion-portrait', 'dialogue-bubble']) {
      const r = document.querySelector('.' + name).getBoundingClientRect();
      boxes[name] = { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
     }
     return { boxes, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.equal(layout.overflow, false, `${width}px horizontal overflow`);
    const p = layout.boxes;
    assert.ok(p.intro.bottom <= p.companion.y);
    assert.ok(p.companion.bottom <= p['profile-summary'].y);
    assert.ok(p['profile-summary'].bottom <= p.tasks.y);
    assert.ok(p['companion-portrait'].right < p['dialogue-bubble'].x, 'avatar stays left of bubble');
    if (width < 1024) assert.ok(p.tasks.y < p.habits.y);
    else assert.ok(p.tasks.right < p.habits.x && p.tasks.y === p.habits.y);
   };
   await checkLayout();
   assert.equal(await page.locator('.site-header, .profile, .chat-button, #companion-title').count(), 0);
   assert.deepEqual(await page.locator('.profile-summary dt').allTextContents(), ['所持貨幣', '人物等級']);
   assert.deepEqual(await page.locator('.profile-summary dd').allTextContents(), ['—', '—']);
   assert.equal(await page.locator('time').getAttribute('datetime'), '2026-10-21');
   assert.match(await page.locator('time').textContent(), /2026 年・星期三/);
   assert.equal(await page.locator('.companion-note').textContent(), '目前為模擬回應，尚未串接 AI');
   const summaryRows = await page.locator('.profile-summary > div').evaluateAll(es => es.map(e => e.getBoundingClientRect().y));
   assert.equal(summaryRows[0], summaryRows[1], 'summary stays one row at normal text size');
   const original = await page.locator('#companion-dialogue').textContent();
   await page.mouse.move(100, 100); await page.mouse.wheel(0, 300);
   await page.locator('[data-task]').first().focus();
   await page.waitForTimeout(1100);
   assert.equal(await page.locator('#companion-dialogue').textContent(), original, 'passive events do not generate');
   await page.reload();
   await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link');
   await page.keyboard.press('Enter');
   assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
   for (let i = 0; i < 7; i++) {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.tagName), 'INPUT');
    assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'solid');
   }
   await page.locator('[data-task]').first().focus(); await page.keyboard.press('Space');
   assert.equal(await page.locator('#task-count').textContent(), '2 / 4 完成');
   assert.equal(await page.locator('#companion-dialogue').textContent(), original, 'preserve dialogue while waiting');
   assert.ok(await page.locator('[data-task]').first().evaluate(e => getComputedStyle(e).transitionDuration.split(', ').every(t => t === '0.18s')));
   await page.locator('[data-habit]').first().check();
   await page.waitForFunction(() => document.querySelector('#companion-status').textContent.includes('已更新'));
   assert.match(await page.locator('#companion-dialogue').textContent(), /2 項示意完成操作/);
   assert.equal(await page.locator('.companion-portrait').getAttribute('data-emotion'), 'pleased');
   assert.equal(await page.locator('#portrait-emotion').textContent(), '欣喜');
   const bubbleBefore = await page.locator('.dialogue-bubble').boundingBox();
   await page.waitForTimeout(200);
   const bubbleAfter = await page.locator('.dialogue-bubble').boundingBox();
   assert.equal(bubbleBefore.height, bubbleAfter.height, 'fade does not animate bubble height');
   assert.equal(await page.locator('.habit-state').first().textContent(), '已打卡');
   const previous = await page.locator('#companion-dialogue').textContent();
   await page.locator('[data-task]').first().uncheck();
   await page.waitForTimeout(1100);
   assert.equal(await page.locator('#companion-dialogue').textContent(), previous, 'undo does not generate');
   await page.locator('[data-habit]').nth(2).check();
   await page.waitForFunction(() => document.querySelector('.companion-portrait').dataset.emotion === 'calm');
   assert.equal(await page.locator('#portrait-emotion').textContent(), '放鬆');
   await page.evaluate(() => document.documentElement.style.fontSize = '200%');
   await checkLayout();
   await page.evaluate(() => document.documentElement.style.fontSize = '');
   await page.emulateMedia({ reducedMotion: 'reduce' });
   assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
   assert.equal(await page.locator('[data-task]').first().evaluate(e => getComputedStyle(e).transitionDuration), '0s');
   assert.equal(await page.locator('#companion-dialogue').evaluate(e => getComputedStyle(e).animationName), 'none');
   assert.ok(await page.locator('label').evaluateAll((els) => els.every((e) => { const r=e.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })));
   await page.reload();
   assert.equal(await page.locator('#task-count').textContent(), '1 / 4 完成');
   assert.equal(await page.locator('#companion-dialogue').textContent(), original);
   await page.evaluate(() => document.activeElement.blur());
   if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, `banner-${width}.png`), fullPage: true });
   assert.deepEqual(errors, []); assert.deepEqual(failedResponses, []);
   console.log(`${width}px PASS: banner/order, 200% text, no overflow, keyboard, batching, paired emotions, passive/undo events, reset, assets`);
   await page.close();
  }
  // Inject an offline provider to exercise the actual UI fallback wiring.
  const page = await browser.newPage();
  await page.route('**/assets/companion.mjs', async (route) => {
   const response = await route.fetch();
   const source = await response.text();
   const start = source.indexOf('export async function generateMockReply');
   assert.ok(start > 0);
   await route.fulfill({ response, body: source.slice(0, start) + 'export async function generateMockReply() { throw new Error("Test offline"); }' });
  });
  await page.goto(base);
  await page.locator('[data-task]').first().check();
  await page.waitForFunction(() => document.querySelector('#companion-status').textContent.includes('備援'));
  assert.equal(await page.locator('#task-count').textContent(), '2 / 4 完成');
  assert.match(await page.locator('#companion-dialogue').textContent(), /原本的示意操作已完成/);
  assert.equal(await page.locator('.companion-portrait').getAttribute('data-emotion'), 'neutral');
  console.log('UI failure PASS: fallback pair rendered, successful task remains completed');
  await page.close();
 } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
