'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');const engine=process.env.RT_E2E_BROWSER||'chromium';
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-workspace-panels-')),file=path.join(root,'index.html'),source='<html><body><h1>Heading</h1><p>Content</p></body></html>';fs.writeFileSync(file,source);
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});if(!server.listening)await once(server,'listening');let browser;
 try{
  browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch();const page=await browser.newPage({viewport:{width:1800,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const wait=async fn=>{for(let i=0;i<100;i++){try{if(await fn())return;}catch(error){if(!/Execution context was destroyed/.test(error.message))throw error;}await page.waitForTimeout(50);}throw Error('Workspace did not settle');};
  await page.goto('http://localhost:'+server.address().port+'/rt');await page.frameLocator('#app').getByRole('heading').waitFor();
  const layers=page.getByRole('button',{name:'Toggle Layers panel',exact:true}),inspector=page.getByRole('button',{name:'Toggle Inspector panel',exact:true}),layerPanel=page.locator('#layersPanel'),inspectorPanel=page.locator('#panel'),canvas=page.locator('#frameWrap');
  assert.equal(await layers.getAttribute('aria-expanded'),'true');assert.equal(await inspector.getAttribute('aria-expanded'),'true');const wide=await canvas.evaluate(el=>el.clientWidth);
  await layers.click();await inspector.click();await wait(async()=>await canvas.evaluate(el=>el.clientWidth)>wide+500);await page.reload();await page.frameLocator('#app').getByRole('heading').waitFor();assert.equal(await layerPanel.isVisible(),false);assert.equal(await inspectorPanel.isVisible(),false);await layers.click();await inspector.click();
  await page.setViewportSize({width:720,height:900});await wait(async()=>!await layerPanel.isVisible()&&!await inspectorPanel.isVisible());assert.ok(await canvas.evaluate(el=>el.clientWidth)>=700);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await inspector.click();await inspectorPanel.waitFor({state:'visible'});
  const dock=page.getByRole('navigation',{name:'Canvas tools',exact:true});
  await wait(async()=>{const d=await dock.boundingBox(),p=await inspectorPanel.boundingBox();return d.x+d.width<=p.x;});
  await inspector.click();await inspectorPanel.waitFor({state:'hidden'});
  await layers.click();await layerPanel.waitFor({state:'visible'});
  await wait(async()=>{const d=await dock.boundingBox(),p=await layerPanel.boundingBox();return d.x>=p.x+p.width;});
  await layers.click();await layerPanel.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Compare screens',exact:true}).click();await page.frameLocator('iframe[title="Phone comparison preview"]').locator('body').waitFor();const compactWidth=await canvas.evaluate(el=>el.clientWidth);assert.ok(compactWidth>=400);
  await layers.click();await layerPanel.waitFor({state:'visible'});assert.equal(await canvas.evaluate(el=>el.clientWidth),compactWidth);await page.getByRole('treeitem',{name:'h1 · Heading',exact:true}).click();await inspectorPanel.waitFor({state:'visible'});assert.equal(await layerPanel.isVisible(),false);assert.equal(await canvas.evaluate(el=>el.clientWidth),compactWidth);const selected=await page.locator('#panelBody').textContent();assert.ok(selected.length>0);
  await inspector.focus();await page.keyboard.press('Escape');await inspectorPanel.waitFor({state:'hidden'});assert.equal(await inspector.getAttribute('aria-expanded'),'false');assert.equal(await inspector.evaluate(el=>el===document.activeElement),true);await inspector.click();await inspectorPanel.waitFor({state:'visible'});assert.equal(await page.locator('#panelBody').textContent(),selected);
  await layers.click();const selectionId=await page.frameLocator('#app').getByRole('heading').getAttribute('data-rt');await page.evaluate(id=>window.dispatchEvent(new CustomEvent('retouch:selection',{detail:id})),selectionId);assert.equal(await layerPanel.isVisible(),true,'Refreshing the same selection does not replace the chosen drawer');await inspector.click();
  const background=page.getByLabel('Background color (CSS)',{exact:true});await background.fill('#ff0000');await background.press('Tab');await wait(async()=>fs.readFileSync(file,'utf8')!==source);await wait(async()=>await page.frameLocator('#app').getByRole('heading').evaluate(el=>getComputedStyle(el).backgroundColor)==='rgb(255, 0, 0)');await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(async()=>fs.readFileSync(file,'utf8')===source);await wait(async()=>await page.frameLocator('#app').getByRole('heading').evaluate(el=>getComputedStyle(el).backgroundColor)!=='rgb(255, 0, 0)');
  await page.setViewportSize({width:360,height:800});
  for(const toggle of [inspector,layers]){
   if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
   await wait(async()=>await dock.evaluate(el=>{const r=el.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&[...el.querySelectorAll('button')].every(button=>{const b=button.getBoundingClientRect();return button.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));});}));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollLeft),0);
   await page.locator('#quickActions').click();await page.getByRole('dialog',{name:'Actions',exact:true}).waitFor();await page.keyboard.press('Escape');
  }
  if(process.env.RT_E2E_WORKSPACE_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_WORKSPACE_SCREENSHOT});
  await page.setViewportSize({width:1800,height:1000});await wait(async()=>await layerPanel.isVisible()&&await inspectorPanel.isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(fs.readFileSync(file,'utf8'),source);assert.deepEqual(errors,[]);console.log('WORKSPACE PANELS/PERSISTENCE/COMPACT DRAWERS/SELECTION/ESCAPE/SOURCE PASS',engine);
 }finally{if(browser)await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
