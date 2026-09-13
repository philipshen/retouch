'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),palette=require('../../shell/palette-values.js');
exports.run=async({page,app,file,wait,settled})=>{
 const read=()=>fs.readFileSync(file,'utf8'),original=read(),cases=[['Gradient box','fill']];if(await app.locator('[aria-label="Stroke gradient"]').count())cases.push(['Stroke gradient','stroke']);
 const edit=async(label,value)=>{const field=page.getByLabel(label,{exact:true});await field.fill(value);await field.press('Tab');await settled();};
 for(const [label,paint]of cases){
  await page.getByRole('treeitem',{name:'rect · '+label,exact:true}).click();await settled();const layer=app.locator('[aria-label="'+label+'"]'),id=await layer.getAttribute('data-rt');
  await edit('Stop 1 color','rgba(255, 0, 0, 0.5)');await edit('Stop 1 opacity','25%');await wait(async()=>await app.locator('#paint > stop').first().getAttribute('stop-opacity')==='25%');const before=read();
  await page.getByLabel('Gradient type',{exact:true}).selectOption('solid');await settled();await wait(async()=>!(await layer.getAttribute(paint)).startsWith('url('));const solid=read(),color=palette.parse(await layer.getAttribute(paint));assert.equal(color.alpha,.125);assert.deepEqual(color.channels,[1,0,0]);assert.equal(await layer.getAttribute('data-rt'),id);assert.equal(await app.locator('#paint').count(),1);assert.equal(await app.locator('[aria-label="Shared gradient"]').getAttribute('fill'),'url(#paint)');assert.equal(await app.locator('#paint > stop').first().getAttribute('stop-opacity'),'25%');assert.equal(await page.getByLabel(paint==='fill'?'Fill type':'Stroke type',{exact:true}).inputValue(),'solid');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===before);await wait(async()=>await layer.getAttribute(paint)==='url(#paint)');await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===solid);await wait(async()=>!(await layer.getAttribute(paint)).startsWith('url('));
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===before);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
 }
 await page.getByRole('treeitem',{name:'rect · Gradient box',exact:true}).click();await settled();console.log('PASS SVG gradient to solid: first-stop alpha, selected fill/stroke, shared resource preservation, visible type and exact history');
};
