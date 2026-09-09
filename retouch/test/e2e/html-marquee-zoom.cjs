'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-marquee-zoom-')),file=path.join(root,'index.html'),original='<html><head></head><body style="margin:0"><div aria-label="Box" style="position:absolute;left:500px;top:500px;width:300px;height:300px;background:skyblue"></div></body></html>';fs.writeFileSync(file,original);
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');const browser=await browserType.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const wait=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await page.waitForTimeout(100);}throw Error('Timed out waiting for marquee');};
 const marquee=page.locator('.selection-marquee'),zoom=page.getByLabel('Canvas zoom (%)',{exact:true});
 try{
  await page.goto(`http://localhost:${server.address().port}/rt`);await page.frameLocator('#app').locator('div').waitFor();
  for(const label of ['Screen width','Screen height']){const field=page.getByLabel(label,{exact:true});await field.fill('4000');await field.press('Tab');}await zoom.fill('10');await zoom.press('Tab');
  for(const gray of [false,true]){
   const f=await page.locator('#app').boundingBox(),start={x:gray?f.x-10:f.x+45,y:f.y+45};await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+1,start.y);await page.waitForTimeout(100);assert.equal(await marquee.count(),0,'one screen pixel does not start a marquee');
   await page.mouse.move(f.x+85,f.y+85,{steps:5});await wait(async()=>await marquee.count()===1);await page.mouse.up();await wait(async()=>await page.getByRole('treeitem',{name:'div · Box',exact:true}).getAttribute('aria-selected')==='true'&&await page.locator('#panelBody').getAttribute('aria-busy')==='false');
  }
  let f=await page.locator('#app').boundingBox();await page.mouse.move(f.x-10,f.y+40);await page.mouse.down();await page.mouse.move(f.x+90,f.y+90,{steps:5});await wait(async()=>await marquee.count()===1);await zoom.fill('20');await zoom.press('Tab');await wait(async()=>await marquee.count()===0);await page.mouse.up();
  f=await page.locator('#app').boundingBox();await page.mouse.move(f.x-10,f.y+40);await page.mouse.down();await page.mouse.move(f.x+90,f.y+90,{steps:5});await wait(async()=>await marquee.count()===1);await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await wait(async()=>await marquee.count()===0);await page.mouse.up();
  assert.equal(fs.readFileSync(file,'utf8'),original);assert.deepEqual(errors,[]);console.log(engine+': PASS low-zoom inner/gray marquee activation, selection, zoom/screen cancellation and unchanged source');
 }finally{await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
