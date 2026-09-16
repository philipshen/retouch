'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('#native-copy'),states=[read()],button=name=>page.getByRole('button',{name,exact:true});
 const open=async()=>{await target.dispatchEvent('dblclick');await wait(async()=>await target.getAttribute('contenteditable')==='true');};
 const choose=async(text,offset)=>{await target.focus();await target.evaluate((el,[text,offset])=>{const d=el.ownerDocument,w=d.createTreeWalker(el,4);let node;while(node=w.nextNode())if(node.data===text)break;if(!node)throw Error('Missing '+text);const range=d.createRange();range.setStart(node,offset);range.collapse(true);d.getSelection().removeAllRanges();d.getSelection().addRange(range);},[text,offset]);};
 const save=async()=>{await button('Finish text editing').click();await wait(()=>read()!==states.at(-1));await settled();states.push(read());};
 const check=async texts=>{assert.deepEqual(await target.locator(':scope > p,:scope > div').allTextContents(),texts);assert.equal(await target.locator('strong').textContent(),'First');assert.equal(await target.locator('a').getAttribute('href'),'/kept');assert.equal(await target.locator('[title="second"]').getAttribute('class'),'native-tail');};
 await open();await choose('First',5);const original=await target.innerHTML();await page.keyboard.press('Delete');await check(['FirstSecond','Third']);const joined=await target.innerHTML();assert.equal(read(),states.at(-1));await button('Undo').click();assert.equal(await target.innerHTML(),original);await button('Redo').click();assert.equal(await target.innerHTML(),joined);await save();await open();await check(['FirstSecond','Third']);
 await choose('Third',0);await page.keyboard.press('Backspace');await check(['FirstSecondThird']);await save();await open();await check(['FirstSecondThird']);assert.equal(await target.locator('[title="third"]').evaluate(el=>el.tagName),'SPAN');
 const tops=await target.evaluate(el=>{const d=el.ownerDocument,w=d.createTreeWalker(el,4),out=[];let node;while(node=w.nextNode()){if(!node.data.trim())continue;const range=d.createRange();range.selectNodeContents(node);out.push(range.getBoundingClientRect().top);}return out;});assert.ok(Math.max(...tops)-Math.min(...tops)<2,JSON.stringify(tops));
 await button('Finish text editing').click();await settled();assert.equal(read(),states.at(-1));
 for(let i=states.length-2;i>=0;i--){await button('Undo').click();await wait(()=>read()===states[i]);await settled();}
 for(let i=1;i<states.length;i++){await button('Redo').click();await wait(()=>read()===states[i]);await settled();}
 console.log('NATIVE PARAGRAPH JOIN PASS '+kind+': p/div forward/backward joins, preserved formatting/links/attributes, inline geometry, local history, save/reopen and exact source undo/redo');
};
