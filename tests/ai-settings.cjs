const {openSettingsSection}=require('./settings-ui.cjs');
// All provider/backend/login responses in this file are mocks, never real credentials.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base=(process.env.BASE_URL||'http://127.0.0.1:3013/').replace(/\/?$/,'/');
const key='test-only-invalid-credential',login='test-only-invalid-login-token';
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
for(const width of [320,375,390,450,451,768,1024,1280])for(const font of ['device','serif','sans','rounded']){
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'settings.html');await p.waitForSelector('body[data-navigation=ready]');await openSettingsSection(p,'ai');
 assert.equal(await p.locator('#ai-connect').isDisabled(),true);assert.match(await p.locator('#ai-state').textContent(),/尚未設定/);
 await p.evaluate(async font=>{const{dataStore:s}=await import('./assets/data.mjs?v=sync-retain-24');await s.transact({type:'appearance.update',changes:{settings:{...s.get().settings,appearance:{...s.get().settings.appearance,font}}}});await document.fonts.ready;},font);
 await p.evaluate(()=>document.documentElement.style.fontSize='200%');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}/${font}: page overflow`);
 await p.locator('#general-tab').focus({preventScroll:true});await p.keyboard.press('End');assert.equal(await p.locator('#management-tab').getAttribute('aria-selected'),'true');await p.keyboard.press('Home');assert.equal(await p.locator('#general-tab').getAttribute('aria-selected'),'true');
 await p.locator('#ai-browser-mode').click();await p.locator('#ai-mode-confirm').waitFor({state:'visible'});assert.ok(await p.evaluate(()=>document.querySelector('#ai-mode-confirm').getBoundingClientRect().right<=innerWidth));await p.locator('#ai-enable-browser').click();assert.equal(await p.locator('#ai-key').isEnabled(),true);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'enabled developer controls must not overflow');
 assert.deepEqual(errors,[]);await context.close();
}
console.log('PASS formal-unconfigured and browser-enabled AI UI: 32 width/font combinations, 200% text, consent dialog, keyboard and no whole-page overflow');
const context=await browser.newContext({viewport:{width:375,height:900},reducedMotion:'reduce'}),p=await context.newPage(),requests=[],errors=[],logs=[];
p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>logs.push(m.text()));
await p.route('**/assets/ai-config.mjs*',route=>route.fulfill({contentType:'text/javascript',body:"export const AI_BACKEND_URL='https://backend.example.invalid/v1/ai';"}));
await p.route('**/assets/ai-auth.mjs*',route=>route.fulfill({contentType:'text/javascript',body:`export async function getAIAccessToken(){return '${login}';}`}));
let modelError='',slow=false,release;
await p.route('https://backend.example.invalid/v1/ai',async route=>{
 const body=route.request().postDataJSON();requests.push(body);assert.equal(route.request().headers().authorization,'Bearer '+login);
 if(slow){slow=false;await new Promise(r=>release=r);}
 if(body.operation==='models')await route.fulfill({json:{models:[{id:'fixture-text',name:'文字模型 <img src=x onerror=alert(1)>'},{id:'fixture-other',name:'Other'}],fetchedAt:new Date().toISOString()}});
 else await route.fulfill({status:modelError?429:200,json:modelError?{error:{code:modelError,message:key}}:{ok:true}});
});
await p.addInitScript(testKey=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(String(v).includes(testKey))throw new Error('credential persistence blocked');return original.call(this,k,v);};window.scrollCalls=[];const scroll=window.scrollTo;window.scrollTo=function(...a){scrollCalls.push(a);return scroll.apply(this,a);};},key);
await p.goto(base+'settings.html');await p.waitForSelector('body[data-navigation=ready]');await openSettingsSection(p,'ai');
await p.locator('#ai-key').fill(key);assert.equal(await p.locator('#ai-toggle-key').count(),0);assert.equal(await p.locator('#ai-key').getAttribute('type'),'password');await p.locator('#ai-key').blur();assert.equal(await p.locator('#ai-key').inputValue(),'');
await p.locator('#ai-connect').click();await p.waitForFunction(()=>!document.querySelector('#ai-model').disabled);assert.equal(await p.locator('#ai-model option').count(),3);assert.equal(await p.locator('#ai-panel img').count(),0,'model names cannot become HTML');
assert.equal(await p.locator('#ai-test').isDisabled(),true);await p.locator('#ai-model').selectOption('fixture-text');await p.locator('#ai-test').click();await p.waitForFunction(()=>document.querySelector('#ai-state').textContent.includes('測試成功'));
assert.equal(requests.at(-1).operation,'test');assert.deepEqual(Object.keys(requests.at(-1)).sort(),['apiKey','model','operation','provider']);
await p.evaluate(()=>scrollCalls=[]);modelError='quota';await p.locator('#ai-test').click();await p.waitForFunction(()=>document.querySelector('#ai-state').textContent.includes('額度'));assert.equal(await p.locator('#ai-model').inputValue(),'fixture-text');assert.equal(await p.evaluate(()=>scrollCalls.length),0,'async AI results do not position tabs');modelError='';
const backup=await p.evaluate(async()=>{const{dataStore}=await import('./assets/data.mjs?v=sync-retain-24');const{withBackup}=await import('./assets/backup.mjs?v=sync-retain-24');let text;await withBackup(dataStore,'',async blob=>{text=await blob.text();});return {text,stored:JSON.stringify({...localStorage,...sessionStorage}),doc:dataStore.get()};});
assert.ok(!backup.text.includes(key)&&!backup.text.includes(login));assert.ok(!backup.stored.includes(key)&&!backup.stored.includes(login));assert.deepEqual(backup.doc.settings.ai,{provider:'gemini',model:'fixture-text'});
// Switching providers while the listing is in flight cannot revive old state.
slow=true;await p.locator('#ai-refresh').click();await p.waitForTimeout(30);await p.locator('#ai-provider').selectOption('claude');assert.equal(await p.locator('#ai-key').inputValue(),'');release();await p.waitForTimeout(80);assert.equal(await p.locator('#ai-model option').count(),1);assert.equal(await p.locator('#ai-model').isDisabled(),true);
await p.locator('#ai-key').fill(key);await p.locator('#ai-connect').click();await p.waitForFunction(()=>!document.querySelector('#ai-model').disabled);await p.locator('#ai-disconnect').click();assert.equal(await p.locator('#ai-key').inputValue(),'');assert.equal(await p.locator('#ai-model').isDisabled(),true);
await p.locator('#ai-key').fill(key);await p.reload();await openSettingsSection(p,'ai');assert.equal(await p.locator('#ai-key').inputValue(),'');assert.equal(await p.locator('#ai-test').isDisabled(),true);
await p.locator('#ai-key').fill(key);await p.goto(base+'profile.html');await p.goto(base+'settings.html');await openSettingsSection(p,'ai');assert.equal(await p.locator('#ai-key').inputValue(),'');
assert.ok(!logs.some(line=>line.includes(key)||line.includes(login)));assert.deepEqual(errors,[]);await context.close();console.log('PASS mock AI connect/list/test/quota/provider-race/disconnect/reload/leave, backup and storage credential isolation, safe labels, no async scrolling');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
