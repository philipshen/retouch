'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,shape,read,wait,settled,screenshot})=>{
 const original=read(),points=()=>shape.getAttribute('points'),endpoints=value=>value.split(' ').slice(0,2),before=endpoints(await points()),states=[original];
 for(const [label,value]of [['Arrowhead length','8'],['Arrowhead width','20']]){
  const field=page.getByLabel(label,{exact:true});await field.waitFor();assert.equal(await field.evaluate(el=>el.closest('[data-section="stroke"]')!==null),true);
  await field.fill(value);await field.press('Tab');await wait(()=>read()!==states.at(-1));await settled();await wait(async()=>Math.abs(Number(await page.getByLabel(label,{exact:true}).inputValue())-Number(value))<.00001);
  assert.deepEqual(endpoints(await points()),before,'arrowhead edits preserve the shaft endpoints');states.push(read());
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
 const raw=page.getByLabel('Shape Points',{exact:true});
 for(const details of await raw.locator('xpath=ancestor::details').all())if(await details.getAttribute('open')===null)await details.locator(':scope > summary').click();
 await raw.fill('0,0 100,0 80,5 100,0 80,-9');await raw.press('Tab');await wait(()=>read()!==original);await settled();
 assert.equal(await page.getByLabel('Arrowhead length',{exact:true}).count(),0,'freeform points are not rewritten as a symmetric arrow');
 assert.equal(await page.getByRole('button',{name:'Reverse arrow',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Swap arrowheads',exact:true}).count(),0);assert.equal(await page.getByLabel('Start point',{exact:true}).count(),0);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await page.getByLabel('Arrowhead length',{exact:true}).waitFor();
};
