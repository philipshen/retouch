'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const original=read(),nodes=app.locator('h1,p.other-font'),screen=page.getByLabel('Screen size',{exact:true}),clip=page.getByRole('checkbox',{name:'Shared Clip content',exact:true}),reset=page.getByRole('button',{name:'Reset shared clip content',exact:true,includeHidden:true});
 const overflow=()=>nodes.evaluateAll(nodes=>nodes.map(el=>{const css=getComputedStyle(el);return [css.overflowX,css.overflowY];})),originalOverflow=await overflow(),styles=await nodes.evaluateAll(nodes=>nodes.map(el=>el.getAttribute('style')));
 const group=async()=>{await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click();await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click({modifiers:['Shift']});await settled();};
 const size=async value=>{await screen.focus();await screen.selectOption(value);await settled();await screen.focus();};
 const reveal=async control=>control.evaluate(el=>{window.RetouchInspectorUI.reveal(el);return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
 const undo=async source=>{await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===source);await settled();};
 const expectOverflow=async value=>wait(async()=>JSON.stringify(await overflow())===JSON.stringify([[value,value],[value,value]]));
 await size('768x1024');await page.getByLabel('Style screen scope',{exact:true}).selectOption(kind==='html'?'min-[768px]:':'md:');await settled();await group();
 await clip.waitFor({state:'attached',timeout:5000});assert.equal(await clip.evaluate(el=>el.indeterminate),true);await reveal(clip);await clip.click();await wait(()=>read()!==original);await settled();const clipped=read();await expectOverflow('clip');assert.equal(await clip.isChecked(),true);
 assert.deepEqual(await app.locator('p.named-font').evaluate(el=>[getComputedStyle(el).overflowX,getComputedStyle(el).overflowY]),['visible','visible']);
 await clip.focus();await page.keyboard.press('Space');await wait(()=>read()!==clipped);await settled();const visible=read();await expectOverflow('visible');
 await reveal(reset);await reset.click();await wait(()=>read()!==visible);await settled();assert.deepEqual(await overflow(),originalOverflow);assert.equal(await clip.evaluate(el=>el.indeterminate),true);
 await undo(visible);await size('390x844');await wait(()=>clip.isDisabled());assert.equal(await reset.isDisabled(),true);assert.deepEqual(await overflow(),originalOverflow);
 await clip.evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});await reset.evaluate(el=>el.click());await settled();assert.equal(read(),visible);
 await size('768x1024');await expectOverflow('visible');await undo(clipped);await expectOverflow('clip');
 if(process.env.RT_E2E_CLIP_SCREENSHOT){await reveal(clip);await page.screenshot({path:process.env.RT_E2E_CLIP_SCREENSHOT,caret:'initial'});}
 await undo(original);assert.deepEqual(await overflow(),originalOverflow);assert.deepEqual(await nodes.evaluateAll(nodes=>nodes.map(el=>el.getAttribute('style'))),styles);
 for(const property of ['overflow','overflow-x','overflow-y']){
  await nodes.first().evaluate((el,property)=>el.style.setProperty(property,'visible','important'),property);await group();assert.equal(await clip.isDisabled(),true);
  await clip.evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});await settled();assert.equal(read(),original);
  await nodes.first().evaluate((el,style)=>{el.style.cssText='';if(style===null)el.removeAttribute('style');else el.setAttribute('style',style);},styles[0]);await group();
 }
 console.log(kind+': PASS shared clipping mixed state, keyboard, reset, responsive refusal, inline priority, unchanged styles and exact source undo');
};
