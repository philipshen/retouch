'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-history-reload-')),file=path.join(root,'index.html'),original='<!doctype html><html><head></head><body><h1>History</h1></body></html>';fs.writeFileSync(file,original);
 let server,browser;const start=async port=>{server=require('../../src/html-site.cjs').start({root,port,quiet:true});await once(server,'listening');},stop=async()=>{server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server=null;};
 try{
  await start(0);const port=server.address().port;browser=await browserType.launch();const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));const read=()=>fs.readFileSync(file,'utf8');
  const wait=async fn=>{for(let i=0;i<150;i++){if(await fn())return;await page.waitForTimeout(100);}throw Error('Timed out');},undo=page.getByRole('button',{name:'Undo',exact:true}),redo=page.getByRole('button',{name:'Redo',exact:true}),ready=()=>wait(async()=>await undo.getAttribute('aria-busy')==='false');
  const reload=async()=>{await page.reload();await page.getByRole('treeitem',{name:'h1 · History',exact:true}).waitFor();await ready();};
  await page.goto('http://localhost:'+port+'/rt');await page.getByRole('treeitem',{name:'h1 · History',exact:true}).click();await page.getByLabel('Opacity (%)',{exact:true}).fill('50');await page.getByLabel('Opacity (%)',{exact:true}).press('Tab');await wait(()=>read()!==original);await ready();const edited=read();
  await page.getByRole('button',{name:'Lock h1 · History',exact:true}).click();await page.getByRole('button',{name:'Unlock h1 · History',exact:true}).waitFor();
  await reload();assert.equal(await undo.isEnabled(),true);await undo.click();await page.getByRole('button',{name:'Lock h1 · History',exact:true}).waitFor();await ready();assert.equal(read(),edited,'lock undo does not change source');
  await reload();assert.equal(await redo.isEnabled(),true);await undo.click();await wait(()=>read()===original);await ready();await reload();assert.equal(await undo.isDisabled(),true);await redo.click();await wait(()=>read()===edited);await ready();await wait(async()=>await page.frameLocator('#app').locator('h1').evaluate(el=>getComputedStyle(el).opacity)==='0.5');
  await reload();await redo.click();await page.getByRole('button',{name:'Unlock h1 · History',exact:true}).waitFor();await ready();await undo.click();await ready();await undo.click();await wait(()=>read()===original);await ready();await reload();assert.equal(await redo.isEnabled(),true);
  await stop();await start(port);await reload();assert.equal(await undo.isDisabled(),true);assert.equal(await redo.isDisabled(),true,'old server history is unavailable');assert.equal(read(),original);assert.deepEqual(errors,[]);console.log('HISTORY RELOAD PASS',engine);
 }finally{await browser?.close();if(server)await stop();fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
