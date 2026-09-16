 'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 const show=control=>wait(()=>control.evaluate(el=>{window.RetouchInspectorUI.reveal(el);return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(el.isConnected&&!el.matches(':disabled')&&el.getClientRects().length>0))));}));
 const group=async()=>{await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click();await page.getByRole('treeitem',{name:'p · Other text',exact:true}).click({modifiers:['Shift']});await settled();};
 const nodes=app.locator('h1,p.other-font'),screen=page.getByLabel('Screen size',{exact:true}),original=read();
 await screen.selectOption('768x1024');await settled();await page.getByLabel('Style screen scope').selectOption(kind==='html'?'min-[768px]:':'md:');await settled();await group();
 const trigger=page.getByLabel('Shared type settings',{exact:true});await trigger.click();
 const dialog=page.getByRole('dialog',{name:'Type settings',exact:true}),tabs=dialog.getByRole('tablist',{name:'Type settings categories',exact:true});
 assert.equal(await tabs.getByRole('tab').count(),3);const basics=tabs.getByRole('tab',{name:'Basics',exact:true}),details=tabs.getByRole('tab',{name:'Details',exact:true});
 await basics.click();await basics.press('ArrowRight');assert.equal(await details.getAttribute('aria-selected'),'true');assert.equal(await details.evaluate(el=>el===document.activeElement),true);await details.press('Home');assert.equal(await basics.getAttribute('aria-selected'),'true');assert.equal(read(),original,'tab navigation must not write source');
 await show(page.getByLabel('Shared Number width',{exact:true}));assert.equal(await details.getAttribute('aria-selected'),'true','reveal must open the containing category');
 const layerPreview=page.frameLocator('iframe[title="Selected layer typography preview"]'),previewLayer=page.getByLabel('Preview selected text layer',{exact:true});
 await previewLayer.selectOption('0');await wait(async()=>await layerPreview.locator('body > div').evaluate(el=>getComputedStyle(el).fontVariantNumeric)==='oldstyle-nums');
 await previewLayer.selectOption('1');await wait(async()=>await layerPreview.locator('body > div').evaluate(el=>getComputedStyle(el).fontVariantNumeric)==='lining-nums');
 await page.getByLabel('Shared Number width',{exact:true}).focus();await wait(async()=>await layerPreview.locator('body > div').textContent()==='111111 · 888888');assert.equal(read(),original,'preview layer and sample changes must not write source');
 if(process.env.RT_E2E_SHARED_FEATURE_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_SHARED_FEATURE_SCREENSHOT,caret:'initial'});
 await page.keyboard.press('Escape');assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);assert.equal(read(),original);
 for(const [property,label,value,resetLabel,expected]of [
 ['font-variant-numeric','Number width','tabular-nums','number formatting',['oldstyle-nums tabular-nums','lining-nums tabular-nums']],
 ['font-variant-ligatures','Common ligatures','common-ligatures','ligatures',['common-ligatures no-discretionary-ligatures no-historical-ligatures no-contextual','common-ligatures']]]){
  const measure=()=>nodes.evaluateAll((nodes,p)=>nodes.map(el=>getComputedStyle(el).getPropertyValue(p)),property),initial=await measure(),input=page.getByLabel('Shared '+label,{exact:true});
  assert.deepEqual(initial,property.endsWith('numeric')?['oldstyle-nums','lining-nums']:['none','normal'],'fixture must start with distinct per-layer font features');
  if(property.endsWith('ligatures'))assert.equal(await input.inputValue(),'__mixed');
  await show(input);await input.selectOption(value);await wait(()=>read()!==original);await settled();try{await wait(async()=>JSON.stringify(await measure())===JSON.stringify(expected));}catch(error){console.log('FEATURE MISMATCH',property,await measure(),expected,read());throw error;}await wait(async()=>await layerPreview.locator('body > div').evaluate((el,p)=>getComputedStyle(el).getPropertyValue(p),property)===expected[1]);const changed=read();
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await screen.focus();await screen.selectOption('390x844');await settled();await screen.focus();await wait(()=>input.isDisabled());assert.deepEqual(await measure(),initial);await input.evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));},value);assert.equal(read(),changed);await screen.selectOption('768x1024');await settled();
  const reset=page.getByRole('button',{name:'Reset shared '+resetLabel,exact:true,includeHidden:true});await show(reset);await reset.click();await wait(()=>read()!==changed);await settled();assert.deepEqual(await measure(),initial);await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===changed);await settled();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();
  await nodes.first().evaluate((el,p)=>el.style.setProperty(p,'normal','important'),property);await group();await wait(()=>input.isDisabled());await input.evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));},value);await settled();assert.equal(read(),original);await nodes.first().evaluate((el,p)=>el.style.removeProperty(p),property);await group();
 }
 console.log(kind+': PASS shared number and ligature groups preserve per-layer features, mixed state, responsive fallback, reset, exact undo and inline guards');
};
