'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,target,read,wait,settled,states,kind})=>{
 await target.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,4);r.collapse(true);d.getSelection().removeAllRanges();d.getSelection().addRange(r);});
 await page.keyboard.press('Shift+Enter');
 const initialHeight=(await target.boundingBox()).height;
 const field=page.getByLabel('Text layer list style',{exact:true}),button=name=>page.getByRole('button',{name,exact:true});
 const selectAll=()=>target.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.selectNodeContents(el);d.getSelection().removeAllRanges();d.getSelection().addRange(r);});
 const open=async()=>{await target.dispatchEvent('dblclick');await wait(async()=>await target.getAttribute('contenteditable')==='true');await selectAll();};
 const save=async()=>{await button('Finish text editing').click();await settled();await wait(()=>read()!==states.at(-1));states.push(read());};
 await selectAll();const before=await target.innerHTML();await field.selectOption('ul');const bullet=await target.innerHTML();assert.notEqual(bullet,before);assert.equal(read(),states.at(-1));
 assert.equal(await target.locator('ul').evaluate(el=>getComputedStyle(el).listStyleType),'disc');
 await button('Undo').click();assert.equal(await target.innerHTML(),before);assert.equal(await target.getAttribute('contenteditable'),'true');
 await button('Redo').click();assert.equal(await target.innerHTML(),bullet);
 await target.focus();await selectAll();await page.keyboard.press('Control+Shift+7');assert.deepEqual(await target.locator('ol > li').allTextContents(),['Head','line']);
 await button('Undo').click();assert.equal(await target.innerHTML(),bullet);
 await page.keyboard.press('Control+Shift+8');assert.equal(await target.innerHTML(),bullet,'Reapplying list style must not change source evidence');
 await save();assert.equal(await target.locator('ul').evaluate(el=>getComputedStyle(el).listStyleType),'disc');
 await open();await field.selectOption('ol');await save();assert.equal(await target.locator('ol').evaluate(el=>getComputedStyle(el).listStyleType),'decimal');
 await open();await field.selectOption('none');await save();assert.equal(await target.locator('ul,ol,li').count(),0);assert.equal(await target.textContent(),'Headline');assert.ok(Math.abs((await target.boundingBox()).height-initialHeight)<1,'Removing list markers must not add blank lines');
 await open();await field.selectOption('ul');await save();assert.deepEqual(await target.locator('ul > li').allTextContents(),['Head','line']);assert.equal(await target.locator('ul').evaluate(el=>getComputedStyle(el).listStyleType),'disc');
 await open();
 if(process.env.RT_E2E_LIST_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_LIST_SCREENSHOT});
 await button('Finish text editing').click();await settled();assert.equal(read(),states.at(-1));
 for(let i=states.length-2;i>=0;i--){await button('Undo').click();await settled();await wait(()=>read()===states[i]);}
 for(let i=1;i<states.length;i++){await button('Redo').click();await settled();await wait(()=>read()===states[i]);}
 for(let i=states.length-2;i>=0;i--){await button('Undo').click();await settled();await wait(()=>read()===states[i]);}
 console.log('LIST CONTROLS PASS '+kind+': bullets/numbers/none, marker styles, shortcut, grouped local history, save/reopen/conversion and exact source undo/redo');
};
