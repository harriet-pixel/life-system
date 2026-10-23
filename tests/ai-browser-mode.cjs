const {openSettingsSection}=require('./settings-ui.cjs');
// Official API traffic is intercepted with fabricated credentials. No screenshots/traces.
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const base=(process.env.BASE_URL||'http://127.0.0.1:3013/').replace(/\/?$/,'/'),sessionKey='life-system.ai-test.v1',key='test-only-invalid-credential';
const fixtures=require('./fixtures/provider-catalogues-20261023.json');
const models={gemini:'models/gemini-3.7-flash',deepseek:'deepseek-flash',openai:'gpt-6.1-sol',claude:'claude-opus-5-5'};
const origins={gemini:'https://generativelanguage.googleapis.com',deepseek:'https://api.deepseek.com',openai:'https://api.openai.com',claude:'https://api.anthropic.com'};
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
for(const provider of ['gemini','deepseek','openai','claude']){
 const c=await browser.newContext({viewport:{width:375,height:900},reducedMotion:'reduce'}),p=await c.newPage(),calls=[],logs=[],errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>logs.push(m.text()));
 let pending=null,slow=false;
 await c.route(origins[provider]+'/**',async route=>{
  const req=route.request();if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST','Access-Control-Allow-Headers':'authorization,content-type,x-goog-api-key,x-api-key,anthropic-version,anthropic-dangerous-direct-browser-access'}});return;}
  calls.push({url:req.url(),method:req.method(),body:req.postData(),headers:req.headers()});
  if(slow){slow=false;await new Promise(r=>pending=r);}
  const list=fixtures[provider];
  const text='mock response <img src=x onerror=alert(1)>';
  const response={gemini:{candidates:[{content:{parts:[{text}]}}]},deepseek:{content:[{type:'text',text}]},openai:{output:[{type:'message',content:[{type:'output_text',text}]}]},claude:{content:[{type:'text',text}]}}[provider];
  await route.fulfill({headers:{'Access-Control-Allow-Origin':'*'},json:req.method()==='GET'?list:response}).catch(()=>{});
 });
 await p.goto(base+'settings.html');await p.waitForSelector('body[data-navigation=ready]');await openSettingsSection(p,'ai');assert.equal(await p.locator('#ai-key').isDisabled(),true);
 await p.locator('#ai-browser-mode').click();await p.locator('#ai-mode-confirm').waitFor({state:'visible'});assert.equal(await p.locator('#ai-key').isDisabled(),true);await p.locator('#ai-enable-browser').click();assert.equal(await p.locator('#ai-key').isEnabled(),true);
 await p.locator('#ai-provider').selectOption(provider);await p.locator('#ai-key').fill(key);await p.locator('#ai-connect').click();await p.waitForFunction(()=>!document.querySelector('#ai-model').disabled);await p.locator('#ai-model').selectOption(models[provider]);
 const original=await p.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),sessionKey);assert.equal(original.apiKey,key);assert.equal(original.expiresAt-original.issuedAt,7200000);
 await p.locator('#ai-test').click();await p.waitForFunction(()=>document.querySelector('#ai-state').textContent.includes('測試成功'));
 // Actual visible navigation uses the same tab; the restored service re-lists before generating.
 await p.locator('#mobile-links a').filter({hasText:'首頁'}).click();await p.waitForURL(base+'');await p.waitForSelector('body[data-navigation=ready]');await p.waitForSelector('.ai-developer-test:not([hidden])');assert.match(await p.locator('#companion-dialogue').textContent(),/模擬|完成/);
 const dev=p.locator('.ai-developer-test');await dev.locator('textarea').fill('Home fixture');await dev.getByRole('button',{name:'送出測試'}).click();await p.waitForFunction(()=>document.querySelector('.ai-test-output').textContent.includes('mock response'));
 assert.equal(await dev.locator('.ai-test-output img').count(),0);
 await p.locator('#mobile-links a').filter({hasText:'我的資料'}).click();await p.waitForURL(base+'profile.html');await p.waitForSelector('body[data-navigation=ready]');await p.waitForSelector('.ai-developer-test:not([hidden])');await p.locator('.ai-developer-test textarea').fill('Profile fixture');await p.locator('.ai-developer-test').getByRole('button',{name:'送出測試'}).click();await p.waitForFunction(()=>document.querySelector('.ai-test-output').textContent.includes('mock response'));
 await p.reload();await p.waitForSelector('.ai-developer-test:not([hidden])');await p.locator('.ai-developer-test textarea').fill('Reload fixture');await p.locator('.ai-developer-test').getByRole('button',{name:'送出測試'}).click();await p.waitForFunction(()=>document.querySelector('.ai-test-output').textContent.includes('mock response'));
 assert.equal(await p.evaluate(k=>JSON.parse(sessionStorage.getItem(k)).expiresAt,sessionKey),original.expiresAt);
 assert.ok(calls.filter(call=>call.method==='POST').length>=4,'real shared transport called after all three page transitions');assert.ok(calls.every(call=>!call.url.includes(key)&&!String(call.body).includes(key)));
 if(provider==='claude')assert.ok(calls.every(call=>call.headers['anthropic-dangerous-direct-browser-access']==='true'));
 const local=await p.evaluate(()=>JSON.stringify(localStorage));assert.ok(!local.includes(key));
 await p.locator('#mobile-links a').filter({hasText:'設定'}).click();await p.waitForURL(base+'settings.html');await p.waitForSelector('body[data-navigation=ready]');await p.waitForSelector('body[data-navigation=ready]');await openSettingsSection(p,'ai');await p.locator('#ai-panel').waitFor({state:'visible'});
 const backup=await p.evaluate(async()=>{const{dataStore}=await import('./assets/data.mjs?v=task-context-7');const{withBackup}=await import('./assets/backup.mjs?v=task-context-7');let text;await withBackup(dataStore,'',async blob=>text=await blob.text());return text;});assert.ok(!backup.includes(key)&&!backup.includes(sessionKey));
 // Cancellation races never publish an outdated list.
 slow=true;await p.locator('#ai-refresh').click();await p.waitForTimeout(30);await p.locator('#ai-provider').selectOption(provider==='claude'?'gemini':'claude');pending?.();await p.waitForTimeout(60);assert.equal(await p.locator('#ai-model').isDisabled(),true);assert.equal(await p.evaluate(k=>JSON.parse(sessionStorage.getItem(k)).apiKey,sessionKey),'');
 await p.locator('#ai-key').fill(key);await p.locator('#ai-disconnect').click();assert.equal(await p.evaluate(k=>sessionStorage.getItem(k),sessionKey),null);assert.equal(await p.locator('#ai-browser-mode').isChecked(),false);
 await p.locator('#ai-browser-mode').click();await p.locator('#ai-enable-browser').click();await p.locator('#ai-key').fill(key);await p.locator('#ai-browser-mode').uncheck();assert.equal(await p.evaluate(k=>sessionStorage.getItem(k),sessionKey),null);
 // Restoring an expired entry clears it before any API request.
 const count=calls.length;await p.evaluate(({sessionKey,original})=>{const issuedAt=Date.now()-7200001;sessionStorage.setItem(sessionKey,JSON.stringify({...original,issuedAt,expiresAt:issuedAt+7200000}));},{sessionKey,original});await p.reload();await p.waitForSelector('body[data-navigation=ready]');await openSettingsSection(p,'ai');assert.equal(await p.evaluate(k=>sessionStorage.getItem(k),sessionKey),null);assert.equal(calls.length,count);assert.equal(await p.locator('#ai-key').isDisabled(),true);
 assert.ok(!logs.some(m=>m.includes(key)));assert.deepEqual(errors,[]);await c.close();console.log(provider+': PASS mocked official direct APIs, same-tab home/profile/reload generation, unchanged deadline, cancel/switch/disable/clear/expiry, backup isolation and safe output');
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
