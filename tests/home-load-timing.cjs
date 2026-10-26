// Diagnostic timings only: no unstable millisecond pass/fail threshold.
const {chromium}=require('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:3014/work/build/';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),results=[];
 try{
  for(const mode of ['cold','warm','slow']){
   const context=await browser.newContext({viewport:{width:375,height:812}}),page=await context.newPage();
   await page.addInitScript(()=>{
    new MutationObserver(()=>{
     const list=document.querySelector('.task-list');
     if(list&&!list.textContent.includes('正在讀取')&&!window.todayTime)window.todayTime=performance.now();
    }).observe(document,{childList:true,subtree:true});
   });
   const client=await context.newCDPSession(page);await client.send('Network.enable');
   if(mode==='warm'){await page.goto(base);await page.waitForSelector('body[data-shell=ready]');}
   else await client.send('Network.setCacheDisabled',{cacheDisabled:true});
   if(mode==='slow')await client.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:160*1024,uploadThroughput:80*1024});
   await page.goto(base);await page.waitForSelector('body[data-shell=ready]',{timeout:90000});
   results.push(await page.evaluate(mode=>({mode,today:Math.round(window.todayTime),resources:performance.getEntriesByType('resource').length}),mode));
   await context.close();
  }
  console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
