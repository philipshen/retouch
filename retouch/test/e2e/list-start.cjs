'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,target,read,wait,settled,states,kind})=>{
 const button=name=>page.getByRole('button',{name,exact:true}),field=page.getByLabel('List start number',{exact:true}),style=page.getByLabel('Text layer list style',{exact:true});
 const choose=async index=>{await target.focus();await target.locator('li').nth(index).evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.selectNodeContents(el);r.collapse(true);d.getSelection().removeAllRanges();d.getSelection().addRange(r);});await wait(()=>field.isEnabled());};
 const save=async()=>{await button('Finish text editing').click();await settled();await wait(()=>read()!==states.at(-1));states.push(read());};
 const open=async()=>{await target.dispatchEvent('dblclick');await wait(async()=>await target.getAttribute('contenteditable')==='true');};
 await target.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,4);r.collapse(true);d.getSelection().removeAllRanges();d.getSelection().addRange(r);});await page.keyboard.press('Shift+Enter');
 await target.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.selectNodeContents(el);d.getSelection().removeAllRanges();d.getSelection().addRange(r);});await style.selectOption('ol');await save();await open();await choose(1);assert.equal(await field.inputValue(),'1');
 const before=await target.innerHTML();await field.fill('7');await field.press('Enter');assert.equal(await target.locator('ol').getAttribute('start'),'7');assert.equal(read(),states.at(-1));const changed=await target.innerHTML();await button('Undo').click();assert.equal(await target.innerHTML(),before);await button('Redo').click();assert.equal(await target.innerHTML(),changed);await save();assert.match(read(),/start="7"/);
 await open();await choose(1);assert.equal(await field.inputValue(),'7');await field.fill('1.5');assert.equal(await field.evaluate(el=>el.validity.stepMismatch),true);await field.press('Enter');assert.equal(await target.locator('ol').getAttribute('start'),'7');assert.equal(read(),states.at(-1));
 await choose(1);await button('Increase list indentation').click();await choose(1);await field.fill('5');await field.press('Enter');assert.equal(await target.locator(':scope > ol').getAttribute('start'),'7');assert.equal(await target.locator('ol ol').getAttribute('start'),'5');await save();
 await open();await choose(1);assert.equal(await field.inputValue(),'5');assert.equal(await target.textContent(),'Headline');
 if(process.env.RT_E2E_LIST_START_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_LIST_START_SCREENSHOT,caret:'initial'});
 await style.selectOption('ul');await wait(()=>field.isDisabled());await button('Undo').click();await button('Finish text editing').click();await settled();assert.equal(read(),states.at(-1));
 for(let i=states.length-2;i>=0;i--){await button('Undo').click();await settled();await wait(()=>read()===states[i]);}
 for(let i=1;i<states.length;i++){await button('Redo').click();await settled();await wait(()=>read()===states[i]);}
 for(let i=states.length-2;i>=0;i--){await button('Undo').click();await settled();await wait(()=>read()===states[i]);}
 console.log('LIST START PASS '+kind+': selected list numbering, nested isolation, validation, local history, save/reopen and exact source undo/redo');
};
