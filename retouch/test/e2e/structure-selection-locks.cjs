'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');const engine=process.env.RT_E2E_BROWSER||'chromium';
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-selection-locks-')),file=path.join(root,'index.html'),source='<html><body><main><section><h1>Title</h1></section><aside><p>Paragraph</p></aside><footer><span>Survives</span></footer></main></body></html>';fs.writeFileSync(file,source);
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});if(!server.listening)await once(server,'listening');let browser;
 try{
  browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch();const page=await browser.newPage({viewport:{width:1800,height:1000}}),app=page.frameLocator('#app'),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const wait=async fn=>{for(let i=0;i<100;i++){try{if(await fn())return;}catch(error){if(!/Execution context was destroyed/.test(error.message))throw error;}await page.waitForTimeout(100);}throw Error('Selection edit did not settle');};
  const row=name=>page.getByRole('treeitem',{name,exact:true}),run=async name=>{await page.getByRole('button',{name:'Actions',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Actions',exact:true});await dialog.getByRole('combobox').fill(name);await dialog.getByRole('option',{name,exact:true}).click();await dialog.waitFor({state:'hidden'});};
  await page.goto('http://localhost:'+server.address().port+'/rt');await row('h1 · Title').click();await run('Lock selection');await row('span · Survives').click();await run('Lock selection');
  const locked=()=>page.evaluate(()=>layerLocks.direct(doc().querySelector('footer span'))&&[...doc().querySelectorAll('h1')].every((el,i)=>layerLocks.direct(el)===(i===0)));
  await wait(locked);
  const selectParents=async()=>{await row('section').click();await wait(async()=>await row('section').getAttribute('aria-selected')==='true');await row('aside').click({modifiers:['Meta']});await wait(async()=>await page.locator('[role="treeitem"][aria-selected="true"]').count()===2);};
  await selectParents();await run('Duplicate layers');await wait(async()=>await app.locator('section').count()===2);await wait(locked);assert.ok(!fs.readFileSync(file,'utf8').includes('data-rt-copy-'));
  await run('Undo last edit');await wait(async()=>fs.readFileSync(file,'utf8')===source&&await app.locator('section').count()===1);await wait(locked);
  await run('Redo last edit');await wait(async()=>await app.locator('section').count()===2);await wait(locked);
  await run('Undo last edit');await wait(async()=>fs.readFileSync(file,'utf8')===source&&await app.locator('section').count()===1);await wait(locked);
  await selectParents();await run('Delete layers');await wait(async()=>await app.locator('section,aside').count()===0);await wait(locked);
  await run('Undo last edit');await wait(async()=>fs.readFileSync(file,'utf8')===source&&await app.locator('section').count()===1);await wait(locked);
  await run('Redo last edit');await wait(async()=>await app.locator('section,aside').count()===0);await wait(locked);
  await run('Undo last edit');await wait(async()=>fs.readFileSync(file,'utf8')===source&&await app.locator('section').count()===1);await wait(locked);assert.deepEqual(errors,[]);console.log('MULTI-LAYER COPY/DELETE/DESCENDANT AND SIBLING LOCKS/UNDO/REDO PASS',engine);
 }finally{if(browser)await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
