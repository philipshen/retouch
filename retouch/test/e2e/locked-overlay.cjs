'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-locked-overlay-')),file=path.join(root,'index.html'),original='<html><body style="margin:0"><main style="position:absolute;left:20px;top:20px;width:300px;height:280px"><div aria-label="A" style="position:absolute;left:20px;top:20px;width:60px;height:50px;background:skyblue">A</div><div aria-label="B" style="position:absolute;left:150px;top:120px;width:60px;height:50px;background:pink">B</div></main><div aria-label="Overlay" onclick="window.overlayClicks=(window.overlayClicks||0)+1" style="position:absolute;inset:0 auto auto 0;width:350px;height:300px;background:#0002;z-index:2">Overlay</div></body></html>';fs.writeFileSync(file,original);
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');const browser=await browserType.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const wait=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await page.waitForTimeout(100);}throw Error('Timed out waiting for locked overlay');};
 try{
  await page.goto(`http://localhost:${server.address().port}/rt`);const app=page.frameLocator('#app');await app.getByLabel('Overlay',{exact:true}).waitFor();const selected=()=>page.getByRole('treeitem',{selected:true}).allTextContents(),selection=names=>wait(async()=>JSON.stringify((await selected()).sort())===JSON.stringify(names.map(n=>'div · '+n).sort()));
  await page.getByRole('button',{name:'Lock div · Overlay',exact:true}).click();await page.getByRole('button',{name:'Unlock div · Overlay',exact:true}).waitFor();
  for(const value of [50,100,200]){
   const zoom=page.getByLabel('Canvas zoom (%)',{exact:true});await zoom.fill(String(value));await zoom.press('Enter');await page.locator('#frameWrap').evaluate(el=>{el.scrollLeft=0;el.scrollTop=96;});
   const f=await page.locator('#app').boundingBox(),scale=value/100,point=(x,y)=>({x:f.x+x*scale,y:f.y+y*scale});
   let p=point(65,65);await page.mouse.click(p.x,p.y);await selection(['A']);
   p=point(190,160);await page.keyboard.down('Shift');await page.mouse.click(p.x,p.y);await page.keyboard.up('Shift');await selection(['A','B']);
   p=point(320,280);await page.mouse.click(p.x,p.y);await selection([]);
   p=point(30,30);await page.mouse.move(p.x,p.y);await page.mouse.down();p=point(260,220);await page.mouse.move(p.x,p.y,{steps:5});await wait(async()=>await page.locator('.selection-marquee').count()===1);await page.mouse.up();await selection(['A','B']);
   p=point(30,30);await page.mouse.move(p.x,p.y);await page.mouse.down();p=point(260,220);await page.mouse.move(p.x,p.y,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();await selection(['A','B']);
  }
  const under=await app.getByLabel('A',{exact:true}).boundingBox();await page.mouse.dblclick(under.x+20,under.y+20);await wait(async()=>await app.getByLabel('A',{exact:true}).getAttribute('contenteditable')==='true');await page.keyboard.press('Escape');await wait(async()=>await app.getByLabel('A',{exact:true}).getAttribute('contenteditable')!=='true');
  await page.getByRole('button',{name:'Unlock div · Overlay',exact:true}).click();await page.getByRole('button',{name:'Lock div · Overlay',exact:true}).waitFor();const box=await app.getByLabel('Overlay',{exact:true}).boundingBox();await page.mouse.click(box.x+30,box.y+30);await selection(['Overlay']);await page.keyboard.press('Escape');
  assert.equal(await app.locator('body').evaluate(()=>window.overlayClicks||0),0,'editor picking never triggers the covered app action');assert.equal(fs.readFileSync(file,'utf8'),original);assert.deepEqual(errors,[]);console.log(engine+': PASS picking and modifier selection through locked overlays at 50/100/200% zoom, empty click, double-click text access, overlay-start marquee/cancellation, unlock restoration and unchanged app/source');
 }finally{await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
