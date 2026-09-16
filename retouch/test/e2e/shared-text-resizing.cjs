'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const prefix=process.env.RT_E2E_RESIZE_SINGLE?'':'Shared ',original=read(),nodes=app.locator(process.env.RT_E2E_RESIZE_SINGLE?'h1':'h1,p.other-font'),screen=page.getByLabel('Screen size',{exact:true});
 const measure=()=>nodes.evaluateAll(nodes=>nodes.map(el=>{const css=getComputedStyle(el);return {width:parseFloat(css.width),height:parseFloat(css.height),text:el.textContent,wrap:css.getPropertyValue('text-wrap-mode')};}));
 const group=async()=>{await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click();if(!process.env.RT_E2E_RESIZE_SINGLE)await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click({modifiers:['Shift']});await settled();};
 const initial=await measure();await screen.selectOption('768x1024');await settled();await page.getByLabel('Style screen scope').selectOption(kind==='html'?'min-[768px]:':'md:');await settled();await group();
 for(const mode of ['Auto height','Auto width','Fixed size']){
  const button=page.getByRole('button',{name:prefix+mode,exact:true});await button.evaluate(el=>window.RetouchInspectorUI.reveal(el));if(process.env.RT_E2E_RESIZE_SCREENSHOT&&mode==='Auto height')await page.screenshot({path:process.env.RT_E2E_RESIZE_SCREENSHOT,caret:'initial'});await button.click();try{await wait(()=>read()!==original);}catch(error){console.log(await page.locator("body").innerText());throw error;}await settled();const changed=read(),after=await measure();
  for(let i=0;i<initial.length;i++){assert.equal(after[i].text,initial[i].text);if(mode==='Auto height'){assert.equal(after[i].width,initial[i].width);assert.ok(after[i].height<initial[i].height);}else if(mode==='Auto width'){assert.ok(after[i].width<initial[i].width);assert.ok(after[i].height<initial[i].height);assert.equal(after[i].wrap,'nowrap');}else{assert.equal(after[i].width,initial[i].width);assert.equal(after[i].height,initial[i].height);}}
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await screen.focus();await screen.selectOption('390x844');await settled();await screen.focus();await wait(()=>button.isDisabled());assert.deepEqual(await measure(),initial);await button.evaluate(el=>el.click());assert.equal(read(),changed);await screen.selectOption('768x1024');await settled();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();assert.deepEqual(await measure(),initial);await group();
 }
 for(const [property,value]of [['white-space','pre'],...(process.env.RT_E2E_RESIZE_LAYOUT==='vertical-grid'?[['justify-self','stretch']]:[])]){
  const before=await nodes.first().getAttribute('style');await nodes.first().evaluate((el,[property,value])=>el.style.setProperty(property,value,'important'),[property,value]);await group();const button=page.getByRole('button',{name:prefix+'Auto height',exact:true});assert.equal(await button.isDisabled(),true);await button.evaluate(el=>el.click());assert.equal(read(),original);await nodes.first().evaluate((el,before)=>{el.style.cssText='';if(before===null)el.removeAttribute('style');else el.setAttribute('style',before);},before);await group();
 }

 console.log(kind+': PASS '+(prefix?'shared':'single')+' text sizing geometry, individual dimensions, responsive scope, exact undo and inline priority refusal');
};
