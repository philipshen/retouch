'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),anchor=target.locator('a'),initial=read(),href=await anchor.getAttribute('href'),field=page.getByLabel('Selected text link',{exact:true});
 await target.click({position:{x:10,y:12}});await wait(async()=>await target.getAttribute('contenteditable')==='true');
 await anchor.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.selectNodeContents(el);const selection=d.getSelection();selection.removeAllRanges();selection.addRange(r);});
 await wait(async()=>await field.inputValue()===href);assert.equal(await field.evaluate(el=>el.readOnly),true);assert.equal(await page.getByRole('button',{name:'Remove selected text link',exact:true}).isDisabled(),true);
 await target.focus();await page.keyboard.press('Meta+k');assert.equal(await field.evaluate(el=>el===el.ownerDocument.activeElement),true);assert.equal(await field.inputValue(),href);
 // Read-only URLs remain copyable; typing cannot overwrite the expression or attributes.
 await field.press('X');assert.equal(await field.inputValue(),href);await field.press('Escape');assert.equal(read(),initial);assert.equal(await anchor.getAttribute('href'),href);
 // Formatting the contents still works without reconstructing the owned anchor.
 await anchor.evaluate(el=>{const d=el.ownerDocument,r=d.createRange();r.selectNodeContents(el);const selection=d.getSelection();selection.removeAllRanges();selection.addRange(r);});
 const size=page.getByLabel('Selected text size (px)',{exact:true});await size.fill('20');await size.press('Enter');assert.equal(await anchor.locator('span').textContent(),'line');assert.equal(await anchor.getAttribute('href'),href);
 await settled();await wait(()=>read()!==initial);const saved=read();assert.equal(await anchor.getAttribute('href'),href);
 const sourceOpen=initial.match(/<a\s[^>]+>/)[0];assert.ok(saved.includes(sourceOpen));
 for(const [name,state]of [['Undo',initial],['Redo',saved],['Undo',initial]]){await page.getByRole('button',{name,exact:true}).click();await settled();await wait(()=>read()===state);assert.equal(await anchor.getAttribute('href'),href);}
 console.log('OWNED LINK TEXT PASS '+kind+': shortcut, copyable read-only URL, retained source expression/attributes, child formatting and exact undo/redo');
};
