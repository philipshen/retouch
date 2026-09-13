'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),initial=read(),original=await target.textContent(),field=()=>page.getByLabel('Selected text link',{exact:true}),states=[initial];
 const select=async locator=>locator.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.selectNodeContents(el);const s=d.getSelection();s.removeAllRanges();s.addRange(r);});
 const edit=async()=>{await target.click({position:{x:(await target.boundingBox()).width-10,y:12}});await wait(async()=>await target.getAttribute('contenteditable')==='true');};
 const save=async()=>{await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await settled();await wait(()=>read()!==states.at(-1));states.push(read());assert.equal(await target.textContent(),original);};
 const url='https://example.test/docs?a=1&b=%22x%22';
 await edit();await target.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,1);r.setEnd(el.firstChild,4);const s=d.getSelection();s.removeAllRanges();s.addRange(r);});
 await page.getByRole('button',{name:'Underline selected text',exact:true}).click();
 await target.focus();await page.keyboard.press('Control+k');assert.equal(await field().evaluate(el=>el===el.ownerDocument.activeElement),true);assert.equal(await target.getAttribute('contenteditable'),'true');await field().fill(url);await field().press('Enter');assert.equal(await target.locator('a').getAttribute('href'),url);assert.equal(await target.locator('u a').textContent(),original.slice(1,4));assert.equal(read(),initial);
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal(await target.locator('a').count(),0);await page.getByRole('button',{name:'Redo',exact:true}).click();assert.equal(await target.locator('a').getAttribute('href'),url);
 const markup=await target.innerHTML();await field().fill('javascript:alert(1)');await field().press('Enter');assert.equal(await field().getAttribute('aria-invalid'),'true');assert.equal(await target.innerHTML(),markup);assert.equal(read(),initial);await field().press('Escape');assert.equal(await field().getAttribute('aria-invalid'),null);assert.equal(await field().inputValue(),url);
 if(process.env.RT_E2E_TEXT_LINKS_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_TEXT_LINKS_SCREENSHOT});await save();
 await edit();await select(target.locator('a'));await wait(async()=>await field().inputValue()===url);await field().fill('/updated#section');await field().press('Enter');assert.equal(await target.locator('a').getAttribute('href'),'/updated#section');assert.equal(await target.locator('a a').count(),0);await save();
 await edit();await target.locator('a').evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,1);r.setEnd(el.firstChild,2);const selection=d.getSelection();selection.removeAllRanges();selection.addRange(r);});await field().fill('/partial');await field().press('Enter');assert.deepEqual(await target.locator('a').evaluateAll(nodes=>nodes.map(el=>el.getAttribute('href'))),['/updated#section','/partial','/updated#section']);assert.equal(await target.locator('a a').count(),0);await save();
 await edit();await select(target.locator('a').nth(1));await page.getByRole('button',{name:'Remove selected text link',exact:true}).click();assert.equal(await target.locator('a').count(),2);assert.equal(await target.locator('u').textContent(),original.slice(1,4));
 await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal(await target.locator('a').nth(1).getAttribute('href'),'/partial');await page.getByRole('button',{name:'Redo',exact:true}).click();assert.equal(await target.locator('a').count(),2);await save();
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 console.log('TEXT LINKS PASS '+kind+': selected link creation, retained underline, URL validation, saved href update, no nested anchors, removal, local and exact source undo/redo');
};
