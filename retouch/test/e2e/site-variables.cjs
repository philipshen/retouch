'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'retouch-site-variables-'))),file=path.join(root,'index.html');
 const original='<html><head><style>:root{--brand:#123456;--accent:var(--brand);--space:24px}h1{--heading-only:#ff0000}p{--accent:#008844;color:#112233}@media(min-width:700px){:root{--brand:#cc3300}}</style></head><body><h1>Variables</h1><p>Other layer</p></body></html>';fs.writeFileSync(file,original);process.env.RETOUCH_STATE_DIR=path.join(root,'.history-cache');let server,browser;
 try{
  server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');browser=await browserType.launch();const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const wait=async fn=>{for(let i=0;i<150;i++){if(await fn())return;await page.waitForTimeout(50);}throw Error('Timed out');};
  await page.goto('http://localhost:'+server.address().port+'/rt');await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await page.getByRole('treeitem',{name:'h1 · Variables',exact:true}).click();await page.getByText('Site variables',{exact:true}).click();
  const variable=page.getByLabel('Site variable',{exact:true});await variable.selectOption('--accent');assert.equal(await variable.locator('option[value="--space"]').count(),0);await page.getByRole('button',{name:'Apply site variable',exact:true}).click();
  const color=()=>page.frameLocator('#app').locator('h1').evaluate(el=>getComputedStyle(el).color);await wait(async()=>await color()==='rgb(18, 52, 86)');assert.match(fs.readFileSync(file,'utf8'),/color:var\(--accent\)/);
  await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await wait(async()=>await color()==='rgb(204, 51, 0)');assert.match(fs.readFileSync(file,'utf8'),/color:var\(--accent\)/);
  if(process.env.RT_E2E_VARIABLE_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_VARIABLE_SCREENSHOT});
  await page.getByRole('button',{name:'Detach site variable',exact:true}).click();await wait(()=>!fs.readFileSync(file,'utf8').includes('color:var(--accent)'));
  await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await wait(async()=>await color()==='rgb(204, 51, 0)');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(async()=>await color()==='rgb(18, 52, 86)');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>fs.readFileSync(file,'utf8')===original);
  await page.getByRole('treeitem',{name:'p · Other layer',exact:true}).click({modifiers:['Shift']});await page.getByLabel('Shared Width',{exact:true}).waitFor();
  await variable.selectOption('--accent');assert.equal(await variable.locator('option[value="--heading-only"]').count(),0);assert.match(await variable.locator('option[value="--accent"]').textContent(),/Varies by layer/);
  await page.getByRole('button',{name:'Apply site variable',exact:true}).click();await wait(()=>fs.readFileSync(file,'utf8').split('color:var(--accent)').length===3);
  const colors=()=>page.frameLocator('#app').locator('h1,p').evaluateAll(els=>els.map(el=>getComputedStyle(el).color));assert.deepEqual(await colors(),['rgb(18, 52, 86)','rgb(0, 136, 68)']);
  await page.getByRole('button',{name:'Detach site variable',exact:true}).click();await wait(()=>!fs.readFileSync(file,'utf8').includes('color:var(--accent)'));await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');assert.deepEqual(await colors(),['rgb(18, 52, 86)','rgb(0, 136, 68)']);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(async()=>(await colors())[0]==='rgb(204, 51, 0)');assert.equal((await colors())[1],'rgb(0, 136, 68)');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>fs.readFileSync(file,'utf8')===original);
  await page.getByRole('treeitem',{name:'h1 · Variables',exact:true}).click();await variable.selectOption('--accent');await page.getByRole('button',{name:'Apply site variable',exact:true}).click();await wait(()=>fs.readFileSync(file,'utf8').includes('color:var(--accent)'));const singlyBound=fs.readFileSync(file,'utf8');
  await page.getByRole('treeitem',{name:'p · Other layer',exact:true}).click({modifiers:['Shift']});await page.getByText('1 of 2 layers bound · Mixed bindings.',{exact:true}).waitFor();await page.getByRole('button',{name:'Reset variable binding',exact:true}).click();await wait(()=>!fs.readFileSync(file,'utf8').includes('color:var(--accent)'));assert.equal((await colors())[1],'rgb(17, 34, 51)');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>fs.readFileSync(file,'utf8')===singlyBound);await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>fs.readFileSync(file,'utf8')===original);
  assert.deepEqual(errors,[]);console.log('SITE VARIABLES PASS',engine);
 }finally{await browser?.close();if(server){server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
