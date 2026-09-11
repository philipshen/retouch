'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-history-selection-')),file=path.join(root,'index.html'),original='<!doctype html><html><body><main><h1>First</h1><p>Second</p></main></body></html>';fs.writeFileSync(file,original);
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');const browser=await browserType.launch(),page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const read=()=>fs.readFileSync(file,'utf8'),wait=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await page.waitForTimeout(50);}throw Error('Selection/history condition not reached');},settled=()=>page.waitForFunction(()=>!panelTasks&&!sourceRequests&&!undoBusy);
 try{
  await page.goto('http://localhost:'+server.address().port+'/rt');const app=page.frameLocator('#app');await app.locator('h1').waitFor();await page.getByRole('treeitem',{name:'h1 · First',exact:true}).click();await settled();await page.getByRole('treeitem',{name:'p · Second',exact:true}).click({modifiers:['Shift']});await settled();
  await page.getByText('Layer actions',{exact:true}).click();await wait(async()=>await page.getByRole('treeitem',{selected:true}).count()===2);
  await page.getByRole('button',{name:'Duplicate layers',exact:true}).click();await settled();await wait(async()=>await app.locator('h1,p').count()===4);await wait(async()=>await page.getByRole('treeitem',{selected:true}).count()===2);const duplicated=read(),ids=await page.evaluate(()=>sel.multiple.map(info=>info.id));
  await page.getByRole('treeitem',{selected:true}).last().press('Delete');await settled();await wait(async()=>await app.locator('h1,p').count()===2);const deleted=read();assert.notEqual(deleted,duplicated);
  // Reproduce refresh invalidating a stale occurrence before history restores its recorded selection.
  await page.evaluate(()=>{window.__historyRefresh=refreshWrittenElement;refreshWrittenElement=async(...args)=>{await window.__historyRefresh(...args);clearSelection();};});
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),duplicated);await wait(async()=>await page.getByRole('treeitem',{selected:true}).count()===2);assert.deepEqual(await page.evaluate(()=>sel.multiple.map(info=>info.id)),ids);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();assert.equal(read(),deleted);await wait(async()=>await app.locator('h1,p').count()===2);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),duplicated);assert.deepEqual(await page.evaluate(()=>sel.multiple.map(info=>info.id)),ids);
  await page.evaluate(()=>{refreshWrittenElement=window.__historyRefresh;delete window.__historyRefresh;});
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),original);await wait(async()=>await app.locator('h1,p').count()===2);assert.deepEqual(errors,[]);
  console.log(engine+': PASS deleted multi-selection restored after refresh clears stale selection, exact undo/redo IDs and source, duplication undo');
 }finally{await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
