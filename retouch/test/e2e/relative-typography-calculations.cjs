'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 await page.getByLabel('Style screen scope').selectOption('');await settled();
 const settings=page.locator('summary[aria-label="Type settings"]');if(!await settings.evaluate(el=>el.parentElement.open))await settings.click();
 const initial=read(),states=[initial];
 const edit=async(label,value,check,button)=>{
  const input=page.getByLabel(label,{exact:true}),before=read();await input.evaluate(el=>window.RetouchInspectorUI.reveal(el));await input.fill(value);
  if(button)await page.getByRole('button',{name:button,exact:true}).click();else await input.press('Enter');
  await wait(()=>read()!==before);await settled();await wait(check);states.push(read());
 };
 const ratio=property=>app.locator('h1').evaluate((el,p)=>{const s=getComputedStyle(el);return parseFloat(s.getPropertyValue(p))/parseFloat(s.fontSize);},property);
 for(const label of ['Line height (%)','Letter spacing (%)']){
  const input=page.getByLabel(label,{exact:true}),value=await input.inputValue();
  await input.fill('150 * 2%');await input.press('Escape');await settled();assert.equal(await input.inputValue(),value);assert.equal(read(),initial);
  for(const bad of ['1 / 0','2000','20px']){
   await input.fill(bad);await page.getByRole('button',{name:'Use relative '+label.replace(' (%)','').toLowerCase(),exact:true}).click();
   assert.equal(await input.evaluate(el=>el.validity.valid),false);assert.equal(read(),initial);await input.press('Escape');
  }
 }
 await edit('Line height (%)','(100 + 75)%',async()=>Math.abs(await ratio('line-height')-1.75)<.001);
 await edit('Letter spacing (%)','(5 - 15)%',async()=>Math.abs(await ratio('letter-spacing')+.1)<.001,'Use relative letter spacing');
 const held=page.getByLabel('Line height (%)',{exact:true}),before=read();await held.focus();
 await page.keyboard.down('ArrowUp');await page.keyboard.down('ArrowUp');assert.equal(read(),before,'held arrows only preview draft');await page.keyboard.up('ArrowUp');
 await wait(()=>read()!==before);await settled();await wait(async()=>Math.abs(await ratio('line-height')-1.77)<.001);states.push(read());
 for(let i=states.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===states[i]);await settled();}
 for(let i=1;i<states.length;i++){await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===states[i]);await settled();}
 for(let i=states.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===states[i]);await settled();}
 await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click();await settled();
 await page.getByRole('treeitem',{name:'p · Named text',exact:true}).click({modifiers:['Shift']});await settled();
 await edit('Shared Line height (%)','100 * 2%',async()=>await app.locator('p').evaluateAll(nodes=>nodes.every(el=>{const s=getComputedStyle(el);return Math.abs(parseFloat(s.lineHeight)/parseFloat(s.fontSize)-2)<.001;})));
 await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===initial);await settled();
 await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click();await settled();
 console.log(kind+': PASS relative typography calculations, conversion button validation, held-arrow grouping, shared relative line height and exact undo/redo');
};
