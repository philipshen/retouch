'use strict';
const assert=require('node:assert/strict');
exports.run=async({page,app,read,wait,settled,kind})=>{
 const original=read();
 for(const multi of [false,true]){
  if(multi){await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click({modifiers:['Shift']});await settled();assert.equal(await page.getByRole('treeitem',{selected:true}).count(),2);}
  await app.locator('h1').click({button:'right'});await page.getByRole('menu',{name:'Canvas actions',exact:true}).locator('[data-action-id="layer-reparentElement"]').click();const dialog=page.locator('dialog.layer-move-dialog');await dialog.waitFor();const destination=await app.locator('aside').getAttribute('data-rt');await dialog.getByRole('combobox',{name:'Destination container'}).selectOption(destination);await dialog.getByRole('button',{name:'Move layer',exact:true}).click();await wait(()=>read()!==original);await settled();const moved=read();await wait(async()=>await app.locator('aside > h1').count()===1);assert.equal(await app.locator('aside > p').count(),multi?1:0);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await wait(async()=>await app.locator('main > h1').count()===1);assert.equal(await page.getByRole('treeitem',{selected:true}).count(),multi?2:1);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===moved);await settled();await wait(async()=>await app.locator('aside > h1').count()===1);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await wait(async()=>await app.locator('main > h1').count()===1);
 }
 await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).dragTo(page.getByRole('treeitem',{name:'aside · Destination',exact:true}));await wait(()=>read()!==original);await settled();await wait(async()=>await app.locator('aside > :is(h1,p)').count()===2);await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();
 console.log(kind+': PASS single and multi-layer reparent through destination picker and tree drag, rendered parents, selection and exact undo/redo');
};
