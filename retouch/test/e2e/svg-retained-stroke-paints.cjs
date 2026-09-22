'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,read,settled,wait})=>{
 const sharp=require(process.env.RT_E2E_SHARP_ROOT||require('node:path').join(process.env.RT_INSPECTOR_FIXTURE,'node_modules/sharp')),sample=async(property,color)=>{const {data,info}=await sharp(await app.locator('svg[data-rt]').screenshot()).removeAlpha().raw().toBuffer({resolveWithObject:true}),offset=(Math.floor(info.height*.45)*info.width+Math.floor(info.width*(property==='fill'?.5:.22)))*3;assert.ok([...data.subarray(offset,offset+3)].every((value,i)=>Math.abs(value-color[i])<=5),'Rendered '+property+' paint pixels');};
 const initial=read(),group=app.locator('[data-rt-stroke-alignment]');
 for(const [property,value]of [['fill','#00ff00'],['stroke','#ff00ff']]){
  const path=group.locator(':scope > g:last-child > path')[property==='fill'?'first':'last'](),before=read(),markup=await group.innerHTML();
  await page.getByRole('button',{name:'Edit SVG '+property,exact:true}).click();
  const picker=page.getByRole('dialog',{name:'Edit SVG '+property,exact:true}),field=page.getByLabel('Color value',{exact:true});assert.equal(await picker.isVisible(),true);await field.fill(value);
  await wait(async()=>await path.getAttribute(property)===value);assert.equal(read(),before);
  await page.keyboard.press('Escape');await wait(async()=>await picker.count()===0);assert.equal(await group.innerHTML(),markup);assert.equal(read(),before);
  await page.getByRole('button',{name:'Edit SVG '+property,exact:true}).click();await field.fill(value);await page.getByRole('button',{name:'Apply color',exact:true}).click();await settled();await wait(()=>read()!==before);const after=read();assert.equal(await path.getAttribute(property),value);await sample(property,property==='fill'?[0,255,0]:[255,0,255]);
  assert.equal(await app.locator('input').inputValue(),'retained draft');assert.equal(await app.locator('input').evaluate(()=>window.strokeDocument),'same');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===before);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===after);assert.equal(await path.getAttribute(property),value);
  const opacity=page.getByLabel('SVG '+property+' opacity (%)',{exact:true});await opacity.fill('40');await opacity.press('Tab');await settled();await wait(()=>read()!==after);const rendered=await path.evaluate((el,property)=>getComputedStyle(el).getPropertyValue(property),property);const paint=await page.evaluate(value=>RetouchPaintPicker.parsePaint(value),rendered);assert.equal(paint.alpha,.4);assert.equal(await path.getAttribute(property+'-opacity'),'1');await sample(property,property==='fill'?[153,255,153]:[255,0,102]);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===after);
  const input=page.getByLabel('SVG '+property,{exact:true});await input.fill('none');await input.press('Tab');await settled();await wait(()=>read()!==after);assert.equal(await path.getAttribute(property),'none');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===after);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===before);
 }
 assert.equal(read(),initial);
};
