'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,live,file,source})=>{
 const read=()=>fs.readFileSync(file,'utf8'),settled=()=>page.waitForFunction(()=>!undoBusy&&!sourceRequests&&!panelTasks),target=app.locator('#comment-rich');
 const comments=value=>value.match(/<!--[\s\S]*?-->/g)||[],originalComments=comments(source);
 const renderedComments=()=>target.evaluate(el=>{const walker=el.ownerDocument.createTreeWalker(el,128),values=[];while(walker.nextNode())values.push(walker.currentNode.data);return values;});
 const originalRendered=await renderedComments();assert.equal(originalRendered.length,4);
 const row=page.getByRole('treeitem',{name:'h2 · comment-rich',exact:true});await row.click();await settled();await row.press('Enter');await page.waitForFunction(()=>document.querySelector('#app').contentDocument.querySelector('#comment-rich')?.isContentEditable);
 await target.evaluate(el=>{const d=el.ownerDocument,node=Array.from(el.childNodes).find(node=>node.nodeType===3&&node.textContent.includes('Hello')),range=d.createRange(),at=node.textContent.indexOf('Hello');range.setStart(node,at);range.setEnd(node,at+5);const selection=d.getSelection();selection.removeAllRanges();selection.addRange(range);});
 await page.getByRole('button',{name:'Bold selected text',exact:true}).click();await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await settled();const formatted=read();assert.match(formatted,/<strong>Hello<\/strong>/);assert.deepEqual(comments(formatted),originalComments);assert.match(formatted,/\{\{ count \}\}/);assert.deepEqual(await renderedComments(),originalRendered);await live.locator('#comment-rich strong').waitFor();
 const toggle=async()=>{await page.locator('#modeBtn').click();await target.locator('em').click();await app.getByRole('button',{name:'Count 3',exact:true}).waitFor();assert.match(await target.textContent(),/Hello 3 world!/);await target.locator('em').click();await app.getByRole('button',{name:'Count 2',exact:true}).waitFor();await page.locator('#modeBtn').click();assert.deepEqual(await renderedComments(),originalRendered);};
 await toggle();assert.equal(read(),formatted);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),source);assert.equal(await target.locator('strong').count(),0);assert.deepEqual(await renderedComments(),originalRendered);
 await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();assert.equal(read(),formatted);await toggle();
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),source);
 assert.equal(await target.evaluate(el=>el.ownerDocument.defaultView.__viteDocument===el.ownerDocument),true);assert.equal(await live.evaluate(()=>window.__viteDocument===document),true);await live.getByRole('button',{name:'Count 1',exact:true}).waitFor();await page.getByRole('treeitem',{name:'h1 · Hello Vite',exact:true}).click();await settled();
 console.log('VUE COMMENTS, FORMATTING, LIVE VALUES, EVENTS, EXACT HISTORY AND RETAINED STATE PASS');
};
