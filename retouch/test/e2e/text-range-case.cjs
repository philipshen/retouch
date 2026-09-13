'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),original=await target.textContent(),states=[read()];
 const field=name=>page.getByLabel('Selected text '+name,{exact:true});
 const edit=async(locator,from=0,to=3)=>{await locator.click();await wait(async()=>await target.getAttribute('contenteditable')==='true');await locator.evaluate((el,{from,to})=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,from);r.setEnd(el.firstChild,to);const selection=d.getSelection();selection.removeAllRanges();selection.addRange(r);},{from,to});};
 const save=async(name,value)=>{await field(name).selectOption(value);assert.equal(read(),states.at(-1),'a style draft must not commit source before Done');await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await wait(()=>read()!==states.at(-1));states.push(read());await settled();assert.equal(await target.textContent(),original,'case must not rewrite the copy');};
 await edit(target,1,4);await save('case','uppercase');assert.equal(await target.innerText(),'HEADline');assert.equal(await target.locator('span').count(),1);
 await edit(target.locator('span'));await wait(async()=>await field('case').inputValue()==='uppercase');await save('case','lowercase');assert.equal(await target.innerText(),original);
 await edit(target.locator('span'));await save('case','none');assert.equal(await target.innerText(),original);
 await edit(target.locator('span'));await save('caps','small-caps');assert.equal(await target.locator('span').count(),1);assert.equal(await target.locator('span').evaluate(el=>getComputedStyle(el).fontVariantCaps),'small-caps');
 await edit(target.locator('span'));await wait(async()=>await field('caps').inputValue()==='small-caps');await save('caps','all-small-caps');assert.equal(await target.locator('span').evaluate(el=>getComputedStyle(el).fontVariantCaps),'all-small-caps');
 await edit(target.locator('span'),1,2);await save('case','uppercase');assert.equal(await target.locator('span').count(),3);assert.equal(await target.innerText(),'HeAdline');for(const span of await target.locator('span').all())assert.equal(await span.evaluate(el=>getComputedStyle(el).fontVariantCaps),'all-small-caps');
 await edit(target.locator('span').nth(1),0,1);await save('case','none');assert.equal(await target.locator('span').count(),1);
 await edit(target.locator('span'));await save('caps','normal');assert.equal(await target.locator('span').evaluate(el=>getComputedStyle(el).fontVariantCaps),'normal');
 // Capitalization is a browser text transform, including word-boundary behavior.
 await edit(target.locator('span'));await save('case','capitalize');assert.equal(await target.locator('span').evaluate(el=>getComputedStyle(el).textTransform),'capitalize');
 if(process.env.RT_E2E_RANGE_CASE_SCREENSHOT){await edit(target.locator('span'));await page.screenshot({path:process.env.RT_E2E_RANGE_CASE_SCREENSHOT});await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await settled();}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 console.log('TEXT RANGE CASE PASS '+kind+': original copy retained, rendered upper/lowercase, small caps, saved values, partial split/merge, Done and exact undo/redo');
};
