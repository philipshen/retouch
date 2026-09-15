'use strict';
const assert=require('node:assert/strict');
exports.run=async({page,app,read,wait,settled,kind})=>{
 const original=read(),group=page.getByRole('treeitem',{name:'div · Group',exact:true}),measure=()=>app.locator('h1,p').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));
 const undo=async()=>{await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();};
 if(process.env.RT_E2E_GROUP_SEPARATE_PARENTS){const toggle=page.getByRole('treeitem',{name:'section · Side panel',exact:true}).locator('..').locator('.layer-toggle');if((await toggle.getAttribute('aria-label')).startsWith('Expand '))await toggle.click();}
 for(const multiple of [false,true]){
  await group.click();if(multiple)await page.getByRole('treeitem',{name:'p · Named text',exact:true}).click({modifiers:['Meta']});await settled();
  for(const axis of ['x','y']){
   const index=axis==='x'?0:1,input=page.getByLabel('Group '+axis.toUpperCase()+' (px)',{exact:true}),before=await measure(),parent=process.env.RT_E2E_GROUP_SEPARATE_PARENTS&&multiple?await app.locator('body').evaluate((el,index)=>index?-scrollY:-scrollX,index):await app.locator('main').evaluate((el,index)=>{const r=el.getBoundingClientRect();return index?r.y:r.x;},index),start=Math.min(...before.slice(0,multiple?3:2).map(box=>box[index]))-parent,value=Number(await input.inputValue())+23;
   if(process.env.RT_E2E_GROUP_SEPARATE_PARENTS&&multiple){assert.equal(await page.getByLabel('Align to',{exact:true}).locator('option[value=parent]').count(),0);assert.ok((await input.getAttribute('title')).includes('on the page'));assert.ok(Math.abs(Number(await input.inputValue())-start)<.01,'page coordinate field matches independent bounds');}
   await input.fill(String(value));await input.press('Enter');await wait(()=>read()!==original);await settled();const expected=boxes=>boxes.every((box,i)=>box.every((n,j)=>Math.abs(n-before[i][j]-((multiple||i<2)&&j===index?value-start:0))<.1));await wait(async()=>expected(await measure()));assert.equal(await page.getByRole('treeitem',{selected:true}).count(),multiple?2:1);const saved=read();await undo();await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===saved);await settled();await undo();
   await input.fill('999');await input.press('Escape');assert.equal(read(),original);
   const label=input.locator('..').locator('span').first(),r=await label.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+20,r.y+r.height/2,{steps:4});assert.equal(read(),original);const previewValue=Number(await input.inputValue());await wait(async()=>{const boxes=await measure();return boxes.every((box,i)=>box.every((n,j)=>Math.abs(n-before[i][j]-((multiple||i<2)&&j===index?previewValue-start:0))<.1));});await page.keyboard.press('Escape');await page.mouse.up();await wait(async()=>{const boxes=await measure();return boxes.every((box,i)=>box.every((n,j)=>Math.abs(n-before[i][j])<.1));});assert.equal(read(),original);
   const next=await label.boundingBox();await page.mouse.move(next.x+next.width/2,next.y+next.height/2);await page.mouse.down();await page.mouse.move(next.x+next.width/2+15,next.y+next.height/2,{steps:4});assert.equal(read(),original);await page.mouse.up();await wait(()=>read()!==original);await settled();await undo();
  }
 }
 await page.screenshot({path:'/tmp/retouch-group-position-'+kind+'.png'});await group.click();await settled();
 console.log(kind+': PASS group X/Y fields for single and mixed selections, rendered scrub preview, source unchanged until release, Escape, preserved dimensions and exact undo/redo');
};
