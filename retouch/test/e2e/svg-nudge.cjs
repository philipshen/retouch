'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,select,read,wait,settled,original,kind})=>{
 const surface=page.getByLabel('Move SVG vector on canvas',{exact:true});
 const center=target=>target.evaluate(el=>{const g=el.getBBox(),m=el.getScreenCTM();return {x:m.a*(g.x+g.width/2)+m.c*(g.y+g.height/2)+m.e,y:m.b*(g.x+g.width/2)+m.d*(g.y+g.height/2)+m.f};});
 for(const [tag,name] of [['rect','Box'],['g','Group'],['text','Text']]){
  await select(tag,name);const target=app.locator('[aria-label="'+name+'"]'),before=await center(target);await app.locator('body').evaluate(el=>{el.tabIndex=-1;el.focus({preventScroll:true});});
  await page.keyboard.down('ArrowRight');await surface.waitFor();await page.keyboard.down('ArrowRight');await page.keyboard.down('Shift');await page.keyboard.down('ArrowDown');await page.keyboard.up('ArrowRight');assert.equal(await surface.isVisible(),true,'overlapping held arrows remain one gesture');assert.equal(read(),original);const preview=await center(target);assert.ok(Math.abs(preview.x-before.x-2)<.1&&Math.abs(preview.y-before.y-10)<.1,name+' follows canvas axes through ancestor transforms '+JSON.stringify({before,preview}));await page.keyboard.up('ArrowDown');await page.keyboard.up('Shift');await surface.waitFor({state:'detached'});await settled();await wait(()=>read()!==original);const changed=read();
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===changed);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
 }
 await select('rect','Box');await app.locator('body').evaluate(el=>{el.tabIndex=-1;el.focus({preventScroll:true});});await page.keyboard.down('ArrowLeft');await surface.waitFor();await page.keyboard.press('Escape');await page.keyboard.up('ArrowLeft');assert.equal(read(),original);assert.equal(await surface.isVisible(),false);assert.equal(Number(await page.getByRole('textbox',{name:'Vector width',exact:true}).inputValue()),60);
 for(const zoom of ['50','200']){
  const zoomInput=page.getByLabel('Canvas zoom (%)',{exact:true});await zoomInput.fill(zoom);await zoomInput.press('Enter');await select('rect','Box');const target=app.locator('[aria-label="Box"]'),before=await center(target);await app.locator('body').evaluate(el=>{el.tabIndex=-1;el.focus({preventScroll:true});});await page.keyboard.press('ArrowRight');await settled();await wait(()=>read()!==original);const after=await center(target);assert.ok(Math.abs(after.x-before.x-1)<.1&&Math.abs(after.y-before.y)<.1,'one document pixel at '+zoom+'% zoom');await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
 }
 await page.getByLabel('Canvas zoom (%)',{exact:true}).fill('100');await page.getByLabel('Canvas zoom (%)',{exact:true}).press('Enter');await select('rect','Box');
 const input=page.getByRole('textbox',{name:'Vector X',exact:true});await input.focus();await page.keyboard.press('ArrowLeft');assert.equal(await surface.isVisible(),false);assert.equal(read(),original);
 console.log('SVG NUDGE: canvas axes, held/repeated keys, Shift, exact grouped history, Escape and input guard PASS '+kind);
};
