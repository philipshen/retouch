'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-canvas-pan-')),file=path.join(root,'index.html');
 const original='<html style="scroll-behavior:smooth"><body style="margin:0;height:3000px"><h1>Zoom anchor</h1></body></html>';fs.writeFileSync(file,original);
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');const browser=await browserType.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(`http://localhost:${server.address().port}/rt`);await page.frameLocator('#app').getByRole('heading').waitFor();
  const hand=page.getByRole('button',{name:'Hand',exact:true}),surface=page.getByLabel('Pan canvas',{exact:true}),canvas=page.locator('#frameWrap'),layer=page.getByRole('treeitem',{name:'h1 · Zoom anchor',exact:true});
  await layer.click();await page.getByLabel('Canvas zoom (%)',{exact:true}).fill('200');await page.getByLabel('Canvas zoom (%)',{exact:true}).press('Enter');
  const setup=async()=>{await canvas.evaluate(el=>{el.scrollLeft=150;el.scrollTop=400;});return canvas.boundingBox();};
  const scroll=()=>canvas.evaluate(el=>({x:el.scrollLeft,y:el.scrollTop,page:document.querySelector('#app').contentWindow.scrollY}));
  for(const scale of [50,200,400])for(const focus of ['editor','iframe']){
   await page.getByLabel('Canvas zoom (%)',{exact:true}).fill(String(scale));await page.getByLabel('Canvas zoom (%)',{exact:true}).press('Enter');
   const rect=await setup();if(focus==='editor')await layer.focus();else await page.frameLocator('#app').locator('body').evaluate(el=>{el.tabIndex=-1;el.focus();});
   const before=await scroll();await page.keyboard.down('Space');await surface.waitFor({state:'visible'});
   await page.mouse.move(rect.x+400,rect.y+300);await page.mouse.down();await page.mouse.move(rect.x+500,rect.y+370,{steps:5});await page.mouse.up();await page.keyboard.up('Space');await surface.waitFor({state:'hidden'});
   assert.deepEqual(await scroll(),{x:Math.max(0,before.x-100),y:Math.max(0,before.y-70),page:before.page});assert.equal(await layer.getAttribute('aria-selected'),'true');
  }
  await page.getByLabel('Canvas zoom (%)',{exact:true}).fill('200');await page.getByLabel('Canvas zoom (%)',{exact:true}).press('Enter');
  await hand.click();await surface.waitFor({state:'visible'});await setup();await surface.evaluate(el=>el.dispatchEvent(new WheelEvent('wheel',{deltaX:40,bubbles:true,cancelable:true})));assert.equal((await scroll()).x,190,'horizontal wheel works over the hand surface');assert.equal(await hand.getAttribute('aria-pressed'),'true');
  const rect=await setup();await page.mouse.move(rect.x+400,rect.y+300);await page.mouse.down();await page.mouse.move(rect.x+450,rect.y+350);await page.keyboard.press('Escape');const canceled=await scroll();await page.mouse.move(rect.x+500,rect.y+400);assert.deepEqual(await scroll(),canceled);await page.mouse.up();await surface.waitFor({state:'hidden'});assert.equal(await hand.getAttribute('aria-pressed'),'false');
  await layer.click();assert.equal(await layer.getAttribute('aria-selected'),'true','next click is not swallowed by canceled capture');
  await page.getByLabel('Find a layer').fill('');await page.getByLabel('Find a layer').focus();await page.keyboard.press('Space');assert.equal(await page.getByLabel('Find a layer').inputValue(),' ');assert.equal(await surface.isVisible(),false);await page.getByLabel('Find a layer').fill('');
  await hand.click();await page.getByRole('button',{name:'Edit mode',exact:true}).click();await surface.waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('#canvasHand').disabled);assert.equal(await hand.isDisabled(),true);await page.frameLocator('#app').locator('body').evaluate(el=>el.focus());await page.keyboard.press('Space');assert.equal(await surface.isVisible(),false);await page.getByRole('button',{name:'Interact mode',exact:true}).click();
  await hand.click();await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await surface.waitFor({state:'hidden'});assert.equal(await hand.getAttribute('aria-pressed'),'false');
  assert.equal(fs.readFileSync(file,'utf8'),original);assert.deepEqual(errors,[]);console.log(engine+': PASS hand button, Space-drag from editor/iframe, scale-independent pan, selection/page-scroll preservation, Escape capture recovery, typing/Interact guards, screen-change cancellation and unchanged source');
 }finally{await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
