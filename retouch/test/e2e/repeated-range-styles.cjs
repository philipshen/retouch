'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),states=[read()],text=await target.textContent();
 const select=async(locator,from,to)=>locator.evaluate((el,{from,to})=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,from);r.setEnd(el.firstChild,to);const s=d.getSelection();s.removeAllRanges();s.addRange(r);},{from,to});
 await target.click({position:{x:12,y:18}});await wait(async()=>await target.getAttribute('contenteditable')==='true');await select(target,1,4);
 for(let index=0;index<10;index++){
  if(index){await target.locator('span').click();await wait(async()=>await target.getAttribute('contenteditable')==='true');await select(target.locator('span'),0,3);}
  const value=index%2?'700':'400';await page.getByLabel('Selected text weight',{exact:true}).selectOption(value);
  assert.equal(await target.locator('span').count(),1);
  await page.keyboard.press('Enter');await wait(()=>read()!==states.at(-1));states.push(read());await settled();
  assert.equal(await target.locator('span').count(),1);assert.equal(await target.textContent(),text);
  assert.equal(await target.locator('span').evaluate(el=>getComputedStyle(el).fontWeight),value);
  assert.equal((read().match(/<span\b/g)||[]).length,1);
 }
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 console.log('REPEATED RANGE STYLES PASS '+kind+': ten saved weight changes, direct text-run reentry, one source wrapper, exact undo/redo');
};
