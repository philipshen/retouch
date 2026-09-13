'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const target=app.locator('h1'),states=[read()],text=await target.textContent(),expected={};
 const select=async(locator,from,to)=>locator.evaluate((el,{from,to})=>{const d=el.ownerDocument,r=d.createRange();r.setStart(el.firstChild,from);r.setEnd(el.firstChild,to);const s=d.getSelection();s.removeAllRanges();s.addRange(r);},{from,to});
 const edit=async(locator,from=0,to=3)=>{await locator.click();await wait(async()=>await target.getAttribute('contenteditable')==='true');await select(locator,from,to);};
 const change=async(property,value)=>{
  if(property==='font-family'){
   await page.getByRole('button',{name:'Choose selected text font',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Selected text font',exact:true});await dialog.getByLabel('Selected text font family',{exact:true}).selectOption(value);await dialog.getByRole('button',{name:'Apply font',exact:true}).click();
  }else if(property==='font-size'||property==='color'){
   const field=page.getByLabel(property==='color'?'Selected text color':'Selected text size (px)',{exact:true});await field.fill(value);await field.press('Enter');
  }else if(property==='font-weight'&&value==='537.25'){
   await page.getByLabel('Selected text weight',{exact:true}).selectOption('custom');const field=page.getByLabel('Selected text custom weight',{exact:true});await field.fill(value);await field.press('Enter');
  }else{await page.getByLabel(property==='font-weight'?'Selected text weight':'Selected text style',{exact:true}).selectOption(value);await page.keyboard.press('Enter');}
  await wait(()=>read()!==states.at(-1));states.push(read());await settled();assert.equal(await target.textContent(),text);
 };
 const steps=[['font-weight','400'],['font-size','24.5'],['color','#11223380'],['font-style','italic'],['font-family','monospace'],['font-weight','537.25'],['font-size','28']];
 for(let index=0;index<steps.length;index++){
  await edit(index?target.locator('span'):target,index?0:1,index?3:4);
  const [property,value]=steps[index];await change(property,value);expected[property]=property==='font-size'?value+'px':value;
  assert.equal(await target.locator('span').count(),1);assert.equal((read().match(/<span\b/g)||[]).length,1);
  const values=await target.locator('span').evaluate(el=>Object.fromEntries([...el.style].map(name=>[name,el.style.getPropertyValue(name)])));
  for(const [name,value]of Object.entries(expected)){if(name==='color')assert.ok(read().includes(value));else assert.equal(values[name],value,name);}
 }
 await edit(target.locator('span'),1,2);await change('font-weight','700');assert.equal(await target.locator('span').count(),3);assert.equal(await target.locator('span span').count(),0);assert.equal((read().match(/#11223380/g)||[]).length,3);
 for(const span of await target.locator('span').all()){const style=await span.evaluate(el=>({font:el.style.fontFamily,size:el.style.fontSize,style:el.style.fontStyle}));assert.deepEqual(style,{font:'monospace',size:'28px',style:'italic'});}
 await edit(target.locator('span').nth(1),0,1);await change('font-weight','537.25');assert.equal(await target.locator('span').count(),1);assert.equal(read(),states[steps.length]);
 if(process.env.RT_E2E_COMBINED_RANGE_SCREENSHOT){await edit(target.locator('span'));await page.screenshot({path:process.env.RT_E2E_COMBINED_RANGE_SCREENSHOT});await page.keyboard.press('Escape');await settled();}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=1;n<states.length;n++){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 for(let n=states.length-2;n>=0;n--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===states[n]);}
 console.log('COMBINED RANGE STYLES PASS '+kind+': five typography properties in one span, repeated changes, partial split/merge, exact alpha, retained styles and exact source undo/redo');
};
