'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,shape,read,wait,settled,screenshot})=>{
 const original=read(),points=()=>shape.getAttribute('points'),endpoints=value=>value.split(' ').slice(0,2),before=endpoints(await points()),states=[original];
 for(const [label,value]of [['Arrowhead length','8'],['Arrowhead width','20']]){
  const field=page.getByLabel(label,{exact:true});await field.waitFor();assert.equal(await field.evaluate(el=>el.closest('[data-section="stroke"]')!==null),true);
  await field.fill(value);await field.press('Tab');await wait(()=>read()!==states.at(-1));await settled();await wait(async()=>Math.abs(Number(await page.getByLabel(label,{exact:true}).inputValue())-Number(value))<.00001);
  assert.deepEqual(endpoints(await points()),before,'arrowhead edits preserve the shaft endpoints');states.push(read());
 }
 if(screenshot)await page.screenshot({path:screenshot});
 for(let i=states.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===states[i]);await settled();}
 for(let i=1;i<states.length;i++){await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===states[i]);await settled();}
 for(let i=states.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===states[i]);await settled();}
 assert.equal(read(),original);
 const raw=page.getByLabel('Shape Points',{exact:true});
 for(const details of await raw.locator('xpath=ancestor::details').all())if(await details.getAttribute('open')===null)await details.locator(':scope > summary').click();
 await raw.fill('0,0 100,0 80,5 100,0 80,-9');await raw.press('Tab');await wait(()=>read()!==original);await settled();
 assert.equal(await page.getByLabel('Arrowhead length',{exact:true}).count(),0,'freeform points are not rewritten as a symmetric arrow');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await page.getByLabel('Arrowhead length',{exact:true}).waitFor();
};
