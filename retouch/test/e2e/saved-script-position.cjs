'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),states=[read()],text=await target.textContent();
 const edit=async()=>{await target.click({position:{x:12,y:18}});await wait(async()=>await target.getAttribute('contenteditable')==='true');};
 const select=async(selector,start,end)=>{await (selector?target.locator(selector):target).evaluate((el,{start,end})=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,start);r.setEnd(el.firstChild,end);const s=d.getSelection();s.removeAllRanges();s.addRange(r);},{start,end});};
 const commit=async()=>{await page.keyboard.press('Enter');await wait(()=>read()!==states.at(-1));states.push(read());await settled();assert.equal(await target.textContent(),text);};
 await edit();await select(null,1,4);await page.getByRole('button',{name:'Superscript selected text',exact:true}).click();await commit();await wait(async()=>await target.locator('sup').count()===1);
 await edit();
 // Source-owned attributes and component/binding identities must not be dropped.
 for(const [name,value] of [['class','authored-script'],['data-rt-i','1234567890'],['data-rt-origin','dynamic-binding']]){
  const script=target.locator('sup');
  await script.evaluate((el,{name,value})=>el.setAttribute(name,value),{name,value});
  await select('sup',1,2);
  const before=await target.innerHTML();
  await page.getByRole('button',{name:'Subscript selected text',exact:true}).click();
  assert.equal(await target.innerHTML(),before);assert.equal(read(),states.at(-1));
  await script.evaluate((el,name)=>el.removeAttribute(name),name);
 }
 await select('sup',1,2);await page.getByRole('button',{name:'Subscript selected text',exact:true}).click();assert.deepEqual(await target.locator('sup').allTextContents(),[text.slice(1,2),text.slice(3,4)]);await commit();await wait(async()=>await target.locator('sup').count()===2&&await target.locator('sub').count()===1);
 await edit();await select('sub',0,1);await page.getByRole('button',{name:'Subscript selected text',exact:true}).click();assert.equal(await target.locator('sub').count(),0);await commit();await wait(async()=>await target.locator('sub').count()===0&&await target.locator('sup').count()===2);
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 console.log('SAVED SCRIPT FORMATTING PASS '+kind+': reopen, partial switch, toggle off, protected attributes, unchanged surrounding text and exact undo/redo');
};
