'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),states=[read()],button=name=>page.getByRole('button',{name,exact:true});
 const open=async()=>{await target.dispatchEvent('dblclick');await wait(async()=>await target.getAttribute('contenteditable')==='true');};
 const choose=async(text,from,to=from)=>{await target.focus();await target.evaluate((el,[text,from,to])=>{const d=el.ownerDocument,w=d.createTreeWalker(el,4);let n;while(n=w.nextNode())if(n.data===text)break;if(!n)throw Error('Missing '+text);const r=d.createRange();r.setStart(n,from);r.setEnd(n,to);d.getSelection().removeAllRanges();d.getSelection().addRange(r);},[text,from,to]);};
 const save=async()=>{await button('Finish text editing').click();await settled();await wait(()=>read()!==states.at(-1));states.push(read());};
 const count=()=>target.locator(':scope > [data-retouch-paragraph]').count();
 await open();await choose('Headline',4);await page.keyboard.press('Enter');await choose('line',0,4);await page.getByLabel('Selected text link',{exact:true}).fill('/kept-link');await page.getByLabel('Selected text link',{exact:true}).press('Tab');await save();await open();
 const originalHeight=(await target.boundingBox()).height;await choose('Head',4);await page.keyboard.press('Shift+Enter');const softHeight=(await target.boundingBox()).height;await choose('line',0);await page.keyboard.press('Backspace');assert.equal(await count(),1);assert.ok(Math.abs((await target.boundingBox()).height-originalHeight)<1);assert.ok(softHeight>originalHeight);await button('Undo').click();await button('Undo').click();
 const height=(await target.boundingBox()).height;await choose('line',0);const before=await target.innerHTML();await page.keyboard.press('Backspace');assert.equal(await count(),1);assert.equal(await target.textContent(),'Headline');assert.ok((await target.boundingBox()).height<height*.7);const joined=await target.innerHTML();assert.equal(await target.locator('a').getAttribute('href'),'/kept-link');
 await button('Undo').click();assert.equal(await target.innerHTML(),before);await button('Redo').click();assert.equal(await target.innerHTML(),joined);await save();await open();assert.equal(await count(),1);assert.equal(await target.locator('a').getAttribute('href'),'/kept-link');
 // Re-split a saved join, then use forward Delete at the preceding boundary.
 await choose('line',0);await page.keyboard.press('Enter');assert.equal(await count(),2);await choose('Head',4);const split=await target.innerHTML();await page.keyboard.press('Delete');assert.equal(await count(),1);await button('Undo').click();assert.equal(await target.innerHTML(),split);await choose('Head',4);assert.equal(await target.evaluate(el=>el.dispatchEvent(new InputEvent('beforeinput',{inputType:'deleteContentForward',bubbles:true,cancelable:true}))),false);assert.equal(await count(),1);await save();await open();
 // Empty paragraphs and a trailing soft line retain exactly their visible lines.
 await choose('line',4);await page.keyboard.press('Enter');await page.keyboard.press('Enter');await page.keyboard.insertText('Tail');assert.equal(await count(),3);await choose('Tail',0);await page.keyboard.press('Backspace');assert.equal(await count(),2);assert.equal(await target.textContent(),'HeadlineTail');await save();await open();
 await choose('Tail',0);const heldBefore=await target.innerHTML();await page.keyboard.down('Backspace');await page.keyboard.down('Backspace');await page.keyboard.up('Backspace');assert.equal(await count(),1);await button('Undo').click();assert.equal(await target.innerHTML(),heldBefore);
 await choose('Tail',0);await page.keyboard.press('Backspace');await save();await open();assert.equal(await count(),1);assert.equal(await target.textContent(),'HeadlineTail');
 const depth=()=>target.evaluate(el=>{const walk=(n,d)=>Math.max(d,...[...n.children].map(c=>walk(c,d+1)));return walk(el,0);});const beforeDepth=await depth();for(let i=0;i<6;i++){await choose('Tail',0);await page.keyboard.press('Enter');await page.keyboard.press('Backspace');assert.equal(await count(),1);}assert.ok(await depth()<=beforeDepth+1);
 await button('Finish text editing').click();await settled();if(read()!==states.at(-1))states.push(read());await open();
 if(process.env.RT_E2E_PARAGRAPH_JOIN_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_PARAGRAPH_JOIN_SCREENSHOT});
 await button('Finish text editing').click();await settled();assert.equal(read(),states.at(-1));
 for(let i=states.length-2;i>=0;i--){await button('Undo').click();await settled();await wait(()=>read()===states[i]);}
 for(let i=1;i<states.length;i++){await button('Redo').click();await settled();await wait(()=>read()===states[i]);}
 for(let i=states.length-2;i>=0;i--){await button('Undo').click();await settled();await wait(()=>read()===states[i]);}
 console.log('PARAGRAPH JOIN PASS '+kind+': Backspace/Delete/beforeinput, retained links, split/join, empty paragraphs, geometry, held deletion grouping, save/reopen and exact source undo/redo');
};
