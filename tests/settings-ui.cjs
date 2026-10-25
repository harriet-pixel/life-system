async function openSettingsSection(page,key){
 await page.waitForSelector('body[data-shell="ready"]');
 const group=['backup','storage','history'].includes(key)?'management':'general';
 if(await page.locator('#'+group+'-tab').getAttribute('aria-selected')!=='true')await page.locator('#'+group+'-tab').click();
 if(!await page.locator('#'+key+'-section').evaluate(node=>node.open))await page.locator('#'+key+'-tab').click();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
module.exports={openSettingsSection};
module.exports.redoFromHistory=async page=>{const prior=new URL(page.url()).pathname,group=await page.locator('.settings-content > .activity-tabs [aria-selected=true]').count()?await page.locator('.settings-content > .activity-tabs [aria-selected=true]').getAttribute('id'):null;if(!prior.endsWith('settings.html')){await page.getByRole('link',{name:'設定',exact:true}).click();await page.waitForFunction(()=>document.body.dataset.page==='settings');}await openSettingsSection(page,'history');await page.locator('#history-redo').click();if(!prior.endsWith('settings.html')){await page.goBack();await page.waitForFunction(path=>location.pathname===path,prior);}else if(group&&await page.locator('#'+group).getAttribute('aria-selected')!=='true')await page.locator('#'+group).click();};
