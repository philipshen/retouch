'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
exports.run=async({page,app,phone,file,original,state})=>{
 const geometry=frame=>frame.locator('#art img, #art span').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect(),c=getComputedStyle(el);return [r.x,r.y,r.width,r.height,c.marginLeft,c.opacity];}));
 const before=await Promise.all([app,phone].map(geometry));
 const wrapped=original.replace('<img id="art-image"','<picture data-rt-picture="" style="display:contents"><source media="(max-width:600px)" srcset="/small.svg 1x"/><img id="art-image"').replace('alt="Art"/>','alt="Art"/></picture>');
 const after=require('../../src/svelte-picture-styles.cjs').plan({source:original,relPath:'App.svelte',file},{source:wrapped}).source;fs.writeFileSync(file,after);
 for(const frame of [app,phone])await frame.locator('#art > picture > img').waitFor();
 await page.waitForFunction(()=>{const frames=[document.querySelector('#app'),document.querySelector('iframe[title="Phone comparison preview"]')];return frames.every(frame=>{const d=frame.contentDocument,img=d?.querySelector('#art img');return img&&img.complete&&img.naturalWidth&&d.defaultView.getComputedStyle(img).width===(d.defaultView.innerWidth<=600?'20px':'40px');});});
 assert.deepEqual(await Promise.all([app,phone].map(geometry)),before);await state();await page.screenshot({path:'/tmp/retouch-svelte-picture-style-'+(process.env.RT_E2E_BROWSER||'chromium')+'.png'});
 fs.writeFileSync(file,original);for(const frame of [app,phone])await frame.locator('#art > img').waitFor();await state();assert.deepEqual(await Promise.all([app,phone].map(geometry)),before);
 console.log('SVELTE SCOPED PICTURE CSS, RESPONSIVE GEOMETRY, SIBLING STYLES AND RETAINED STATE PASS');
};
