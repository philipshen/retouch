'use strict';
const assert=require('node:assert/strict');
exports.run=async({page,app,read,wait,settled,kind})=>{
 const original=read(),heading=page.getByRole('treeitem',{name:'h1 · Headline',exact:true});await heading.click();await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click({modifiers:['Meta']});await settled();
 const layout=page.getByLabel('Shared layout section',{exact:true}),display=page.getByLabel('Shared Display',{exact:true}),options=page.getByLabel('Shared layout options',{exact:true});
 assert.equal(await display.isVisible(),true);assert.equal(await page.getByLabel('Shared Padding',{exact:true}).isVisible(),true);assert.equal(await options.evaluate(el=>el.open),false);
 for(const name of ['Direction','Wrap','Align items','Align lines','Distribute items','Gap'])assert.equal(await page.getByLabel('Shared '+name,{exact:true}).isVisible(),false,name+' is secondary for block layers');assert.equal(read(),original);
 await options.locator(':scope > summary').click();assert.equal(await page.getByLabel('Shared Direction',{exact:true}).isVisible(),true);await options.locator(':scope > summary').click();assert.equal(read(),original);
 for(const mode of ['flex','grid']){
  await display.selectOption(mode);await wait(()=>read()!==original);await settled();await wait(async()=>await app.locator('h1,p').evaluateAll((nodes,mode)=>nodes.slice(0,2).every(el=>getComputedStyle(el).display===mode),mode));
  for(const name of ['Align items','Align lines','Distribute items','Gap'])assert.equal(await page.getByLabel('Shared '+name,{exact:true}).isVisible(),true,name+' is primary for '+mode);
  assert.equal(await page.getByLabel('Shared Direction',{exact:true}).isVisible(),mode==='flex');assert.equal(await page.getByLabel('Shared Wrap',{exact:true}).isVisible(),mode==='flex');
  if(mode==='flex'){const beforeDirection=read();await page.getByLabel('Shared Direction',{exact:true}).selectOption('column');await wait(()=>read()!==beforeDirection);await settled();assert.deepEqual(await app.locator('h1,p').evaluateAll(nodes=>nodes.slice(0,2).map(el=>getComputedStyle(el).flexDirection)),['column','column']);await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===beforeDirection);await settled();}
  await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await wait(async()=>await display.inputValue()==='block');
 }
 await layout.scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/retouch-shared-layout-context-'+kind+'.png'});assert.equal(read(),original);console.log(kind+': PASS contextual shared layout for block/flex/grid, accessible secondary controls, live mode switching and exact source undo');
};
