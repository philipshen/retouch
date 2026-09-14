'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,target,read,wait,settled,states,kind})=>{
 const button=name=>page.getByRole('button',{name,exact:true});
 const selectAll=async()=>{await target.focus();await target.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.selectNodeContents(el);d.getSelection().removeAllRanges();d.getSelection().addRange(r);});};
 const open=async()=>{await target.dispatchEvent('dblclick');await wait(async()=>await target.getAttribute('contenteditable')==='true');};
 const save=async()=>{await button('Finish text editing').click();await settled();await wait(()=>read()!==states.at(-1));states.push(read());};
 for(const value of ['word -','2.','1.5',' -','- ']){await selectAll();await page.keyboard.insertText(value);await page.keyboard.press('Space');assert.equal(await target.locator('ul,ol').count(),0);assert.equal((await target.textContent()).replace(/\u00a0/g,' '),value+' ');}
 await selectAll();await page.keyboard.insertText('- ');assert.equal(await target.locator('ul,ol').count(),0,'multi-character insertion does not run typing shortcuts');
 for(const [prefix,tag]of [['-','ul'],['*','ul'],['1.','ol'],['1)','ol']]){
  await selectAll();await page.keyboard.insertText(prefix);await page.keyboard.press('Space');assert.equal(await target.locator(':scope > '+tag+' > li').count(),1);assert.equal(await target.textContent(),'');
  await button('Undo').click();assert.equal(await target.locator('ul,ol').count(),0);assert.equal(await target.textContent(),prefix+' ');await button('Redo').click();assert.equal(await target.locator(tag+' > li').count(),1);
  await target.focus();await page.keyboard.insertText('Item');await page.keyboard.press('Enter');await page.keyboard.insertText('Next');assert.deepEqual(await target.locator(tag+' > li').allTextContents(),['Item','Next']);
  // Undo the complete local edit back to the saved, unlisted source.
  await button('Finish text editing').click();await settled();states.push(read());await open();await button('Finish text editing').click();await settled();assert.equal(read(),states.at(-1));await button('Undo').click();await settled();await wait(()=>read()===states.at(-2));states.pop();await open();
 }
 // Convert just one explicit paragraph; keep the surrounding paragraphs intact.
 await selectAll();await page.keyboard.insertText('Before');await page.keyboard.press('Enter');await page.keyboard.insertText('-Listed');await target.evaluate(el=>{const d=el.ownerDocument,w=d.createTreeWalker(el,4);let n;while(n=w.nextNode())if(n.data==='-Listed')break;const range=d.createRange();range.setStart(n,1);range.setEnd(n,7);d.getSelection().removeAllRanges();d.getSelection().addRange(range);});const link=page.getByLabel('Selected text link',{exact:true});await link.fill('/listed');await link.press('Tab');await target.focus();await target.evaluate(el=>{const d=el.ownerDocument,w=d.createTreeWalker(el,4);let n;while(n=w.nextNode())if(n.data==='-')break;const r=d.createRange();r.setStart(n,1);r.collapse(true);d.getSelection().removeAllRanges();d.getSelection().addRange(r);});await page.keyboard.press('Space');assert.equal(await target.locator(':scope > ul > li').count(),1);assert.equal(await target.locator(':scope > [data-retouch-paragraph]').textContent(),'Before');await save();await open();assert.equal(await target.locator(':scope > ul > li').textContent(),'Listed');assert.equal(await target.locator('a').getAttribute('href'),'/listed');assert.equal(await target.locator('a').textContent(),'Listed');
 if(process.env.RT_E2E_LIST_PREFIX_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_LIST_PREFIX_SCREENSHOT});await button('Finish text editing').click();await settled();assert.equal(read(),states.at(-1));
 for(let i=states.length-2;i>=0;i--){await button('Undo').click();await settled();await wait(()=>read()===states[i]);}
 for(let i=1;i<states.length;i++){await button('Redo').click();await settled();await wait(()=>read()===states[i]);}
 for(let i=states.length-2;i>=0;i--){await button('Undo').click();await settled();await wait(()=>read()===states[i]);}
 console.log('LIST PREFIX PASS '+kind+': four prefixes, immediate undo to literal text, redo, typing/Enter, saved source, isolated paragraph conversion and exact history');
};
