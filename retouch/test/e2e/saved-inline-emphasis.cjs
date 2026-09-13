'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),original=read(),text=await target.textContent();
 const edit=async()=>{await target.click({position:{x:12,y:18}});await wait(async()=>await target.getAttribute('contenteditable')==='true');};
 const select=async(locator,start,end)=>locator.evaluate((el,{start,end})=>{
  const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,start);r.setEnd(el.firstChild,end);
  const s=d.getSelection();s.removeAllRanges();s.addRange(r);
 },{start,end});
 for(const [tag,label,key] of [['strong','Bold selected text','b'],['em','Italic selected text','i']]){
  const states=[original],button=page.getByRole('button',{name:label,exact:true});
  const commit=async()=>{await page.keyboard.press('Enter');await wait(()=>read()!==states.at(-1));states.push(read());await settled();assert.equal(await target.textContent(),text);};
  await edit();await select(target,1,4);await button.click();
  // A partial toggle before saving must preserve both unselected sides.
  await select(target.locator(tag),1,2);await button.click();
  assert.deepEqual(await target.locator(tag).allTextContents(),[text.slice(1,2),text.slice(3,4)]);
  await button.click();assert.deepEqual(await target.locator(tag).allTextContents(),[text.slice(1,2),text.slice(2,3),text.slice(3,4)]);
  await commit();await wait(async()=>await target.locator(tag).count()===3);
  await edit();await select(target.locator(tag).nth(1),0,1);
  // Exercise the same path through the existing keyboard shortcut after reopen.
  await page.keyboard.press('ControlOrMeta+'+key);
  assert.deepEqual(await target.locator(tag).allTextContents(),[text.slice(1,2),text.slice(3,4)]);
  await commit();await wait(async()=>await target.locator(tag).count()===2);
  for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
  for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
  for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 }
 console.log('SAVED INLINE EMPHASIS PASS '+kind+': partial bold/italic, reopen, keyboard toggle, surrounding text and exact undo/redo');
};
