'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const base=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'retouch-project-screens-'))),roots=['one','two'].map(name=>path.join(base,name));
 for(const root of roots){fs.mkdirSync(root);fs.writeFileSync(path.join(root,'index.html'),'<html><head></head><body><h1>Screen project</h1></body></html>');}
 process.env.RETOUCH_STATE_DIR=path.join(base,'history');let server,browser;
 const start=async(root,port)=>{server=require('../../src/html-site.cjs').start({root,port,quiet:true});await once(server,'listening');};
 const stop=async()=>{server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server=null;};
 try{
  await start(roots[0],0);const port=server.address().port;browser=await browserType.launch();const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  const open=async()=>{await page.goto('http://localhost:'+port+'/rt');await page.frameLocator('#app').locator('h1').waitFor();};await open();
  const picker=page.getByLabel('Screen size',{exact:true});await picker.selectOption('390x844');await page.getByLabel('Screen width',{exact:true}).fill('1120');await page.getByLabel('Screen width',{exact:true}).press('Tab');
  await page.getByRole('button',{name:'Compare screens',exact:true}).click();await page.getByRole('button',{name:'Pin current size',exact:true}).click();
  await page.getByRole('button',{name:'Rename Custom 1120 × 844 comparison',exact:true}).click();await page.getByLabel('Comparison name',{exact:true}).filter({visible:true}).fill('Reading view');await page.getByLabel('Comparison name',{exact:true}).filter({visible:true}).press('Enter');
  assert.equal(await picker.locator('option[value="saved:1120x844"]').textContent(),'Reading view · 1120 × 844');
  await picker.selectOption('390x844');await picker.selectOption('saved:1120x844');await page.waitForFunction(()=>document.querySelector('#app').contentWindow.innerWidth===1120);assert.equal(await page.getByLabel('Screen height',{exact:true}).inputValue(),'844');
  await page.getByRole('button',{name:'Remove Reading view comparison',exact:true}).click();assert.equal(await picker.inputValue(),'custom');assert.equal(await page.getByLabel('Screen width',{exact:true}).inputValue(),'1120');
  await page.getByRole('button',{name:'Undo remove: Reading view',exact:true}).click();assert.equal(await picker.inputValue(),'saved:1120x844');
  await page.reload();await page.frameLocator('#app').locator('h1').waitFor();assert.equal(await picker.inputValue(),'saved:1120x844');
  await stop();await start(roots[1],port);await open();assert.equal(await picker.inputValue(),'fluid');assert.equal(await picker.locator('option[value="saved:1120x844"]').count(),0);await picker.selectOption('768x1024');
  await stop();await start(roots[0],port);await open();assert.equal(await picker.inputValue(),'saved:1120x844');await page.waitForFunction(()=>document.querySelector('#app').contentWindow.innerWidth===1120);
  assert.deepEqual(errors,[]);console.log('PROJECT SCREENS PASS',engine);
 }finally{await browser?.close();if(server)await stop();fs.rmSync(base,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
