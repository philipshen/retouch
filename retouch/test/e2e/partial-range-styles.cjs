'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),states=[read()],text=await target.textContent();
 const select=async(locator,from,to)=>locator.evaluate((el,{from,to})=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,from);r.setEnd(el.firstChild,to);const s=d.getSelection();s.removeAllRanges();s.addRange(r);},{from,to});
 const commit=async()=>{await page.keyboard.press('Enter');await wait(()=>read()!==states.at(-1));states.push(read());await settled();assert.equal(await target.textContent(),text);assert.equal(await target.locator('span span').count(),0);};
 const edit=async locator=>{await locator.click();await wait(async()=>await target.getAttribute('contenteditable')==='true');};
 const weight=value=>page.getByLabel('Selected text weight',{exact:true}).selectOption(value);
 await target.click({position:{x:12,y:18}});await wait(async()=>await target.getAttribute('contenteditable')==='true');await select(target,1,6);await weight('400');await commit();
 await edit(target.locator('span'));await select(target.locator('span'),1,4);await weight('700');
 assert.deepEqual(await target.locator('span').allTextContents(),[text.slice(1,2),text.slice(2,5),text.slice(5,6)]);
 assert.deepEqual(await target.locator('span').evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).fontWeight)),['400','700','400']);await commit();
 await edit(target.locator('span').nth(1));await select(target.locator('span').nth(1),0,3);await weight('400');
 assert.equal(await target.locator('span').count(),1);assert.equal(await target.locator('span').textContent(),text.slice(1,6));
 assert.equal(await target.evaluate(el=>el.ownerDocument.getSelection().toString()),text.slice(2,5));await commit();
 await edit(target.locator('span'));await select(target.locator('span'),1,4);await weight('700');await commit();
 assert.equal(await target.locator('span').count(),3);assert.equal((read().match(/<span\b/g)||[]).length,3);
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 console.log('PARTIAL RANGE STYLES PASS '+kind+': saved split, preserved outer styles, neighbor merge, retained text selection and exact undo/redo');
};
