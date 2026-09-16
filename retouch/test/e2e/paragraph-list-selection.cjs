'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 let target=app.locator('#native-copy');const states=[read()],button=name=>page.getByRole('button',{name,exact:true}),style=page.getByLabel('Text layer list style',{exact:true});
 const open=async()=>{await target.dispatchEvent('dblclick');await wait(async()=>await target.getAttribute('contenteditable')==='true');};
 const choose=async(first,last=first,start=0,end=0)=>{await target.focus();await target.evaluate((el,[first,last,start,end])=>{const d=el.ownerDocument,w=d.createTreeWalker(el,4),nodes={};let node;while(node=w.nextNode())nodes[node.data]=node;const range=d.createRange();range.setStart(nodes[first],start);range.setEnd(nodes[last],end);d.getSelection().removeAllRanges();d.getSelection().addRange(range);},[first,last,start,end]);await wait(()=>style.isEnabled());};
 const save=async()=>{await button('Finish text editing').click();await wait(()=>read()!==states.at(-1));await settled();states.push(read());};
 const check=async expected=>{assert.deepEqual(await target.evaluate(el=>[...el.children].map(n=>[n.tagName,n.textContent])),expected);assert.equal(await target.locator('strong').textContent(),'First');assert.equal(await target.locator('a').getAttribute('href'),'/kept');assert.equal(await target.locator('[title="second"]').getAttribute('class'),'native-tail');};
 await open();await choose('Second','Third');assert.equal(await style.inputValue(),'none');const original=await target.innerHTML();await style.selectOption('ul');await check([['P','First'],['UL','Second'],['DIV','Third']]);const listed=await target.innerHTML();await button('Undo').click();assert.equal(await target.innerHTML(),original);await button('Redo').click();assert.equal(await target.innerHTML(),listed);await save();await open();await check([['P','First'],['UL','Second'],['DIV','Third']]);
 // A paragraph beside an existing list must show No list and affect only itself.
 await choose('Third','Third',2,2);assert.equal(await style.inputValue(),'none');await style.selectOption('ol');await save();await open();await check([['P','First'],['UL','Second'],['OL','Third']]);
 // Remove the two selected lists separately, then make a list from a partial
 // selection spanning two native paragraphs. Paragraph attributes survive.
 await choose('Second');await style.selectOption('none');await save();await open();await choose('Third');await style.selectOption('none');await save();await open();await check([['P','First'],['DIV','Second'],['DIV','Third']]);
 await choose('First','Second',2,3);await style.selectOption('ol');await save();await open();await check([['OL','FirstSecond'],['DIV','Third']]);assert.equal(await target.locator(':scope > ol > li').count(),2);assert.equal(await target.locator('[title="first"]').evaluate(el=>el.tagName),'LI');
 // Parent-element offsets are valid browser selection boundaries, too.
 await target.focus();await target.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el,1);r.setEnd(el,2);d.getSelection().removeAllRanges();d.getSelection().addRange(r);});await wait(()=>style.isEnabled());await style.selectOption('ul');await save();await open();await check([['OL','FirstSecond'],['UL','Third']]);
 await button('Finish text editing').click();await settled();assert.equal(read(),states.at(-1));
 target=app.locator('#explicit-copy');await open();const explicitText=await target.textContent();await choose('Two','Three');await style.selectOption('ul');assert.deepEqual(await target.evaluate(el=>[...el.children].map(n=>[n.tagName,n.textContent])),[['SPAN','One'],['UL',kind==='react'?'Two':'Two\n'],['SPAN','Three']]);assert.equal(await target.textContent(),explicitText);await save();await open();assert.equal(await target.locator('ul > li > span[data-retouch-paragraph]').textContent(),'Two');assert.equal(await target.locator(':scope > span').count(),2);
 await target.focus();await target.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstElementChild.firstChild,1);r.setEnd(el.querySelector('li span').firstChild,1);d.getSelection().removeAllRanges();d.getSelection().addRange(r);});await wait(()=>style.isDisabled());await button('Finish text editing').click();await settled();assert.equal(read(),states.at(-1));
 for(let i=states.length-2;i>=0;i--){await button('Undo').click();await wait(()=>read()===states[i]);await settled();}
 for(let i=1;i<states.length;i++){await button('Redo').click();await wait(()=>read()===states[i]);await settled();}
 console.log('PARAGRAPH LIST SELECTION PASS '+kind+': caret and selected paragraphs, exclusive end, partial text and parent boundaries, preserved adjacent lists/attributes/links, local history, save/reopen and exact source undo/redo');
};
