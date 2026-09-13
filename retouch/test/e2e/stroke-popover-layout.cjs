'use strict';
const assert=require('node:assert/strict');
module.exports=async({page,read,wait,settled})=>{
 const source=read(),original=page.viewportSize(),opener=page.locator('summary[aria-label="Advanced stroke settings"]'),dialog=page.getByRole('dialog',{name:'Stroke settings',exact:true}),edges=page.locator('.border-edges > summary'),close=page.getByRole('button',{name:'Close stroke settings',exact:true});
 const bounded=async()=>{const box=await dialog.boundingBox(),v=page.viewportSize();return box&&box.x>=0&&box.y>=0&&box.x+box.width<=v.width&&box.y+box.height<=v.height;};
 await page.setViewportSize({width:1000,height:280});await settled();const toggle=page.getByRole('button',{name:'Toggle Inspector panel',exact:true});if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();await opener.click();await dialog.waitFor();await wait(bounded);
 assert.equal(await edges.evaluate(el=>el.parentElement.open),false);await edges.click();await wait(bounded);
 await dialog.evaluate(el=>{el.scrollTop=el.scrollHeight;});assert.ok(await dialog.evaluate(el=>el.scrollTop)>0,'fixture must actually scroll the panel');await wait(async()=>{const a=await close.boundingBox(),b=await dialog.boundingBox();return a&&b&&a.y>=b.y&&a.y+a.height<=b.y+b.height;});
 const lastInput=dialog.locator('.border-edges input').last();assert.equal(await lastInput.evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el;}),true,'bottom input must receive hits above the tool dock');
 if(process.env.RT_E2E_STROKE_POPUP_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_STROKE_POPUP_SCREENSHOT});
 await edges.click();await wait(bounded);await close.click();assert.equal(await dialog.isVisible(),false);assert.equal(await opener.evaluate(el=>document.activeElement===el),true);assert.equal(read(),source);
 await page.setViewportSize(original);await settled();assert.equal(read(),source);
 console.log('STROKE POPOVER RESIZE AND SCROLL PASS');
};
