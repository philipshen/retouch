'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,file,wait,settled})=>{
 const read=()=>fs.readFileSync(file,'utf8'),original=read(),cases=[['Gradient box','fill']];if(await app.locator('[aria-label="Stroke gradient"]').count())cases.push(['Stroke gradient','stroke']);
 for(const [label,paint]of cases){
  await page.getByRole('treeitem',{name:'rect · '+label,exact:true}).click();await settled();const layer=app.locator('[aria-label="'+label+'"]'),id=await layer.getAttribute('data-rt');
  await page.getByLabel('Stop 1 position',{exact:true}).fill('25%');await page.getByLabel('Stop 1 position',{exact:true}).press('Tab');await settled();await wait(async()=>await app.locator('#paint > stop').first().getAttribute('offset')==='25%');const before=read();
  await page.getByRole('button',{name:'Reverse '+paint+' gradient',exact:true}).click();await settled();await wait(async()=>await app.locator('#paint > stop').first().getAttribute('stop-color')==='#0000ff');const reversed=read();assert.notEqual(reversed,before);assert.equal(await app.locator('#paint > stop').last().getAttribute('offset'),'75%');assert.equal(await layer.getAttribute('data-rt'),id);assert.equal(await layer.getAttribute(paint),'url(#paint)');assert.equal(await app.locator('[aria-label="Shared gradient"]').getAttribute('fill'),'url(#paint)');assert.equal(await app.locator('#paint > stop').first().evaluate(el=>getComputedStyle(el).stopColor),'rgb(0, 0, 255)');
  if(process.env.RT_E2E_GRADIENT_REVERSE_SCREENSHOT){await page.locator('[data-gradient-paint="'+paint+'"]').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:process.env.RT_E2E_GRADIENT_REVERSE_SCREENSHOT});}
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===before);await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===reversed);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===before);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
 }
 await page.getByRole('treeitem',{name:'rect · Gradient box',exact:true}).click();await settled();console.log('PASS reverse SVG gradient: asymmetric positions, colors, shared paint, selected identity and exact undo/redo');
};
