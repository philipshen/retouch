'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const engine=process.env.RT_E2E_BROWSER||'chromium';
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-layer-navigation-')),file=path.join(root,'index.html'),source='<html><body><main aria-label="Frame"><h1>A</h1><p>B</p><p>C</p></main><input aria-label="Site input"></body></html>';fs.writeFileSync(file,source);
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});if(!server.listening)await once(server,'listening');let browser;
 try{
  browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch();const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:'+server.address().port+'/rt');const app=page.frameLocator('#app');await app.getByRole('heading',{name:'A'}).waitFor();
  const selected=async name=>{await page.waitForFunction(name=>[...document.querySelectorAll('[role="treeitem"]')].some(el=>el.textContent===name&&el.getAttribute('aria-selected')==='true'),name);await page.waitForFunction(()=>!undoBusy&&!sourceRequests&&!panelTasks&&panelBody.getAttribute('aria-busy')!=='true');};
  const choose=async name=>{await page.getByRole('treeitem',{name,exact:true}).click();await selected(name);};
  const key=async(key,name)=>{await app.locator('body').evaluate(el=>el.tabIndex=-1);await app.locator('body').press(key);await selected(name);};
  await choose('main · Frame');await key('Enter','h1 · A');await key('Tab','p · B');await key('Shift+Tab','h1 · A');await key('Shift+Enter','main · Frame');
  await page.getByRole('button',{name:'Collapse main · Frame',exact:true}).click();await key('Enter','h1 · A');await page.getByRole('treeitem',{name:'p · B',exact:true}).waitFor();
  await page.getByRole('button',{name:'Lock p · B',exact:true}).click();await choose('h1 · A');await key('Tab','p · C');await key('Shift+Tab','h1 · A');await key('Tab','p · C');await key('Tab','h1 · A');
  await app.locator('body').evaluate(el=>el.ownerDocument.addEventListener('keydown',event=>{if(event.key==='Tab')el.ownerDocument.defaultView.parent.nativeTabPrevented=event.defaultPrevented;},true));await app.getByRole('textbox',{name:'Site input',exact:true}).press('Tab');assert.equal(await page.evaluate(()=>window.nativeTabPrevented),false);await selected('h1 · A');
  await choose('main · Frame');await page.locator('#modeBtn').click();await key('Enter','main · Frame');assert.equal(fs.readFileSync(file,'utf8'),source);assert.deepEqual(errors,[]);console.log('LAYER NAVIGATION CHILD/PARENT/SIBLINGS/LOCKS/COLLAPSE/NATIVE INPUT PASS',engine);
 }finally{if(browser)await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
