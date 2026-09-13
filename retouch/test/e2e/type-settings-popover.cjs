'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,kind,read,wait,settled})=>{
 for(const [label,property,value,resetName,mode]of [
  [kind==='html'?'Font size (CSS)':'Font size (px)','fontSize','40','Reset font size'],
  [kind==='html'?'Letter spacing (CSS)':'Letter spacing (px)','letterSpacing','2','Reset letter spacing'],
  [kind==='html'?'Font style (CSS)':'Font slant','fontStyle','italic','Reset font style','select'],
  [kind==='html'?'Text decoration (CSS)':'Text decoration','textDecorationLine','underline','Reset text decoration','select'],
  [kind==='html'?'Text case (CSS)':'Text case','textTransform','uppercase','Reset text case','select'],
  [kind==='html'?'Text alignment (CSS)':'Text alignment','textAlign','center','Reset text alignment','alignment']
 ]){
  const before=read(),target=app.locator('h1'),baseline=await target.evaluate((el,p)=>getComputedStyle(el)[p],property),input=page.getByLabel(label,{exact:true});if(mode==='alignment')await page.getByRole('button',{name:'Align text center',exact:true}).click();else if(mode==='select'){const opener=page.locator('summary[aria-label="Type settings"]');if(!await opener.evaluate(el=>el.parentElement.open))await opener.click();await page.getByRole('tab',{name:'Basics',exact:true}).click();await input.selectOption(value);}else{await input.fill(value);await input.press('Tab');}await settled();await wait(()=>read()!==before);await wait(async()=>await target.evaluate((el,p)=>getComputedStyle(el)[p],property)===(mode?value:value+'px'));const changed=read();
  await page.getByRole('button',{name:resetName,exact:true}).click();await settled();await wait(async()=>await target.evaluate((el,p)=>getComputedStyle(el)[p],property)===baseline);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===changed);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===before);
 }
 const source=read(),original=page.viewportSize(),opener=page.locator('summary[aria-label="Type settings"]'),dialog=page.getByRole('dialog',{name:'Type settings',exact:true}),close=page.getByRole('button',{name:'Close type settings',exact:true});
 const bounded=async()=>{const b=await dialog.boundingBox(),v=page.viewportSize();return b&&b.x>=0&&b.y>=0&&b.x+b.width<=v.width&&b.y+b.height<=v.height;};
 if(await dialog.isVisible())await close.click();
 assert.equal(await opener.evaluate(el=>Boolean(el.closest('.typography-alignment-tools'))),true);
 await opener.click();await dialog.waitFor();
 const tabs=dialog.getByRole('tablist',{name:'Type settings categories'}),basics=tabs.getByRole('tab',{name:'Basics',exact:true}),details=tabs.getByRole('tab',{name:'Details',exact:true}),variable=tabs.getByRole('tab',{name:'Variable',exact:true});
 await basics.click();await basics.press('ArrowRight');assert.equal(await details.getAttribute('aria-selected'),'true');assert.equal(await details.evaluate(el=>el===document.activeElement),true);assert.equal(await dialog.getByRole('tabpanel',{name:'Basics',exact:true}).isVisible(),false);assert.equal(await dialog.getByRole('tabpanel',{name:'Details',exact:true}).isVisible(),true);
 await details.press('End');assert.equal(await variable.getAttribute('aria-selected'),'true');assert.equal(await dialog.getByRole('tabpanel',{name:'Variable',exact:true}).isVisible(),true);await variable.press('Home');assert.equal(await basics.getAttribute('aria-selected'),'true');assert.equal(read(),source);
 const sample=page.frameLocator('iframe[title="Typography preview"]').locator('body div');await sample.waitFor();const originalSample=await sample.textContent();
 await details.click();await wait(async()=>await sample.textContent()==='0123456789');const numbers=dialog.locator('.numeric-typography > summary');if(!await numbers.evaluate(el=>el.parentElement.open))await numbers.click();
 for(const [label,text]of [['Number width','111111 · 888888'],['Number style','0123456789'],['Fractions','1/2 1/3 3/4'],['Ordinals','1st 2nd 3rd'],['Zero style','0 O 00 OO']]){const control=dialog.getByLabel(label,{exact:true});await control.focus();await wait(async()=>await sample.textContent()===text);}
 await details.focus();await dialog.getByLabel('Fractions',{exact:true}).hover();await wait(async()=>await sample.textContent()==='1/2 1/3 3/4');await details.hover();await wait(async()=>await sample.textContent()==='0123456789');await basics.click();await wait(async()=>await sample.textContent()===originalSample);assert.equal(read(),source);await close.click();

 await opener.click();await dialog.waitFor();await wait(bounded);
 const more=dialog.locator('details').filter({has:page.locator(':scope > summary', {hasText:'More font settings'})});
 assert.equal(await more.count(),1);await more.evaluate(el=>el.open=false);
 const numeric=dialog.locator('input[aria-label="Font weight (CSS)"],input[aria-label="Font weight (1–1000)"]');assert.equal(await numeric.isVisible(),false);
 assert.equal(await page.getByLabel('Font weight style',{exact:true}).isVisible(),true);
 assert.equal(await dialog.locator('.type-settings-page > button').count(),0,'Reset buttons belong beside their property or inside More font settings');
 for(const name of ['Reset font size','Reset line height','Reset letter spacing']){const reset=page.getByRole('button',{name,exact:true});assert.equal(await reset.evaluate(el=>el.parentElement.classList.contains('property-row')),true);assert.equal(await reset.textContent(),'↺');}
 await wait(bounded);if(process.env.RT_E2E_TYPE_SETTINGS_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_TYPE_SETTINGS_SCREENSHOT+'.regular.png'});await close.focus();await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);assert.equal(await opener.evaluate(el=>el===document.activeElement),true);
 await opener.click();await dialog.waitFor();await page.getByLabel('Font weight style',{exact:true}).click();assert.equal(await dialog.isVisible(),false);await page.keyboard.press('Escape');
 await opener.click();await details.click();await close.click();
 await page.getByLabel('Font weight style',{exact:true}).selectOption('custom');await dialog.waitFor();await wait(bounded);
 assert.ok(await dialog.evaluate(el=>el.contains(document.activeElement)&&document.activeElement.getClientRects().length>0),'Custom weight focuses a visible control inside the popup');await close.click();
 await opener.click();await variable.click();await close.click();
 await page.keyboard.press('ControlOrMeta+k');await page.getByRole('combobox',{name:'Search actions',exact:true}).fill('Edit font weight');await page.getByRole('combobox',{name:'Search actions',exact:true}).press('Enter');await dialog.waitFor();assert.ok(await dialog.evaluate(el=>el.contains(document.activeElement)),'action search focuses the revealed field');await close.click();
 await page.setViewportSize({width:1000,height:280});await wait(()=>page.locator('#main').evaluate(el=>el.classList.contains('compact-workspace')));await settled();const toggle=page.getByRole('button',{name:'Toggle Inspector panel',exact:true});if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
 await opener.click();await dialog.waitFor();await wait(bounded);await dialog.evaluate(el=>{el.scrollTop=el.scrollHeight;});assert.ok(await dialog.evaluate(el=>el.scrollTop)>0);
 await wait(async()=>{const a=await close.boundingBox(),b=await dialog.boundingBox();return a&&b&&a.y>=b.y&&a.y+a.height<=b.y+b.height;});
 const visibleLast=dialog.getByRole('tabpanel',{name:'Basics',exact:true}).locator('button').last();await visibleLast.scrollIntoViewIfNeeded();assert.equal(await visibleLast.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true);
 if(process.env.RT_E2E_TYPE_SETTINGS_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_TYPE_SETTINGS_SCREENSHOT});
 await close.click();assert.equal(await dialog.isVisible(),false);assert.equal(await opener.evaluate(el=>el===document.activeElement),true);assert.equal(read(),source);
 await page.setViewportSize(original);await settled();assert.equal(read(),source);
 console.log('TYPE SETTINGS POPOVER PASS: close, Escape, outside dismissal, Custom focus, compact scrolling and no source writes');
};
