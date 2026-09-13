'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),states=[read()],text=await target.textContent(),size=()=>page.getByLabel('Selected text size (px)',{exact:true});
 const select=async(locator,from,to)=>locator.evaluate((el,{from,to})=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,from);r.setEnd(el.firstChild,to);const s=d.getSelection();s.removeAllRanges();s.addRange(r);},{from,to});
 const save=async value=>{await size().fill(value);await size().press('Enter');await wait(()=>read()!==states.at(-1));states.push(read());await settled();assert.equal(await target.textContent(),text);};
 const edit=async(locator,from,to)=>{await locator.click();await wait(async()=>await target.getAttribute('contenteditable')==='true');await select(locator,from,to);};
 const originalSize=await target.evaluate(el=>getComputedStyle(el).fontSize);
 await target.click({position:{x:12,y:18}});await wait(async()=>await target.getAttribute('contenteditable')==='true');await select(target,1,4);
 await size().fill('64');await size().press('Escape');assert.equal(read(),states[0]);assert.equal(await target.locator('span').count(),0);
 for(const invalid of ['-1','1001']){await size().fill(invalid);await size().press('Enter');assert.equal(await size().getAttribute('aria-invalid'),'true');assert.equal(read(),states[0]);assert.equal(await target.locator('span').count(),0);}
 await save('24.5');assert.equal(await target.locator('span').evaluate(el=>getComputedStyle(el).fontSize),'24.5px');assert.equal(await target.evaluate(el=>getComputedStyle(el).fontSize),originalSize);
 await edit(target.locator('span'),0,3);await wait(async()=>await size().inputValue()==='24.5');await save('48');assert.equal(await target.locator('span').count(),1);
 await edit(target.locator('span'),1,2);await save('24');assert.equal(await target.locator('span span').count(),0);
 assert.deepEqual(await target.locator('span').allTextContents(),[text.slice(1,2),text.slice(2,3),text.slice(3,4)]);
 assert.deepEqual(await target.locator('span').evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).fontSize)),['48px','24px','48px']);
 await edit(target.locator('span').nth(1),0,1);await save('48');assert.equal(await target.locator('span').count(),1);assert.equal((read().match(/<span\b/g)||[]).length,1);
 await edit(target.locator('span'),0,3);await size().fill('36');await page.getByLabel('Selected text weight',{exact:true}).focus();
 assert.equal(read(),states.at(-1));assert.equal(await target.getAttribute('contenteditable'),'true');
 await page.locator('#routeInput').focus();await wait(()=>read()!==states.at(-1));states.push(read());await settled();assert.equal(await target.locator('span').evaluate(el=>getComputedStyle(el).fontSize),'36px');
 if(process.env.RT_E2E_RANGE_SIZE_SCREENSHOT){await edit(target.locator('span'),0,3);await page.screenshot({path:process.env.RT_E2E_RANGE_SIZE_SCREENSHOT});await page.keyboard.press('Escape');await settled();}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 console.log('TEXT RANGE SIZE PASS '+kind+': cancel/invalid preservation, decimal pixels, Enter/blur save, toolbar focus retention, reuse, partial split/merge and exact undo/redo');
};
