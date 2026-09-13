'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine],liquidMode=process.env.RT_E2E_LIQUID_SVG==='1';
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-native-svg-')),file=path.join(root,liquidMode?'main.liquid':'index.html');
 const layouts=[['Relative','position:relative;padding:13px;border:3px solid #999'],['Static','padding:19px;border:2px solid #999'],['Transformed','transform:rotate(12deg) scale(.8,1.1);transform-origin:40% 30%;padding:11px;border:4px solid #999'],['Grid','display:grid;grid-template-columns:1fr 1fr;position:relative;padding:17px'],['Flex','display:flex;position:relative;padding:23px']];
 const original='<html><head><style>body{margin:32px}section{position:relative;margin:30px;padding:20px;border:5px solid #ddd}main{width:500px;height:220px;background:#f5f5f5;box-sizing:border-box}p{margin:0}svg{margin:8px;max-width:90%;transform:translate(3px,7px)}</style></head><body>'+layouts.map(([name,style])=>'<section><main aria-label="'+name+'" style="'+style+'"><p>'+(liquidMode?'{{ title }}':'Keep this text')+'</p></main></section>').join('')+'</body></html>';fs.writeFileSync(file,original);
 let upstream,server,browser;
 try{
  if(liquidMode){const adapter=require('../../src/adapters/liquid.cjs'),renderer=new(require('liquidjs').Liquid)();upstream=require('node:http').createServer(async(req,res)=>{try{res.setHeader('content-type','text/html');res.end(await renderer.parseAndRender(adapter.stamp(fs.readFileSync(file,'utf8'),file,root).code,{title:'Keep this text'}));}catch(error){res.statusCode=500;res.end(error.message);}});upstream.listen(0,'127.0.0.1');await once(upstream,'listening');server=require('../../src/server.cjs').startServer({appRoot:root,adapter,port:0,proxyTo:'http://127.0.0.1:'+upstream.address().port,rendering:{reloadAfterWrite:true},quiet:true});}
  else server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');
  browser=await browserType.launch();const page=await browser.newPage({viewport:{width:1600,height:1100}}),app=page.frameLocator('#app'),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const wait=async fn=>{for(let i=0;i<150;i++){try{if(await fn())return;}catch(e){if(!/Execution context was destroyed/.test(e.message))throw e;}await page.waitForTimeout(100);}throw Error('Timed out waiting for native drawing');};
  const shapeBounds=async shape=>{const f=await page.locator('#app').boundingBox(),r=await shape.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,iw:innerWidth};}),scale=f.width/r.iw;return {x:f.x+r.x*scale,y:f.y+r.y*scale,width:r.width*scale,height:r.height*scale};};
  const settled=()=>wait(async()=>await page.locator('#panelBody').getAttribute('aria-busy')!=='true');
  await page.goto('http://localhost:'+server.address().port+'/rt');await app.locator('main').first().waitFor();await page.getByLabel('Screen size',{exact:true}).selectOption('1440x900');const zoom=page.getByLabel('Canvas zoom (%)',{exact:true});await zoom.fill('60');await zoom.press('Tab');
  for(const [name]of layouts)for(const [preset,tag]of [['rectangle','rect'],['ellipse','ellipse'],['line','line'],['circle','circle'],['triangle','polygon'],['star','polygon']]){
   const target=app.locator('main[aria-label="'+name+'"]');await target.scrollIntoViewIfNeeded();await page.getByRole('treeitem',{name:'main · '+name,exact:true}).click();await settled();await wait(async()=>await page.getByRole('button',{name:'Shape tools',exact:true}).isEnabled());
   const before=await target.locator('p').boundingBox(),beforeDOM=await target.innerHTML();
   await page.getByRole('button',{name:'Shape tools',exact:true}).click();await page.getByRole('menuitem',{name:'Draw '+preset,exact:true}).click();await page.locator('.svg-draw-surface').waitFor();
   assert.equal(await app.locator('svg').count(),0,'coordinate probe is removed before drawing');assert.equal(await target.innerHTML(),beforeDOM,'measurement leaves no preview DOM changes');
   const frame=await page.locator('#app').boundingBox(),box=await target.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,iw:innerWidth};}),scale=frame.width/box.iw;
   const a={x:frame.x+(box.x+box.width*.25)*scale,y:frame.y+(box.y+box.height*.25)*scale},b={x:frame.x+(box.x+box.width*.65)*scale,y:frame.y+(box.y+box.height*.65)*scale};
   await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:5});const preview=await page.locator('.svg-draw-surface '+tag).evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});assert.equal(fs.readFileSync(file,'utf8'),original);assert.equal(await app.locator('svg').count(),0);
   if(name==='Transformed'&&preset==='rectangle'&&process.env.RT_E2E_SVG_NATIVE_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_SVG_NATIVE_SCREENSHOT});await page.mouse.up();await wait(()=>fs.readFileSync(file,'utf8')!==original);await settled();const shape=target.locator('svg '+tag);await shape.waitFor();const rendered=await shapeBounds(shape);for(const key of ['x','y','width','height'])assert.ok(Math.abs(preview[key]-rendered[key])<.6,name+' '+preset+' '+key+' '+JSON.stringify({preview,rendered}));
   assert.deepEqual(await target.locator('p').boundingBox(),before,'drawing does not move existing content');assert.equal(await target.locator('p').textContent(),'Keep this text');
   const saved=fs.readFileSync(file,'utf8');await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>fs.readFileSync(file,'utf8')===original);await settled();await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>fs.readFileSync(file,'utf8')===saved);await settled();await shape.waitFor();const restored=await shapeBounds(shape);for(const key of ['x','y','width','height'])assert.ok(Math.abs(restored[key]-rendered[key])<.6);await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>fs.readFileSync(file,'utf8')===original);await settled();
   console.log(name,preset,'PASS');
  }
  for(const cancel of ['escape','layout','zoom','scroll']){
   const target=app.locator('main[aria-label="Relative"]');await target.scrollIntoViewIfNeeded();await page.getByRole('treeitem',{name:'main · Relative',exact:true}).click();await settled();await wait(async()=>await page.getByRole('button',{name:'Shape tools',exact:true}).isEnabled());await page.getByRole('button',{name:'Shape tools',exact:true}).focus();await page.keyboard.press('r');await page.locator('.svg-draw-surface').waitFor();const box=await target.boundingBox();await page.mouse.move(box.x+40,box.y+30);await page.mouse.down();await page.mouse.move(box.x+100,box.y+70,{steps:3});
   const style=await target.getAttribute('style');
   if(cancel==='escape')await page.keyboard.press('Escape');
   if(cancel==='layout')await target.evaluate(el=>el.style.width='520px');
   if(cancel==='zoom'){await zoom.fill('75');await zoom.press('Tab');}
   if(cancel==='scroll')await app.locator('body').evaluate(el=>el.ownerDocument.defaultView.scrollBy(0,30));
   await wait(async()=>await page.locator('.svg-draw-surface').count()===0);await page.mouse.up();if(cancel==='layout')await target.evaluate((el,style)=>el.setAttribute('style',style),style);assert.equal(fs.readFileSync(file,'utf8'),original);assert.equal(await app.locator('svg').count(),0);console.log('Cancel',cancel,'PASS');
  }
  assert.deepEqual(errors,[]);console.log(engine+(liquidMode?' Liquid':' HTML')+': PASS native shape drawing in relative, static, transformed, grid and flex containers; preview geometry, unchanged content and exact history');
 }finally{await browser?.close();if(server){server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));}if(upstream){upstream.closeAllConnections();await new Promise(r=>upstream.close(r));}fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
