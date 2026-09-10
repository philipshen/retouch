'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'retouch-recovery-guard-'))),file=path.join(root,'index.html'),other=path.join(root,'other.html'),before='<!doctype html><html><head></head><body><h1>History</h1></body></html>',after=before.replace('<h1>','<h1 style="opacity:.5">');fs.writeFileSync(file,after);fs.writeFileSync(other,before);process.env.RETOUCH_STATE_DIR=path.join(root,'.history-cache');
 const store=require('../../src/history-store.cjs').createHistoryStore(root,process.env.RETOUCH_STATE_DIR);store.load();store.save({undo:[],redo:[],pending:{type:'record',entry:{id:'a'.repeat(32),route:'/',edits:[{file,before,after},{file:other,before,after}]}}});const journal=fs.readFileSync(store.file,'utf8');
 let server,browser;const start=async port=>{server=require('../../src/html-site.cjs').start({root,port,quiet:true});await once(server,'listening');},stop=async()=>{server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server=null;};
 try{
  await start(0);const port=server.address().port;browser=await browserType.launch();const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('http://localhost:'+port+'/rt');await page.getByText('Source recovery required. Editing is paused.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Interact mode',exact:true}).isDisabled(),true);await page.getByRole('treeitem',{name:'h1 · History',exact:true}).click();assert.equal(await page.getByLabel('Opacity (%)',{exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Delete layer',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Duplicate layer',exact:true}).isDisabled(),true);
  const id=await page.frameLocator('#app').locator('h1').getAttribute('data-rt');const responses=await page.evaluate(async id=>{
   const headers={'x-retouch-token':window.__RT_TOKEN,'content-type':'application/json'},resolve=await fetch('/rt/__api/resolve?id='+id,{headers}).then(r=>r.json()),results=[];
   for(const [url,body]of [['/rt/__api/op',{type:'setText',id,fileHash:resolve.element.hash,text:'Changed'}],['/rt/__api/text-styles',{}],['/rt/__api/color-styles',{}],['/rt/__api/effect-styles',{}],['/rt/__api/variables',{}],['/rt/__api/upload',{}]]){const response=await fetch(url,{method:'POST',headers,body:JSON.stringify(body)});results.push({status:response.status,body:await response.json()});}return results;
  },id);for(const response of responses){assert.equal(response.status,409);assert.equal(response.body.historyRecoveryRequired,true);}assert.equal(fs.readFileSync(file,'utf8'),after);assert.equal(fs.readFileSync(other,'utf8'),before);assert.equal(fs.readFileSync(store.file,'utf8'),journal);
  await page.getByText('Review recovery',{exact:true}).click();
  await page.getByRole('button',{name:'Recheck recovery',exact:true}).click();await page.getByRole('button',{name:'Recheck recovery',exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.recovery-panel p').textContent.includes('index.html: after operation'));
  assert.match(await page.locator('.recovery-panel p').first().textContent(),/other.html: before operation/);
  assert.equal(fs.readFileSync(store.file,'utf8'),journal);
  const cleared=JSON.parse(journal);delete cleared.pending;
  for(const damaged of [null,'broken',JSON.stringify(cleared)]){
   if(damaged===null)fs.unlinkSync(store.file);else fs.writeFileSync(store.file,damaged);
   const result=await page.evaluate(async()=>{const response=await fetch('/rt/__api/history-recovery',{method:'POST',headers:{'x-retouch-token':window.__RT_TOKEN}});return {status:response.status,body:await response.json()};});
   assert.equal(result.status,409);assert.equal(result.body.historyRecoveryRequired,true);
  }
  fs.writeFileSync(store.file,journal);
  if(process.env.RT_E2E_RECOVERY_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_RECOVERY_SCREENSHOT});
  fs.writeFileSync(other,after);await page.getByRole('button',{name:'Recheck recovery',exact:true}).click();await page.getByText('Source recovery required. Editing is paused.',{exact:true}).waitFor({state:'hidden'});await page.getByRole('treeitem',{name:'h1 · History',exact:true}).waitFor();assert.equal(await page.getByText('Source recovery required. Editing is paused.',{exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Edit mode',exact:true}).isEnabled(),true);await page.getByRole('button',{name:'Undo',exact:true}).click();for(let i=0;i<150;i++){if(fs.readFileSync(file,'utf8')===before&&fs.readFileSync(other,'utf8')===before)break;await page.waitForTimeout(100);}assert.equal(fs.readFileSync(file,'utf8'),before);assert.equal(fs.readFileSync(other,'utf8'),before);await stop();fs.writeFileSync(file,after);fs.writeFileSync(other,before);fs.writeFileSync(store.file,journal);await start(port);await page.reload();await page.getByText('Review recovery',{exact:true}).click();
  await page.getByRole('button',{name:'Restore before interrupted edit',exact:true}).waitFor();assert.match(await page.locator('.recovery-panel ul').textContent(),/index.html.*will be restored/);
  if(process.env.RT_E2E_RESTORE_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_RESTORE_SCREENSHOT});
  await page.getByRole('button',{name:'Restore before interrupted edit',exact:true}).click();await page.getByText('Source recovery required. Editing is paused.',{exact:true}).waitFor({state:'hidden'});
  assert.equal(fs.readFileSync(file,'utf8'),before);assert.equal(fs.readFileSync(other,'utf8'),before);assert.equal(await page.getByRole('button',{name:'Edit mode',exact:true}).isEnabled(),true);assert.equal(await page.getByRole('button',{name:'Undo',exact:true}).isDisabled(),true);
  assert.deepEqual(errors,[]);console.log('HISTORY RECOVERY GUARD PASS',engine);
 }finally{await browser?.close();if(server)await stop();fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
