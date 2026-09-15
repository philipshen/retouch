'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,read,wait,settled})=>{
 const image=!!process.env.RT_E2E_MATRIX_POSITION_IMAGE,box=image?app.getByAltText('Matrix image',{exact:true}):app.locator('main > p').filter({hasText:'Matrix text'}),source=read();await page.getByRole('treeitem',{name:image?'img · Matrix image':'p · Matrix text',exact:true}).click();await settled();if(image)await box.evaluate(el=>el.decode());
 const imageState=()=>box.evaluate(el=>{const css=getComputedStyle(el);return [el.getAttribute('src'),css.objectFit,css.objectPosition,el.naturalWidth,el.naturalHeight];}),originalImage=image?await imageState():null;
 const transform=()=>box.evaluate(el=>{const s=getComputedStyle(el);return [s.transform,s.transformOrigin,s.rotate,s.scale,s.translate,s.transformBox];}),original=await transform();
 if(process.env.RT_E2E_MATRIX_POSITION_FLOW){await require('./flow-local-rotation.cjs')({page,box,read,wait,settled});return;}
 if(process.env.RT_E2E_MATRIX_POSITION_HANDLES)await require('./local-selection-handles.cjs')({page,box,read,wait,settled});
 if(process.env.RT_E2E_MATRIX_POSITION_ROTATE)await require('./local-rotation.cjs')({page,box,read,wait,settled});
 await require('./local-position-fields.cjs')({page,box,read,wait,settled});
 await require('./text-local-move.cjs')({page,box,read,wait,settled});await require('./local-resize.cjs')({page,box,read,wait,settled});assert.equal(read(),source);assert.deepEqual(await transform(),original);
 await page.getByRole('button',{name:'Align left',exact:true}).click();await settled();await wait(()=>read()!==source);
 const minX=Math.min(...(await box.evaluate(require('./border-geometry.cjs'))).points.map(p=>p.localX));assert.ok(Math.abs(minX)<.8,'matrix-transformed visual edge aligns with frame: '+minX);assert.deepEqual(await transform(),original);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===source);
 if(process.env.RT_E2E_MATRIX_POSITION_INLINE_ROTATE){const heading=app.locator('h1'),headingStyle=await heading.getAttribute('style'),imageStyle=await box.getAttribute('style');await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click({modifiers:['Meta']});await settled();const shared=page.getByLabel('Shared Rotation (°)',{exact:true});await shared.fill('45');await shared.press('Enter');await settled();await wait(()=>read()!==source);for(const el of [heading,box])assert.equal(await el.evaluate(el=>getComputedStyle(el).rotate),'45deg');assert.equal(await heading.getAttribute('style'),headingStyle);assert.equal(await box.getAttribute('style'),imageStyle);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===source);assert.equal(await heading.evaluate(el=>getComputedStyle(el).rotate),'15deg');await page.getByRole('treeitem',{name:image?'img · Matrix image':'p · Matrix text',exact:true}).click();await settled();}
 if(image)assert.deepEqual(await imageState(),originalImage,'geometry editing preserves image source and crop');
 console.log('PASS matrix transform preserved through live movement, keyboard nudging, visual alignment, cancellation and exact undo');
};
