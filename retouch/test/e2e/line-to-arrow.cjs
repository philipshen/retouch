'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,shape,read,wait,settled})=>{
 const original=read(),id=await shape.getAttribute('data-rt'),snapshot=await shape.evaluate(el=>({endpoints:['x1','y1','x2','y2'].map(k=>Number(el.getAttribute(k)||0)),stroke:getComputedStyle(el).stroke,width:getComputedStyle(el).strokeWidth}));
 const action=page.getByRole('button',{name:'Convert line to arrow',exact:true});await action.waitFor();assert.equal(await action.evaluate(el=>!!el.closest('[data-section="stroke"]')),true);
 for(const property of ['stroke','fill']){
  await shape.evaluate((el,property)=>{const style=el.ownerDocument.createElement('style');style.id='arrow-conversion-override';style.textContent='path[data-rt="'+el.getAttribute('data-rt')+'"]{'+property+':red!important}';el.ownerDocument.head.append(style);},property);
  await action.click();await settled();assert.equal(read(),original,'CSS overrides refuse conversion without source writes');
  await page.getByText('CSS changes the appearance of this shape when converted. Conversion is unavailable for these styles.',{exact:true}).first().waitFor();
  await shape.evaluate(el=>el.ownerDocument.getElementById('arrow-conversion-override').remove());
 }
 await shape.evaluate(el=>el.setAttribute('marker-end','url(#existing-marker)'));await action.click();await settled();assert.equal(read(),original);
 await page.getByText('Remove SVG markers before converting this shape.',{exact:true}).first().waitFor();await shape.evaluate(el=>el.removeAttribute('marker-end'));
 await action.click();await wait(()=>read()!==original);await settled();
 const arrow=page.frameLocator('#app').locator('[data-rt="'+id+'"]');await wait(async()=>await arrow.evaluate(el=>el.tagName.toLowerCase())==='path');
 const actual=await arrow.evaluate(el=>({stroke:getComputedStyle(el).stroke,width:getComputedStyle(el).strokeWidth,fill:getComputedStyle(el).fill}));
 actual.endpoints=require('../../shell/svg-parametric.js').pointsFromPath(await arrow.getAttribute('d')).split(' ').slice(0,2).flatMap(p=>p.split(',').map(Number));assert.deepEqual(actual.endpoints,snapshot.endpoints);assert.equal(actual.stroke,snapshot.stroke);assert.equal(actual.width,snapshot.width);assert.equal(actual.fill,'none');
 await page.getByLabel('Arrowhead length',{exact:true}).waitFor({state:'attached'});const converted=read();
 await require('./arrow-parameters.cjs')({page,shape:arrow,read,wait,settled});assert.equal(read(),converted);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await shape.waitFor({state:'attached'});assert.equal(await shape.getAttribute('data-rt'),id);
 await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===converted);await settled();await page.getByLabel('Arrowhead length',{exact:true}).waitFor({state:'attached'});
 await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await shape.waitFor({state:'attached'});
};
