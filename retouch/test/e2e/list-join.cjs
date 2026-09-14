'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,target,read,wait,settled,states,kind})=>{
 const button=name=>page.getByRole('button',{name,exact:true}),items=()=>target.locator(':scope > ol > li').count();
 const open=async()=>{assert.equal(await page.locator('#panelBody > [data-section=typography]').count(),1,'saved text-only lists keep Typography primary');await target.locator('a').filter({hasText:/\S/}).first().click();await wait(async()=>await target.getAttribute('contenteditable')==='true');};
 const save=async()=>{await button('Finish text editing').click();await settled();await wait(()=>read()!==states.at(-1));states.push(read());};
 const select=async(text,offset,end=offset)=>{await target.focus();await target.evaluate((el,[text,offset,end])=>{const d=el.ownerDocument,w=d.createTreeWalker(el,4);let n;while(n=w.nextNode())if(n.data===text)break;if(!n)throw Error('Missing '+text);const range=d.createRange();range.setStart(n,offset);range.setEnd(n,end);d.getSelection().removeAllRanges();d.getSelection().addRange(range);},[text,offset,end]);};
 await select('Headline',0,8);const link=page.getByLabel('Selected text link',{exact:true});await link.fill('/kept');await link.press('Tab');await page.getByLabel('Text layer list style',{exact:true}).selectOption('ol');await save();await open();
 // New split copies can join before either half has been written to source.
 await select('Headline',4);await page.keyboard.press('Enter');await select('Head',4);const split=await target.innerHTML();await page.keyboard.press('Delete');assert.equal(await items(),1);assert.equal(await target.textContent(),'Headline');await button('Undo').click();assert.equal(await target.innerHTML(),split);await save();await open();
 // Backspace first removes the marker, then a separate press joins the text.
 await select('line',0);await page.keyboard.press('Backspace');assert.equal(await items(),2);assert.equal(await target.locator(':scope > ol > li').nth(1).evaluate(el=>getComputedStyle(el).listStyleType),'none');await save();await open();
 await select('line',0);const before=await target.innerHTML();await page.keyboard.press('Backspace');assert.equal(await items(),1);assert.equal(await target.textContent(),'Headline');const joined=await target.innerHTML();await button('Undo').click();assert.equal(await target.innerHTML(),before);await button('Redo').click();assert.equal(await target.innerHTML(),joined);await save();await open();assert.equal(await items(),1);assert.deepEqual(await target.locator('a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href'))),['/kept','/kept']);
 // Forward deletion and beforeinput follow the same explicit source path.
 await select('line',0);await page.keyboard.press('Enter');await save();await open();await select('Head',4);assert.equal(await target.evaluate(el=>el.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentForward',bubbles:true,cancelable:true}))),false);assert.equal(await items(),1);await save();await open();
 // A held deletion joins and removes subsequent characters as one undo group.
 await select('line',0);await page.keyboard.press('Enter');await select('line',0);await page.keyboard.press('Backspace');const held=await target.innerHTML();await page.keyboard.down('Backspace');await page.keyboard.down('Backspace');await page.keyboard.up('Backspace');assert.equal(await items(),1);await button('Undo').click();assert.equal(await target.innerHTML(),held);await select('line',0);await page.keyboard.press('Backspace');
 await button('Finish text editing').click();await settled();if(read()!==states.at(-1))states.push(read());await open();assert.equal(await items(),1);assert.equal(await target.textContent(),'Headline');
 if(process.env.RT_E2E_LIST_JOIN_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_LIST_JOIN_SCREENSHOT});await button('Finish text editing').click();await settled();assert.equal(read(),states.at(-1));
 for(let i=states.length-2;i>=0;i--){await button('Undo').click();await settled();await wait(()=>read()===states[i]);}
 for(let i=1;i<states.length;i++){await button('Redo').click();await settled();await wait(()=>read()===states[i]);}
 for(let i=states.length-2;i>=0;i--){await button('Undo').click();await settled();await wait(()=>read()===states[i]);}
 console.log('LIST JOIN PASS '+kind+': new/saved items, marker-then-Backspace, Delete, beforeinput, links, held deletion undo, pointer reopening and exact source history');
};
