'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,read,wait,settled})=>{
 const box=app.locator('main > p').last(),source=read();await page.getByRole('treeitem',{name:'p · Matrix text',exact:true}).click();await settled();
 const transform=()=>box.evaluate(el=>{const s=getComputedStyle(el);return [s.transform,s.transformOrigin,s.rotate,s.scale];}),original=await transform();
 await require('./text-local-move.cjs')({page,box,read,wait,settled});await require('./local-resize.cjs')({page,box,read,wait,settled});assert.equal(read(),source);assert.deepEqual(await transform(),original);
 await page.getByRole('button',{name:'Align left',exact:true}).click();await settled();await wait(()=>read()!==source);
 const minX=await box.evaluate(el=>{const own=parent.RetouchSVGDraw.nativeSpace(el).matrix,frame=parent.RetouchSVGDraw.nativeSpace(el.offsetParent).matrix.inverse(),css=getComputedStyle(el),width=parseFloat(css.width),height=parseFloat(css.height);return Math.min(...[[0,0],[width,0],[width,height],[0,height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(own).matrixTransform(frame).x));});assert.ok(Math.abs(minX)<.8,'matrix-transformed visual edge aligns with frame: '+minX);assert.deepEqual(await transform(),original);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===source);
 console.log('PASS matrix transform preserved through live movement, keyboard nudging, visual alignment, cancellation and exact undo');
};
