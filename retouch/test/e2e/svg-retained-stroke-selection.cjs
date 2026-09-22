'use strict';
const assert=require('node:assert/strict'),A=require('../../shell/svg-affine.js');
module.exports=async({page,app,read,settled,wait})=>{
 const initial=read(),card=page.getByRole('treeitem',{name:'rect · Card',exact:true}),circle=page.getByRole('treeitem',{name:'circle',exact:true});
 const undo=async()=>{await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();};
 const select=async()=>{await card.click();await settled();await circle.click({modifiers:['Meta']});await settled();await page.getByLabel('Selection width',{exact:true}).waitFor();};
 const measure=()=>page.evaluate(()=>sel.multiple.map(info=>{const el=matchingEls(info.id)[0],m=el.getScreenCTM(),r=el.getBoundingClientRect();return {id:info.id,m:[m.a,m.b,m.c,m.d,m.e,m.f],r:r.toJSON(),transform:el.getAttribute('transform'),stroke:info.svgStrokeSource||null};}));
 const baseModel=model=>{const copy={...model};delete copy.placement;return copy;};
 const verify=async(before,global)=>{const after=await measure();assert.deepEqual(after.map(v=>v.id),before.map(v=>v.id));for(let i=0;i<before.length;i++){
  if(global)A.multiply(global,before[i].m).forEach((value,j)=>assert.ok(Math.abs(after[i].m[j]-value)<.01,JSON.stringify({before:before[i],after:after[i],global,j})));
  if(before[i].stroke){assert.equal(after[i].stroke.definitionId,before[i].stroke.definitionId);assert.deepEqual(baseModel(after[i].stroke.model),baseModel(before[i].stroke.model));}
 }
 await page.evaluate(()=>{for(const info of sel.multiple)if(info.svgStrokeSource){const el=matchingEls(info.id)[0];RetouchSVGStrokeFidelity.check(el,info.svgStrokeSource.model,info.svgStrokeSource.definitionId);const model=JSON.parse(atob(el.getAttribute('data-rt-stroke-model').replace(/-/g,'+').replace(/_/g,'/')));if(JSON.stringify(model)!==JSON.stringify(info.svgStrokeSource.model))throw Error('Rendered retained metadata did not refresh');}});
 assert.equal(await app.locator('input').inputValue(),'retained draft');assert.equal(await app.locator('input').evaluate(()=>window.strokeDocument),'same');};
 const history=async(action,global=null)=>{const before=read(),state=await measure();await action();await settled();await wait(()=>read()!==before);const after=read();await verify(state,global);await undo();await wait(()=>read()===before);await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===after);await verify(state,global);await undo();await wait(()=>read()===before);};
 for(const retained of [1,2]){
  await select();assert.equal((await measure()).filter(item=>item.stroke).length,retained);if(retained===2&&process.env.RT_STROKE_CONTROLS_SCREENSHOT)await page.screenshot({path:process.env.RT_STROKE_CONTROLS_SCREENSHOT.replace(/\.png$/,'-selection.png')});
  if(retained===2){await require('./svg-retained-stroke-shared-properties.cjs')({page,app,read,settled,wait});await require('./svg-retained-stroke-relative.cjs')({page,app,read,settled,wait});await require('./svg-retained-stroke-shared-paints.cjs')({page,app,read,settled,wait});}
  // One CSS-controlled member refuses the entire draft, restoring every node.
  const before=await measure(),saved=read();await app.locator('head').evaluate((head,id)=>{const style=head.ownerDocument.createElement('style');style.id='batch-transform-override';style.textContent='[data-rt="'+id+'"]{transform:matrix(1,0,0,1,0,0)!important}';head.append(style);},before[0].id);
  await page.evaluate(()=>writeSVGSelection(Object.fromEntries(sel.multiple.map(info=>[info.id,[1,0,0,1,9,0]]))));assert.equal(read(),saved);assert.deepEqual((await measure()).map(item=>item.transform),before.map(item=>item.transform));await app.locator('#batch-transform-override').evaluate(el=>el.remove());
  for(const action of ['move','width','rotate','flip']){
   const state=await measure(),left=Math.min(...state.map(v=>v.r.left)),right=Math.max(...state.map(v=>v.r.right)),top=Math.min(...state.map(v=>v.r.top)),bottom=Math.max(...state.map(v=>v.r.bottom)),cx=(left+right)/2,cy=(top+bottom)/2;
   const global=action==='move'?[1,0,0,1,9,0]:action==='width'?[1.15,0,0,1,-left*.15,0]:action==='rotate'?A.parse('rotate(-12 '+cx+' '+cy+')'):[-1,0,0,1,2*cx,0];
   await history(async()=>{if(action==='flip')return page.getByRole('button',{name:'Flip horizontally',exact:true}).click();const field=page.getByLabel(action==='move'?'Selection X':action==='width'?'Selection width':'Rotate selection (°)',{exact:true});await field.fill(action==='move'?(Number(await field.inputValue())+9).toString():action==='width'?(Number(await field.inputValue())*1.15).toString():'12');await field.press('Enter');},global);
  }
  await history(async()=>{await app.locator('body').evaluate(el=>{el.tabIndex=-1;el.focus({preventScroll:true});});await page.keyboard.down('ArrowRight');await page.getByLabel('Move SVG selection on canvas',{exact:true}).waitFor();await page.keyboard.down('ArrowRight');assert.equal(read(),saved);await page.keyboard.up('ArrowRight');},[1,0,0,1,2,0]);
  const state=await measure();await app.locator('body').evaluate(el=>el.focus({preventScroll:true}));await page.keyboard.down('ArrowLeft');await page.getByLabel('Move SVG selection on canvas',{exact:true}).waitFor();await page.keyboard.press('Escape');await page.keyboard.up('ArrowLeft');assert.equal(read(),saved);assert.deepEqual((await measure()).map(v=>v.m),state.map(v=>v.m));
  await history(async()=>{const handle=page.getByRole('button',{name:'Resize selection from bottom right',exact:true}),box=await handle.boundingBox();await page.mouse.move(box.x+5,box.y+5);await page.mouse.down();await page.keyboard.down('Control');await page.mouse.move(box.x+25,box.y+17,{steps:4});assert.equal(read(),saved);await page.mouse.up();await page.keyboard.up('Control');});
  if(retained===1){await circle.click();await settled();await page.getByLabel('Stroke alignment',{exact:true}).selectOption('inside');await settled();await wait(()=>read()!==initial);assert.equal(await app.locator('[data-rt-stroke-alignment]').count(),2);}
 }
 await page.getByRole('treeitem',{name:'g · Vectors',exact:true}).click();await settled();await card.click({modifiers:['Meta']});await settled();await page.getByLabel('Selection X',{exact:true}).waitFor();
 await history(async()=>{const field=page.getByLabel('Selection X',{exact:true});await field.fill((Number(await field.inputValue())+6).toString());await field.press('Enter');},[1,0,0,1,6,0]);
 await undo();await wait(()=>read()===initial);await card.click();await settled();console.log('PASS mixed and retained vector selections: shared transforms, rendered matrices, atomic refusal, held-key/canvas history and original paint preservation');
};
