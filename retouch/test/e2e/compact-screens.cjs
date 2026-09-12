'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');const engine=process.env.RT_E2E_BROWSER||'chromium';
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-compact-screens-')),file=path.join(root,'index.html'),source='<html><body><main><h1>Responsive canvas</h1></main></body></html>';fs.writeFileSync(file,source);
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});if(!server.listening)await once(server,'listening');let browser;
 try{
  browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch();const page=await browser.newPage({viewport:{width:360,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const wait=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await page.waitForTimeout(50);}throw Error('Preview controls did not settle');};
  await page.goto('http://localhost:'+server.address().port+'/rt');await page.frameLocator('#app').locator('h1').waitFor();
  const options=page.locator('#screenOptions'),summary=options.locator('summary'),width=page.getByLabel('Screen width',{exact:true}),height=page.getByLabel('Screen height',{exact:true}),rotate=page.getByRole('button',{name:'Rotate',exact:true}),size=()=>page.evaluate(()=>RetouchScreens.get());
  assert.equal(await options.getAttribute('open'),null);assert.ok(await summary.isVisible());assert.equal(await rotate.isVisible(),false);assert.equal((await width.boundingBox()).y,(await height.boundingBox()).y);assert.ok((await page.locator('#screenToolbar').boundingBox()).height<=90,'Preview toolbar stays within two compact rows');
  await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await wait(async()=>(await size()).width===390);await page.screenshot({path:'/private/tmp/retouch-compact-screens-closed-'+engine+'.png'});
  await summary.click();await rotate.waitFor({state:'visible'});let bounds=await options.locator('.screen-options-body').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=360);
  await page.getByRole('button',{name:'Lock screen aspect ratio',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Lock screen aspect ratio',exact:true}).getAttribute('aria-pressed'),'true');await rotate.click();assert.deepEqual(await size(),{width:844,height:390});
  await page.getByRole('button',{name:'Undo preview size',exact:true}).click();assert.deepEqual(await size(),{width:390,height:844});await page.getByRole('button',{name:'Redo preview size',exact:true}).click();assert.deepEqual(await size(),{width:844,height:390});
  await page.getByRole('button',{name:'Lock screen aspect ratio',exact:true}).click();await rotate.focus();await page.keyboard.press('Escape');assert.equal(await options.getAttribute('open'),null);assert.ok(await summary.evaluate(el=>el===document.activeElement));
  await summary.click();await width.click();assert.equal(await options.getAttribute('open'),null);await width.fill('768');await width.press('Enter');await wait(async()=>(await size()).width===768);
  await summary.click();const zoom=page.getByLabel('Canvas zoom (%)',{exact:true});await zoom.fill('75');await zoom.press('Enter');assert.equal(await zoom.inputValue(),'75');assert.equal((await size()).width,768);await page.screenshot({path:'/private/tmp/retouch-compact-screens-open-'+engine+'.png'});
  await page.setViewportSize({width:320,height:800});await wait(async()=>{const b=await options.locator('.screen-options-body').boundingBox();return b&&b.x>=0&&b.x+b.width<=320;});
  await page.setViewportSize({width:1400,height:900});await wait(async()=>await rotate.isVisible());assert.equal(await summary.isVisible(),false);assert.ok((await page.locator('#screenToolbar').boundingBox()).height<=52,'Wide preview controls stay on one row');assert.equal((await size()).width,768);await page.getByLabel('Screen size',{exact:true}).selectOption('1440x900');assert.deepEqual(await size(),{width:1440,height:900});
  assert.equal(fs.readFileSync(file,'utf8'),source);assert.deepEqual(errors,[]);console.log('COMPACT SCREEN CONTROLS PASS',engine);
 }finally{if(browser)await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
