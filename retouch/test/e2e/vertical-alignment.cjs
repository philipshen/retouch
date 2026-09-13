'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),states=[read()],original=await target.textContent();
 const geometry=()=>target.evaluate(el=>{const c=getComputedStyle(el),box=el.getBoundingClientRect(),r=el.ownerDocument.createRange();r.selectNodeContents(el);const text=r.getBoundingClientRect();return {top:text.top-box.top,left:text.left-box.left,textHeight:text.height,height:box.height,width:box.width,display:c.display,lineHeight:c.lineHeight};});
 await page.getByLabel('Style screen scope').selectOption('');await settled();const baseline=await geometry();
 const edit=async name=>{await page.getByRole('button',{name:'Align text '+name,exact:true}).click();await settled();await wait(()=>read()!==states.at(-1));states.push(read());assert.equal(await target.textContent(),original);};
 const check=async offset=>{await wait(async()=>Math.abs((await geometry()).top-baseline.top-offset)<1);const g=await geometry();for(const p of ['left','textHeight','height','width','display','lineHeight'])assert.equal(g[p],baseline[p],p+' unchanged');};
 await page.keyboard.press('ControlOrMeta+k');const search=page.getByRole('combobox',{name:'Search actions',exact:true});await search.fill('Edit vertical text alignment');await search.press('Enter');await wait(async()=>await page.getByRole('button',{name:'Align text top',exact:true}).evaluate(el=>el===document.activeElement));assert.equal(read(),states[0]);
 await edit('middle');await check(80);if(process.env.RT_E2E_VERTICAL_ALIGNMENT_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_VERTICAL_ALIGNMENT_SCREENSHOT});
 await page.getByLabel('Style screen scope').selectOption(kind==='html'?'min-[768px]:':'md:');await settled();await edit('bottom');await check(160);
 await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await settled();await check(80);await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();await check(160);
 const top=page.getByRole('button',{name:'Align text top',exact:true});await top.focus();await top.press('End');assert.equal(await page.getByRole('button',{name:'Align text bottom',exact:true}).evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Home');await page.keyboard.press('Space');await settled();await wait(()=>read()!==states.at(-1));states.push(read());await check(0);
 await page.getByRole('button',{name:'Reset vertical text alignment',exact:true}).click();await settled();await wait(()=>read()!==states.at(-1));states.push(read());await check(80);
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 assert.deepEqual(await geometry(),baseline);console.log('VERTICAL ALIGNMENT PASS '+kind+' '+process.env.RT_E2E_VERTICAL_ALIGNMENT+': top/middle/bottom geometry, retained box and layout, screen isolation, keyboard, reset and exact source undo/redo');
};
