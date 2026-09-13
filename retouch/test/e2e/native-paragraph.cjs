'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),initial=read(),states=[initial],original=await target.innerText();
 const start=async offset=>{await target.click();await wait(async()=>await target.getAttribute('contenteditable')==='true');await target.evaluate((el,offset)=>{const d=el.ownerDocument,r=d.createRange();if(offset===null){r.selectNodeContents(el);r.collapse(false);}else{r.setStart(el.firstChild,offset);r.collapse(true);}d.getSelection().removeAllRanges();d.getSelection().addRange(r);},offset);};
 const paragraph=()=>target.evaluate(el=>el.ownerDocument.execCommand('insertParagraph',false));
 const positions=()=>target.evaluate(el=>{const d=el.ownerDocument,walker=d.createTreeWalker(el,4),out=[],top=el.getBoundingClientRect().top;for(let node;node=walker.nextNode();)for(let i=0;i<node.length;i++){const range=d.createRange();range.setStart(node,i);range.setEnd(node,i+1);out.push({text:node.data[i],y:range.getBoundingClientRect().top-top});}return out;});
 const save=async expected=>{
  const before=await positions();
  assert.equal(before.map(char=>char.text).join(''),expected.replace(/\n/g,''));
  await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await settled();await wait(()=>read()!==states.at(-1));states.push(read());
  assert.equal(await target.innerText(),expected);
  const after=await positions();assert.equal(after.length,before.length);
  for(let i=0;i<before.length;i++){assert.equal(after[i].text,before[i].text);assert.ok(Math.abs(after[i].y-before[i].y)<1,`Saving moved character ${i} vertically: ${before[i].y} -> ${after[i].y}`);}
 };
 await start(4);assert.equal(await paragraph(),true);await page.keyboard.insertText('Next');await save('Head\nNextline');assert.equal(await target.locator('br').count(),1);
 await start(null);assert.equal(await paragraph(),true);assert.equal(await paragraph(),true);await page.keyboard.insertText('Last');await save('Head\nNextline\n\nLast');
 await start(null);await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await settled();assert.equal(read(),states.at(-1),'Reopening native line boundaries must not rewrite the source');
 if(process.env.RT_E2E_NATIVE_PARAGRAPH_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_NATIVE_PARAGRAPH_SCREENSHOT});
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 assert.equal(await target.innerText(),original);console.log('NATIVE PARAGRAPH BOUNDARIES PASS '+kind+': browser insertParagraph, middle split, blank line, save/reopen and exact source undo/redo');
};
