'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,file,wait,settled})=>{
 const read=()=>fs.readFileSync(file,'utf8'),original=read(),cases=[['Gradient box','fill']];if(await app.locator('[aria-label="Stroke gradient"]').count())cases.push(['Stroke gradient','stroke']);
 const undo=async source=>{await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===source);};const redo=async source=>{await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===source);};
 for(const [label,paint]of cases){
  await page.getByRole('treeitem',{name:'rect · '+label,exact:true}).click();await settled();const layer=app.locator('[aria-label="'+label+'"]'),sourceId=await layer.getAttribute('data-rt');
  await page.getByRole('button',{name:'Make '+paint+' gradient unique',exact:true}).click();await settled();await wait(async()=>await layer.getAttribute(paint)!=='url(#paint)');const reference=await layer.getAttribute(paint),id=/^url\(#([\w-]+)\)$/.exec(reference)?.[1];assert.ok(id);assert.notEqual(id,'paint');await wait(async()=>await app.locator('#'+id+' > stop').count()===2);assert.equal(await layer.getAttribute('data-rt'),sourceId);assert.equal(await app.locator('[aria-label="Shared gradient"]').getAttribute('fill'),'url(#paint)');const detached=read();
  const input=page.getByLabel('Stop 1 color',{exact:true});await input.fill('#00ff00');await input.press('Tab');await settled();await wait(async()=>await app.locator('#'+id+' > stop').first().getAttribute('stop-color')==='#00ff00');const edited=read();assert.equal(await app.locator('#paint > stop').first().getAttribute('stop-color'),'#ff0000');assert.equal(await app.locator('#'+id+' > stop').first().evaluate(el=>getComputedStyle(el).stopColor),'rgb(0, 255, 0)');assert.equal(await app.locator('#paint > stop').first().evaluate(el=>getComputedStyle(el).stopColor),'rgb(255, 0, 0)');
  await undo(detached);await undo(original);await wait(async()=>await app.locator('#'+id).count()===0);assert.equal(await layer.getAttribute(paint),'url(#paint)');await redo(detached);await redo(edited);await wait(async()=>await app.locator('#'+id+' > stop').first().getAttribute('stop-color')==='#00ff00');await undo(detached);await undo(original);
 }
 await page.getByRole('treeitem',{name:'rect · Gradient box',exact:true}).click();await settled();console.log('PASS unique SVG gradients: fill/stroke isolation, original resources, selected identity and exact undo/redo');
};
