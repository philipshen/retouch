'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,live,file,source})=>{
 const read=()=>fs.readFileSync(file,'utf8'),settled=()=>page.waitForFunction(()=>!undoBusy&&!sourceRequests&&!panelTasks),target=app.locator('#bound-link'),link=target.locator('a');
 const opening=source.match(/<a :href="[^>]*>/)[0];assert.equal(await link.getAttribute('href'),'/docs/2');
 await page.getByRole('treeitem',{name:'h2 · bound-link',exact:true}).click();await settled();await page.getByRole('treeitem',{name:'h2 · bound-link',exact:true}).press('Enter');await page.waitForFunction(()=>document.querySelector('#app').contentDocument.querySelector('#bound-link')?.isContentEditable);
 await link.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.selectNodeContents(el);const s=d.getSelection();s.removeAllRanges();s.addRange(r);});
 const field=page.getByLabel('Selected text link',{exact:true});await page.waitForFunction(()=>document.querySelector('[aria-label="Selected text link"]')?.readOnly);assert.equal(await field.inputValue(),'/docs/2');assert.equal(await page.getByRole('button',{name:'Remove selected text link',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Bold selected text',exact:true}).click();await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await settled();const formatted=read();assert.ok(formatted.includes(opening+'<strong>the docs</strong></a>'));assert.equal(await link.getAttribute('href'),'/docs/2');await live.locator('#bound-link strong').waitFor();assert.equal(await live.locator('#bound-link a').getAttribute('href'),'/docs/1');
 const toggle=async()=>{await page.locator('#modeBtn').click();await link.click();await app.getByRole('button',{name:'Count 3',exact:true}).waitFor();assert.equal(await link.getAttribute('href'),'/docs/3');await link.click();await app.getByRole('button',{name:'Count 2',exact:true}).waitFor();assert.equal(await link.getAttribute('href'),'/docs/2');await page.locator('#modeBtn').click();};
 await toggle();assert.equal(read(),formatted);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),source);assert.equal(await link.locator('strong').count(),0);assert.equal(await link.getAttribute('href'),'/docs/2');
 await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();assert.equal(read(),formatted);await toggle();assert.equal(read(),formatted);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),source);
 assert.equal(await target.evaluate(el=>el.ownerDocument.defaultView.__viteDocument===el.ownerDocument),true);assert.equal(await live.evaluate(()=>window.__viteDocument===document),true);await live.getByRole('button',{name:'Count 1',exact:true}).waitFor();
 await page.getByRole('treeitem',{name:'h1 · Hello Vite',exact:true}).click();await settled();console.log('VUE BOUND LINK TEXT, READ-ONLY URL, REACTIVE DESTINATION, EXACT HISTORY AND STATE PASS');
};
