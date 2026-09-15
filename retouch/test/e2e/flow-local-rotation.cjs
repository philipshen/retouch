'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,box,read,wait,settled})=>{
 const source=read(),style=await box.getAttribute('style'),position=await box.evaluate(el=>getComputedStyle(el).position);assert.equal(position,process.env.RT_E2E_MATRIX_POSITION_FLOW==='static'?'static':'relative');
 const corner=page.getByRole('button',{name:'Rotate from top right corner',exact:true});await corner.waitFor();const outline=await page.locator('.affine-selection-outline.sel polygon').getAttribute('points'),expected=await box.evaluate(require('./border-geometry.cjs'));outline.split(' ').forEach((pair,i)=>{const [x,y]=pair.split(',').map(Number);assert.ok(Math.abs(x-expected.points[i].x)<.8&&Math.abs(y-expected.points[i].y)<.8,'flow selection outline follows transformed border');});
 const r=await corner.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.locator('.canvas-local-rotate-surface').waitFor();await page.mouse.move(r.x+r.width/2+25,r.y+r.height/2+20,{steps:4});assert.notEqual(await box.evaluate(el=>getComputedStyle(el).rotate),'25deg');assert.equal(read(),source);await page.keyboard.press('Escape');await page.mouse.up();assert.equal(await box.getAttribute('style'),style);assert.equal(read(),source);
 if(process.env.RT_E2E_MATRIX_POSITION_FLOW_RESIZE)await require('./flow-local-resize.cjs')({page,box,read,wait,settled});
 await require('./local-rotation.cjs')({page,box,read,wait,settled});assert.equal(await box.evaluate(el=>getComputedStyle(el).position),position);
 console.log('PASS transformed flow-layer rotation, direct corner, unchanged layout and sibling, exact undo');
};
