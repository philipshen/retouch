'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,read,wait,settled})=>{
 const source=read(),box=app.locator('h1'),style=await box.getAttribute('style'),clip=page.getByRole('checkbox',{name:'Clip content',exact:true}),state=()=>box.evaluate(el=>{const css=getComputedStyle(el);el.scrollLeft=20;return {overflow:[css.overflowX,css.overflowY],scroll:el.scrollLeft,width:el.clientWidth,content:el.scrollWidth};});
 const before=await state();assert.ok(before.content>before.width);assert.equal(before.scroll,20);await clip.click();await settled();await wait(()=>read()!==source);const clipped=read();assert.deepEqual((await state()).overflow,['clip','clip']);assert.equal((await state()).scroll,0);assert.equal(await box.getAttribute('style'),style);
 await page.getByRole('button',{name:'Reset clipping',exact:true}).click();await settled();await wait(()=>read()!==clipped);assert.deepEqual((await state()).overflow,['auto','auto']);assert.equal((await state()).scroll,20);assert.equal(await box.getAttribute('style'),style);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===clipped);assert.deepEqual((await state()).overflow,['clip','clip']);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===source);assert.deepEqual(await state(),before);
 console.log('PASS single inline clipping, scroll behavior, reset and exact undo');
};
