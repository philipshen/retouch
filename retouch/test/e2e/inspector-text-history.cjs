'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-text-history-')),file=path.join(root,'index.html');
 const original='<!doctype html><html><body><h1>Original heading</h1><p>Unchanged sibling</p></body></html>';fs.writeFileSync(file,original);
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');let browser;
 try{
  browser=await browserType.launch();const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.goto('http://localhost:'+server.address().port+'/rt');await page.getByRole('treeitem',{name:'h1 · Original heading',exact:true}).click();
  const field=page.locator('#panelBody textarea'),heading=page.frameLocator('#app').locator('h1'),read=()=>fs.readFileSync(file,'utf8');
  const settled=()=>page.waitForFunction(()=>!panelTasks&&!sourceRequests&&!undoBusy,null,{polling:50});
  const check=async text=>{await settled();await page.waitForFunction(text=>document.querySelector('#app').contentDocument.querySelector('h1')?.textContent===text,text,{polling:50});assert.equal(await field.inputValue(),text,'Inspector agrees with restored source and canvas');assert.equal(read(),original.replace('Original heading',text));assert.equal(await heading.textContent(),text);};
  const activate=async name=>{const button=page.getByRole('button',{name,exact:true});if(process.env.RT_E2E_NATIVE_CLICK)await button.evaluate(button=>{button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,button:0}));button.click();});else await button.click();};
  // A background native WebView can delay paints indefinitely after activation.
  // History and completed-click cleanup must not need another animation frame.
  if(process.env.RT_E2E_NATIVE_CLICK)await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});
  await field.fill('Edited in inspector');await activate('Apply text');await check('Edited in inspector');
  // WebKit buttons may leave the textarea focused; history must still replace
  // a submitted value. Explicitly focus it to cover that behavior in both engines.
  await field.focus();await activate('Undo');await check('Original heading');
  await activate('Redo');await check('Edited in inspector');
  await activate('Undo');await check('Original heading');
  // A draft survives preview refreshes until Apply, then becomes source history.
  await field.fill('Draft after undo');await page.evaluate(()=>reloadFrame());assert.equal(await field.inputValue(),'Draft after undo');assert.equal(read(),original);
  await activate('Apply text');await check('Draft after undo');await activate('Undo');await check('Original heading');
  assert.deepEqual(errors,[]);console.log(engine+': PASS inspector text/preview/source synchronization, exact Undo/Redo, focused draft across reload and subsequent edit');
 }finally{if(browser)await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
