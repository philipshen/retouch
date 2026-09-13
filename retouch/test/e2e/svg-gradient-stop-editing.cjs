'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,file,wait,settled})=>{
 const read=()=>fs.readFileSync(file,'utf8'),original=read(),stops=app.locator('#paint > stop');
 const undo=async expected=>{await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===expected);};
 const redo=async expected=>{await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===expected);};
 assert.ok(await page.getByRole('button',{name:'Remove gradient stop 1',exact:true}).isDisabled());
 for(const method of ['button','rail']){
  if(method==='button')await page.getByRole('button',{name:'Add gradient stop',exact:true}).click();else{const rail=page.getByRole('button',{name:'Add gradient stop at position',exact:true});await rail.scrollIntoViewIfNeeded();const box=await rail.boundingBox();await rail.click({position:{x:box.width*.25,y:box.height/2}});}
  await settled();await wait(async()=>await stops.count()===3);const added=read();assert.notEqual(added,original);assert.ok(Math.abs(Number(await stops.nth(1).getAttribute('offset'))-(method==='button'?.5:.25))<.01);assert.equal(await stops.nth(1).getAttribute('stop-opacity'),'1');
  await page.getByRole('button',{name:'Select gradient stop 2',exact:true}).click();assert.ok(await page.getByLabel('Stop 2 color',{exact:true}).evaluate(el=>el===document.activeElement));
  await undo(original);await wait(async()=>await stops.count()===2);await redo(added);await wait(async()=>await stops.count()===3);
  await page.getByRole('button',{name:'Remove gradient stop 2',exact:true}).click();await settled();await wait(()=>read()===original);await wait(async()=>await stops.count()===2);await undo(added);await wait(async()=>await stops.count()===3);await redo(original);await wait(async()=>await stops.count()===2);
 }
 console.log('PASS gradient stop midpoint and rail insertion, removal, minimum stops, focus and exact undo/redo');
};
