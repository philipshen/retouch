'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,live,file,source})=>{
 const read=()=>fs.readFileSync(file,'utf8'),settled=()=>page.waitForFunction(()=>!undoBusy&&!sourceRequests&&!panelTasks),target=app.locator('#bound-rich'),run=target.locator(':scope > span');
 const binding=source.match(/<span :class="count % 2[^>]*>/)[0];
 const appearance=async(value)=>{await page.waitForFunction(value=>{const w=document.querySelector('#app').contentWindow,span=w.document.querySelector('#bound-rich > span');return span?.textContent==='Click '+value&&span.className===(value%2?'odd':'even')&&w.getComputedStyle(span).color===(value%2?'rgb(180, 20, 20)':'rgb(20, 20, 180)');},value);};
 await appearance(2);await page.getByRole('treeitem',{name:'h2 · bound-rich',exact:true}).click();await settled();await page.getByRole('treeitem',{name:'h2 · bound-rich',exact:true}).press('Enter');await page.waitForFunction(()=>document.querySelector('#app').contentDocument.querySelector('#bound-rich')?.isContentEditable);
 await run.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,0);r.setEnd(el.firstChild,5);const s=d.getSelection();s.removeAllRanges();s.addRange(r);});await page.getByRole('button',{name:'Bold selected text',exact:true}).click();
 await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await settled();const formatted=read();assert.ok(formatted.includes(binding+'<strong>Click</strong> {{ count }}</span>'));await appearance(2);await live.locator('#bound-rich strong').waitFor();assert.equal(await live.locator('#bound-rich > span').textContent(),'Click 1');
 const toggle=async()=>{await page.locator('#modeBtn').click();await run.click();await app.getByRole('button',{name:'Count 3',exact:true}).waitFor();await appearance(3);await run.click();await app.getByRole('button',{name:'Count 2',exact:true}).waitFor();await appearance(2);await page.locator('#modeBtn').click();};
 await toggle();assert.equal(read(),formatted);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),source);assert.equal(await run.locator('strong').count(),0);await appearance(2);await toggle();assert.equal(read(),source);
 await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();assert.equal(read(),formatted);await appearance(2);await toggle();
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),source);await appearance(2);
 assert.equal(await target.evaluate(el=>el.ownerDocument.defaultView.__viteDocument===el.ownerDocument),true);assert.equal(await live.evaluate(()=>window.__viteDocument===document),true);await live.getByRole('button',{name:'Count 1',exact:true}).waitFor();
 await page.getByRole('treeitem',{name:'h1 · Hello Vite',exact:true}).click();await settled();console.log('VUE BOUND TEXT, EXACT DIRECTIVES, LIVE CLASSES/STYLES/EVENTS AND HISTORY PASS');
};
