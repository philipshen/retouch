'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),initial=read(),original=await target.textContent(),states=[initial];
 const edit=async(offset=null)=>{await target.click();await wait(async()=>await target.getAttribute('contenteditable')==='true');await target.evaluate((el,offset)=>{const d=el.ownerDocument,r=d.createRange();if(offset===null){r.selectNodeContents(el);r.collapse(false);}else{r.setStart(el.firstChild,offset);r.collapse(true);}const selection=d.getSelection();selection.removeAllRanges();selection.addRange(r);},offset);};
 const save=async()=>{await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await settled();await wait(()=>read()!==states.at(-1));states.push(read());};
 const height=(await target.boundingBox()).height;
 await edit(4);await page.keyboard.press('Shift+Enter');await page.keyboard.insertText('Next');assert.equal(await target.innerText(),original.slice(0,4)+'\nNext'+original.slice(4));assert.equal(await target.locator('br').count(),1);assert.equal(read(),initial);
 await page.keyboard.press('Control+z');assert.equal(await target.textContent(),original);assert.equal(await target.locator('br').count(),1);await page.keyboard.press('Control+z');assert.equal(await target.locator('br').count(),0);await page.keyboard.press('Control+Shift+z');await page.keyboard.press('Control+Shift+z');assert.equal(await target.innerText(),original.slice(0,4)+'\nNext'+original.slice(4));await save();assert.equal(await target.locator('br').count(),1);assert.ok((await target.boundingBox()).height>height);
 await edit();await page.keyboard.press('Shift+Enter');await page.keyboard.press('Shift+Enter');await save();assert.equal(await target.locator('br').count(),3,'only the three authored breaks survive compilation');
 await edit();await page.getByRole('button',{name:'Finish text editing',exact:true}).click();await settled();assert.equal(read(),states.at(-1),'reopening a trailing break must not rewrite source');
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 states.splice(1);
 await edit();const size=page.getByLabel('Selected text size (px)',{exact:true});await size.fill('20');await size.press('Enter');await page.keyboard.press('Shift+Enter');await page.keyboard.insertText('Styled');assert.equal(await target.locator('span').evaluate(el=>getComputedStyle(el).fontSize),'20px');assert.equal(await target.innerText(),original+'\nStyled');await save();assert.equal(await target.locator('br').count(),1);assert.equal(await target.locator('span').textContent(),'Styled');
 if(process.env.RT_E2E_LINE_BREAK_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_LINE_BREAK_SCREENSHOT});
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===initial);
 console.log('INLINE LINE BREAK PASS '+kind+': middle/trailing/consecutive breaks, rendered lines, placeholder omission, cursor styles, reopen stability and exact local/source undo/redo');
};
