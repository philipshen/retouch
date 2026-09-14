'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,target,read,wait,settled,states,kind})=>{
 const button=name=>page.getByRole('button',{name,exact:true}),field=page.getByLabel('Text layer list style',{exact:true});
 const open=async()=>{await target.dispatchEvent('dblclick');await wait(async()=>await target.getAttribute('contenteditable')==='true');};
 const save=async()=>{await button('Finish text editing').click();await settled();await wait(()=>read()!==states.at(-1));states.push(read());};
 const choose=async(text,offset=0)=>{await target.focus();await target.evaluate((el,[text,offset])=>{const d=el.ownerDocument,w=d.createTreeWalker(el,4);let n;while(n=w.nextNode())if(n.data===text)break;if(!n)throw Error('Missing '+text);const r=d.createRange();r.setStart(n,offset);r.collapse(true);d.getSelection().removeAllRanges();d.getSelection().addRange(r);},[text,offset]);};
 const geometry=()=>target.evaluate(el=>{const d=el.ownerDocument,w=d.createTreeWalker(el,4),out={};for(let n;n=w.nextNode();)if(n.data.trim()){const r=d.createRange();r.selectNodeContents(n);const b=r.getBoundingClientRect();out[n.data]={x:b.x,y:b.y};}return out;});
 await choose('Headline',4);await page.keyboard.press('Shift+Enter');await field.selectOption('ol');await save();await open();await choose('line');await page.keyboard.press('Tab');await save();await open();await choose('line');
 const before=await target.innerHTML(),positions=await geometry();
 await page.keyboard.down('Backspace');await page.keyboard.down('Backspace');await page.keyboard.down('Backspace');await page.keyboard.up('Backspace');
 const removed=await target.innerHTML();assert.notEqual(removed,before);assert.equal(await target.textContent(),'Headline');assert.deepEqual(await geometry(),positions);
 assert.equal(await target.locator('ol ol > li').evaluate(n=>getComputedStyle(n).listStyleType),'none');assert.equal(read(),states.at(-1));
 await button('Undo').click();assert.equal(await target.innerHTML(),before);await button('Redo').click();assert.equal(await target.innerHTML(),removed);
 await save();await open();assert.equal(await target.locator('ol ol > li').evaluate(n=>getComputedStyle(n).listStyleType),'none');assert.deepEqual(await geometry(),positions);
 await choose('line');await field.selectOption('ol');assert.equal(await target.locator('ol ol > li').evaluate(n=>getComputedStyle(n).listStyleType),'lower-alpha');await save();await open();
 // Ordinary character deletion inside an item remains native and grouped.
 await choose('line',4);const textBefore=await target.innerHTML();await page.keyboard.down('Backspace');await page.keyboard.down('Backspace');await page.keyboard.up('Backspace');assert.equal(await target.textContent(),'Headli');await button('Undo').click();assert.equal(await target.innerHTML(),textBefore);
 await choose('Head');assert.equal(await target.evaluate(el=>el.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentBackward',bubbles:true,cancelable:true}))),false);assert.equal(await target.locator(':scope > ol > li').evaluate(n=>getComputedStyle(n).listStyleType),'none');await save();await open();
 if(process.env.RT_E2E_LIST_BACKSPACE_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_LIST_BACKSPACE_SCREENSHOT});
 await button('Finish text editing').click();await settled();assert.equal(read(),states.at(-1));
 for(let i=states.length-2;i>=0;i--){await button('Undo').click();await settled();await wait(()=>read()===states[i]);}
 for(let i=1;i<states.length;i++){await button('Redo').click();await settled();await wait(()=>read()===states[i]);}
 for(let i=states.length-2;i>=0;i--){await button('Undo').click();await settled();await wait(()=>read()===states[i]);}
 console.log('LIST BACKSPACE PASS '+kind+': nested and first-item marker removal, unchanged geometry, held-key grouping, ordinary deletion, marker restoration, save/reopen and exact source history');
};
