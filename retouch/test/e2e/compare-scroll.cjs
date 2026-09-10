'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-compare-scroll-')),file=path.join(root,'index.html');
 const source='<!doctype html><html><head><style>body{margin:0;min-height:3000px;min-width:1500px}#outer{margin:10px;width:280px;height:200px;overflow:auto}#inner{width:220px;height:120px;overflow:auto;font:16px/20px sans-serif}#content{width:900px;height:600px;background:linear-gradient(red,blue)}#tail{height:1000px;width:500px}</style></head><body><div id="outer"><div id="inner"><div id="content">Scrollable content</div></div><div id="tail">Outer content</div></div></body></html>';fs.writeFileSync(file,source);
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});if(!server.listening)await once(server,'listening');let browser;
 try{
  browser=await browserType.launch();const page=await browser.newPage({viewport:{width:1800,height:1200}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const wait=async fn=>{for(let n=0;n<100;n++){if(await fn())return;await new Promise(r=>setTimeout(r,50));}throw Error('Comparison scroll did not settle');};
  await page.goto('http://localhost:'+server.address().port+'/rt');await page.getByRole('button',{name:'Compare screens',exact:true}).click();
  const frame=page.frameLocator('iframe[title="Phone comparison preview"]'),viewport=page.getByRole('button',{name:'Edit from Phone comparison',exact:true});await frame.locator('#inner').waitFor();
  if(process.env.RT_E2E_COMPARE_ORDER){
   const order=()=>page.locator('.compare-card').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label'))),up=()=>page.getByRole('button',{name:'Move Phone comparison up',exact:true}),down=()=>page.getByRole('button',{name:'Move Phone comparison down',exact:true});
   assert.equal(await up().isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Move Desktop comparison down',exact:true}).isDisabled(),true);
   const preserving=await page.evaluate(()=>typeof document.getElementById('screenComparisons').moveBefore==='function');await frame.locator('body').evaluate(()=>{window.reorderProbe='kept';scrollTo(0,300);});
   await down().click();assert.deepEqual(await order(),['Tablet comparison','Phone comparison','Desktop comparison']);await wait(async()=>await frame.locator('body').evaluate(()=>scrollY)===300);if(preserving)assert.equal(await frame.locator('body').evaluate(()=>window.reorderProbe),'kept');
   assert.deepEqual(await page.locator('#screenPreset optgroup[label="Project screens"] option').allTextContents(),['Tablet · 768 × 1024','Phone · 390 × 844','Desktop · 1440 × 900']);
   await page.reload();await page.getByRole('button',{name:'Compare screens',exact:true}).click();await frame.locator('#inner').waitFor();assert.deepEqual(await order(),['Tablet comparison','Phone comparison','Desktop comparison']);
   await page.getByRole('button',{name:'Remove Tablet comparison',exact:true}).click();await wait(async()=>await page.locator('.compare-card').count()===2);const restore=page.getByRole('button',{name:'Undo remove: Tablet',exact:true});await wait(async()=>!await restore.isDisabled());await restore.click();assert.deepEqual(await order(),['Tablet comparison','Phone comparison','Desktop comparison']);
   await down().click();assert.deepEqual(await order(),['Tablet comparison','Desktop comparison','Phone comparison']);assert.equal(await down().isDisabled(),true);await up().click();await up().click();assert.deepEqual(await order(),['Phone comparison','Tablet comparison','Desktop comparison']);assert.equal(await up().isDisabled(),true);assert.equal(fs.readFileSync(file,'utf8'),source);
   if(process.env.RT_E2E_COMPARE_ORDER_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_COMPARE_ORDER_SCREENSHOT});await frame.locator('body').evaluate(()=>scrollTo(0,0));console.log('COMPARISON ORDER/PERSISTENCE/BOUNDARIES/SOURCE PASS',engine,{preserving});
  }

  await viewport.scrollIntoViewIfNeeded();const box=await viewport.boundingBox(),scale=box.width/390;
  const wheel=async(dx,dy,deltaMode=0)=>{await viewport.dispatchEvent('wheel',{clientX:box.x+30*scale,clientY:box.y+30*scale,deltaX:dx,deltaY:dy,deltaMode,bubbles:true,cancelable:true});};
  const positions=()=>frame.locator('body').evaluate(()=>({inner:[document.querySelector('#inner').scrollLeft,document.querySelector('#inner').scrollTop],outer:[document.querySelector('#outer').scrollLeft,document.querySelector('#outer').scrollTop],page:[scrollX,scrollY]}));
  const near=(a,b)=>assert.ok(Math.abs(a-b)<1.1,`${a} vs ${b}`);
  await page.mouse.move(box.x+30*scale,box.y+30*scale);await page.mouse.wheel(40,50);await wait(async()=>(await positions()).inner[1]>0);let pos=await positions();near(pos.inner[0],40/scale);near(pos.inner[1],50/scale);assert.deepEqual(pos.outer,[0,0]);assert.deepEqual(pos.page,[0,0]);
  await frame.locator('#inner').evaluate(el=>{el.scrollLeft=0;el.scrollTop=0;});await wheel(0,2,1);near((await positions()).inner[1],40);
  await frame.locator('#inner').evaluate(el=>{el.scrollLeft=el.scrollWidth;el.scrollTop=el.scrollHeight;});
  await wheel(20,30);pos=await positions();near(pos.outer[0],20/scale);near(pos.outer[1],30/scale);assert.deepEqual(pos.page,[0,0]);
  await frame.locator('#outer').evaluate(el=>{el.scrollLeft=0;el.scrollTop=0;});
  await frame.locator('#inner').evaluate(el=>{el.style.overscrollBehavior='contain';});await wheel(20,30);pos=await positions();assert.deepEqual(pos.outer,[0,0]);assert.deepEqual(pos.page,[0,0]);
  await frame.locator('#inner').evaluate(el=>{el.style.overscrollBehavior='auto';el.scrollTop=0;el.scrollLeft=0;});
  await wheel(0,1,2);pos=await positions();assert.ok(pos.inner[1]>400);assert.ok(pos.outer[1]>0);assert.deepEqual(pos.page,[0,0]);
  await frame.locator('#outer').evaluate(el=>{el.scrollTop=el.scrollHeight;el.scrollLeft=el.scrollWidth;});
  await wheel(20,30);pos=await positions();near(pos.page[0],20/scale);near(pos.page[1],30/scale);
  await frame.locator('body').evaluate(()=>{scrollTo(0,0);for(const id of ['outer','inner']){const el=document.getElementById(id);el.scrollLeft=0;el.scrollTop=0;}});
  const widthInput=page.getByLabel('Phone comparison width',{exact:true});await widthInput.fill('650');await widthInput.press('Tab');await wait(()=>frame.locator('body').evaluate(()=>innerWidth===650));
  await wait(async()=>Math.abs((await viewport.boundingBox()).height-(box.width/650)*844)<1);
  const resized=await viewport.boundingBox(),newScale=resized.width/650;await page.mouse.move(resized.x+30*newScale,resized.y+30*newScale);await page.mouse.wheel(20,10);await wait(async()=>(await positions()).inner[1]>0);
  pos=await positions();near(pos.inner[0],20/newScale);near(pos.inner[1],10/newScale);assert.deepEqual(pos.outer,[0,0]);assert.deepEqual(pos.page,[0,0]);
  assert.deepEqual(await page.frameLocator('#app').locator('body').evaluate(()=>[scrollX,scrollY]),[0,0]);assert.equal(fs.readFileSync(file,'utf8'),source);assert.deepEqual(errors,[]);
  await page.getByRole('button',{name:'Compare screens',exact:true}).click();await wait(async()=>await page.locator('#screenComparisons iframe').count()===0);
  console.log(engine+': PASS nested comparison scroll, both scaled axes after resizing, line/page deltas, ancestor handoff, overscroll containment, main-canvas isolation and unchanged source');
 }finally{if(browser)await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
