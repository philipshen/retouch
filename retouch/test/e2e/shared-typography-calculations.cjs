'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 await page.getByLabel('Style screen scope').selectOption('');await settled();
 await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click();await settled();
 await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click({modifiers:['Shift']});await settled();
 const initial=read(),states=[initial],field=name=>page.getByLabel('Shared '+name+(kind==='html'?'':' (px)'),{exact:true});
 const values=property=>app.locator('h1, p.other-font').evaluateAll((nodes,p)=>nodes.map(el=>parseFloat(getComputedStyle(el).getPropertyValue(p))),property);
 const initialSizes=await values('font-size');assert.notEqual(initialSizes[0],initialSizes[1],'fixture starts with mixed font sizes');
 const mixed=field('Font size');assert.equal(await mixed.inputValue(),'');assert.equal(await mixed.getAttribute('placeholder'),'Mixed');
 for(const name of ['Font size','Line height','Letter spacing']){
  const input=field(name),value=await input.inputValue();await input.fill('(12 + 4)px');await input.press('Escape');await settled();assert.equal(read(),initial);assert.equal(await input.inputValue(),value);
  await input.fill('1 / 0');await input.press('Enter');assert.equal(await input.evaluate(el=>el.validity.valid),false);assert.equal(read(),initial);await input.press('Escape');
 }
 const edit=async(name,expression,property,expected)=>{const before=read();await field(name).fill(expression);await field(name).press('Enter');await wait(()=>read()!==before);await settled();await wait(async()=>(await values(property)).every(v=>Math.abs(v-expected)<.001));states.push(read());};
 await edit('Font size','(16 + 4) * 2px','font-size',40);
 await edit('Line height','(20 + 4) * 2px','line-height',48);
 await edit('Letter spacing','(2 - 4) / 2px','letter-spacing',-1);
 // Cancelling a draft after a uniform edit must not create another transaction.
 const before=read(),size=field('Font size');await size.fill('100px');await size.press('Escape');await settled();assert.equal(read(),before);assert.deepEqual(await values('font-size'),[40,40]);
 const scope=page.getByLabel('Style screen scope'),screen=page.getByLabel('Screen size',{exact:true});
 await scope.selectOption(kind==='html'?'min-[768px]:':'md:');await settled();
 await edit('Font size','24 * 2px','font-size',48);
 await screen.focus();await screen.selectOption('390x844');await settled();await wait(async()=>(await values('font-size')).every(v=>v===40));
 await screen.focus();await screen.selectOption('768x1024');await settled();await wait(async()=>(await values('font-size')).every(v=>v===48));
 for(let i=states.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===states[i]);await settled();}
 assert.deepEqual(await values('font-size'),initialSizes);
 for(let i=1;i<states.length;i++){await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===states[i]);await settled();}
 for(let i=states.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===states[i]);await settled();}
 await scope.selectOption('');await settled();await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click();await settled();
 console.log(kind+': PASS shared typography calculations, mixed/uniform cancellation, invalid arithmetic, responsive isolation and exact undo/redo');
};
