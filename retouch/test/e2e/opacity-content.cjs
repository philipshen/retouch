'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const original=read(),nodes=app.locator('h1,p.other-font'),screen=page.getByLabel('Screen size',{exact:true}),heading=page.getByRole('treeitem',{name:'h1 · Headline',exact:true}),paragraph=page.getByRole('treeitem',{name:'p · Other text',exact:true}),styles=await nodes.evaluateAll(nodes=>nodes.map(el=>el.getAttribute('style')));
 const state=()=>nodes.evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).opacity));
 const size=async value=>{await screen.focus();await screen.selectOption(value);await settled();await screen.focus();};
 const reveal=async control=>control.evaluate(el=>{window.RetouchInspectorUI.reveal(el);return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
 const undo=async source=>{await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===source);await settled();};
 await size('768x1024');await page.getByLabel('Style screen scope').selectOption(kind==='html'?'min-[768px]:':'md:');await settled();
 for(const shared of [false,true]){
  const select=async()=>{await heading.click();if(shared)await paragraph.click({modifiers:['Shift']});await settled();};await select();
  const input=page.getByLabel((shared?'Shared ':'')+'Opacity (%)',{exact:true}),reset=page.getByRole('button',{name:'Reset '+(shared?'shared ':'')+'opacity'+(shared?' (%)':''),exact:true,includeHidden:true});
  assert.equal(await input.isDisabled(),false,JSON.stringify({shared,title:await input.getAttribute('title'),style:await nodes.first().getAttribute('style'),scope:await page.getByLabel('Style screen scope').inputValue()}));if(shared)assert.equal(await input.inputValue(),'');await reveal(input);await input.fill('50');await input.press('Tab');await wait(()=>read()!==original);await settled();const hidden=read();assert.deepEqual(await state(),shared?['0.5','0.5']:['0.5','0.4']);
  if(!shared&&kind!=='html'){const slider=page.getByLabel('Opacity',{exact:true});assert.equal(await slider.isDisabled(),false);await slider.evaluate(el=>{el.value='75';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});}else{await input.fill('75');await input.press('Tab');}await wait(()=>read()!==hidden);await settled();const shown=read();assert.deepEqual(await state(),shared?['0.75','0.75']:['0.75','0.4']);
  await reveal(reset);await reset.click();await wait(()=>read()!==shown);await settled();assert.deepEqual(await state(),['0.8','0.4']);await undo(shown);
  await size('390x844');await wait(()=>input.isDisabled());assert.equal(await reset.isDisabled(),true);if(!shared&&kind!=='html')assert.equal(await page.getByLabel('Opacity',{exact:true}).isDisabled(),true);assert.deepEqual(await state(),['0.8','0.4']);await input.evaluate(el=>{el.value='50';el.dispatchEvent(new Event('change',{bubbles:true}));});await reset.evaluate(el=>el.click());await settled();assert.equal(read(),shown);
  await size('768x1024');await undo(hidden);await undo(original);assert.deepEqual(await nodes.evaluateAll(nodes=>nodes.map(el=>el.getAttribute('style'))),styles);
  await nodes.first().evaluate(el=>el.style.setProperty('opacity','0.8','important'));await select();assert.equal(await input.isDisabled(),true);await input.evaluate(el=>{el.value='50';el.dispatchEvent(new Event('change',{bubbles:true}));});await settled();assert.equal(read(),original);
  await nodes.first().evaluate((el,style)=>{el.style.cssText='';el.setAttribute('style',style);},styles[0]);await select();await reveal(input);await input.fill('50');await input.press('Tab');await wait(()=>read()!==original);await settled();const beforeReset=read();
  await nodes.first().evaluate(el=>el.style.setProperty('opacity','0.8','important'));await select();assert.equal(await input.isDisabled(),true);assert.equal(await reset.isDisabled(),false);await reveal(reset);await reset.click();await wait(()=>read()!==beforeReset);await settled();assert.equal(await reset.isDisabled(),true);await undo(beforeReset);await nodes.first().evaluate((el,style)=>{el.style.cssText='';el.setAttribute('style',style);},styles[0]);await undo(original);
 }
 console.log(kind+': PASS single/shared opacity over inline styles, scope guards, important refusal, reset and exact undo');
};
