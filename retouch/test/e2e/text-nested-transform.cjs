'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,box,read,wait,settled})=>{
 const source=read(),rotation=page.getByLabel('Rotation (°)',{exact:true});await rotation.fill('25');await rotation.press('Enter');await settled();await wait(()=>read()!==source);const rotated=read();
 await page.getByRole('button',{name:'Flip horizontally',exact:true}).click();await settled();await wait(()=>read()!==rotated);const flipped=read();
 const transform=()=>box.evaluate(el=>{const css=getComputedStyle(el);return {rotate:css.rotate,scale:css.scale};});const before=await transform();assert.equal(before.rotate,'25deg');assert.ok(before.scale.startsWith('-1'));
 await require('./text-local-move.cjs')({page,box,read,wait,settled});assert.equal(read(),flipped);assert.deepEqual(await transform(),before);
 await page.getByRole('button',{name:'Move on canvas',exact:true}).click();await page.locator('.canvas-move-surface').waitFor();const inline=await box.getAttribute('style');try{await box.evaluate(el=>el.style.setProperty('rotate','50deg','important'));await wait(async()=>await page.locator('.canvas-move-surface').count()===0);assert.equal(read(),flipped,'changing the layer transform cancels the gesture');}finally{await box.evaluate((el,value)=>{if(value===null)el.removeAttribute('style');else el.setAttribute('style',value);},inline);}await settled();
 await page.getByRole('button',{name:'Align left',exact:true}).click();await settled();await wait(()=>read()!==flipped);
 const left=await box.evaluate(el=>{const css=getComputedStyle(el),width=parseFloat(css.width),height=parseFloat(css.height),angle=25*Math.PI/180;return parseFloat(css.left)+width/2-(Math.cos(angle)*width+Math.sin(angle)*height)/2;});assert.ok(Math.abs(left)<.7,'alignment uses the rotated and reflected visible bounds inside the frame');assert.deepEqual(await transform(),before);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===flipped);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===rotated);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===source);
};
