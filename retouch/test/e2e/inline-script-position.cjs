'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),original=read(),text=await target.textContent();
 for(const [tag,label]of [['sup','Superscript selected text'],['sub','Subscript selected text']]){
  await target.click();await wait(async()=>await target.getAttribute('contenteditable')==='true');
  await target.evaluate(el=>{const r=el.ownerDocument.createRange();r.setStart(el.firstChild,1);r.setEnd(el.firstChild,4);const s=el.ownerDocument.getSelection();s.removeAllRanges();s.addRange(r);});
  const toolbar=page.getByRole('toolbar',{name:'Selected text formatting'});await toolbar.waitFor();await page.getByRole('button',{name:label,exact:true}).click();assert.equal(await target.locator(tag).textContent(),text.slice(1,4));assert.equal(read(),original);
  const opposite=tag==='sup'?'Subscript selected text':'Superscript selected text';await page.getByRole('button',{name:opposite,exact:true}).click();assert.equal(await target.locator(tag==='sup'?'sub':'sup').textContent(),text.slice(1,4));await page.getByRole('button',{name:label,exact:true}).click();assert.equal(await target.locator(tag).textContent(),text.slice(1,4));assert.equal(await target.locator('sup sub,sub sup').count(),0);
  assert.equal(await target.locator(tag).evaluate(el=>parseFloat(getComputedStyle(el).fontSize)<parseFloat(getComputedStyle(el.parentElement).fontSize)),true);
  if(process.env.RT_E2E_INLINE_SCRIPT_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_INLINE_SCRIPT_SCREENSHOT});
  await page.keyboard.press('Enter');await wait(()=>read()!==original);await settled();try{await wait(async()=>await target.locator(tag).count()===1);}catch(error){console.log('INLINE DIAGNOSTIC',JSON.stringify({source:read(),html:await target.evaluate(el=>el.outerHTML)}));throw error;}assert.equal(await target.textContent(),text);assert.equal(await toolbar.count(),0);const changed=read();
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);await wait(async()=>await target.locator(tag).count()===0);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===changed);await wait(async()=>await target.locator(tag).count()===1);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);await wait(async()=>await target.locator(tag).count()===0);
 }

 await target.click();await wait(async()=>await target.getAttribute('contenteditable')==='true');await target.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,1);r.setEnd(el.firstChild,4);const s=d.getSelection();s.removeAllRanges();s.addRange(r);});await page.getByRole('button',{name:'Superscript selected text',exact:true}).click();
 await target.locator('sup').evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,1);r.setEnd(el.firstChild,2);const s=d.getSelection();s.removeAllRanges();s.addRange(r);});await page.getByRole('button',{name:'Subscript selected text',exact:true}).click();assert.deepEqual(await target.locator('sup').allTextContents(),[text.slice(1,2),text.slice(3,4)]);assert.equal(await target.locator('sub').textContent(),text.slice(2,3));await page.getByRole('button',{name:'Subscript selected text',exact:true}).click();assert.equal(await target.locator('sub').count(),0);await page.getByRole('button',{name:'Subscript selected text',exact:true}).click();assert.equal(await target.textContent(),text);
 await page.keyboard.press('Enter');await wait(()=>read()!==original);await settled();await wait(async()=>await target.locator('sup').count()===2&&await target.locator('sub').count()===1);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
 console.log('INLINE SCRIPT POSITION PASS '+kind+': selected range, smaller glyphs, text preservation, toolbar cleanup and exact undo/redo');
};
