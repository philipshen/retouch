'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');const engine=process.env.RT_E2E_BROWSER||'chromium';
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-workspace-panels-')),file=path.join(root,'index.html'),source='<html><body><h1>Heading</h1><p>Content</p></body></html>';fs.writeFileSync(file,source);
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});if(!server.listening)await once(server,'listening');let browser;
 try{
  browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch();const page=await browser.newPage({viewport:{width:1800,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const wait=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await page.waitForTimeout(50);}throw Error('Workspace did not settle');};
  await page.goto('http://localhost:'+server.address().port+'/rt');await page.frameLocator('#app').getByRole('heading').waitFor();
  await page.getByRole('treeitem',{name:'h1 · Heading',exact:true}).click();
  await page.getByLabel('Style screen scope').waitFor();
  await page.evaluate(()=>{document.getElementById('screenPreset').focus();busyPanel(true);RetouchScreens.set({width:820,height:900});});
  await page.waitForFunction(()=>doc().defaultView.innerWidth===820);await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>panelTasks),1);
  await page.evaluate(()=>busyPanel(false));
  await wait(async()=>await page.getByLabel('Style screen scope').locator('option[value="min-[820px]:"]').count()===1);
  await page.evaluate(()=>{RetouchScreens.set({width:940,height:900});document.querySelector('[aria-label="Style screen scope"]').focus();});
  await wait(async()=>await page.getByLabel('Style screen scope').locator('option[value="min-[940px]:"]').count()===1);
  for(const [type,width,pointerId] of [['pointerup',1000,31],['click',1020,32]]){
   await page.evaluate(({width,pointerId})=>{const scope=document.querySelector('[aria-label="Style screen scope"]');scope.focus();scope.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId}));RetouchScreens.set({width,height:900});},{width,pointerId});
   await page.waitForFunction(width=>doc().defaultView.innerWidth===width,width);await page.waitForTimeout(200);
   await page.evaluate(({type,pointerId})=>window.dispatchEvent(new PointerEvent(type,{bubbles:true,button:0,pointerId})),{type,pointerId});
   await wait(async()=>await page.getByLabel('Style screen scope').locator('option[value="min-['+width+'px]:"]').count()===1);
   assert.equal(await page.getByLabel('Style screen scope').evaluate(el=>el===document.activeElement),true);
  }
  const draft=page.getByLabel('Font size (CSS)',{exact:true});await draft.fill('77px');const field=await draft.elementHandle();
  await page.evaluate(()=>RetouchScreens.set({width:1060,height:900}));
  await page.waitForFunction(()=>doc().defaultView.innerWidth===1060);await page.waitForTimeout(200);
  assert.equal(await field.evaluate(el=>el.isConnected&&el===document.activeElement&&el.value==='77px'),true);
  assert.equal(fs.readFileSync(file,'utf8'),source);assert.deepEqual(errors,[]);
  console.log('VIEWPORT REFRESH AFTER BUSY PANEL PASS',engine);

 }finally{if(browser)await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
