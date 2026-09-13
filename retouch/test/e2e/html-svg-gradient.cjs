'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(require.resolve('playwright',{paths:[fixture]}))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-svg-gradient-')),file=path.join(root,'index.html');
 let original='<html><head></head><body><svg width="400" height="240" viewBox="0 0 400 240"><defs><linearGradient id="paint"><stop offset="0" stop-color="#ff0000"/><stop offset="100%" stop-color="#0000ff"/></linearGradient><radialGradient id="radial"><stop offset="0" stop-color="white"/><stop offset="1" stop-color="black"/></radialGradient></defs><rect aria-label="Gradient box" x="10" y="10" width="180" height="100" fill="url(#paint)"/><circle aria-label="Shared gradient" cx="260" cy="60" r="50" fill="url(#paint)"/><rect aria-label="Radial box" x="10" y="140" width="180" height="80" fill="url(#radial)"/><rect aria-label="Solid box" class="layout-marker" x="330" y="110" width="50" height="25" fill="#22aa44" stroke="#4466aa" stroke-width="3"/></svg></body></html>';
 if(process.env.RT_E2E_GRADIENT_TRANSFORM)original=original.replaceAll('Gradient id=', 'Gradient gradientTransform="rotate(20 .5 .5)" id=').replace('<rect aria-label="Gradient box"','<rect transform="rotate(12 100 60)" aria-label="Gradient box"');
 if(process.env.RT_E2E_GRADIENT_VIEWPORT)original=original.replace(/<(linearGradient|radialGradient) /g, '<$1 gradientUnits="userSpaceOnUse" ');
 fs.writeFileSync(file,original);const read=()=>fs.readFileSync(file,'utf8');
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');
 const browser=await browserType.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const app=page.frameLocator('#app');
 const wait=async fn=>{for(let i=0;i<120;i++){try{if(await fn())return;}catch(error){if(!/Execution context was destroyed/.test(error.message))throw error;}await page.waitForTimeout(100);}throw Error('Timed out waiting for gradient');};
 const settled=()=>wait(async()=>await page.locator('#panelBody').getAttribute('aria-busy')!=='true');
 const edit=async(label,value)=>{const input=page.getByLabel(label,{exact:true});await input.fill(value);await input.press('Tab');await settled();};
 try{
  await page.goto(`http://localhost:${server.address().port}/rt`);await app.locator('[aria-label="Gradient box"]').click();await settled();await wait(async()=>await page.getByLabel('Stop 1 color',{exact:true}).count()===1);
  if(process.env.RT_E2E_SVG_CANVAS_STOP_ACTIONS_ONLY){await require('./svg-gradient-canvas-stop-actions.cjs').run({page,app,file,wait,settled});assert.deepEqual(errors,[]);return;}
  if(process.env.RT_E2E_SVG_CANVAS_STOPS_ONLY){await require('./svg-gradient-canvas-stops.cjs').run({page,app,file,wait,settled});assert.deepEqual(errors,[]);return;}
  if(process.env.RT_E2E_SVG_SESSION_ONLY){await require('./svg-gradient-canvas-session.cjs').run({page,app,file,wait,settled});assert.deepEqual(errors,[]);return;}
  if(process.env.RT_E2E_SVG_CANVAS_GRADIENT_ONLY){await require('./svg-gradient-canvas.cjs').run({page,app,file,wait,settled});assert.deepEqual(errors,[]);return;}
  if(process.env.RT_E2E_SVG_SOLID_ONLY){await require('./svg-gradient-solid.cjs').run({page,app,file,wait,settled});assert.deepEqual(errors,[]);return;}
  if(process.env.RT_E2E_SVG_CREATE_ONLY){await require('./svg-gradient-create.cjs').run({page,app,file,wait,settled});assert.deepEqual(errors,[]);return;}
  if(process.env.RT_E2E_SVG_REVERSE_ONLY){await require('./svg-gradient-reverse.cjs').run({page,app,file,wait,settled});assert.deepEqual(errors,[]);return;}
  if(process.env.RT_E2E_SVG_TYPE_ONLY){await require('./svg-gradient-type.cjs').run({page,app,file,wait,settled});assert.deepEqual(errors,[]);return;}
  if(process.env.RT_E2E_SVG_REORDER_ONLY){await require('./svg-gradient-stop-reorder.cjs').run({page,app,file,wait,settled});assert.deepEqual(errors,[]);return;}
  await require('./svg-gradient-stop-editing.cjs').run({page,app,file,wait,settled});
  await require('./svg-gradient-stop-drag.cjs').run({page,app,file,wait,settled});
  await require('./svg-gradient-stop-reorder.cjs').run({page,app,file,wait,settled});
  await require('./svg-gradient-stop-picker.cjs').run({page,app,file,wait,settled});
  await require('./svg-gradient-detach.cjs').run({page,app,file,wait,settled});await require('./svg-gradient-type.cjs').run({page,app,file,wait,settled});
  await require('./svg-gradient-reverse.cjs').run({page,app,file,wait,settled});
  await require('./svg-gradient-create.cjs').run({page,app,file,wait,settled});
  await require('./svg-gradient-solid.cjs').run({page,app,file,wait,settled});
  await require('./svg-gradient-canvas.cjs').run({page,app,file,wait,settled});
  for(const [label,value,selector,attribute]of [['Stop 1 color','#00ff00','#paint stop:first-child','stop-color'],['Stop 2 position','75%','#paint stop:last-child','offset'],['Stop 2 opacity','0.5','#paint stop:last-child','stop-opacity'],['Gradient x2','60%','#paint','x2']]){
   await edit(label,value);await wait(async()=>await app.locator(selector).getAttribute(attribute)===value);if(attribute==='stop-color')assert.equal(await app.locator(selector).evaluate(el=>getComputedStyle(el).stopColor),'rgb(0, 255, 0)');const changed=read();assert.notEqual(changed,original);assert.equal(await app.locator('circle').getAttribute('fill'),'url(#paint)');
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);await wait(async()=>await app.locator(selector).getAttribute(attribute)!==value);
   await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===changed);await wait(async()=>await app.locator(selector).getAttribute(attribute)===value);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
  }
  await page.getByLabel('Gradient gradientUnits',{exact:true}).selectOption('userSpaceOnUse');await settled();await wait(async()=>await app.locator('#paint').getAttribute('gradientUnits')==='userSpaceOnUse');await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
  await edit('Stop 1 position','200%');assert.equal(read(),original);await page.getByRole('treeitem',{name:'rect · Radial box',exact:true}).click();await settled();await edit('Gradient fx','25%');await wait(async()=>await app.locator('#radial').getAttribute('fx')==='25%');
  assert.ok(await page.getByText('Shared gradient · Edits affect all referencing layers and screen sizes. Page styles can override stop colors.',{exact:true}).isVisible());
  if(process.env.RT_E2E_GRADIENT_SCREENSHOT){await page.locator('[data-section="fill-gradient"]').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:process.env.RT_E2E_GRADIENT_SCREENSHOT});}
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);assert.deepEqual(errors,[]);console.log('PASS SVG gradient inspector: shared paint, stops, coordinates, radial focus, exact undo/redo, invalid input ('+engine+')');
 }finally{await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
