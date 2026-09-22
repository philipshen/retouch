'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,read,settled,wait})=>{
 const initial=read(),group=app.locator('[data-rt-stroke-alignment]');
 const archived=()=>group.locator('[data-rt-stroke-original]').evaluate(el=>{const copy=el.cloneNode(true);for(const node of [copy,...copy.querySelectorAll('*')])for(const name of ['data-rt-revision','data-rt-client-revision','data-rt-client-mounted'])node.removeAttribute(name);return copy.innerHTML;});
 const original=await archived(),id=await group.getAttribute('data-rt-stroke-id');
 const probes=await page.evaluate(()=>{const d=doc(),identity=sel.info.svgStrokeSource.definitionId,observer=new MutationObserver(()=>{});observer.observe(d,{subtree:true,childList:true});renderPanel();const duplicated=observer.takeRecords().flatMap(record=>[...record.addedNodes]).filter(node=>node.nodeType===1&&(node.id===identity||node.querySelector('[id="'+identity+'"]'))).length;observer.disconnect();return duplicated;});assert.equal(probes,0,'Inspector probes must not duplicate mask/clip IDs');
 const override=await app.locator('head').evaluate(head=>{const style=head.ownerDocument.createElement('style');style.id='placement-override';style.textContent='[data-rt-stroke-alignment]{transform:matrix(1,0,0,1,0,0)!important}';head.append(style);return style.id;});
 assert.equal(await page.evaluate(()=>writeSVGTransform(sel.info,matchingEls(sel.info.id)[0],[1,0,0,1,5,0])),false);assert.equal(read(),initial);assert.equal(await group.getAttribute('transform'),null);await app.locator('#'+override).evaluate(el=>el.remove());
 const undo=async()=>{await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();};
 const history=async action=>{
  const before=read();await action();await settled();await wait(()=>read()!==before);const after=read();
  assert.equal(await archived(),original);assert.equal(await group.getAttribute('data-rt-stroke-id'),id);
  await page.evaluate(()=>RetouchSVGStrokeFidelity.check(matchingEls(sel.info.id)[0],sel.info.svgStrokeSource.model,sel.info.svgStrokeSource.definitionId));
  assert.equal(await app.locator('input').inputValue(),'retained draft');assert.equal(await app.locator('input').evaluate(()=>window.strokeDocument),'same');
  await undo();await wait(()=>read()===before);await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===after);await undo();await wait(()=>read()===before);
 };
 for(const [label,value]of [['Vector X','28'],['Vector Y','31'],['Vector width','70'],['Vector height','50'],['Vector rotation (°)','30']])await history(async()=>{const field=page.getByLabel(label,{exact:true});await field.fill(value);await field.press('Enter');await settled();assert.ok(Math.abs(Number(await field.inputValue())-Number(value))<.01);});
 await history(()=>page.getByRole('button',{name:'Flip horizontally',exact:true}).click());
 // Held-key previews are reversible and commit one history entry on release.
 const x=page.getByLabel('Vector X',{exact:true}),before=read(),transform=await group.getAttribute('transform');await x.focus();await page.keyboard.down('ArrowUp');await page.keyboard.down('ArrowUp');assert.equal(read(),before);assert.notEqual(await group.getAttribute('transform'),transform);await page.keyboard.press('Escape');await page.keyboard.up('ArrowUp');assert.equal(read(),before);assert.equal(await group.getAttribute('transform'),transform);
 await history(async()=>{await x.focus();await page.keyboard.down('ArrowUp');await page.keyboard.down('ArrowUp');assert.equal(read(),before);await page.keyboard.up('ArrowUp');});
 await history(async()=>{await page.getByRole('button',{name:'Rotate vector on canvas',exact:true}).click();await page.getByLabel('Rotate SVG vector on canvas',{exact:true}).waitFor();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');});
 await history(async()=>{await group.click();await settled();await page.keyboard.down('ArrowRight');await page.keyboard.down('ArrowRight');assert.equal(read(),initial);await page.keyboard.up('ArrowRight');});
 // Canvas handles use the same grouped source operation.
 await history(async()=>{const handle=page.getByRole('button',{name:'Resize vector from bottom right',exact:true}),box=await handle.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+20,box.y+box.height/2+12,{steps:4});assert.equal(read(),initial);await page.mouse.up();});
 assert.equal(read(),initial);console.log('PASS retained vector position, size, rotation, flip, field/keyboard previews, canvas resize and exact history');
};
