'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,file,wait,settled})=>{
 const read=()=>fs.readFileSync(file,'utf8'),original=read(),surface=page.getByLabel('Edit gradient on canvas',{exact:true}),cases=[['Gradient box','paint','linear','fill'],['Radial box','radial','radial','fill']];
 if(await app.locator('[aria-label="Stroke gradient"]').count())cases.push(['Stroke gradient','paint','linear','stroke']);
 await page.getByRole('button',{name:'Fit screen',exact:true}).click();await settled();
 const history=async(name,text)=>{await page.getByRole('button',{name,exact:true}).click();await settled();await wait(()=>read()===text);};
 for(const [label,id,type,paint]of cases){
  await page.getByRole('treeitem',{name:'rect · '+label,exact:true}).click();await settled();
  const open=async()=>{await page.getByRole('button',{name:'Edit '+paint+' gradient on canvas',exact:true}).click();await wait(async()=>await surface.count()===1);},definition=app.locator('#'+id);
  await open();await page.getByRole('button',{name:'Gradient color stop 1',exact:true}).focus();await page.keyboard.press('Delete');assert.equal(read(),original);assert.equal(await surface.count(),1);assert.equal(await definition.locator('stop').count(),2);
  const {x,y,length}=await page.getByRole('button',{name:'Move entire gradient',exact:true}).evaluate(el=>{const length=el.getTotalLength(),point=el.getPointAtLength(length/2).matrixTransform(el.getScreenCTM());return {x:point.x,y:point.y,length};});
  assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.getAttribute('aria-label'),{x,y}),'Move entire gradient');
  await page.mouse.dblclick(x,y);await settled();await wait(async()=>await definition.locator('stop').count()===3);const inserted=read();assert.notEqual(inserted,original);await wait(async()=>await surface.count()===1);await wait(async()=>await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'))==='Gradient color stop 2');
  const offset=Number(await definition.locator('stop').nth(1).getAttribute('offset'));assert.ok(Math.abs(offset-.5)*length<1.5,label+' inserted at '+offset+' from '+x+','+y);const color=await definition.locator('stop').nth(1).evaluate(el=>getComputedStyle(el).stopColor),channels=color.match(/[\d.]+/g).map(Number),left=Math.round(255*(1-offset)),right=Math.round(255*offset),expected=type==='radial'?[left,left,left]:[left,0,right];assert.ok(expected.every((value,index)=>Math.abs(channels[index]-value)<=1),color);
  await page.keyboard.press('Backspace');await settled();await wait(()=>read()===original);await wait(async()=>await surface.count()===1);assert.equal(await definition.locator('stop').count(),2);await wait(async()=>await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'))==='Gradient color stop 2');
  await page.getByRole('button',{name:'Finish gradient editing',exact:true}).click();await history('Undo',inserted);await history('Redo',original);await history('Undo',inserted);await history('Undo',original);
  await open();await page.getByRole('button',{name:'Move entire gradient',exact:true}).focus();await page.keyboard.press('Insert');await settled();await wait(async()=>await definition.locator('stop').count()===3);assert.equal(await definition.locator('stop').nth(1).getAttribute('offset'),'0.5');await history('Undo',original);
 }
 console.log('PASS canvas stop actions: double-click and keyboard insertion, interpolated colors, Delete/Backspace, minimum stops, fill/stroke, persistent focus and exact undo/redo');
};
