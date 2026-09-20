'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE,engine=process.env.RT_E2E_BROWSER||'chromium';
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-link-comparison-')),file=path.join(root,'index.html'),source='<!doctype html><html><body><a href="/old">Docs</a><input aria-label="Draft" value="Initial"></body></html>';fs.writeFileSync(file,source);
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});if(!server.listening)await once(server,'listening');let browser;
 try{
  browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch();const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:'+server.address().port+'/rt');const app=page.frameLocator('#app');await app.locator('a').waitFor();await page.getByRole('button',{name:'Compare screens',exact:true}).click();
  const live=page.frameLocator('iframe[title="Phone comparison preview"]');await live.locator('a').waitFor();
  for(const frame of [app,live])await frame.locator('input').evaluate(el=>{el.value='Retained';el.ownerDocument.defaultView.__linkDocument=el.ownerDocument;});
  await page.getByRole('treeitem',{name:'a · Docs',exact:true}).click();const settled=()=>page.waitForFunction(()=>!undoBusy&&!sourceRequests&&!panelTasks);
  const check=async href=>{for(const frame of [app,live]){assert.equal(await frame.locator('a').getAttribute('href'),href);assert.equal(await frame.locator('input').inputValue(),'Retained');assert.equal(await frame.locator('input').evaluate(el=>el.ownerDocument.defaultView.__linkDocument===el.ownerDocument),true);}};
  const field=()=>page.getByLabel('Link destination',{exact:true});await field().fill('/new?a=1&b=2');await field().press('Enter');await settled();await check('/new?a=1&b=2');const changed=fs.readFileSync(file,'utf8');
  await page.getByRole('button',{name:'Remove link destination',exact:true}).click();await settled();await check(null);const removed=fs.readFileSync(file,'utf8');
  for(const [text,href] of [[changed,'/new?a=1&b=2'],[source,'/old']]){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await check(href);assert.equal(fs.readFileSync(file,'utf8'),text);}
  for(const [text,href] of [[changed,'/new?a=1&b=2'],[removed,null]]){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await check(href);assert.equal(fs.readFileSync(file,'utf8'),text);}
  assert.deepEqual(errors,[]);console.log('LINK COMPARISON SAVE/REMOVE/UNDO/REDO AND RETAINED DOCUMENT/INPUT PASS '+engine);
 }finally{await browser?.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
