'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,live,file,source,errors})=>{
 const errorStart=errors.length,failures=[],conflictLogs=[];
 const onResponse=response=>{if(response.status()>=400&&response.url().endsWith('/rt/__api/op'))failures.push(response);};
 const onConsole=message=>{if(message.type()==='error')conflictLogs.push({message:message.text(),url:message.location().url});};
 page.on('response',onResponse);page.on('console',onConsole);
 const read=()=>fs.readFileSync(file,'utf8'),settled=()=>page.waitForFunction(()=>!undoBusy&&!sourceRequests&&!panelTasks),target=app.locator('#rich-live');
 const edit=async()=>{await target.click();await page.waitForFunction(()=>document.querySelector('#app').contentDocument.querySelector('#rich-live')?.isContentEditable);};
 const save=async()=>{await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await settled();};
 await edit();assert.equal(await target.locator('[contenteditable="false"]').textContent(),'2');
 await target.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,0);r.setEnd(el.firstChild,5);const s=d.getSelection();s.removeAllRanges();s.addRange(r);});await page.keyboard.insertText('Welcome');
 await target.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,0);r.setEnd(el.firstChild,7);const s=d.getSelection();s.removeAllRanges();s.addRange(r);});await page.getByRole('button',{name:'Bold selected text',exact:true}).click();await save();
 const formatted=read();assert.notEqual(formatted,source);assert.match(formatted,/<strong>Welcome<\/strong> {{ count }}/);assert.equal(await target.textContent(),'Welcome 2 times!');assert.equal(await target.locator('strong').textContent(),'Welcome');
 await live.locator('#rich-live strong').waitFor();assert.equal(await live.locator('#rich-live').textContent(),'Welcome 1 times!');
 await page.locator('#modeBtn').click();await app.getByRole('button',{name:'Count 2',exact:true}).click();await app.getByRole('button',{name:'Count 3',exact:true}).waitFor();await page.locator('#modeBtn').click();assert.equal(await target.textContent(),'Welcome 3 times!');
 await live.getByRole('button',{name:'Count 1',exact:true}).click();await live.getByRole('button',{name:'Count 2',exact:true}).waitFor();assert.equal(await live.locator('#rich-live').textContent(),'Welcome 2 times!');
 // Removing the protected value must refuse the source write and restore Vue's nodes.
 await edit();await target.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.selectNodeContents(el);const s=d.getSelection();s.removeAllRanges();s.addRange(r);});await target.press('Backspace');const conflict=page.waitForEvent('console',{predicate:message=>message.type()==='error'&&/Failed to load resource.*409/.test(message.text()),timeout:10000}),refusal=page.waitForResponse(response=>response.url().endsWith('/rt/__api/op')&&response.request().method()==='POST');await save();const response=await refusal;assert.equal(response.status(),409);assert.match((await response.json()).reason,/Keep each live Vue value exactly once/);await conflict;assert.equal(read(),formatted);assert.equal(await target.textContent(),'Welcome 3 times!');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),source);assert.equal(await target.textContent(),'Hello 3 times!');
 await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();assert.equal(read(),formatted);assert.equal(await target.textContent(),'Welcome 3 times!');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),source);
 assert.equal(await target.evaluate(el=>el.ownerDocument.defaultView.__viteDocument===el.ownerDocument),true);assert.equal(await live.evaluate(()=>window.__viteDocument===document),true);
 await app.getByRole('button',{name:'Count 3',exact:true}).waitFor();await live.getByRole('button',{name:'Count 2',exact:true}).waitFor();
 const empty=app.locator('#rich-empty');await page.getByRole('treeitem',{name:'h3 · rich-empty',exact:true}).click();await settled();await page.getByRole('treeitem',{name:'h3 · rich-empty',exact:true}).press('Enter');await page.waitForFunction(()=>document.querySelector('#app').contentDocument.querySelector('#rich-empty')?.isContentEditable);
 assert.equal(await empty.locator('[contenteditable="false"]').count(),1);assert.equal(await empty.locator('[contenteditable="false"]').textContent(),'');
 await empty.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el,0);r.collapse(true);const s=d.getSelection();s.removeAllRanges();s.addRange(r);});await page.keyboard.insertText('Pending:');await save();const pending=read();assert.match(pending,/Pending:{{ count > 100 \? count : "" }}/);assert.equal(await empty.textContent(),'Pending:');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),source);assert.equal(await empty.textContent(),'');
 await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();assert.equal(read(),pending);assert.equal(await empty.textContent(),'Pending:');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),source);await app.getByRole('button',{name:'Count 3',exact:true}).waitFor();
 await page.getByRole('treeitem',{name:'h1 · Hello Vite',exact:true}).click();await settled();// WebKit reports the same failed resource twice; prove there was only one
 // rejected request and account for its exact URL, not arbitrary console errors.
 const expectedErrors=errors.splice(errorStart);assert.equal(failures.length,1);assert.equal(failures[0].status(),409);assert.ok(expectedErrors.length>=1&&expectedErrors.length<=2);assert.equal(conflictLogs.length,expectedErrors.length);assert.ok(conflictLogs.every(log=>log.url===response.url()&&/Failed to load resource.*409/.test(log.message)),JSON.stringify(conflictLogs));assert.ok(expectedErrors.every(error=>/Failed to load resource.*409/.test(error)),JSON.stringify(expectedErrors));page.off('response',onResponse);page.off('console',onConsole);
 console.log('VUE LIVE TEXT, LITERAL FORMATTING, PROTECTED EXPRESSIONS, REACTIVITY AND EXACT HISTORY PASS');
};
