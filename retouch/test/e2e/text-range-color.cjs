'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),states=[read()],text=await target.textContent(),color=()=>page.getByLabel('Selected text color',{exact:true});
 const select=async(locator,from,to)=>locator.evaluate((el,{from,to})=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,from);r.setEnd(el.firstChild,to);const s=d.getSelection();s.removeAllRanges();s.addRange(r);},{from,to});
 const save=async value=>{await color().fill(value);await color().press('Enter');await wait(()=>read()!==states.at(-1));states.push(read());await settled();assert.equal(await target.textContent(),text);};
 const edit=async(locator,from,to)=>{await locator.click();await wait(async()=>await target.getAttribute('contenteditable')==='true');await select(locator,from,to);};
 const originalColor=await target.evaluate(el=>getComputedStyle(el).color);
 await target.click({position:{x:12,y:18}});await wait(async()=>await target.getAttribute('contenteditable')==='true');await select(target,1,4);
 const beforePicker=await target.innerHTML();
 await page.getByRole('button',{name:'Choose selected text color',exact:true}).click();
 const picker=page.getByRole('dialog',{name:'Edit Selected text color',exact:true});
 await picker.getByLabel('Color value',{exact:true}).fill('#ff000080');
 await wait(async()=>await target.locator('span').count()===1);
 assert.equal(read(),states[0]);assert.equal(await target.getAttribute('contenteditable'),'true');
 assert.match(await picker.getByLabel('Color edit range',{exact:true}).textContent(),/across all screen sizes/);
 assert.match(await target.locator('span').evaluate(el=>getComputedStyle(el).color),/^rgba\(255, 0, 0, /);
 await picker.getByRole('button',{name:'Cancel',exact:true}).click();await picker.waitFor({state:'detached'});
 assert.equal(await target.innerHTML(),beforePicker);assert.equal(read(),states[0]);
 assert.equal(await target.evaluate(el=>el.ownerDocument.getSelection().toString()),text.slice(1,4));
 await page.getByRole('button',{name:'Choose selected text color',exact:true}).click();
 await picker.getByLabel('Color value',{exact:true}).fill('#abcdef');await page.keyboard.press('Escape');await picker.waitFor({state:'detached'});
 assert.equal(await target.innerHTML(),beforePicker);assert.equal(read(),states[0]);
 await color().fill('ff0000');await color().press('Escape');assert.equal(await target.locator('span').count(),0);assert.equal(read(),states[0]);
 await color().fill('var(--brand)');await color().press('Enter');assert.equal(await color().getAttribute('aria-invalid'),'true');assert.equal(read(),states[0]);
 await page.getByRole('button',{name:'Choose selected text color',exact:true}).click();
 await picker.getByLabel('Color value',{exact:true}).fill('#11223380');if(process.env.RT_E2E_RANGE_PICKER_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_RANGE_PICKER_SCREENSHOT});await picker.getByRole('button',{name:'Apply color',exact:true}).click();
 await wait(()=>read()!==states.at(-1));states.push(read());await settled();assert.ok(read().includes('#11223380'));const rendered=await target.locator('span').evaluate(el=>getComputedStyle(el).color);assert.match(rendered,/^rgba\(17, 34, 51, /);assert.ok(Math.abs(Number(rendered.match(/, ([\d.]+)\)$/)[1])-128/255)<0.005);assert.equal(await target.evaluate(el=>getComputedStyle(el).color),originalColor);
 await edit(target.locator('span'),0,3);await wait(async()=>await color().inputValue()==='#11223380');
 const savedMarkup=await target.innerHTML();
 await page.getByRole('button',{name:'Choose selected text color',exact:true}).click();
 await picker.getByLabel('Color value',{exact:true}).fill('#123456');
 await picker.getByRole('button',{name:'Cancel',exact:true}).click();await picker.waitFor({state:'detached'});
 assert.equal(await target.innerHTML(),savedMarkup);assert.equal(read(),states.at(-1));
 await wait(async()=>await color().inputValue()==='#11223380');
 await target.evaluate(el=>{el.__originalRangeNodes=[...el.childNodes];const r=el.ownerDocument.createRange();r.selectNodeContents(el);const selection=el.ownerDocument.getSelection();selection.removeAllRanges();selection.addRange(r);});
 await page.getByRole('button',{name:'Choose selected text color',exact:true}).click();
 await picker.getByLabel('Color value',{exact:true}).fill('#00ff00');
 assert.equal(await target.locator('span').count(),4);assert.equal(read(),states.at(-1));
 await picker.getByRole('button',{name:'Cancel',exact:true}).click();await picker.waitFor({state:'detached'});
 assert.equal(await target.innerHTML(),savedMarkup);
 assert.equal(await target.evaluate(el=>el.__originalRangeNodes.every((node,index)=>el.childNodes[index]===node)),true);
 assert.equal(await target.evaluate(el=>el.ownerDocument.getSelection().toString()),text);
 await select(target.locator('span'),0,3);await wait(async()=>await color().inputValue()==='#11223380');
 const p3='color(display-p3 1 0.2 0.3 / 0.5)';await save(p3);assert.ok(read().includes(p3));assert.equal(await target.locator('span').count(),1);assert.equal(await target.locator('span').evaluate(el=>getComputedStyle(el).color),p3);
 await edit(target.locator('span'),0,3);await save('11223380');assert.equal(await target.locator('span').count(),1);
 await edit(target.locator('span'),1,2);await save('ff000080');assert.equal(await target.locator('span span').count(),0);assert.equal(await target.locator('span').count(),3);
 assert.equal((read().match(/#11223380/g)||[]).length,2);assert.equal((read().match(/#ff000080/g)||[]).length,1);
 await edit(target.locator('span').nth(1),0,1);await save('11223380');assert.equal(await target.locator('span').count(),1);assert.ok(read().includes('#11223380'));
 if(process.env.RT_E2E_RANGE_COLOR_SCREENSHOT){await edit(target.locator('span'),0,3);await page.screenshot({path:process.env.RT_E2E_RANGE_COLOR_SCREENSHOT});await page.keyboard.press('Escape');await settled();}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 console.log('TEXT RANGE COLOR PASS '+kind+': live picker preview, Cancel/Escape restore selection and markup, Apply, invalid preservation, exact hex alpha, Display P3, reuse, partial split/merge and exact undo/redo');
};
