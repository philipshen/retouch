'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
exports.run=async({page,app,phone,file,original,state,server})=>{
 const geometry=frame=>frame.locator('#art img, #art span').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect(),c=getComputedStyle(el);return [r.x,r.y,r.width,r.height,c.marginLeft,c.opacity,c.borderTopLeftRadius,c.paddingRight];}));
 const before=await Promise.all([app,phone].map(geometry));
 const wrapped=original.replace('<img id="art-image"','<picture data-rt-picture="" style="display:contents"><source media="(max-width:600px)" srcset="/small.svg 1x"/><img id="art-image"').replace('alt="Art"/>','alt="Art"/></picture>');
 const root=fs.realpathSync(path.dirname(file)),actualFile=fs.realpathSync(file),inventory=require('../../src/vite-picture-styles.cjs').discover(server,{root});assert.ok(inventory.files.includes(actualFile));assert.ok(inventory.files.includes(path.join(root,'art.css')));const plan=require('../../src/svelte-picture-style-plan.cjs').plan({appRoot:root,source:original,relPath:'App.svelte',file:actualFile},{source:wrapped,files:inventory.files});
 const {SourceHistory}=require('../../src/history.cjs'),adapter=require('../../src/adapters/svelte.cjs'),history=new SourceHistory(),saved=history.commit(root,{ok:true,edits:plan.edits});assert.equal(saved.ok,true,saved.reason);
 async function settled(wrapped){
  for(const frame of [app,phone])await frame.locator(wrapped?'#art > picture > img':'#art > img').waitFor();
  await page.waitForFunction(expected=>{const frames=[document.querySelector('#app'),document.querySelector('iframe[title="Phone comparison preview"]')];return frames.every((frame,index)=>{const d=frame.contentDocument,img=d?.querySelector('#art img');if(!img?.complete||!img.naturalWidth)return false;const actual=[...d.querySelectorAll('#art img,#art span')].map(el=>{const r=el.getBoundingClientRect(),c=d.defaultView.getComputedStyle(el);return [r.x,r.y,r.width,r.height,c.marginLeft,c.opacity,c.borderTopLeftRadius,c.paddingRight];});return JSON.stringify(actual)===JSON.stringify(expected[index]);});},before);
  assert.deepEqual(await Promise.all([app,phone].map(geometry)),before);await state();
 }
 await settled(true);await page.screenshot({path:'/tmp/retouch-svelte-picture-style-'+(process.env.RT_E2E_BROWSER||'chromium')+'.png'});
 for(const [direction,wrapped] of [['undo',false],['redo',true],['undo',false]]){const result=history.apply(root,direction,saved.undoId,adapter);assert.equal(result.ok,true,result.reason);await settled(wrapped);for(const edit of plan.edits)assert.equal(fs.readFileSync(edit.file,'utf8'),wrapped?edit.after:edit.before);}
 console.log('SVELTE PICTURE CSS IMPORT GRAPH, RESPONSIVE GEOMETRY, EXACT MULTI-FILE HISTORY AND RETAINED STATE PASS');
};
