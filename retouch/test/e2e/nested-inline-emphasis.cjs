'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),original=read(),text=await target.textContent();
 const edit=async()=>{await target.click({position:{x:12,y:18}});await wait(async()=>await target.getAttribute('contenteditable')==='true');};
 const select=async(locator,start,end)=>locator.evaluate((el,{start,end})=>{
  const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,start);r.setEnd(el.firstChild,end);
  const s=d.getSelection();s.removeAllRanges();s.addRange(r);
 },{start,end});
 for(const [outer,inner,outerLabel,innerLabel] of [['strong','em','Bold selected text','Italic selected text'],['em','strong','Italic selected text','Bold selected text']]){
  const states=[original];
  const click=label=>page.getByRole('button',{name:label,exact:true}).click();
  const commit=async()=>{await page.keyboard.press('Enter');await wait(()=>read()!==states.at(-1));states.push(read());await settled();assert.equal(await target.textContent(),text);};
  await edit();await select(target,1,6);await click(outerLabel);
  await select(target.locator(outer),1,4);await click(innerLabel);await commit();
  await wait(async()=>await target.locator(outer+' '+inner).count()===1);
  await edit();await select(target.locator(inner),1,2);await click(outerLabel);
  assert.deepEqual(await target.locator(outer).allTextContents(),[text.slice(1,3),text.slice(4,6)]);
  assert.deepEqual(await target.locator(inner).allTextContents(),[text.slice(2,3),text.slice(3,4),text.slice(4,5)]);
  assert.equal(await target.locator(inner).nth(1).evaluate((el,outer)=>!!el.closest(outer),outer),false);
  await commit();await wait(async()=>await target.locator(inner).count()===3);
  await edit();await select(target.locator(inner).nth(1),0,1);await click(innerLabel);
  assert.equal(await target.locator(inner).count(),2);await commit();
  for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
  for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
  for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 }
 console.log('NESTED INLINE EMPHASIS PASS '+kind+': saved nested ranges, independent bold/italic removal, surrounding text and exact undo/redo');
};
