'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,read,settled,wait})=>{
 const initial=read(),group=app.locator('[data-rt-stroke-alignment]');
 const model=()=>page.evaluate(()=>sel.info.svgStrokeSource.model);
 const baseline=await model(),identity=await group.getAttribute('data-rt-stroke-id');
 const undo=async expected=>{await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===expected);};
 const start=async()=>{await page.getByRole('button',{name:'Edit vector points',exact:true}).click();await page.getByRole('button',{name:'Vector point 1',exact:true}).waitFor();};
 const check=async()=>{
  const current=await model();assert.equal(current.originalPath,baseline.path);assert.notEqual(current.path,baseline.path);
  for(const key of ['position','width','fill','stroke','matrix'])assert.deepEqual(current[key],baseline[key]);
  assert.equal(await group.getAttribute('data-rt-stroke-id'),identity);
  await page.evaluate(()=>RetouchSVGStrokeFidelity.check(matchingEls(sel.info.id)[0],sel.info.svgStrokeSource.model,sel.info.svgStrokeSource.definitionId));
  assert.equal(await app.locator('input').inputValue(),'retained draft');assert.equal(await app.locator('input').evaluate(()=>window.strokeDocument),'same');
 };
 const history=async(before,action)=>{await start();await action();await settled();await wait(()=>read()!==before);const after=read();await check();await undo(before);await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===after);await check();await undo(before);};
 await start();await page.getByRole('button',{name:'Vector point 1',exact:true}).click();await page.keyboard.press('ArrowRight');assert.equal(read(),initial);await page.keyboard.press('Escape');assert.equal(read(),initial);
 await history(initial,async()=>{await page.getByRole('button',{name:'Vector point 1',exact:true}).click();const field=page.getByRole('spinbutton',{name:'Vector X',exact:true});await field.fill('25');await field.press('Enter');});
 // The rendered fill path carries both the source transform and retained placement.
 const rotation=page.getByLabel('Vector rotation (°)',{exact:true});await rotation.fill('25');await rotation.press('Enter');await settled();await wait(()=>read()!==initial);const placed=read(),placement=(await model()).placement;
 await history(placed,async()=>{const point=page.getByRole('button',{name:'Vector point 2',exact:true}),box=await point.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2-8,box.y+box.height/2+6,{steps:4});assert.equal(read(),placed);await page.mouse.up();});
 assert.deepEqual((await model()).placement,placement);await undo(initial);
 // A generated paint override must prevent opening a source-backed point session.
 // Use the real generated tree rather than relying on a renderer-specific marker.
 await group.locator(':scope > g').last().locator(':scope > path').first().evaluate(el=>el.style.setProperty('fill','lime','important'));
 await page.getByRole('button',{name:'Edit vector points',exact:true}).click();await page.locator('#toasts').getByText('Page CSS overrides fill on this stroke. Resolve that override before editing it.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Vector point 1',exact:true}).count(),0);assert.equal(read(),initial);
 await group.locator(':scope > g').last().locator(':scope > path').first().evaluate(el=>el.style.removeProperty('fill'));
 assert.equal(read(),initial);console.log('PASS retained path numeric editing, transformed point drag, cancellation, fidelity refusal, exact history and preserved document');
};
