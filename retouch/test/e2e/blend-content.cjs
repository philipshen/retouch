'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const original=read(),nodes=app.locator('h1,p.other-font'),screen=page.getByLabel('Screen size',{exact:true}),heading=page.getByRole('treeitem',{name:'h1 · Headline',exact:true}),paragraph=page.getByRole('treeitem',{name:'p · Other text',exact:true}),styles=await nodes.evaluateAll(nodes=>nodes.map(el=>el.getAttribute('style')));
 let property;const state=()=>nodes.evaluateAll((nodes,property)=>nodes.map(el=>getComputedStyle(el).getPropertyValue(property)),property);
 const size=async value=>{await screen.focus();await screen.selectOption(value);await settled();await screen.focus();};
 const reveal=async control=>control.evaluate(el=>{window.RetouchInspectorUI.reveal(el);return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
 const undo=async source=>{await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===source);await settled();};
 await size('768x1024');await page.getByLabel('Style screen scope').selectOption(kind==='html'?'min-[768px]:':'md:');await settled();
 for(const [key,label,first,second,initial]of [['mix-blend-mode','Blend mode','overlay','multiply',['screen','multiply']],['isolation','Blend group','isolate','auto',['auto','isolate']]]){property=key;for(const shared of [false,true]){
  const select=async()=>{await heading.click();if(shared)await paragraph.click({modifiers:['Shift']});await settled();};await select();
  const input=page.getByLabel((shared?'Shared ':'')+label,{exact:true}),reset=page.getByRole('button',{name:'Reset '+(shared?'shared ':'')+label.toLowerCase(),exact:true,includeHidden:true});
  assert.equal(await input.isDisabled(),false);if(shared)assert.equal(await input.inputValue(),'');await reveal(input);await input.selectOption(first);await wait(()=>read()!==original);await settled();const hidden=read();assert.deepEqual(await state(),shared?[first,first]:[first,initial[1]]);
  await input.selectOption(second);await wait(()=>read()!==hidden);await settled();const shown=read();assert.deepEqual(await state(),shared?[second,second]:[second,initial[1]]);
  await reveal(reset);await reset.click();await wait(()=>read()!==shown);await settled();assert.deepEqual(await state(),initial);await undo(shown);
  await size('390x844');await wait(()=>input.isDisabled());assert.equal(await reset.isDisabled(),true);assert.deepEqual(await state(),initial);await input.evaluate(el=>{el.value=el.options[el.options.length-1].value;el.dispatchEvent(new Event('change',{bubbles:true}));});await reset.evaluate(el=>el.click());await settled();assert.equal(read(),shown);
  await size('768x1024');await undo(hidden);await undo(original);assert.deepEqual(await nodes.evaluateAll(nodes=>nodes.map(el=>el.getAttribute('style'))),styles);
  await nodes.first().evaluate((el,[property,value])=>el.style.setProperty(property,value,'important'),[property,initial[0]]);await select();assert.equal(await input.isDisabled(),true);await input.evaluate(el=>{el.value=el.options[el.options.length-1].value;el.dispatchEvent(new Event('change',{bubbles:true}));});await settled();assert.equal(read(),original);
  await nodes.first().evaluate((el,style)=>{el.style.cssText='';el.setAttribute('style',style);},styles[0]);await select();await reveal(input);await input.selectOption(first);await wait(()=>read()!==original);await settled();const beforeReset=read();
  await nodes.first().evaluate((el,[property,value])=>el.style.setProperty(property,value,'important'),[property,initial[0]]);await select();assert.equal(await input.isDisabled(),true);assert.equal(await reset.isDisabled(),false);await reveal(reset);await reset.click();await wait(()=>read()!==beforeReset);await settled();assert.equal(await reset.isDisabled(),true);await undo(beforeReset);await nodes.first().evaluate((el,style)=>{el.style.cssText='';el.setAttribute('style',style);},styles[0]);await undo(original);
 }
 }
 console.log(kind+': PASS single/shared blend and isolation over inline styles, scope guards, important refusal, reset and exact undo');
};
