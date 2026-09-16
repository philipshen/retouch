'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,target,read,wait,settled,states,kind})=>{
 const button=name=>page.getByRole('button',{name,exact:true}),field=page.getByLabel('List inset (px)',{exact:true});
 const choose=async text=>{await target.focus();await target.evaluate((el,text)=>{const d=el.ownerDocument,w=d.createTreeWalker(el,4);let n;while(n=w.nextNode())if(n.data===text){const r=d.createRange();r.setStart(n,0);r.collapse(true);d.getSelection().removeAllRanges();d.getSelection().addRange(r);return;}throw Error('Missing text '+text);},text);await wait(()=>field.isEnabled());};
 const change=async value=>{await field.fill(String(value));await field.press('Enter');};
 const save=async()=>{await button('Finish text editing').click();await settled();await wait(()=>read()!==states.at(-1));states.push(read());await target.dispatchEvent('dblclick');await wait(async()=>await target.getAttribute('contenteditable')==='true');};
 const inset=async selector=>target.locator(selector).evaluate(n=>parseFloat(n.ownerDocument.defaultView.getComputedStyle(n).paddingInlineStart));
 await target.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.selectNodeContents(el);d.getSelection().removeAllRanges();d.getSelection().addRange(r);});await page.keyboard.insertText('Alpha');await page.keyboard.press('Shift+Enter');await page.keyboard.insertText('Beta');await page.keyboard.press('Shift+Enter');await page.keyboard.insertText('Gamma');await page.getByLabel('Text layer list style',{exact:true}).selectOption('ol');await choose('Alpha');await page.getByLabel('List start number',{exact:true}).fill('100');await page.getByLabel('List start number',{exact:true}).press('Enter');
 const before=await target.innerHTML();await change(160);assert.equal(await inset(':scope > ol'),160);const after=await target.innerHTML();await button('Undo').click();assert.equal(await target.innerHTML(),before);await button('Redo').click();assert.equal(await target.innerHTML(),after);await save();assert.equal(await inset(':scope > ol'),160);
 // Geometry must be real page geometry after a source round trip, not editor-only CSS.
 const geometry=await target.locator(':scope > ol').evaluate(list=>{const d=list.ownerDocument,r=d.createRange();r.selectNodeContents(list.firstElementChild);return {left:list.getBoundingClientRect().left,text:r.getBoundingClientRect().left};});assert.ok(Math.abs(geometry.text-geometry.left-160)<1);
 await choose('Gamma');await button('Increase list indentation').click();await choose('Gamma');await change(24.5);assert.equal(await inset(':scope > ol'),160);assert.equal(await inset('ol ol'),24.5);await save();assert.equal(await inset('ol ol'),24.5);
 await choose('Alpha');await change(0);assert.equal(await inset(':scope > ol'),0);assert.equal(await inset('ol ol'),24.5);await save();assert.equal(await inset(':scope > ol'),0);
 await choose('Alpha');await change(-1);assert.equal(await inset(':scope > ol'),0);await change(160);const edited=await target.innerHTML();await button('Undo').click();assert.equal(await inset(':scope > ol'),0);await button('Redo').click();assert.equal(await target.innerHTML(),edited);await save();assert.equal(await inset(':scope > ol'),160);
 await choose('Alpha');
 if(process.env.RT_E2E_LIST_INSET_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_LIST_INSET_SCREENSHOT,caret:'initial'});
 await button('Finish text editing').click();await settled();assert.equal(read(),states.at(-1));
 for(let i=states.length-2;i>=0;i--){await button('Undo').click();await settled();await wait(()=>read()===states[i]);}
 for(let i=1;i<states.length;i++){await button('Redo').click();await settled();await wait(()=>read()===states[i]);}
 console.log('LIST INSET PASS '+kind+': wide counters, page geometry, nested independent insets, zero hanging inset, invalid-value guard, local history, save/reopen and exact source undo/redo');
};
