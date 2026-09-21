'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,app,read,settled,wait})=>{
 const initial=read(),stroke=app.locator('[data-rt-stroke-alignment] > g:last-child > path').last();
 const undo=async()=>{const button=page.getByRole('button',{name:'Undo',exact:true});assert.equal(await button.isEnabled(),true);await button.focus();await page.keyboard.press('Control+z');};
 const redo=async()=>{const button=page.getByRole('button',{name:'Redo',exact:true});assert.equal(await button.isEnabled(),true);await button.focus();await page.keyboard.press('Control+Shift+z');};
 const open=async()=>{if(!await page.getByRole('dialog',{name:'Stroke settings',exact:true}).isVisible())await page.getByLabel('Advanced stroke settings',{exact:true}).click();};
 const history=async(action,property,value)=>{
  await open();const before=read();await action();await settled();await wait(()=>read()!==before);const after=read();assert.equal(await stroke.getAttribute(property),value);assert.equal(await app.locator('input').inputValue(),'retained draft');assert.equal(await app.locator('input').evaluate(()=>window.strokeDocument),'same');
  await page.getByRole('button',{name:'Close stroke settings',exact:true}).click();await undo();await settled();await wait(()=>read()===before);await redo();await settled();await wait(()=>read()===after);assert.equal(await stroke.getAttribute(property),value);
 };
 await history(()=>page.getByRole('button',{name:'Round caps',exact:true}).click(),'stroke-linecap','round');
 await history(()=>page.getByRole('button',{name:'Square caps',exact:true}).click(),'stroke-linecap','square');
 await history(()=>page.getByRole('button',{name:'Round join',exact:true}).click(),'stroke-linejoin','round');
 await history(()=>page.getByRole('button',{name:'Bevel join',exact:true}).click(),'stroke-linejoin','bevel');
 await history(()=>page.getByRole('button',{name:'Miter join',exact:true}).click(),'stroke-linejoin','miter');
 await history(async()=>{const field=page.getByLabel('SVG miter limit',{exact:true});await field.fill('2.5');await field.press('Enter');},'stroke-miterlimit','2.5');
 await history(()=>page.getByRole('button',{name:'No caps',exact:true}).click(),'stroke-linecap','butt');
 const solid=await app.locator('svg[data-rt]').screenshot();
 await history(()=>page.getByLabel('Stroke style',{exact:true}).selectOption('dashed'),'stroke-dasharray','4 4');assert.notDeepEqual(await app.locator('svg[data-rt]').screenshot(),solid);
 await history(async()=>{await page.getByLabel('Dash length',{exact:true}).fill('10');await page.getByLabel('Dash length',{exact:true}).press('Tab');},'stroke-dasharray','10 4');
 await history(async()=>{await page.getByLabel('Dash gap',{exact:true}).fill('6');await page.getByLabel('Dash gap',{exact:true}).press('Tab');},'stroke-dasharray','10 6');
 await open();const before=read(),offset=page.getByLabel('SVG dash offset',{exact:true});await offset.focus();await page.keyboard.down('ArrowUp');await page.keyboard.down('ArrowUp');assert.equal(await offset.inputValue(),'2');assert.equal(read(),before);assert.equal(await stroke.getAttribute('stroke-dashoffset'),'2');await page.keyboard.press('Escape');await page.keyboard.up('ArrowUp');assert.equal(await stroke.getAttribute('stroke-dashoffset'),'0');assert.equal(read(),before);
 await history(async()=>{await offset.focus();await page.keyboard.down('ArrowDown');await page.keyboard.down('ArrowDown');assert.equal(read(),before);await page.keyboard.up('ArrowDown');},'stroke-dashoffset','-2');
 await history(async()=>{await page.getByLabel('Stroke style',{exact:true}).selectOption('custom');const raw=page.getByLabel('SVG dash pattern',{exact:true});await raw.fill('2, 4, 6');await raw.press('Enter');},'stroke-dasharray','2, 4, 6');
 await history(()=>page.getByLabel('Stroke style',{exact:true}).selectOption('solid'),'stroke-dasharray','none');
 if(process.env.RT_STROKE_SETTINGS_SCREENSHOT){await open();await page.screenshot({path:process.env.RT_STROKE_SETTINGS_SCREENSHOT});await page.getByRole('button',{name:'Close stroke settings',exact:true}).click();}
 // Unwind every settings edit with exactly one undo per committed gesture.
 for(let i=0;i<13;i++){await undo();await settled();}
 assert.equal(read(),initial);
};
