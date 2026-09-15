'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,read,wait,settled})=>{
 const targets=app.locator('h1,p.other-font'),styles=()=>targets.evaluateAll(nodes=>nodes.map(el=>el.getAttribute('style'))),originalStyles=await styles(),state=()=>targets.evaluateAll(nodes=>nodes.map(el=>{const c=getComputedStyle(el);return [c.alignItems,c.justifyContent,c.alignContent,c.justifyItems];})),original=await state(),source=read();
 const reveal=async input=>{const ancestors=input.locator('xpath=ancestor::details');for(let i=0;i<await ancestors.count();i++){const details=ancestors.nth(i);if(!await details.evaluate(el=>el.open))await details.locator(':scope > summary').click();}};
 for(const shared of [true,false]){
  if(!shared){await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click();await settled();}
  for(const [label,index,choices]of [['Align children',0,['start','center','end','stretch','baseline']],['Distribute children',1,['start','center','end','between','around','evenly']]]){
   const input=page.getByRole('combobox',{name:(shared?'Shared ':'')+label,exact:true,includeHidden:true}),snapshots=[read()];await reveal(input);
   for(const value of choices){await input.selectOption(value);await settled();await wait(()=>read()!==snapshots.at(-1));snapshots.push(read());const expected=({start:'flex-start',end:'flex-end',between:'space-between',around:'space-around',evenly:'space-evenly'})[value]||value,actual=await state();for(let i=0;i<2;i++){const row=[...original[i]];if(shared||i===0)row[index]=expected;assert.deepEqual(actual[i],row);}assert.deepEqual(await styles(),originalStyles);}
   const final=await state();await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await settled();assert.deepEqual(await state(),original);await wait(()=>input.isDisabled());await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();assert.deepEqual(await state(),final);
   await page.getByRole('button',{name:shared?'Reset shared '+label.toLowerCase():'Reset child alignment',exact:true}).click();await settled();await wait(()=>read()!==snapshots.at(-1));assert.deepEqual(await state(),original);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===snapshots.at(-1));assert.deepEqual(await state(),final);
   for(const expected of snapshots.slice(0,-1).reverse()){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===expected);}assert.equal(read(),source);assert.deepEqual(await state(),original);
  }
  if(shared){
   await app.locator('p.other-font').evaluate(el=>el.style.setProperty('align-items','center','important'));
   await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click();await settled();await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click({modifiers:['Meta']});await settled();assert.equal(await page.getByRole('combobox',{name:'Shared Align children',exact:true}).isDisabled(),true,'important inline alignment on the second selected layer blocks editing');assert.equal(read(),source);
   await app.locator('p.other-font').evaluate((el,style)=>style===null?el.removeAttribute('style'):el.setAttribute('style',style),originalStyles[1]);await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click();await settled();await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click({modifiers:['Meta']});await settled();assert.equal(await page.getByRole('combobox',{name:'Shared Align children',exact:true}).isDisabled(),false);
  }
 }
 assert.deepEqual(await styles(),originalStyles);console.log('PASS inline alignment/distribution menus, all choices, single/shared scope, reset and exact undo');
};
