'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,target,read,wait,settled,states,kind})=>{
 const button=name=>page.getByRole('button',{name,exact:true});
 const open=async()=>{await target.dispatchEvent('dblclick');await wait(async()=>await target.getAttribute('contenteditable')==='true');};
 const save=async()=>{await button('Finish text editing').click();await settled();await wait(()=>read()!==states.at(-1));states.push(read());};
 const select=async(text,offset,end=offset)=>{await target.focus();await target.evaluate((el,[text,offset,end])=>{const d=el.ownerDocument,w=d.createTreeWalker(el,4);let n;while(n=w.nextNode())if(n.data===text)break;if(!n)throw Error('Missing text '+text);const r=d.createRange();r.setStart(n,offset);r.setEnd(n,end);d.getSelection().removeAllRanges();d.getSelection().addRange(r);},[text,offset,end]);};
 const items=()=>target.locator(':scope > ol > li').evaluateAll(nodes=>nodes.map(n=>n.textContent));
 await select('Headline',0,8);await page.keyboard.press('Control+b');
 const link=page.getByLabel('Selected text link',{exact:true});await link.fill('/before');await link.press('Tab');
 await page.getByLabel('Text layer list style',{exact:true}).selectOption('ol');await save();await open();
 await select('Headline',0,8);await link.fill('/after');await link.press('Tab');
 await select('Headline',4);const before=await target.innerHTML();await page.keyboard.press('Enter');const after=await target.innerHTML();
 assert.deepEqual(await items(),['Head','line']);assert.equal(await target.getAttribute('contenteditable'),'true');assert.equal(read(),states.at(-1));
 await button('Undo').click();assert.equal(await target.innerHTML(),before);await button('Redo').click();assert.equal(await target.innerHTML(),after);
 await save();await open();assert.deepEqual(await items(),['Head','line']);assert.deepEqual(await target.locator('a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href'))),['/after','/after']);
 await select('Head',2);await target.evaluate(el=>{const d=el.ownerDocument,w=d.createTreeWalker(el,4);let n;while(n=w.nextNode())if(n.data==='line')break;const r=d.getSelection().getRangeAt(0);r.setEnd(n,2);});
 const selectionBefore=await target.innerHTML();await page.keyboard.press('Enter');assert.deepEqual(await items(),['He','ne']);await button('Undo').click();assert.equal(await target.innerHTML(),selectionBefore);
 await select('line',4);await page.keyboard.press('Enter');await page.keyboard.insertText('Third');assert.deepEqual(await items(),['Head','line','Third']);assert.equal(await target.locator('a').filter({hasText:'Third'}).getAttribute('href'),'/after');
 await page.keyboard.press('Tab');assert.equal(await target.locator('ol ol > li').textContent(),'Third');
 await page.keyboard.press('Enter');assert.equal(await target.locator('ol ol > li').count(),2);await page.keyboard.press('Enter');
 assert.equal(await target.locator(':scope > ol > li').count(),3);assert.equal(await target.locator('ol ol > li').count(),1);
 await page.keyboard.press('Enter');assert.equal(await target.locator(':scope > p').count(),1);await page.keyboard.insertText('After list');await save();await open();
 assert.equal(await target.locator(':scope > p').textContent(),'After list');assert.equal(await target.locator('ol ol > li').textContent(),'Third');
 if(process.env.RT_E2E_LIST_ENTER_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_LIST_ENTER_SCREENSHOT});
 await button('Finish text editing').click();await settled();assert.equal(read(),states.at(-1));
 for(let i=states.length-2;i>=0;i--){await button('Undo').click();await settled();await wait(()=>read()===states[i]);}
 for(let i=1;i<states.length;i++){await button('Redo').click();await settled();await wait(()=>read()===states[i]);}
 for(let i=states.length-2;i>=0;i--){await button('Undo').click();await settled();await wait(()=>read()===states[i]);}
 console.log('LIST ENTER PASS '+kind+': split formatted source item, continue numbering, empty-item outdent and exit, save/reopen, grouped local and exact source history');
};
