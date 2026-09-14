'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE,engine=process.env.RT_E2E_BROWSER||'chromium';if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-selection-navigation-'));fs.writeFileSync(path.join(root,'index.html'),'<html><body><main><p>Old selection</p></main></body></html>');fs.writeFileSync(path.join(root,'next.html'),'<html><body><h1>New page</h1></body></html>');
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});if(!server.listening)await once(server,'listening');let browser,release;
 try{
  browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch();const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('http://localhost:'+server.address().port+'/rt');const app=page.frameLocator('#app');await app.getByText('Old selection',{exact:true}).waitFor();
  let first;const started=new Promise(resolve=>{first=resolve;}),gate=new Promise(resolve=>{release=resolve;});
  await page.route('**/rt/__api/resolve?*',async route=>{requests.push(route.request().url());if(requests.length===1)first();await gate;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:false,error:'Old source no longer resolves'})});});
  await app.getByText('Old selection',{exact:true}).click();await started;await page.locator('#app').evaluate(frame=>{frame.contentWindow.location.href='/next.html';});await app.getByRole('heading',{name:'New page',exact:true}).waitFor();const before=requests.length;release();
  await page.waitForFunction(()=>document.getElementById('panelBody').getAttribute('aria-busy')!=='true');await page.waitForTimeout(100);assert.equal(requests.length,before,'A stale selection must not resolve ancestors from the previous page');await page.unroute('**/rt/__api/resolve?*');await app.getByRole('heading',{name:'New page',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('zoomSelection').disabled);assert.deepEqual(errors,[]);assert.equal(await app.getByRole('heading',{name:'New page'}).count(),1);console.log(engine+': PASS delayed selection stops resolving after preview navigation');
 }finally{release?.();if(browser)await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
