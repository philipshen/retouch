'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,file,wait,settled,kind})=>{
 const read=()=>fs.readFileSync(file,'utf8'),original=read(),image=app.getByAltText('Color image',{exact:true});
 await image.evaluate(el=>el.decode());const originalURL=await image.getAttribute('src');let uploads=0;page.on('request',request=>{if(request.url().includes('/rt/__api/upload?'))uploads++;});
 await app.locator('input').evaluate(el=>{el.value='retained';window.layerPickerOriginal=window.layerPickerIdentity={};});
 if(kind==='react'){await page.locator('#modeBtn').click();
 await app.getByRole('button',{name:'Clicks 0',exact:true}).click();
 await app.getByRole('button',{name:'Clicks 1',exact:true}).waitFor();
 await page.locator('#modeBtn').click();}
 await page.getByRole('treeitem',{name:'img · Color image',exact:true}).click();
 await settled();const browse=page.getByRole('button',{name:'Browse project images',exact:true}),dialog=page.getByRole('dialog',{name:'Project images',exact:true});
 await browse.click();
 await dialog.getByLabel('Find a project image',{exact:true}).fill('picker-blue');const choice=dialog.getByRole('button',{name:kind==='liquid'?'Use project image /assets/picker-blue.svg':'Use project image /picker-blue.svg',exact:true});
 await choice.waitFor();
 await wait(()=>choice.locator('img').evaluate(el=>el.complete&&el.naturalWidth>0));
 await page.keyboard.press('Escape');
 await dialog.waitFor({state:'hidden'});assert.equal(read(),original);assert.equal(await browse.evaluate(el=>el===document.activeElement),true);
 await browse.click();
 await dialog.getByLabel('Find a project image',{exact:true}).fill('picker-blue');
 await choice.click();try{await dialog.waitFor({state:'hidden'});}catch(error){console.error('PICKER STATUS',await dialog.innerText(),read());throw error;}await settled();
 await wait(async()=>await image.evaluate(el=>el.complete&&el.naturalWidth>0&&el.currentSrc.includes('picker-blue.svg')));
 await image.evaluate(el=>el.decode());
 const sharp=require(require('node:path').join(process.env.RT_INSPECTOR_FIXTURE,'node_modules/sharp')),pixels=await sharp(await image.screenshot()).removeAlpha().raw().toBuffer({resolveWithObject:true});
 for(const fraction of [.25,.5,.75]){const offset=(Math.floor(pixels.info.height/2)*pixels.info.width+Math.floor(pixels.info.width*fraction))*3;assert.deepEqual([...pixels.data.subarray(offset,offset+3)],[0,0,255]);}
 assert.equal(uploads,0);if(kind==='liquid'){assert.match(read(),/picker-blue.svg' \| asset_url/);assert.ok((await image.getAttribute('src')).startsWith('/test-theme-assets/'));}
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await settled();
 await wait(()=>read()===original);
 await wait(async()=>await image.getAttribute('src')===originalURL);
 // A late file upload must not modify the old image when a new selection starts.
 let release,held=false;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/rt/__api/upload?*',async route=>{const response=await route.fetch();held=true;
 await gate;
 await route.fulfill({response});});
 const pick=await page.locator('#imgPick').elementHandle(),chooser=page.waitForEvent('filechooser');
 await page.locator('#imgPick').click();
 await (await chooser).setFiles({name:'late-image.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')});
 await wait(()=>held);
 await page.getByRole('treeitem',{name:'h1 · Headline',exact:true}).click();release();
 await wait(()=>pick.evaluate(el=>!el.disabled));assert.equal(read(),original);
 await page.unroute('**/rt/__api/upload?*');
 assert.deepEqual(await app.locator('input').evaluate(el=>[el.value,window.layerPickerOriginal===window.layerPickerIdentity]),['retained',true]);if(kind==='react')assert.equal(await app.getByRole('button',{name:'Clicks 1',exact:true}).count(),1);
 console.log(kind+': PASS image-layer catalog preview/search/cancel, blue replacement pixels without upload, exact undo, focus/state retention and stale upload protection');
};
