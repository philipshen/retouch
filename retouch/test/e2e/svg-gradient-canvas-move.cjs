'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,file,wait,settled})=>{
 const read=()=>fs.readFileSync(file,'utf8'),original=read(),surface=page.getByLabel('Edit gradient on canvas',{exact:true});
 for(const [label,id,linear]of [['Gradient box','paint',true],['Radial box','radial',false]]){
  await page.getByRole('button',{name:'Fit screen',exact:true}).click();await settled();await page.getByRole('treeitem',{name:'rect · '+label,exact:true}).click();await settled();
  const open=async()=>{await page.getByRole('button',{name:'Edit fill gradient on canvas',exact:true}).click();await wait(async()=>await surface.count()===1);};
  const drag=async cancel=>{await open();const box=await page.getByRole('button',{name:'Move entire gradient',exact:true}).boundingBox();assert.ok(box);const x=box.x+box.width/2,y=box.y+box.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+32,y+24,{steps:4});await wait(async()=>await app.locator('#'+id).getAttribute(linear?'x1':'cx')!==null);assert.equal(read(),original);if(cancel)await page.keyboard.press('Escape');await page.mouse.up();await settled();};
  await drag(true);await wait(async()=>await surface.count()===0);assert.equal(read(),original);assert.equal(await app.locator('#'+id).getAttribute(linear?'x1':'cx'),null);
  await drag(false);await wait(()=>read()!==original);const moved=read(),node=app.locator('#'+id),viewport=await node.getAttribute('gradientUnits')==='userSpaceOnUse';
  if(linear){assert.ok(Math.abs(Number(await node.getAttribute('x2'))-Number(await node.getAttribute('x1'))-(viewport?400:1))<1e-6);assert.equal(await node.getAttribute('y1'),await node.getAttribute('y2'));}else{assert.equal(await node.getAttribute('r'),null);assert.equal(await node.getAttribute('cx'),await node.getAttribute('fx'));assert.equal(await node.getAttribute('cy'),await node.getAttribute('fy'));}
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===moved);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
  await open();await page.getByRole('button',{name:'Move entire gradient',exact:true}).focus();await page.keyboard.press('Shift+ArrowDown');assert.equal(read(),original);await page.keyboard.press('Enter');await settled();await wait(()=>read()!==original);if(linear)assert.equal(await node.getAttribute('y1'),viewport?'10':'0.1');else assert.equal(await node.getAttribute('cy'),viewport?'130':'0.6');await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
 }
 console.log('PASS whole gradient movement: line drag, linear separation, radial radius/focus, keyboard, Escape and exact source undo/redo');
};
