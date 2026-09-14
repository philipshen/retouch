'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,dialog,file,source,wait})=>{
 await page.getByRole('button',{name:'Crop image',exact:true}).click();await wait(()=>dialog.getByLabel('Image shadows',{exact:true}).isEnabled());
 for(const [width,height]of [[1366,768],[900,600],[480,500]]){
  await page.setViewportSize({width,height});await page.waitForFunction(()=>{const d=document.querySelector('.image-crop-dialog'),r=d.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;});
  const preview=dialog.getByAltText('Crop preview'),before=await preview.boundingBox();await dialog.getByLabel('Image shadows',{exact:true}).fill('70');await dialog.getByLabel('Image shadows',{exact:true}).press('Tab');await dialog.getByRole('button',{name:'Reset adjustments',exact:true}).scrollIntoViewIfNeeded();
  const after=await preview.boundingBox();assert.ok(Math.abs(after.y-before.y)<1,'Preview stays fixed while scrolling to lower controls');assert.ok(await dialog.locator('.image-crop-controls').evaluate(el=>el.scrollTop>0),JSON.stringify(await dialog.locator('.image-crop-controls').evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight,top:el.scrollTop,rect:el.getBoundingClientRect().toJSON(),dialog:el.parentElement.getBoundingClientRect().toJSON()}))));assert.equal(await dialog.evaluate(el=>el.scrollTop),0);
  for(const control of [preview,dialog.getByRole('button',{name:'Apply crop',exact:true}),dialog.getByRole('button',{name:'Cancel',exact:true})]){const box=await control.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1);}
  assert.equal(fs.readFileSync(file,'utf8'),source);
 }
 if(process.env.RT_E2E_CROP_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_CROP_SCREENSHOT});await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(fs.readFileSync(file,'utf8'),source);console.log('PASS laptop and narrow-window crop controls scroll independently while preview and actions remain visible');
};
