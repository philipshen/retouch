'use strict';
const assert=require('node:assert/strict'),A=require('../../shell/svg-affine.js');
module.exports=async({page,app,cases,select,read,wait,settled,original,kind})=>{
 // Revision stamps change on React refresh; authored content and stable IDs must not.
 for(const [tag,name]of cases){await select(tag,name);const target=app.locator('svg [aria-label="'+name+'"]');
  for(const [axis,label]of [['x','Flip horizontally'],['y','Flip vertically']]){
   const before=await target.evaluate(el=>{const g=el.getBBox(),m=el.parentElement.getScreenCTM().inverse().multiply(el.getScreenCTM());return {g:{x:g.x,y:g.y,width:g.width,height:g.height},m:[m.a,m.b,m.c,m.d,m.e,m.f],content:el.innerHTML.replace(/\sdata-rt-revision="[^"]*"/g,''),path:el.getAttribute('d'),points:el.getAttribute('points')};});
   await page.getByRole('button',{name:label,exact:true}).click();await settled();await wait(()=>read()!==original);const after=await target.evaluate(el=>{const m=el.parentElement.getScreenCTM().inverse().multiply(el.getScreenCTM());return {m:[m.a,m.b,m.c,m.d,m.e,m.f],content:el.innerHTML.replace(/\sdata-rt-revision="[^"]*"/g,''),path:el.getAttribute('d'),points:el.getAttribute('points')};});assert.ok(A.equivalent(after.m,A.reflect(before.m,before.g,axis)),name+' '+axis+' reflects the expected axis');assert.equal(after.content,before.content);assert.equal(after.path,before.path);assert.equal(after.points,before.points);const changed=read();
   if(name==='Curve'&&axis==='x'&&process.env.RT_E2E_SVG_FLIP_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_SVG_FLIP_SCREENSHOT});
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===changed);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
  }console.log('SVG FLIP PASS',kind,name);
 }
 await select('rect','Box');await app.locator('body').evaluate(el=>{el.tabIndex=-1;el.focus();});await page.keyboard.press('Shift+H');await settled();await wait(()=>read()!==original);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
 await require('./shape-tools.cjs').run(page,'Flip vertically');await settled();await wait(()=>read()!==original);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
 const field=page.getByRole('textbox',{name:'Vector X',exact:true});await field.focus();await page.keyboard.press('Shift+H');assert.equal(read(),original);await select('rect','Box');console.log('SVG FLIP: both axes, content preservation, shortcuts, editable guard and exact history PASS '+kind);
};
