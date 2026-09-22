'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,read,settled,wait})=>{
 const entry=read(),card=page.getByRole('treeitem',{name:'rect · Card',exact:true}),circle=page.getByRole('treeitem',{name:'circle',exact:true});
 const select=async()=>{await card.click();await settled();await circle.click({modifiers:['Meta']});await settled();};
 const undo=async()=>{await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();};
 // Different RGB and alpha values exercise per-member writes through the UI.
 await circle.click();await settled();const single=page.getByLabel('SVG fill',{exact:true});await single.fill('#0088ff80');await single.press('Tab');await settled();await wait(()=>read()!==entry);await select();
 const initial=read(),models=()=>page.evaluate(()=>sel.multiple.map(info=>({id:info.id,definitionId:info.svgStrokeSource.definitionId,model:info.svgStrokeSource.model}))),original=await models();
 const paints=property=>page.evaluate(property=>sel.multiple.map(info=>{const model=info.svgStrokeSource.model,paint=RetouchPaintPicker.parsePaint(model[property]);return paint?{channels:paint.channels,space:paint.space,alpha:paint.alpha*model[property+'Opacity']}:{none:true};}),property);
 const verify=async()=>{
  const states=await models();assert.equal(states.length,2);states.forEach((state,i)=>{assert.equal(state.definitionId,original[i].definitionId);assert.equal(state.model.path,original[i].model.path);assert.deepEqual(state.model.matrix,original[i].model.matrix);});
  await page.evaluate(()=>{for(const info of sel.multiple)RetouchSVGStrokeFidelity.check(matchingEls(info.id)[0],info.svgStrokeSource.model,info.svgStrokeSource.definitionId);});
  assert.equal(await app.locator('input').inputValue(),'retained draft');assert.equal(await app.locator('input').evaluate(()=>window.strokeDocument),'same');
 };
 const history=async(action,check)=>{const before=read();await action();await settled();await wait(()=>read()!==before);const after=read();await verify();await check();await undo();await wait(()=>read()===before);await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===after);await verify();await check();await undo();await wait(()=>read()===before);};
 const fillAlpha=page.getByLabel('Shared SVG fill opacity (%)',{exact:true});assert.equal(await fillAlpha.inputValue(),'');assert.equal(await fillAlpha.getAttribute('placeholder'),'Mixed');assert.equal(await fillAlpha.isDisabled(),false);
 for(const property of ['fill','stroke']){
  const input=page.getByLabel('Shared SVG '+property,{exact:true}),alpha=page.getByLabel('Shared SVG '+property+' opacity (%)',{exact:true}),beforePaint=await paints(property);
  await history(async()=>{await alpha.fill('40');await alpha.press('Enter');},async()=>{const changed=await paints(property);changed.forEach((paint,i)=>{assert.deepEqual(paint.channels,beforePaint[i].channels);assert.equal(paint.space,beforePaint[i].space);assert.ok(Math.abs(paint.alpha-.4)<1e-8);});});
  await history(async()=>{await input.fill('12AB34');await input.press('Tab');},async()=>{const changed=await paints(property);changed.forEach((paint,i)=>{[18,171,52].forEach((channel,j)=>assert.ok(Math.abs(paint.channels[j]-channel/255)<1e-6));assert.ok(Math.abs(paint.alpha-beforePaint[i].alpha)<1e-8);});});
  const markup=await app.locator('[data-rt-stroke-alignment]').evaluateAll(els=>els.map(el=>el.innerHTML));
  await page.getByRole('button',{name:'Edit Shared SVG '+property,exact:true}).click();const picker=page.getByRole('dialog',{name:'Edit Shared SVG '+property,exact:true}),value=page.getByLabel('Color value',{exact:true});await value.fill('#00ff00');
  await wait(()=>app.locator('[data-rt-stroke-alignment]').evaluateAll((els,property)=>els.every(el=>[...el.children[1].children].filter(el=>el.localName==='path')[property==='fill'?0:1].getAttribute(property)==='#00ff00'),property));assert.equal(read(),initial);await page.keyboard.press('Escape');await wait(async()=>await picker.count()===0);assert.deepEqual(await app.locator('[data-rt-stroke-alignment]').evaluateAll(els=>els.map(el=>el.innerHTML)),markup);assert.equal(read(),initial);
  await history(async()=>{await page.getByRole('button',{name:'Edit Shared SVG '+property,exact:true}).click();await value.fill('color(display-p3 0.2 0.6 0.8 / 0.5)');await page.getByRole('button',{name:'Apply color',exact:true}).click();},async()=>{for(const paint of await paints(property)){assert.equal(paint.space,'display-p3');assert.deepEqual(paint.channels,[.2,.6,.8]);assert.equal(paint.alpha,.5);}});
  await history(async()=>{await input.fill('none');await input.press('Tab');},async()=>{assert.ok((await paints(property)).every(paint=>paint.none));assert.equal(await alpha.isDisabled(),true);});
  await input.fill('none');await input.press('Tab');await settled();await wait(()=>read()!==initial);const empty=read();
  await history(async()=>{await input.fill('FF8800');await input.press('Tab');},async()=>{for(const paint of await paints(property)){[1,136/255,0].forEach((channel,i)=>assert.ok(Math.abs(paint.channels[i]-channel)<1e-6));assert.equal(paint.alpha,1);}});assert.equal(read(),empty);await undo();await wait(()=>read()===initial);
 }
 // A rendered override refuses the complete per-member color update.
 await app.locator('head').evaluate(head=>{const style=head.ownerDocument.createElement('style');style.id='shared-paint-override';style.textContent='[data-rt-stroke-alignment] > g:last-child > path{fill:lime!important}';head.append(style);});
 assert.equal(await page.evaluate(()=>writeSVGStrokeSelection(sel.multiple,'fill',['red','blue'])),false);assert.equal(read(),initial);await app.locator('#shared-paint-override').evaluate(el=>el.remove());
 await undo();await wait(()=>read()===entry);await select();
 console.log('PASS shared retained paints: mixed color/alpha, opacity preserves colors, hex preserves alpha, picker previews/P3/none and atomic history');
};
