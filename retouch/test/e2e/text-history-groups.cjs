'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),initial=read(),original=await target.textContent();
 const key=async value=>{await target.evaluate(el=>el.focus());await page.keyboard.press(value);};
 const expect=async text=>{assert.equal(await target.textContent(),text);assert.equal(read(),initial);assert.equal(await target.getAttribute('contenteditable'),'true');};
 const undo=async text=>{await key('Control+z');await expect(text);};
 const redo=async text=>{await key('Control+Shift+z');await expect(text);};
 await target.click();await wait(async()=>await target.getAttribute('contenteditable')==='true');await target.evaluate(el=>{const r=el.ownerDocument.createRange();r.selectNodeContents(el);r.collapse(false);const s=el.ownerDocument.getSelection();s.removeAllRanges();s.addRange(r);});
 await page.keyboard.type('hello');await expect(original+'hello');await undo(original);await redo(original+'hello');
 await page.keyboard.type(' ');const afterSpace=await target.textContent();await page.keyboard.type('world');await undo(afterSpace);await undo(original+'hello');
 // Moving away and back to the same cursor position starts another group.
 await key('ArrowLeft');await key('ArrowRight');await page.keyboard.type('Z');await undo(original+'hello');await undo(original);await redo(original+'hello');
 await key('Backspace');await key('Backspace');await key('Backspace');await expect(original+'he');await undo(original+'hello');await undo(original);
 // Pending typography does not make each character a separate undo step.
 const size=page.getByLabel('Selected text size (px)',{exact:true});await size.fill('24');await size.press('Enter');await page.keyboard.type('abc');await expect(original+'abc');await undo(original);assert.equal(await target.locator('span').count(),0);await redo(original+'abc');
 await target.evaluate(el=>{const data=new DataTransfer();data.setData('text/plain','P');el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));});await expect(original+'abcP');await undo(original+'abc');await undo(original);await redo(original+'abc');
 // A deliberate pause separates otherwise contiguous typing.
 await page.keyboard.type('d');await expect(original+'abcd');await page.waitForTimeout(1100);await page.keyboard.type('e');await undo(original+'abcd');await undo(original+'abc');
 await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await settled();const saved=read();assert.notEqual(saved,initial);
 for(const [name,state]of [['Undo',initial],['Redo',saved],['Undo',initial]]){await page.getByRole('button',{name,exact:true}).click();await settled();await wait(()=>read()===state);}
 console.log('TEXT HISTORY GROUPS PASS '+kind+': native/styled words, whitespace and pause boundaries, returned cursor separation, repeated deletion, independent paste and exact source history');
};
