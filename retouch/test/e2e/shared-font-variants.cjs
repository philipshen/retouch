'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const show=control=>wait(()=>control.evaluate(el=>{window.RetouchInspectorUI.reveal(el);return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(el.isConnected&&!el.matches(':disabled')&&el.getClientRects().length>0))));}));
 const group=async()=>{await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click();await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click({modifiers:['Shift']});await settled();};
 for(const [property,label,choices]of [['font-variant-caps','Capital forms',['all-small-caps','petite-caps','normal']],['font-variant-position','Number position',['super','sub','normal']]]){
 const nodes=app.locator('h1,p.other-font'),measure=()=>nodes.evaluateAll((nodes,property)=>nodes.map(el=>getComputedStyle(el).getPropertyValue(property)),property),initial=await measure(),screen=page.getByLabel('Screen size',{exact:true}),original=read();
 await screen.selectOption('768x1024');await settled();await page.getByLabel('Style screen scope').selectOption(process.env.RT_E2E_VARIANT_SHORTHAND==='base'?'':kind==='html'?'min-[768px]:':'md:');await settled();await group();const input=page.getByLabel('Shared '+label,{exact:true});
 for(const value of choices){
  await show(input);await input.selectOption(value);await wait(()=>read()!==original);await settled();await wait(async()=>(await measure()).every(item=>item===value));const changed=read();
  if(process.env.RT_E2E_VARIANT_SHORTHAND!=='base'){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await screen.focus();await screen.selectOption('390x844');await settled();await screen.focus();await wait(()=>input.isDisabled());assert.deepEqual(await measure(),initial);await input.evaluate(el=>{el.value='normal';el.dispatchEvent(new Event('change',{bubbles:true}));});assert.equal(read(),changed);await screen.selectOption('768x1024');await settled();}
  if(process.env.RT_E2E_VARIANT_SHORTHAND)assert.deepEqual(await nodes.evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).fontVariantNumeric)),['oldstyle-nums','oldstyle-nums']);
  const reset=page.getByRole('button',{name:'Reset shared '+label.toLowerCase(),exact:true,includeHidden:true});await show(reset);await reset.click();await wait(()=>read()!==changed);await settled();assert.deepEqual(await measure(),process.env.RT_E2E_VARIANT_SHORTHAND==='base'?['normal','normal']:initial);await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===changed);await settled();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();
 }
 await nodes.first().evaluate((el,property)=>el.style.setProperty(property,'normal','important'),property);await group();await wait(()=>input.isDisabled());await input.evaluate(el=>{el.value='normal';el.dispatchEvent(new Event('change',{bubbles:true}));});await settled();assert.equal(read(),original);await nodes.first().evaluate((el,property)=>el.style.removeProperty(property),property);
 }
 console.log(kind+': PASS shared capital forms and number position, computed styles, scope/reset/undo and important inline refusal');
};
