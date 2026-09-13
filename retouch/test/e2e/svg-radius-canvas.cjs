'use strict';
const assert=require('node:assert/strict');
module.exports=async function canvasRadius({page,app,kind,read,wait,settled}){
 const original=read(),rect=app.locator('main > svg > rect'),surface=page.getByLabel('Round rectangle corners on canvas',{exact:true}),input=page.getByLabel('Rectangle corner radius',{exact:true});
 const select=async()=>{await page.getByRole('treeitem',{name:'rect',exact:true}).click();await settled();};
 const attrs=()=>rect.evaluate(el=>[el.getAttribute('rx'),el.getAttribute('ry')]);
 await select();const values=await attrs();
 const handle=page.getByRole('button',{name:'Round corners from top left',exact:true});
 const ready=()=>page.locator('.svg-radius-handles').getByRole('button',{name:'Round corners from top left',exact:true}).waitFor({state:'visible'});
 const move=async(dx,dy)=>{const r=await handle.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await surface.waitFor();await page.mouse.move(r.x+r.width/2+dx,r.y+r.height/2+dy,{steps:4});};
 for(const zoom of ['50','100','200']){
  await page.getByLabel('Canvas zoom (%)',{exact:true}).fill(zoom);await page.getByLabel('Canvas zoom (%)',{exact:true}).press('Enter');await select();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await ready();
  const f=await page.locator('#app').boundingBox(),size=await app.locator('body').evaluate(()=>innerWidth),scale=f.width/size;
  await move(10*scale,10*scale);assert.equal(read(),original);assert.deepEqual(await attrs(),['15','15']);await page.mouse.up();await surface.waitFor({state:'detached'});await settled();await wait(()=>read()!==original);const changed=read();assert.equal(await input.inputValue(),'15');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);assert.deepEqual(await attrs(),values);await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===changed);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
 }
 await ready();await move(10,10);await page.keyboard.press('Escape');await page.mouse.up();await surface.waitFor({state:'detached'});assert.equal(read(),original);assert.deepEqual(await attrs(),values);
 await page.getByRole('button',{name:'Edit corner radius on canvas',exact:true}).click();await surface.waitFor();await page.keyboard.press('ArrowUp');await page.keyboard.press('Shift+ArrowUp');assert.deepEqual(await attrs(),['16','16']);assert.equal(read(),original);await page.keyboard.press('Enter');await settled();await wait(()=>read()!==original);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
 await ready();await move(10,10);await rect.evaluate(el=>el.setAttribute('width','90'));await surface.waitFor({state:'detached'});await page.mouse.up();assert.equal(read(),original);assert.deepEqual(await attrs(),values);await rect.evaluate(el=>el.setAttribute('width','80'));await select();
 await ready();await move(10,10);await rect.evaluate(el=>el.setAttribute('rx','19'));await surface.waitFor({state:'detached'});await page.mouse.up();assert.deepEqual(await attrs(),['19',values[1]]);assert.equal(read(),original);await rect.evaluate((el,value)=>el.setAttribute('rx',value),values[0]);await select();
 await ready();await move(10,10);await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).dispatchEvent('click');await surface.waitFor({state:'detached'});await page.mouse.up();assert.deepEqual(await attrs(),values);assert.equal(read(),original);await select();
 await page.getByRole('button',{name:'Edit corner radius on canvas',exact:true}).click();await surface.waitFor();await page.keyboard.press('Home');assert.deepEqual(await attrs(),['0','0']);await page.keyboard.press('End');assert.deepEqual(await attrs(),['30','30']);assert.equal(read(),original);await page.keyboard.press('Escape');assert.deepEqual(await attrs(),values);
 // SVG transforms must map pointer movement to the rectangle's local coordinates.
 await rect.evaluate(el=>el.setAttribute('transform','translate(12 6) rotate(12 50 40) scale(.8 1.1)'));await ready();
 const transform=await rect.evaluate(el=>{const m=el.getScreenCTM();return {dx:10*(m.a+m.c),dy:10*(m.b+m.d)};}),f=await page.locator('#app').boundingBox(),size=await app.locator('body').evaluate(()=>innerWidth),scale=f.width/size;
 await move(transform.dx*scale,transform.dy*scale);const transformed=await attrs();assert.equal(transformed[0],transformed[1]);assert.ok(Math.abs(Number(transformed[0])-15)<.1,'Transformed pointer rounding stays below a tenth of an SVG unit');assert.equal(read(),original);
 if(process.env.RT_E2E_SVG_RADIUS_CANVAS_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_SVG_RADIUS_CANVAS_SCREENSHOT});
 await page.keyboard.press('Escape');await page.mouse.up();await surface.waitFor({state:'detached'});assert.deepEqual(await attrs(),values);await rect.evaluate(el=>el.removeAttribute('transform'));assert.equal(read(),original);
 console.log('SVG CANVAS RADIUS: zoom, transformed pointer mapping, previews, keyboard, cancellation and single-step history PASS '+kind);
};
