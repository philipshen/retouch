'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,read,settled,wait})=>{
 const initial=read(),models=()=>page.evaluate(()=>sel.multiple.map(info=>({id:info.id,definitionId:info.svgStrokeSource.definitionId,model:info.svgStrokeSource.model})));
 const original=await models(),undo=async()=>{await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();};
 const verify=async(property,value)=>{
  assert.equal(await page.getByLabel('Shared stroke weight',{exact:true}).isDisabled(),false);
  const states=await models();assert.equal(states.length,2);states.forEach((state,i)=>{assert.equal(state.definitionId,original[i].definitionId);assert.equal(state.model[property],value);assert.equal(state.model.path,original[i].model.path);assert.deepEqual(state.model.matrix,original[i].model.matrix);});
  await page.evaluate(()=>{for(const info of sel.multiple)RetouchSVGStrokeFidelity.check(matchingEls(info.id)[0],info.svgStrokeSource.model,info.svgStrokeSource.definitionId);});
  assert.equal(await app.locator('input').inputValue(),'retained draft');assert.equal(await app.locator('input').evaluate(()=>window.strokeDocument),'same');
 };
 const weight=page.getByLabel('Shared stroke weight',{exact:true});assert.equal(await weight.isDisabled(),false);assert.equal(await weight.inputValue(),'');assert.equal(await weight.getAttribute('placeholder'),'Mixed');
 // A late CSS override on one member refuses all members at save time.
 await app.locator('head').evaluate((head,id)=>{const style=head.ownerDocument.createElement('style');style.id='shared-stroke-override';style.textContent='[data-rt="'+id+'"] > g:last-child > path{stroke:lime!important}';head.append(style);},original[1].id);
 assert.equal(await page.evaluate(()=>writeSVGStrokeSelection(sel.multiple,'width',12)),false);assert.equal(read(),initial);await app.locator('#shared-stroke-override').evaluate(el=>el.remove());
 for(const [property,label,value,select]of [['position','Shared stroke alignment','outside',true],['position','Shared stroke alignment','center',true],['width','Shared stroke weight',12.5,false],['linecap','Shared SVG line ends','round',true],['linejoin','Shared SVG line joins','bevel',true],['miterlimit','Shared SVG miter limit',7,false],['dasharray','Shared SVG dash pattern','4 2',false],['dashoffset','Shared SVG dash offset',3,false]]){
  const input=page.getByLabel(label,{exact:true});assert.equal(await input.isDisabled(),false,label);if(select)await input.selectOption(value);else{await input.fill(String(value));await input.press('Enter');}await settled();await wait(()=>read()!==initial);const after=read();await verify(property,value);
  await undo();await wait(()=>read()===initial);await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===after);await verify(property,value);await undo();await wait(()=>read()===initial);
 }
 await weight.fill('10');await weight.press('Enter');await settled();await wait(()=>read()!==initial);const common=read();
 await weight.focus();await page.keyboard.down('ArrowUp');await page.keyboard.down('ArrowUp');assert.equal(await weight.inputValue(),'12');assert.equal(read(),common);await page.keyboard.press('Escape');await page.keyboard.up('ArrowUp');assert.equal(await weight.inputValue(),'10');assert.equal(read(),common);await verify('width',10);
 await weight.focus();await page.keyboard.down('ArrowUp');await page.keyboard.down('ArrowUp');assert.equal(read(),common);await page.keyboard.up('ArrowUp');await settled();await wait(()=>read()!==common);await verify('width',12);await undo();await wait(()=>read()===common);await verify('width',10);await undo();await wait(()=>read()===initial);assert.equal(await weight.inputValue(),'');
 console.log('PASS shared retained stroke settings: mixed values, atomic CSS refusal, alignment/weight/style, grouped previews and exact history');
};
