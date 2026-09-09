'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-snapping-')),file=path.join(root,'index.html');
 const original='<html><head><style>body{margin:0}main{position:relative;margin:20px;border:10px solid #475569;width:600px;height:600px;background:#dbeafe}.box{position:absolute;left:30px;top:40px;width:80px;height:60px;background:#f87171}.sibling{position:absolute;left:300px;top:200px;width:100px;height:80px;background:#34d399}.box[data-bounded]{max-width:268px;max-height:158px}.hidden{visibility:hidden;position:absolute;left:298px;top:198px;width:100px;height:80px}</style></head><body><main><div class="box" aria-label="Box">Box</div><div class="sibling">Align with me</div><div class="hidden">Hidden</div></main></body></html>';
 fs.writeFileSync(file,original);const read=()=>fs.readFileSync(file,'utf8'),server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');
 const browser=await browserType.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),app=page.frameLocator('#app'),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const wait=async fn=>{for(let i=0;i<100;i++){try{if(await fn())return;}catch(e){if(!/Execution context was destroyed/.test(e.message))throw e;}await page.waitForTimeout(100);}throw Error('Snapping did not settle');},settled=()=>wait(async()=>await page.locator('#panelBody').getAttribute('aria-busy')!=='true');
 const close=(a,b)=>assert.ok(Math.abs(a-b)<.3,`${a} differs from ${b}`),box=()=>app.locator('.box').evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement,pr=p.getBoundingClientRect();return{x:r.left-pr.left-p.clientLeft,y:r.top-pr.top-p.clientTop,width:r.width,height:r.height};});
 const start=async()=>{await page.getByRole('button',{name:'Move on canvas',exact:true}).click();const r=await page.locator('.canvas-move-preview').boundingBox(),point={x:r.x+r.width/2,y:r.y+r.height/2};await page.mouse.move(point.x,point.y);await page.mouse.down();return point;};
 const startResize=async(handle='se')=>{await page.getByRole('button',{name:'Resize on canvas',exact:true}).click();const r=await page.locator('[data-resize-handle='+handle+']').boundingBox(),point={x:r.x+r.width/2,y:r.y+r.height/2},preview=await page.locator('.canvas-move-preview').boundingBox();if(handle==='se'){close(point.x,preview.x+preview.width);close(point.y,preview.y+preview.height);}await page.mouse.move(point.x,point.y);await page.mouse.down();return point;};
 const undo=async()=>{await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();close((await box()).x,30);close((await box()).y,40);};
 try{
  await page.goto(`http://localhost:${server.address().port}/rt`);await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await wait(async()=>await app.locator('body').evaluate(()=>innerWidth)===768);await page.getByRole('treeitem',{name:'div · Box',exact:true}).click();await settled();
  for(const zoom of [50,100,200]){
   await page.getByLabel('Canvas zoom (%)',{exact:true}).fill(String(zoom));await page.getByLabel('Canvas zoom (%)',{exact:true}).press('Enter');
   await app.locator('body').evaluate(()=>scrollTo(0,0));await page.locator('#frameWrap').evaluate(async el=>{el.scrollLeft=0;el.scrollTop=96;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
   // Right/bottom edges approach the sibling's left/top by four screen pixels.
   const scale=zoom/100,point=await start(),dx=190*scale-4,dy=100*scale-4;await page.mouse.move(point.x+dx,point.y+dy,{steps:5});assert.equal(read(),original);assert.equal(await page.locator('[data-snap-axis=x]').count(),1);assert.equal(await page.locator('[data-snap-axis=y]').count(),1);close((await box()).x,30);
   const preview=await page.locator('.canvas-move-preview').boundingBox();close(preview.x+preview.width/2,point.x+190*scale);close(preview.y+preview.height/2,point.y+100*scale);
   // Modifier transitions update the current preview without an extra move.
   await page.keyboard.down('Alt');assert.equal(await page.locator('[data-snap-axis]').count(),0);close((await page.locator('.canvas-move-preview').boundingBox()).x+preview.width/2,point.x+dx);await page.keyboard.up('Alt');assert.equal(await page.locator('[data-snap-axis=x]').count(),1);
   if(zoom===50&&process.env.RT_E2E_SNAPPING_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_SNAPPING_SCREENSHOT});
   await page.mouse.up();await wait(()=>read()!==original);await settled();close((await box()).x,220);close((await box()).y,140);await undo();
   const handle=await startResize();await page.mouse.move(handle.x+dx,handle.y+dy,{steps:5});assert.equal(read(),original);assert.equal(await page.locator('[data-snap-axis=x]').count(),1);assert.equal(await page.locator('[data-snap-axis=y]').count(),1);close((await page.locator('.canvas-move-preview').boundingBox()).width,270*scale);close((await page.locator('.canvas-move-preview').boundingBox()).height,160*scale);
   await page.keyboard.down('Control');assert.equal(await page.locator('[data-snap-axis]').count(),0);close((await page.locator('.canvas-move-preview').boundingBox()).width,270*scale-4);await page.keyboard.up('Control');assert.equal(await page.locator('[data-snap-axis=x]').count(),1);
   if(zoom===50&&process.env.RT_E2E_RESIZE_SNAPPING_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_RESIZE_SNAPPING_SCREENSHOT});
   await page.mouse.up();await wait(()=>read()!==original);await settled();let resized=await box();close(resized.x,30);close(resized.y,40);close(resized.width,270);close(resized.height,160);await undo();
  }
  await page.getByLabel('Canvas zoom (%)',{exact:true}).fill('100');await page.getByLabel('Canvas zoom (%)',{exact:true}).press('Enter');
  let point=await start();await page.keyboard.down('Alt');await page.mouse.move(point.x+186,point.y+96);await page.mouse.up();await page.keyboard.up('Alt');await wait(()=>read()!==original);await settled();close((await box()).x,216);close((await box()).y,136);await undo();
  // Container padding edge uses the border offset. Shift must keep y exact.
  point=await start();await page.keyboard.down('Shift');await page.mouse.move(point.x-27,point.y+4);assert.equal(await page.locator('[data-snap-axis=y]').count(),0);await page.mouse.up();await page.keyboard.up('Shift');await wait(()=>read()!==original);await settled();close((await box()).x,0);close((await box()).y,40);await undo();
  point=await start();await page.mouse.move(point.x+186,point.y+96);await page.keyboard.press('Escape');await page.mouse.up();assert.equal(read(),original);assert.equal(await page.locator('.canvas-snap-guides').count(),0);
  // Proportional corners choose the nearest reachable line without distorting.
  for(const modifiers of [['Shift'],['Alt'],['Shift','Alt']]){
   point=await startResize();for(const key of modifiers)await page.keyboard.down(key);await page.mouse.move(point.x+187,point.y+(modifiers.includes('Shift')?0:97),{steps:4});assert.equal(read(),original);await page.mouse.up();for(const key of modifiers.reverse())await page.keyboard.up(key);await wait(()=>read()!==original);await settled();const b=await box();
   if(modifiers.includes('Shift'))close(b.width/b.height,4/3);else{close(b.width,460);close(b.height,260);}
   if(modifiers.includes('Alt')){close(b.x+b.width/2,70);close(b.y+b.height/2,70);}else{close(b.x,30);close(b.y,40);}
   if(modifiers.includes('Shift'))close(b.y+b.height,240);await undo();
  }
  // A nearby line beyond authored maximum sizes must not override the limits.
  await app.locator('.box').evaluate(el=>el.setAttribute('data-bounded',''));point=await startResize();await page.mouse.move(point.x+187,point.y+97);assert.equal(await page.locator('[data-snap-axis]').count(),0);const bounded=await page.locator('.canvas-move-preview').boundingBox();close(bounded.width,267);close(bounded.height,157);await page.keyboard.press('Escape');await page.mouse.up();assert.equal(read(),original);await app.locator('.box').evaluate(el=>el.removeAttribute('data-bounded'));
  point=await startResize();await page.mouse.move(point.x+187,point.y+97);await page.keyboard.press('Escape');await page.mouse.up();assert.equal(read(),original);assert.equal(await page.locator('.canvas-snap-guides').count(),0);
  await page.getByRole('button',{name:'Resize on canvas',exact:true}).click();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await wait(()=>read()!==original);await settled();close((await box()).width,81);await undo();
  // Keyboard nudges are precise and never attracted to nearby alignment lines.
  await page.getByRole('button',{name:'Move on canvas',exact:true}).click();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await wait(()=>read()!==original);await settled();close((await box()).x,31);await undo();assert.deepEqual(errors,[]);
  console.log(engine+': PASS movement/resize sibling/container snapping, constrained ratio/center resizing and bypass at 50/100/200% zoom, visible guides, hidden sibling exclusion, Alt bypass, Shift lock, precise keyboard nudges, source isolation and exact undo');
 }finally{await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
