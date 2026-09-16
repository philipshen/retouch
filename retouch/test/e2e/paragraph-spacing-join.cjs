'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),states=[read()],field=page.getByLabel('Paragraph spacing (px)',{exact:true}),button=name=>page.getByRole('button',{name,exact:true}),paragraphs=()=>target.locator(':scope > [data-retouch-paragraph]');
 const open=async()=>{await target.dispatchEvent('dblclick');await wait(async()=>await target.getAttribute('contenteditable')==='true');};
 const choose=async(text,offset)=>{await target.focus();await target.evaluate((el,[text,offset])=>{const d=el.ownerDocument,w=d.createTreeWalker(el,4);let node;while(node=w.nextNode())if(node.data===text)break;if(!node)throw Error('Missing '+text);const range=d.createRange();range.setStart(node,offset);range.collapse(true);d.getSelection().removeAllRanges();d.getSelection().addRange(range);},[text,offset]);};
 const save=async()=>{await button('Finish text editing').click();await wait(()=>read()!==states.at(-1));await settled();states.push(read());};
 const check=async texts=>{const boxes=await paragraphs().evaluateAll(nodes=>nodes.map(n=>{const box=n.getBoundingClientRect(),css=getComputedStyle(n);return {text:n.textContent,top:box.top,bottom:box.bottom,end:css.marginBlockEnd};}));assert.deepEqual(boxes.map(b=>b.text),texts);assert.equal(boxes.at(-1).end,'0px');for(let i=1;i<boxes.length;i++)assert.ok(Math.abs(boxes[i].top-boxes[i-1].bottom-24)<1,JSON.stringify(boxes));};
 await open();await choose('Headline',4);await page.keyboard.press('Enter');await choose('line',4);await page.keyboard.press('Enter');await page.keyboard.insertText('Third');await wait(()=>field.isEnabled());await field.fill('24');await field.press('Enter');await check(['Head','line','Third']);await save();await open();
 await choose('Head',4);const before=await target.innerHTML();await page.keyboard.press('Delete');await check(['Headline','Third']);await button('Undo').click();assert.equal(await target.innerHTML(),before);
 await choose('Third',0);await page.keyboard.press('Backspace');await check(['Head','lineThird']);const joined=await target.innerHTML();assert.equal(read(),states.at(-1));await button('Undo').click();assert.equal(await target.innerHTML(),before);await button('Redo').click();assert.equal(await target.innerHTML(),joined);await save();await open();await check(['Head','lineThird']);
 await choose('line',0);await page.keyboard.press('Backspace');await check(['HeadlineThird']);await save();await open();await check(['HeadlineThird']);assert.equal(await field.isDisabled(),true);await button('Finish text editing').click();await settled();assert.equal(read(),states.at(-1));
 for(let i=states.length-2;i>=0;i--){await button('Undo').click();await wait(()=>read()===states[i]);await settled();}
 for(let i=1;i<states.length;i++){await button('Redo').click();await wait(()=>read()===states[i]);await settled();}
 console.log('PARAGRAPH JOIN SPACING PASS '+kind+': forward/backward joins, retained remaining gaps, no trailing margin, local history, save/reopen and exact source undo/redo');
};
