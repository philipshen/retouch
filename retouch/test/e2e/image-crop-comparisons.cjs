'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,img,dialog,file,source,wait})=>{
 const original=await img.getAttribute('src');
 await page.getByRole('button',{name:'Compare screens',exact:true}).click();const previews=['Phone','Tablet','Desktop'].map(name=>page.frameLocator('iframe[title="'+name+' comparison preview"]'));
 for(const frame of previews){await frame.getByAltText('Color image',{exact:true}).waitFor({state:'attached'});await frame.locator('input').evaluate(el=>{el.value='retained';window.comparisonImageIdentity=window.originalComparisonImageIdentity={};});}
 await page.getByRole('button',{name:'Crop image',exact:true}).click();await wait(()=>dialog.getByLabel('Image zoom (%)',{exact:true}).isEnabled());await dialog.getByLabel('Image zoom (%)',{exact:true}).fill('200');await dialog.getByLabel('Image rotation (°)',{exact:true}).fill('33');await dialog.getByRole('button',{name:'Apply crop',exact:true}).click();await dialog.waitFor({state:'hidden'});await wait(()=>fs.readFileSync(file,'utf8')!==source);const src=await img.getAttribute('src');assert.notEqual(src,original);
 for(const frame of previews){await wait(async()=>await frame.getByAltText('Color image',{exact:true}).getAttribute('src')===src).catch(async error=>{throw Error(error.message+'; comparisons: '+JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('#screenComparisons iframe')].map(frame=>({title:frame.title,ready:frame.contentDocument.readyState,mounted:RetouchClientMount.ready(frame.contentDocument),src:frame.contentDocument.querySelector('img')?.getAttribute('src'),image:frame.contentDocument.querySelector('img')?.outerHTML})))));});await frame.getByAltText('Color image',{exact:true}).evaluate(el=>el.decode());}
 await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>fs.readFileSync(file,'utf8')===source);
 for(const frame of previews){await wait(async()=>await frame.getByAltText('Color image',{exact:true}).getAttribute('src')===original);assert.deepEqual(await frame.locator('input').evaluate(el=>[el.value,window.comparisonImageIdentity===window.originalComparisonImageIdentity&&!!window.comparisonImageIdentity]),['retained',true]);}
 console.log('PASS shared crop updates and undo across Phone/Tablet/Desktop with retained comparison documents and inputs');
};
