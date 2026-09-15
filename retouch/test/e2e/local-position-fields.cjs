'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,box,read,wait,settled})=>{
 const source=read(),measure=()=>box.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,style:el.getAttribute('style')};}),before=await measure();
 const axes=await box.evaluate(el=>{const m=parent.RetouchSVGDraw.nativeSpace(el.offsetParent).matrix;return {x:{x:m.a,y:m.b},y:{x:m.c,y:m.d}};});
 const check=async(axis,delta)=>{const actual=await measure();for(const key of ['x','y','width','height'])assert.ok(Math.abs(actual[key]-before[key]-(key==='x'||key==='y'?axes[axis][key]*delta:0))<.8,axis+' field preserves rendered '+key);};
 for(const axis of ['x','y']){
  const input=page.getByLabel(axis.toUpperCase(),{exact:true}),start=Number(await input.inputValue()),label=input.locator('..').locator('span').first();
  for(const cancel of [true,false]){
   const r=await label.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+20,r.y+r.height/2,{steps:4});const delta=Number(await input.inputValue())-start;assert.ok(Math.abs(delta)>0,'scrub changes field');assert.equal(read(),source,'source unchanged during scrub');await check(axis,delta);
   if(cancel){await page.keyboard.press('Escape');await page.mouse.up();await check(axis,0);assert.equal((await measure()).style,before.style,'Escape restores exact inline style');assert.equal(read(),source);}
   else{await page.mouse.up();await settled();await wait(()=>read()!==source);await check(axis,delta);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===source);await check(axis,0);}
  }
 }
 console.log('PASS local X/Y scrubbing preserves authored translation, live geometry, Escape and exact source undo');
};
