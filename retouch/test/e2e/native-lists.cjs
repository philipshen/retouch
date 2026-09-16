'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const states=[read()];
 // Use the inspector's action-search reveal routing for renderer-specific placement.
 await page.getByLabel('HTML element',{exact:true}).evaluate(el=>window.RetouchInspectorUI.reveal(el));
 await page.getByLabel('HTML element',{exact:true}).selectOption('div');await settled();await wait(()=>read()!==states[0]);states.push(read());
 assert.equal(await page.getByText('The page structure changed. Select the layer again.',{exact:true}).count(),0);
 const target=app.locator('main > div.type-editorial');
 await target.click();await wait(async()=>await target.getAttribute('contenteditable')==='true');
 const typography=page.locator('#panelBody > [data-section=typography]');assert.equal(await typography.count(),1,'active DIV text editing has a primary Typography section');assert.equal(await typography.locator('[aria-label="Finish text editing"]').count(),1);assert.equal(await page.locator('.inspector-more [data-range-editing]').count(),0);
 if(process.env.RT_E2E_LIST_START){await require('./list-start.cjs')({page,target,read,wait,settled,states,kind});return;}
 if(process.env.RT_E2E_LIST_PREFIX){await require('./list-prefix.cjs')({page,target,read,wait,settled,states,kind});return;}
 if(process.env.RT_E2E_LIST_JOIN){await require('./list-join.cjs')({page,target,read,wait,settled,states,kind});return;}
 if(process.env.RT_E2E_LIST_BACKSPACE){await require('./list-backspace.cjs')({page,target,read,wait,settled,states,kind});return;}
 if(process.env.RT_E2E_LIST_ENTER){await require('./list-enter.cjs')({page,target,read,wait,settled,states,kind});return;}
 if(process.env.RT_E2E_LIST_INDENT){await require('./list-indentation.cjs')({page,target,read,wait,settled,states,kind});return;}
 if(process.env.RT_E2E_LIST_CONTROLS){await require('./list-controls.cjs')({page,target,read,wait,settled,states,kind});return;}
 await target.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.selectNodeContents(el);const selection=d.getSelection();selection.removeAllRanges();selection.addRange(r);assertNative(d.execCommand('insertUnorderedList',false));function assertNative(ok){if(!ok)throw Error('Native list command failed');}});
 assert.equal(await target.locator('ul > li').innerText(),'Headline');
 await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await settled();await wait(()=>read()!==states.at(-1));states.push(read());
 assert.equal(await target.locator('ul > li').innerText(),'Headline');assert.match(read(),/<ul[^>]*><li>Headline<\/li><\/ul>/);
 // Reopen the text layer after saving the native list structure.
 await target.dispatchEvent('dblclick');await wait(async()=>await target.getAttribute('contenteditable')==='true');
 await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await settled();assert.equal(read(),states.at(-1));
 for(let i=states.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[i]);}
 for(let i=1;i<states.length;i++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[i]);}
 for(let i=states.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[i]);}
 console.log('NATIVE LIST SOURCE PASS '+kind+': native list structure, save/reopen, exact source undo/redo');
};
