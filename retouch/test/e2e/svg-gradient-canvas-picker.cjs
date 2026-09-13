'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,file,wait,settled})=>{
 const read=()=>fs.readFileSync(file,'utf8'),original=read(),surface=page.getByLabel('Edit gradient on canvas',{exact:true}),cases=[['Gradient box','paint','fill'],['Radial box','radial','fill']];if(await app.locator('[aria-label="Stroke gradient"]').count())cases.push(['Stroke gradient','paint','stroke']);
 await page.getByRole('button',{name:'Fit screen',exact:true}).click();await settled();
 const history=async(name,text)=>{await page.getByRole('button',{name,exact:true}).click();await settled();await wait(()=>read()===text);};
 for(const [label,id,paint]of cases){
  await page.getByRole('treeitem',{name:'rect · '+label,exact:true}).click();await settled();const stop=app.locator('#'+id+' > stop').first(),before=await stop.evaluate(el=>el.outerHTML),handle=page.getByRole('button',{name:'Gradient color stop 1',exact:true});
  const openCanvas=async()=>{await page.getByRole('button',{name:'Edit '+paint+' gradient on canvas',exact:true}).click();await wait(async()=>await surface.count()===1);};
  const picker=page.getByRole('dialog',{name:'Edit Stop 1 color',exact:true}),resume=async()=>{await picker.waitFor({state:'detached'});await wait(async()=>await surface.count()===1);await wait(async()=>await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'))==='Gradient color stop 1');};
  await openCanvas();await handle.dblclick();await picker.waitFor();assert.equal(await surface.count(),0);await picker.getByLabel('Color value',{exact:true}).fill('#00ff0080');await wait(async()=>String(await stop.evaluate(el=>getComputedStyle(el).stopColor)).includes('0, 255, 0'));assert.equal(read(),original);
  if(process.env.RT_E2E_GRADIENT_CANVAS_PICKER_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_GRADIENT_CANVAS_PICKER_SCREENSHOT});
  await page.keyboard.press('Escape');await resume();assert.equal(read(),original);assert.equal(await stop.evaluate(el=>el.outerHTML),before);
  await handle.press('F2');await picker.waitFor();await picker.getByRole('button',{name:'Apply color',exact:true}).click();await resume();assert.equal(read(),original);assert.equal(await stop.evaluate(el=>el.outerHTML),before);
  await handle.press('Space');await picker.waitFor();await picker.getByLabel('Color value',{exact:true}).fill('#00ff0080');await picker.getByRole('button',{name:'Apply color',exact:true}).click();await settled();await wait(()=>read()!==original);const changed=read();await resume();assert.equal(await stop.getAttribute('stop-color'),'#00ff0080');assert.equal(await stop.getAttribute('style'),null);await page.getByRole('button',{name:'Finish gradient editing',exact:true}).click();await history('Undo',original);await history('Redo',changed);await history('Undo',original);
  await openCanvas();await handle.press('F2');await picker.waitFor();await picker.getByLabel('Color value',{exact:true}).fill('#00ff00');await page.evaluate(()=>window.dispatchEvent(new Event('retouch:before-zoom')));await picker.waitFor({state:'detached'});assert.equal(await surface.count(),0);assert.equal(read(),original);assert.equal(await stop.evaluate(el=>el.outerHTML),before);
 }
 console.log('PASS canvas stop color picker: pointer and keyboard opening, live alpha preview, cancellation, no-op Apply, restored canvas focus, zoom cancellation and exact undo/redo');
};
