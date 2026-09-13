'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const states=[read()];
 // Use the inspector's action-search reveal routing for renderer-specific placement.
 await page.getByLabel('HTML element',{exact:true}).evaluate(el=>window.RetouchInspectorUI.reveal(el));
 await page.getByLabel('HTML element',{exact:true}).selectOption('div');await settled();await wait(()=>read()!==states[0]);states.push(read());
 const target=app.locator('main > div.type-editorial');
 await target.click();await wait(async()=>await target.getAttribute('contenteditable')==='true');
 await target.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.selectNodeContents(el);const selection=d.getSelection();selection.removeAllRanges();selection.addRange(r);assertNative(d.execCommand('insertUnorderedList',false));function assertNative(ok){if(!ok)throw Error('Native list command failed');}});
 assert.equal(await target.locator('ul > li').innerText(),'Headline');
 await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await settled();await wait(()=>read()!==states.at(-1));states.push(read());
 assert.equal(await target.locator('ul > li').innerText(),'Headline');assert.ok(read().includes('<ul><li>Headline</li></ul>'));
 // Dispatch directly to the text-layer root: pointer hit-testing an item would
 // select the newly created child layer rather than the containing text layer.
 await target.dispatchEvent('dblclick');await wait(async()=>await target.getAttribute('contenteditable')==='true');
 await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await settled();assert.equal(read(),states.at(-1));
 for(let i=states.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[i]);}
 for(let i=1;i<states.length;i++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[i]);}
 for(let i=states.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[i]);}
 console.log('NATIVE LIST SOURCE PASS '+kind+': native list structure, save/reopen, exact source undo/redo');
};
