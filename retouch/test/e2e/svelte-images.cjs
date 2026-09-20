'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,phone,file,original,state})=>{
 const settled=()=>page.waitForFunction(()=>!undoBusy&&!sourceRequests&&!panelTasks),read=()=>fs.readFileSync(file,'utf8');
 const image=frame=>frame.locator('img[aria-label=Hero]');
 const previousLoads=new Map();
 const check=async src=>{for(const frame of [app,phone]){assert.equal(await image(frame).getAttribute('src'),src);await image(frame).evaluate(el=>el.decode());assert.equal(await image(frame).evaluate(el=>el.naturalWidth),40);const loads=Number(await frame.locator('[data-image-loads]').textContent());assert.ok(loads>(previousLoads.get(frame)||0),'The authored image load handler and retained state must keep progressing');previousLoads.set(frame,loads);}await state();};
 await page.getByRole('treeitem',{name:'img · Hero',exact:true}).click();await settled();
 await page.getByLabel('Image path',{exact:true}).fill('/new.svg');await page.getByRole('button',{name:'Apply image path',exact:true}).click();await settled();await check('/new.svg');const changed=read();assert.ok(changed.includes('alt="Hero picture"'));assert.ok(changed.includes('onload={()=>loaded++}'));
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),original);await check('/old.svg');await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();assert.equal(read(),changed);await check('/new.svg');
 await page.getByLabel('Upload image source',{exact:true}).setInputFiles({name:'replacement.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="green"/></svg>')});
 await page.waitForFunction(()=>sel?.info?.src?.startsWith('/rt-assets/')&&!panelTasks&&!sourceRequests);await settled();const uploaded=await image(app).getAttribute('src');await check(uploaded);const uploadedSource=read();assert.ok(uploadedSource.includes(uploaded));
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),changed);await check('/new.svg');await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();assert.equal(read(),uploadedSource);await check(uploaded);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),original);await check('/old.svg');
 for(const name of ['Bound','Responsive']){await page.getByRole('treeitem',{name:'img · '+name,exact:true}).click();await settled();assert.equal(await page.getByLabel('Image path',{exact:true}).count(),0);}
 await page.getByRole('treeitem',{name:'h1 · Hello Svelte',exact:true}).click();await settled();
 console.log('SVELTE IMAGE PATH/UPLOAD, DECODED COMPARISONS, BINDING GUARDS AND EXACT HISTORY PASS');
};
