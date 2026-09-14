'use strict';
const assert=require('node:assert/strict');
exports.run=async({page,dialog,wait})=>{
 await page.evaluate(()=>{const original=window.fetch;window.cropLoadProbe={mode:'fail',started:0,aborted:0};window.fetch=(input,options)=>{const probe=window.cropLoadProbe;if(String(input).endsWith('/image.svg')&&options?.signal){probe.started++;if(probe.mode==='fail')return Promise.resolve(new Response('',{status:503}));if(probe.mode==='hang')return new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>{probe.aborted++;reject(new DOMException('Aborted','AbortError'));},{once:true});});}return original(input,options);};});
 const open=()=>page.getByRole('button',{name:'Crop image',exact:true}).click(),retry=dialog.getByRole('button',{name:'Retry image loading',exact:true});
 await open();await retry.waitFor();assert.match(await dialog.getByRole('status').textContent(),/could not be loaded/);assert.equal(await dialog.getByRole('button',{name:'Apply crop',exact:true}).isDisabled(),true);
 await page.evaluate(()=>window.cropLoadProbe.mode='hang');await retry.click();await wait(async()=>await page.evaluate(()=>window.cropLoadProbe.started)===2);await page.keyboard.press('Escape');await wait(async()=>await page.evaluate(()=>window.cropLoadProbe.aborted)===1);assert.equal(await dialog.count(),0);
 await open();await retry.waitFor({timeout:20000});assert.match(await dialog.getByRole('status').textContent(),/too long/);assert.equal(await page.evaluate(()=>window.cropLoadProbe.aborted),2);
 await page.evaluate(()=>window.cropLoadProbe.mode='normal');await retry.click();await wait(()=>dialog.getByLabel('Image zoom (%)',{exact:true}).isEnabled());await dialog.getByAltText('Crop preview').evaluate(el=>el.decode());assert.equal(await retry.isVisible(),false);await page.keyboard.press('Escape');
};
