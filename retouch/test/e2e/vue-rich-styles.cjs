'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,live,file,source})=>{
 const screen=page.getByLabel('Screen size',{exact:true}),originalScreen=await screen.inputValue();
 const read=()=>fs.readFileSync(file,'utf8'),settled=()=>page.waitForFunction(()=>!undoBusy&&!sourceRequests&&!panelTasks),target=app.locator('#rich-styled');
 const edit=async()=>{await target.click();await page.waitForFunction(()=>document.querySelector('#app').contentDocument.querySelector('#rich-styled')?.isContentEditable);};
 const style=()=>target.locator('span[aria-label="Styled run"]').getAttribute('data-rt-style');const owner=await style();
 const save=async()=>{await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await settled();};
 const font=async()=>{await page.waitForFunction(()=>{const w=document.querySelector('#app').contentWindow,span=w.document.querySelector('#rich-styled span[aria-label="Styled run"]');return span&&w.getComputedStyle(span).fontSize===(w.innerWidth>=768?'27px':'19px');});};
 await font();await edit();await target.locator('span').evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.selectNodeContents(el);const s=d.getSelection();s.removeAllRanges();s.addRange(r);});
 await page.getByRole('button',{name:'Bold selected text',exact:true}).click();await save();const formatted=read();assert.equal(await style(),owner);await font();assert.equal(await target.locator('span strong').textContent(),'Styled');
 for(const size of ['390x844','768x1024']){await screen.selectOption(size);await settled();await font();}
 await edit();await target.locator('span').evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.selectNode(el);const s=d.getSelection();s.removeAllRanges();s.addRange(r);});await target.press('Backspace');await save();const deleted=read();assert.equal(await target.locator('span').count(),0);assert.equal(deleted.includes(owner),false);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),formatted);assert.equal(await style(),owner);await font();
 await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();assert.equal(read(),deleted);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),source);await font();
 assert.equal(await target.evaluate(el=>el.ownerDocument.defaultView.__viteDocument===el.ownerDocument),true);assert.equal(await live.evaluate(()=>window.__viteDocument===document),true);
 await app.getByRole('button',{name:'Count 2',exact:true}).waitFor();await live.getByRole('button',{name:'Count 1',exact:true}).waitFor();
 await screen.selectOption(originalScreen);await settled();await font();
 await page.getByRole('treeitem',{name:'h1 · Hello Vite',exact:true}).click();await settled();
 console.log('VUE RESPONSIVE RICH RUNS, STYLE CLEANUP, EXACT HISTORY AND RETAINED STATE PASS');
};
