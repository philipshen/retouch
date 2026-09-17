'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,live,file,source})=>{
 const settled=()=>page.waitForFunction(()=>!undoBusy&&!sourceRequests&&!panelTasks),read=()=>fs.readFileSync(file,'utf8');
 const row=name=>page.getByRole('treeitem',{name:'a · '+name,exact:true}),field=()=>page.getByLabel('Link destination',{exact:true});
 const anchor=app.locator('a[aria-label=Docs]');
 await row('Docs').click();await settled();assert.equal(await field().inputValue(),'/old');
 const url='https://example.test/docs?a=1&b=%22x%22';await field().fill(url);await field().press('Enter');await settled();
 if(process.env.RT_VUE_LINK_SCREENSHOT)await page.screenshot({path:process.env.RT_VUE_LINK_SCREENSHOT});
 const changed=read();assert.notEqual(changed,source);assert.equal(await anchor.getAttribute('href'),url);
 await live.waitForFunction(url=>document.querySelector('a[aria-label=Docs]')?.getAttribute('href')===url,url);
 assert.equal(await anchor.locator('strong').textContent(),'Read');assert.equal(await anchor.getAttribute('target'),'_blank');assert.match(changed,/@click.prevent="count\+\+"/);
 await field().fill('javascript:alert(1)');await field().press('Tab');assert.equal(await field().getAttribute('aria-invalid'),'true');assert.equal(read(),changed);assert.equal(await anchor.getAttribute('href'),url);
 await field().focus();await field().press('Escape');assert.equal(await field().inputValue(),url);
 await page.getByRole('button',{name:'Remove link destination',exact:true}).click();await settled();const removed=read();assert.equal(await anchor.getAttribute('href'),null);assert.equal(await anchor.count(),1);assert.equal(await anchor.locator('strong').textContent(),'Read');
 await field().fill('#restored');await field().press('Tab');await settled();const restored=read();assert.equal(await anchor.getAttribute('href'),'#restored');
 for(const [text,href] of [[removed,null],[changed,url],[source,'/old']]){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),text);assert.equal(await anchor.getAttribute('href'),href);}
 for(const [text,href] of [[changed,url],[removed,null],[restored,'#restored']]){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();assert.equal(read(),text);assert.equal(await anchor.getAttribute('href'),href);}
 for(let i=0;i<3;i++){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();}assert.equal(read(),source);
 await row('Bound').click();await settled();assert.equal(await field().isDisabled(),true);
 assert.equal(await app.locator('h1').evaluate(el=>el.ownerDocument.defaultView.__viteDocument===el.ownerDocument),true);assert.equal(await live.evaluate(()=>window.__viteDocument===document),true);
 await app.getByRole('button',{name:'Count 2',exact:true}).waitFor();await live.getByRole('button',{name:'Count 1',exact:true}).waitFor();
 await page.getByRole('treeitem',{name:'h1 · Hello Vite',exact:true}).click();await settled();
 console.log('VUE LINK DESTINATION, REMOVAL, VALIDATION, BINDING GUARD AND EXACT HISTORY PASS');
};
