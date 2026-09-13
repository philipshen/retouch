'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const scope=page.getByLabel('Style screen scope'),screen=page.getByLabel('Screen size',{exact:true});
 await scope.selectOption('');await settled();
 const initial=read(),states=[initial],label=name=>name+(kind==='html'?' (CSS)':' (px)'),field=name=>page.getByLabel(label(name),{exact:true});
 const metric=property=>app.locator('h1').evaluate((el,key)=>getComputedStyle(el).getPropertyValue(key),property);
 const edit=async(name,value,property,expected)=>{
  const before=read();await field(name).fill(value);await field(name).press('Enter');
  await wait(()=>read()!==before);await settled();await wait(async()=>Math.abs(parseFloat(await metric(property))-expected)<.01);states.push(read());
 };
 for(const name of ['Font size','Line height','Letter spacing']){
  const input=field(name),value=await input.inputValue();await input.fill('(120 + 8)px');await input.press('Escape');await settled();
  assert.equal(read(),initial,name+' Escape must not write');assert.equal(await input.inputValue(),value);
  await input.fill('1 / 0');await input.press('Enter');
  assert.equal(await input.evaluate(el=>el.validity.valid),false,name+' must reject division by zero');assert.equal(read(),initial);
  await input.press('Escape');
 }
 await edit('Font size','(16 + 4) * 2px','font-size',40);
 await edit('Line height','(20 + 4) * 2px','line-height',48);
 await edit('Letter spacing','(2 - 4) / 2px','letter-spacing',-1);
 for(const name of ['Line height','Letter spacing']){
  const input=field(name),before=read();await input.fill('2000%');await input.press('Enter');assert.equal(await input.evaluate(el=>el.validity.valid),false);assert.equal(read(),before);await input.press('Escape');
 }
 await edit('Line height','(100 + 50)%','line-height',60);
 await edit('Letter spacing','(5 + 5)%','letter-spacing',4);
 if(process.env.RT_E2E_TYPOGRAPHY_SCREENSHOT)await page.locator('#panel').screenshot({path:process.env.RT_E2E_TYPOGRAPHY_SCREENSHOT});
 if(kind==='html'){
  const before=read();await field('Line height').fill('normal');await field('Line height').press('Enter');await wait(()=>read()!==before);await settled();states.push(read());
  await edit('Line height','3 / 2','line-height',60);
  assert.equal(await field('Line height').inputValue(),'1.5','unitless CSS line height retains multiplier semantics');
 }
 await scope.selectOption(kind==='html'?'min-[768px]:':'md:');await settled();
 await edit('Font size','24 * 2px','font-size',48);
 await screen.focus();await screen.selectOption('390x844');await settled();await wait(async()=>await metric('font-size')==='40px');
 await screen.focus();await screen.selectOption('768x1024');await settled();await wait(async()=>await metric('font-size')==='48px');
 const final=read();
 for(let i=states.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===states[i]);await settled();}
 for(let i=1;i<states.length;i++){await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===states[i]);await settled();}
 assert.equal(read(),final);
 for(let i=states.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===states[i]);await settled();}
 await scope.selectOption('');await settled();assert.equal(read(),initial);
 console.log(kind+': PASS typography calculations, invalid drafts, Escape, responsive font size and exact undo/redo');
};
