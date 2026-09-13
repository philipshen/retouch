'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,file,wait,settled})=>{
 const read=()=>fs.readFileSync(file,'utf8'),original=read(),surface=page.getByLabel('Edit gradient on canvas',{exact:true});
 await page.getByRole('button',{name:'Fit screen',exact:true}).click();await settled();
 const history=async(name,text)=>{await page.getByRole('button',{name,exact:true}).click();await settled();await wait(()=>read()===text);};
 const cases=[['Gradient box','paint','linear','fill'],['Radial box','radial','radial','fill']];if(await app.locator('[aria-label="Stroke gradient"]').count())cases.push(['Stroke gradient','paint','linear','stroke']);
 for(const [label,id,type,paint]of cases){
  await page.getByRole('treeitem',{name:'rect · '+label,exact:true}).click();await settled();const field=page.getByLabel('Stop 2 position',{exact:true});await field.fill('60%');await field.press('Tab');await settled();await wait(()=>read()!==original);const baseline=read(),definition=app.locator('#'+id),before=await definition.evaluate(el=>el.outerHTML);
  const open=async()=>{await page.getByRole('button',{name:'Edit '+paint+' gradient on canvas',exact:true}).click();await wait(async()=>await surface.count()===1);};
  const stop=page.getByRole('button',{name:'Gradient color stop 1',exact:true});
  await open();await stop.focus();for(let i=0;i<8;i++)await page.keyboard.press('Shift+ArrowRight');assert.equal(read(),baseline);assert.equal(await definition.locator('stop').last().getAttribute('offset'),'0.8');await page.keyboard.press('Escape');await wait(async()=>await surface.count()===0);assert.equal(await definition.evaluate(el=>el.outerHTML),before);
  await open();await stop.focus();await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('Shift+ArrowLeft');await page.keyboard.press('Enter');await wait(async()=>await surface.count()===0);assert.equal(read(),baseline);assert.equal(await definition.evaluate(el=>el.outerHTML),before);
  await open();await stop.focus();await page.keyboard.press('ArrowRight');await definition.evaluate(el=>el.setAttribute('spreadMethod','reflect'));await wait(async()=>await surface.count()===0);assert.equal(read(),baseline);assert.equal(await definition.getAttribute('spreadMethod'),'reflect');await definition.evaluate(el=>el.removeAttribute('spreadMethod'));assert.equal(await definition.evaluate(el=>el.outerHTML),before);
  await open();const first=await page.getByRole('button',{name:'Gradient '+(type==='linear'?'start':'center')+' handle',exact:true}).boundingBox(),last=await page.getByRole('button',{name:'Gradient '+(type==='linear'?'end':'radius')+' handle',exact:true}).boundingBox(),b=await stop.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
  assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.getAttribute('aria-label'),{x,y}),'Gradient color stop 1');
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+(last.x-first.x)*.8,y+(last.y-first.y)*.8,{steps:5});await wait(async()=>Number(await definition.locator('stop').last().getAttribute('offset'))>.6);assert.equal(read(),baseline);await page.mouse.up();await settled();await wait(()=>read()!==baseline);const changed=read();await wait(async()=>await surface.count()===1);await wait(async()=>await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'))==='Gradient color stop 2');
  if(process.env.RT_E2E_GRADIENT_STOPS_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_GRADIENT_STOPS_SCREENSHOT});
  await page.getByRole('button',{name:'Finish gradient editing',exact:true}).click();await history('Undo',baseline);await history('Redo',changed);await history('Undo',baseline);await history('Undo',original);
 }
 console.log('PASS canvas color stops: linear/radial pointer movement, keyboard reorder, Escape, retained stop identity and exact undo/redo');
};
