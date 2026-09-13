'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,file,wait,settled})=>{
 const read=()=>fs.readFileSync(file,'utf8'),before=read();await page.getByRole('button',{name:'Add gradient stop',exact:true}).click();await settled();await wait(async()=>await app.locator('#paint > stop').count()===3);const original=read();
 const middle=()=>app.locator('#paint > stop').nth(1),value=()=>middle().evaluate(node=>node.offset.baseVal),handle=()=>page.getByRole('button',{name:'Select gradient stop 2',exact:true});
 const history=async changed=>{await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);await wait(async()=>Math.abs(await value()-.5)<.001);await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===changed);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);};
 const start=async()=>{await handle().scrollIntoViewIfNeeded();const h=await handle().boundingBox(),rail=await page.getByRole('button',{name:'Add gradient stop at position',exact:true}).boundingBox();await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();return {x:h.x+h.width/2,y:h.y+h.height/2,width:rail.width};};
 for(const zoom of [50,100,200]){
  const field=page.getByLabel('Canvas zoom (%)',{exact:true});await field.fill(String(zoom));await field.press('Enter');await settled();
  let p=await start();await page.mouse.move(p.x+p.width*.2,p.y,{steps:6});await wait(async()=>Math.abs(await value()-.7)<.005);assert.equal(read(),original,'drag preview must not write source');await page.keyboard.press('Escape');await page.mouse.up();await wait(async()=>Math.abs(await value()-.5)<.001);assert.equal(read(),original);
  p=await start();await page.mouse.move(p.x+p.width*.2,p.y,{steps:6});await wait(async()=>Math.abs(await value()-.7)<.005);assert.equal(read(),original);await page.mouse.up();await settled();await wait(()=>read()!==original);await history(read());
 }
 await handle().focus();await page.keyboard.down('ArrowRight');await page.keyboard.down('ArrowRight');await wait(async()=>Math.abs(await value()-.52)<.001);assert.equal(read(),original);await page.keyboard.up('ArrowRight');await settled();await wait(()=>read()!==original);assert.ok(await handle().evaluate(el=>el===document.activeElement));await history(read());
 // Stops remain within the gradient range, with precise keyboard modifiers.
 let bounded=await start();await page.mouse.move(bounded.x+bounded.width,bounded.y,{steps:5});await wait(async()=>await value()===1);assert.equal(read(),original);await page.keyboard.press('Escape');await page.mouse.up();await wait(async()=>Math.abs(await value()-.5)<.001);
 for(const [modifier,expected]of [['Shift',.6],['Alt',.501]]){await handle().focus();await page.keyboard.down(modifier);await page.keyboard.down('ArrowRight');await wait(async()=>Math.abs(await value()-expected)<.0001);assert.equal(read(),original);await page.keyboard.press('Escape');await page.keyboard.up('ArrowRight');await page.keyboard.up(modifier);await wait(async()=>Math.abs(await value()-.5)<.001);assert.equal(read(),original);}
 // External changes must survive cancellation; restore only the owned offset.
 const p=await start();await page.mouse.move(p.x+p.width*.15,p.y,{steps:4});await wait(async()=>Math.abs(await value()-.65)<.005);await middle().evaluate(node=>node.setAttribute('stop-opacity','0.3'));await wait(async()=>Math.abs(await value()-.5)<.001);await page.mouse.up();assert.equal(await middle().getAttribute('stop-opacity'),'0.3');assert.equal(read(),original);await middle().evaluate(node=>node.setAttribute('stop-opacity','1'));
 await page.getByRole('button',{name:'Remove gradient stop 2',exact:true}).click();await settled();await wait(()=>read()===before);
 console.log('PASS SVG stop dragging: 50/100/200 zoom, live preview, Escape, held arrows, focus, external changes and grouped history');
};
