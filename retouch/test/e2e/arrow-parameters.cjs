'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,shape,read,wait,settled,screenshot})=>{
 const initiallyPath=await shape.evaluate(el=>el.localName)==='path',converted=!!process.env.RT_E2E_ARROW_PATH&&!initiallyPath,dashStates=[];let beforeConversion=read();
 if(converted&&process.env.RT_E2E_ARROW_PATH_DASH){
  for(const [label,value]of [['SVG dash pattern','8 6'],['SVG dash offset','3']]){
   dashStates.push(read());const field=page.getByLabel(label,{exact:true});for(const details of await field.locator('xpath=ancestor::details').all())if(await details.getAttribute('open')===null)await details.locator(':scope > summary').click();await field.fill(value);await field.press('Tab');await wait(()=>read()!==dashStates.at(-1));await settled();
  }
  beforeConversion=read();
 }

 const id=await shape.getAttribute('data-rt'),frame=await(await shape.elementHandle()).ownerFrame();shape=frame.locator('[data-rt="'+id+'"]');
 if(converted){await page.getByRole('button',{name:'Convert to vector path',exact:true}).click();await wait(()=>read()!==beforeConversion);await settled();await wait(async()=>await shape.evaluate(el=>el.localName)==='path');}
 const original=read(),points=async()=>await shape.evaluate(el=>el.localName)==='path'?require('../../shell/svg-parametric.js').pointsFromPath(await shape.getAttribute('d')):shape.getAttribute('points'),endpoints=value=>value.split(' ').slice(0,2),before=endpoints(await points()),states=[original];
 for(const [label,value]of [['Arrowhead length','8'],['Arrowhead width','20']]){
  const field=page.getByLabel(label,{exact:true});await field.waitFor({state:'attached'});for(const details of await field.locator('xpath=ancestor::details').all())if(await details.getAttribute('open')===null)await details.locator(':scope > summary').click();assert.equal(await field.evaluate(el=>el.closest('[data-section="stroke"]')!==null),true);
  await field.fill(value);await field.press('Tab');await wait(()=>read()!==states.at(-1));await settled();await wait(async()=>Math.abs(Number(await page.getByLabel(label,{exact:true}).inputValue())-Number(value))<.00001);
  assert.equal(await shape.evaluate(el=>el.localName),'path','parameter edits use independent path strokes, including legacy arrows');assert.deepEqual(endpoints(await points()),before,'arrowhead edits preserve the shaft endpoints');states.push(read());
 }
 const startPoint=page.getByLabel('Start point',{exact:true});assert.equal(await startPoint.evaluate(el=>!!el.closest('[data-section="stroke"]')),true);
 await startPoint.selectOption('arrow');await wait(()=>read()!==states.at(-1));await settled();assert.equal((await points()).split(' ').length,10);assert.deepEqual(endpoints(await points()),before);states.push(read());
 const endHead=(await points()).split(' ').slice(0,5);
 for(const [label,value]of [['Start arrowhead length','5'],['Start arrowhead width','10']]){
  const field=page.getByLabel(label,{exact:true});assert.equal(await field.evaluate(el=>!!el.closest('[data-section="stroke"]')),true);await field.fill(value);await field.press('Tab');await wait(()=>read()!==states.at(-1));await settled();assert.deepEqual((await points()).split(' ').slice(0,5),endHead,'start head edits preserve end head and shaft');states.push(read());
 }
 if(screenshot)await page.screenshot({path:screenshot});
 const headBefore=await points(),paint=await shape.evaluate(el=>[el.getAttribute('stroke'),el.getAttribute('fill')]);
 await page.getByRole('button',{name:'Reverse arrow',exact:true}).click();await wait(()=>read()!==states.at(-1));await settled();
 assert.deepEqual(endpoints(await points()),before.slice().reverse());
 assert.deepEqual(await shape.evaluate(el=>[el.getAttribute('stroke'),el.getAttribute('fill')]),paint);
 for(const [label,value]of [['Arrowhead length',8],['Arrowhead width',20],['Start arrowhead length',5],['Start arrowhead width',10]])assert.ok(Math.abs(Number(await page.getByLabel(label,{exact:true}).inputValue())-value)<.00001);
 states.push(read());
 await page.getByRole('button',{name:'Reverse arrow',exact:true}).click();await wait(()=>read()!==states.at(-1));await settled();assert.equal(await points(),headBefore);states.push(read());
 await page.getByRole('button',{name:'Swap arrowheads',exact:true}).click();await wait(()=>read()!==states.at(-1));await settled();assert.deepEqual(endpoints(await points()),before);assert.deepEqual(await shape.evaluate(el=>[el.getAttribute('stroke'),el.getAttribute('fill')]),paint);
 for(const [label,value]of [['Arrowhead length',5],['Arrowhead width',10],['Start arrowhead length',8],['Start arrowhead width',20]])assert.ok(Math.abs(Number(await page.getByLabel(label,{exact:true}).inputValue())-value)<.00001);states.push(read());
 await page.getByRole('button',{name:'Swap arrowheads',exact:true}).click();await wait(()=>read()!==states.at(-1));await settled();assert.equal(await points(),headBefore);states.push(read());
 for(const [label,value,count]of [['End point','none',6],['Start point','none',2],['End point','arrow',5],['Start point','arrow',10]]){
  const control=page.getByLabel(label,{exact:true});assert.equal(await control.evaluate(el=>!!el.closest('[data-section="stroke"]')),true);await control.selectOption(value);await wait(()=>read()!==states.at(-1));await settled();assert.equal((await points()).split(' ').length,count);assert.deepEqual(endpoints(await points()),before);states.push(read());
 }
 for(let i=states.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===states[i]);await settled();}
 for(let i=1;i<states.length;i++){await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===states[i]);await settled();}
 for(let i=states.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===states[i]);await settled();}
 assert.equal(read(),original);
 const usesPath=await shape.evaluate(el=>el.localName)==='path',raw=page.getByLabel(usesPath?'Shape Path data':'Shape Points',{exact:true});
 for(const details of await raw.locator('xpath=ancestor::details').all())if(await details.getAttribute('open')===null)await details.locator(':scope > summary').click();
 await raw.fill(usesPath?'M0 0 L100 0 M80 5 L100 0 L80 -9':'0,0 100,0 80,5 100,0 80,-9');await raw.press('Tab');await wait(()=>read()!==original);await settled();
 assert.equal(await page.getByLabel('Arrowhead length',{exact:true}).count(),0,'freeform points are not rewritten as a symmetric arrow');
 assert.equal(await page.getByRole('button',{name:'Reverse arrow',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Swap arrowheads',exact:true}).count(),0);assert.equal(await page.getByLabel('Start point',{exact:true}).count(),0);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await page.getByLabel('Arrowhead length',{exact:true}).waitFor();
 if(converted){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===beforeConversion);await settled();}
 for(const source of dashStates.reverse()){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===source);await settled();}
};
