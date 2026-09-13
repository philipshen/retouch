'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),initial=read(),text=await target.textContent(),states=[];
 const button=name=>page.getByRole('button',{name,exact:true});
 const remember=async()=>{states.push(await target.innerHTML());assert.equal(read(),initial);};
 const selection=()=>target.evaluate(el=>el.ownerDocument.getSelection().getRangeAt(0).toString());
 const step=async(redo,expected,control)=>{
  if(control==='button')await button(redo?'Redo':'Undo').click();
  else if(control)await control.press(redo?'Control+Shift+z':'Control+z');
  else{await target.evaluate(el=>el.focus());await page.keyboard.press(redo?'Control+Shift+z':'Control+z');}
  assert.equal(await target.getAttribute('contenteditable'),'true');assert.equal(await target.innerHTML(),expected);assert.equal(await selection(),text.slice(1,4));assert.equal(read(),initial);
 };
 await target.click();await wait(async()=>await target.getAttribute('contenteditable')==='true');
 await target.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,1);r.setEnd(el.firstChild,4);const selection=d.getSelection();selection.removeAllRanges();selection.addRange(r);});await remember();
 await button('Underline selected text').click();await remember();
 await button('Strikethrough selected text').click();await remember();
 const weight=page.getByLabel('Selected text weight',{exact:true});await weight.selectOption('400');await remember();
 const size=page.getByLabel('Selected text size (px)',{exact:true});await size.fill('24');await size.press('Tab');await remember();
 assert.equal(new Set(states).size,states.length);
 // Re-applying an identical value must not consume an extra history step.
 await size.fill('24');await size.press('Tab');assert.equal(await target.innerHTML(),states.at(-1));
 for(let n=states.length-2;n>=0;n--)await step(false,states[n],n===states.length-2?weight:n===1?'button':undefined);
 for(let n=1;n<states.length;n++)await step(true,states[n],n===1?button('Underline selected text'):n===2?'button':undefined);
 // A different formatting command after Undo replaces the redo branch.
 await step(false,states.at(-2));await button('Superscript selected text').click();const branch=await target.innerHTML();assert.notEqual(branch,states.at(-1));
 await target.evaluate(el=>el.focus());await page.keyboard.press('Control+Shift+z');assert.equal(await target.innerHTML(),branch);assert.equal(read(),initial);assert.equal(await button('Redo').isDisabled(),true);
 // Typed text and its normalization stay a single transaction after formatting.
 await target.evaluate(el=>{const r=el.ownerDocument.getSelection().getRangeAt(0);r.collapse(false);});
 await button('Underline selected text').click();await page.keyboard.insertText('XYZ');assert.equal(await target.textContent(),text.slice(0,4)+'XYZ'+text.slice(4));
 await button('Undo').click();assert.equal(await target.getAttribute('contenteditable'),'true');assert.equal(await target.innerHTML(),branch);
 await button('Finish text editing').click();await settled();const saved=read();assert.notEqual(saved,initial);
 for(const [name,expected]of [['Undo',initial],['Redo',saved],['Undo',initial]]){await button(name).click();await settled();await wait(()=>read()===expected);}
 console.log('INLINE FORMAT HISTORY PASS '+kind+': per-command local undo/redo, selection and metadata retained, toolbar shortcuts, no-op omission, redo branching, grouped typing and exact source history');
};
