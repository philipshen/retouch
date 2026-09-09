"use strict";
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-layer-locks-')),file=path.join(root,'index.html'),original='<html><body style="margin:0"><main aria-label="Frame" style="position:absolute;left:30px;top:30px;width:300px;height:250px"><div aria-label="A" style="position:absolute;left:20px;top:20px;width:80px;height:60px;background:skyblue">A</div><div aria-label="B" style="position:absolute;left:150px;top:120px;width:80px;height:60px;background:pink">B</div></main></body></html>';fs.writeFileSync(file,original);
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');const browser=await browserType.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const wait=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await page.waitForTimeout(100);}throw Error('Timed out waiting for layer lock');};
 try{
  await page.goto(`http://localhost:${server.address().port}/rt`);const app=page.frameLocator('#app'),a=app.getByLabel('A',{exact:true}),item=name=>page.getByRole('treeitem',{name,exact:true}),selected=()=>page.getByRole('treeitem',{selected:true}).allTextContents();await a.waitFor();
  const zoom=page.getByLabel('Canvas zoom (%)',{exact:true});await zoom.fill('100');await zoom.press('Tab');
  await item('div · A').click();await wait(async()=>JSON.stringify(await selected())===JSON.stringify(['div · A']));
  await page.getByRole('button',{name:'Lock div · A',exact:true}).click();await page.getByRole('button',{name:'Unlock div · A',exact:true}).waitFor();await wait(async()=>(await selected()).length===0);
  await a.click();assert.deepEqual(await selected(),[]);assert.equal(await a.getAttribute('contenteditable'),null);
  await item('div · B').click();await wait(async()=>JSON.stringify(await selected())===JSON.stringify(['div · B']));await a.click({modifiers:['Shift']});assert.deepEqual(await selected(),['div · B']);
  await a.click();await wait(async()=>(await selected()).length===0);
  const f=await page.locator('#app').boundingBox();await page.mouse.move(f.x+35,f.y+35);await page.mouse.down();await page.mouse.move(f.x+275,f.y+240,{steps:5});await page.mouse.up();await wait(async()=>JSON.stringify(await selected())===JSON.stringify(['div · B']));
  await page.getByRole('button',{name:'Lock main · Frame',exact:true}).click();await page.getByRole('button',{name:'Locked by parent: div · B',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Locked by parent: div · B',exact:true}).isDisabled(),true);await a.dblclick();assert.deepEqual(await selected(),[]);if(process.env.RT_E2E_LOCKS_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_LOCKS_SCREENSHOT});
  // Locking is editor state; reloading the app frame keeps the current editor's locks.
  await app.locator('body').evaluate(()=>location.reload());await a.waitFor();await page.getByRole('button',{name:'Unlock main · Frame',exact:true}).waitFor();await a.click();assert.deepEqual(await selected(),[]);
  await app.locator('body').evaluate(()=>history.pushState(null,'','#other'));await page.getByRole('button',{name:'Lock main · Frame',exact:true}).waitFor();
  await app.locator('body').evaluate(()=>history.replaceState(null,'',location.pathname));await page.getByRole('button',{name:'Unlock main · Frame',exact:true}).waitFor();
  await page.getByRole('button',{name:'Unlock main · Frame',exact:true}).click();await page.getByRole('button',{name:'Lock div · B',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Unlock div · A',exact:true}).count(),1,'child retains its independent lock');
  await item('div · A').click();await wait(async()=>JSON.stringify(await selected())===JSON.stringify(['div · A']));assert.equal(await page.locator('#panelBody').isVisible(),true,'tree can deliberately select locked layers');
  await page.getByRole('button',{name:'Unlock div · A',exact:true}).click();await page.getByRole('button',{name:'Lock div · A',exact:true}).waitFor();await item('div · B').click();await a.click({modifiers:['Shift']});await wait(async()=>(await selected()).length===2);
  assert.equal(fs.readFileSync(file,'utf8'),original);assert.deepEqual(errors,[]);console.log(engine+': PASS layer locks exclude canvas click/text/modifier/marquee, inherit through frames, survive iframe reload, retain child locks, allow deliberate tree selection and leave source unchanged');
 }finally{await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
