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
  for(const [axis,initial]of [['width',1120],['height',844]]){
   const field=page.getByLabel('Reading view comparison '+axis,{exact:true}),preview=page.frameLocator('iframe[title="Reading view comparison preview"]');
   const dimension=()=>preview.locator('body').evaluate((el,axis)=>axis==='width'?innerWidth:innerHeight,axis);
   await field.fill('1234');await field.press('Escape');await field.press('Tab');assert.equal(await field.inputValue(),String(initial));assert.equal(await dimension(),initial);
   await field.press('Shift+ArrowUp');await page.waitForFunction(({axis,value})=>document.querySelector('iframe[title="Reading view comparison preview"]').contentWindow[axis==='width'?'innerWidth':'innerHeight']===value,{axis,value:initial+10});
   await field.press('Shift+ArrowDown');await page.waitForFunction(({axis,value})=>document.querySelector('iframe[title="Reading view comparison preview"]').contentWindow[axis==='width'?'innerWidth':'innerHeight']===value,{axis,value:initial});
   await field.fill(String(initial+20));await field.press('Enter');assert.equal(await field.evaluate(el=>el===document.activeElement),false);await page.waitForFunction(({axis,value})=>document.querySelector('iframe[title="Reading view comparison preview"]').contentWindow[axis==='width'?'innerWidth':'innerHeight']===value,{axis,value:initial+20});
   await field.fill(String(initial));await field.press('Enter');
  }

  const comparisonSize=()=>page.frameLocator('iframe[title="Reading view comparison preview"]').locator('body').evaluate(()=>[innerWidth,innerHeight]);
  await page.frameLocator('iframe[title="Reading view comparison preview"]').locator('body').evaluate(()=>{window.resizeHistoryMarker='retained';});
  await page.getByRole('button',{name:'Rotate Reading view comparison',exact:true}).click();await page.waitForFunction(()=>document.querySelector('iframe[title="Reading view comparison preview"]').contentWindow.innerWidth===844);assert.deepEqual(await comparisonSize(),[844,1120]);
  await page.getByRole('button',{name:'Undo Reading view comparison size',exact:true}).click();assert.deepEqual(await comparisonSize(),[1120,844]);assert.equal(await picker.locator('option[value="saved:1120x844"]').count(),1);
  await page.getByRole('button',{name:'Redo Reading view comparison size',exact:true}).click();assert.deepEqual(await comparisonSize(),[844,1120]);
  await page.getByRole('button',{name:'Undo Reading view comparison size',exact:true}).click();assert.deepEqual(await comparisonSize(),[1120,844]);
  assert.equal(await page.frameLocator('iframe[title="Reading view comparison preview"]').locator('body').evaluate(()=>window.resizeHistoryMarker),'retained','size history retains the preview browsing context');
  const readingWidth=page.getByLabel('Reading view comparison width',{exact:true});await readingWidth.fill('1130');await readingWidth.press('Enter');assert.equal(await page.getByRole('button',{name:'Redo Reading view comparison size',exact:true}).isDisabled(),true,'a new size edit clears redo');await page.getByRole('button',{name:'Undo Reading view comparison size',exact:true}).click();assert.deepEqual(await comparisonSize(),[1120,844]);
  await picker.selectOption('390x844');await picker.selectOption('saved:1120x844');await page.waitForFunction(()=>document.querySelector('#app').contentWindow.innerWidth===1120);assert.equal(await page.getByLabel('Screen height',{exact:true}).inputValue(),'844');
  await page.getByRole('button',{name:'Remove Reading view comparison',exact:true}).click();assert.equal(await picker.inputValue(),'custom');assert.equal(await page.getByLabel('Screen width',{exact:true}).inputValue(),'1120');
  await page.getByRole('button',{name:'Undo remove: Reading view',exact:true}).click();assert.equal(await picker.inputValue(),'saved:1120x844');
  for(const restored of ['removed view','reopened rail']){
   if(restored==='reopened rail'){await page.getByRole('button',{name:'Compare screens',exact:true}).click();await page.getByRole('button',{name:'Compare screens',exact:true}).click();}
   const redoSize=page.getByRole('button',{name:'Redo Reading view comparison size',exact:true});assert.equal(await redoSize.isDisabled(),false,restored+' retains size history');await redoSize.click();assert.deepEqual(await comparisonSize(),[1130,844]);
   await page.getByRole('button',{name:'Undo Reading view comparison size',exact:true}).click();assert.deepEqual(await comparisonSize(),[1120,844]);
  }
  await page.getByLabel('Phone comparison width',{exact:true}).fill('400');await page.getByLabel('Phone comparison width',{exact:true}).press('Enter');await page.getByRole('button',{name:'Undo Phone comparison size',exact:true}).click();
  await page.getByRole('button',{name:'Remove Phone comparison',exact:true}).click();await page.getByRole('button',{name:'Undo remove: Phone',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('button[aria-label="Remove Phone comparison"]'));
  await page.getByLabel('Screen set file',{exact:true}).setInputFiles({name:'screens.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,screens:[{name:'Imported',width:500,height:700}]}))});
  await page.getByRole('region',{name:'Imported comparison',exact:true}).waitFor();assert.equal(await page.getByRole('region',{name:'Reading view comparison',exact:true}).count(),0);
  await page.getByRole('button',{name:'Undo load screen set',exact:true}).click();await page.getByRole('region',{name:'Reading view comparison',exact:true}).waitFor();
  await page.getByRole('button',{name:'Redo Reading view comparison size',exact:true}).click();assert.deepEqual(await comparisonSize(),[1130,844]);await page.getByRole('button',{name:'Undo Reading view comparison size',exact:true}).click();assert.deepEqual(await comparisonSize(),[1120,844]);
  await page.getByRole('button',{name:'Undo remove: Phone',exact:true}).click();await page.getByRole('button',{name:'Redo Phone comparison size',exact:true}).click();assert.equal(await page.getByLabel('Phone comparison width',{exact:true}).inputValue(),'400');await page.getByRole('button',{name:'Undo Phone comparison size',exact:true}).click();assert.equal(await page.getByLabel('Phone comparison width',{exact:true}).inputValue(),'390');
  await page.reload();await page.frameLocator('#app').locator('h1').waitFor();assert.equal(await picker.inputValue(),'saved:1120x844');
  await stop();await start(roots[1],port);await open();assert.equal(await picker.inputValue(),'fluid');assert.equal(await picker.locator('option[value="saved:1120x844"]').count(),0);await picker.selectOption('768x1024');
  await stop();await start(roots[0],port);await open();assert.equal(await picker.inputValue(),'saved:1120x844');await page.waitForFunction(()=>document.querySelector('#app').contentWindow.innerWidth===1120);
  assert.deepEqual(errors,[]);console.log('PROJECT SCREENS PASS',engine);
 }finally{await browser?.close();if(server)await stop();fs.rmSync(base,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
