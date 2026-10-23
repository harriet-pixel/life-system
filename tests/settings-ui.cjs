async function openSettingsSection(page,key){
 await page.waitForSelector('body[data-shell="ready"]');
 const group=['backup','storage','history'].includes(key)?'management':'general';
 if(await page.locator('#'+group+'-tab').getAttribute('aria-selected')!=='true')await page.locator('#'+group+'-tab').click();
 if(!await page.locator('#'+key+'-section').evaluate(node=>node.open))await page.locator('#'+key+'-tab').click();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
module.exports={openSettingsSection};
