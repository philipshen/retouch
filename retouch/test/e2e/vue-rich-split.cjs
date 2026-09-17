'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,live,file,source})=>{
 const screen=page.getByLabel('Screen size',{exact:true}),originalScreen=await screen.inputValue();
 const read=()=>fs.readFileSync(file,'utf8'),settled=()=>page.waitForFunction(()=>!undoBusy&&!sourceRequests&&!panelTasks),target=app.locator('#rich-split');
 const fonts=async(count)=>{await page.waitForFunction(count=>{const w=document.querySelector('#app').contentWindow,runs=[...w.document.querySelectorAll('#rich-split span[title]')];return runs.length===count&&runs.every(span=>w.getComputedStyle(span).fontSize===(w.innerWidth>=768?'27px':'19px'));},count);};
 await screen.selectOption('768x1024');await settled();await fonts(1);
 // Select the container in the layer tree so Enter splits its child paragraph.
 await page.getByRole('treeitem',{name:'div · rich-split',exact:true}).click();await settled();
 await page.getByRole('treeitem',{name:'div · rich-split',exact:true}).press('Enter');await page.waitForFunction(()=>document.querySelector('#app').contentDocument.querySelector('#rich-split')?.isContentEditable);
 await target.locator('span[title]').evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,6);r.collapse(true);const s=d.getSelection();s.removeAllRanges();s.addRange(r);});
 await target.press('Enter');await fonts(2);assert.deepEqual(await target.locator('span[title]').allTextContents(),['Split ','here']);
 await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await settled();const split=read();assert.notEqual(split,source);await fonts(2);
 const owners=await target.locator('span[title]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-rt-style')));assert.equal(new Set(owners).size,2);assert.ok(owners.every(id=>/^[a-f0-9]{10}$/.test(id)));
 for(const size of ['390x844','768x1024']){await screen.selectOption(size);await settled();await fonts(2);}
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),source);await fonts(1);
 await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();assert.equal(read(),split);await fonts(2);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),source);await fonts(1);
 assert.equal(await target.evaluate(el=>el.ownerDocument.defaultView.__viteDocument===el.ownerDocument),true);assert.equal(await live.evaluate(()=>window.__viteDocument===document),true);
 await app.getByRole('button',{name:'Count 2',exact:true}).waitFor();await live.getByRole('button',{name:'Count 1',exact:true}).waitFor();
 await screen.selectOption(originalScreen);await settled();await page.getByRole('treeitem',{name:'h1 · Hello Vite',exact:true}).click();await settled();
 console.log('VUE RESPONSIVE TEXT SPLIT, DISTINCT OWNERS, PREVIEW, EXACT HISTORY AND RETAINED STATE PASS');
};
