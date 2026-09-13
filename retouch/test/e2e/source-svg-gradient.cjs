'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const markup='<svg width="400" height="240" viewBox="0 0 400 240"><defs><linearGradient id="paint"><stop offset="0" stop-color="#ff0000"/><stop offset="100%" stop-color="#0000ff"/></linearGradient><radialGradient id="radial"><stop offset="0" stop-color="white"/><stop offset="1" stop-color="black"/></radialGradient></defs><rect aria-label="Gradient box" x="10" y="10" width="180" height="100" fill="url(#paint)"/><circle aria-label="Shared gradient" cx="260" cy="60" r="50" fill="url(#paint)"/><rect aria-label="Radial box" x="10" y="140" width="180" height="80" fill="url(#radial)"/><rect aria-label="Stroke gradient" x="210" y="140" width="160" height="80" fill="none" stroke="url(#paint)" stroke-width="8"/></svg>';
exports.markup=kind=>kind==='react'?markup.replaceAll('stop-color','stopColor').replaceAll('stroke-width','strokeWidth'):markup;
exports.run=async function({page,app,file,wait,settled,kind,errors}){
 const read=()=>fs.readFileSync(file,'utf8'),original=read();
 const edit=async(label,value)=>{const input=page.getByLabel(label,{exact:true});await input.fill(value);await input.press('Tab');await settled();};
 await app.locator('[aria-label="Gradient box"]').click();await settled();await wait(async()=>await page.getByLabel('Stop 1 color',{exact:true}).count()===1);
  await require('./svg-gradient-stop-editing.cjs').run({page,app,file,wait,settled});
  for(const [label,value,selector,attribute]of [['Stop 1 color','#00ff00','#paint stop:first-child','stop-color'],['Stop 2 position','75%','#paint stop:last-child','offset'],['Stop 2 opacity','0.5','#paint stop:last-child','stop-opacity'],['Gradient x2','60%','#paint','x2']]){
   await edit(label,value);await wait(async()=>await app.locator(selector).getAttribute(attribute)===value);if(attribute==='stop-color')assert.equal(await app.locator(selector).evaluate(el=>getComputedStyle(el).stopColor),'rgb(0, 255, 0)');const changed=read();assert.notEqual(changed,original);assert.equal(await app.locator('circle').getAttribute('fill'),'url(#paint)');
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);await wait(async()=>await app.locator(selector).getAttribute(attribute)!==value);
   await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===changed);await wait(async()=>await app.locator(selector).getAttribute(attribute)===value);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
  }
  await page.getByLabel('Gradient gradientUnits',{exact:true}).selectOption('userSpaceOnUse');await settled();await wait(async()=>await app.locator('#paint').getAttribute('gradientUnits')==='userSpaceOnUse');await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
  await edit('Stop 1 position','200%');assert.equal(read(),original);
  await page.getByRole('treeitem',{name:'rect · Stroke gradient',exact:true}).click();await settled();await edit('Stop 1 opacity','0.25');await wait(async()=>await app.locator('#paint stop').first().getAttribute('stop-opacity')==='0.25');assert.equal(await app.locator('[aria-label="Stroke gradient"]').getAttribute('stroke'),'url(#paint)');await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
  await page.getByRole('treeitem',{name:'rect · Radial box',exact:true}).click();await settled();await edit('Gradient fx','25%');await wait(async()=>await app.locator('#radial').getAttribute('fx')==='25%');
  assert.ok(await page.getByText('Shared gradient · Edits affect all referencing layers and screen sizes. Page styles can override stop colors.',{exact:true}).isVisible());
  if(process.env.RT_E2E_GRADIENT_SCREENSHOT){await page.locator('[data-section="fill-gradient"]').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:process.env.RT_E2E_GRADIENT_SCREENSHOT});}
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);assert.deepEqual(errors,[]);console.log('PASS SVG gradient inspector: shared paint, stops, coordinates, radial focus and exact history ('+kind+')');

};
