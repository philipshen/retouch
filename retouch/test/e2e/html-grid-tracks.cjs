'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const engine=process.env.RT_E2E_BROWSER||'chromium';
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-html-tracks-')),file=path.join(root,'index.html');
 const original='<html><body><main><section id="layout" style="--track_size:80px;display:grid;grid-template-columns:100px 100px;grid-template-rows:100px 100px;width:400px;height:300px;gap:10px"><div style="width:40px;height:40px">One</div><div style="width:40px;height:40px">Two</div></section></main></body></html>';fs.writeFileSync(file,original);const read=()=>fs.readFileSync(file,'utf8');
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});if(!server.listening)await once(server,'listening');let browser;
 try{
  browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch();const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:'+server.address().port+'/rt');const parent=page.frameLocator('#app').locator('#layout');await parent.waitFor();
  const settled=()=>page.waitForFunction(()=>!panelTasks&&!sourceRequests&&!undoBusy);
  const wait=async fn=>{for(let i=0;i<200;i++){try{if(await fn())return;}catch(error){if(!/Execution context was destroyed/.test(error.message))throw error;}await page.waitForTimeout(50);}throw Error('Timed out: '+await page.locator('#toasts').textContent());};
  await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await page.getByRole('treeitem',{name:'section · layout',exact:true}).click();await settled();await page.getByLabel('Style screen scope',{exact:true}).selectOption('min-[768px]:');await settled();await page.getByText('Custom grid tracks',{exact:true}).click();
  const standalone=await browser.newPage({javaScriptEnabled:false,viewport:{width:768,height:1024}});
  const tracks=axis=>parent.evaluate((el,axis)=>getComputedStyle(el).getPropertyValue('grid-template-'+axis).replace(/\[[^\]]*\]/g,' ').trim().split(/\s+/).map(parseFloat),axis);
  for(const axis of ['columns','rows'])for(const value of (['80px minmax(0, 1fr)','repeat(3, minmax(0, 1fr))','[content_start] 80px [rest] 1fr','auto 1fr','var(--track_size) minmax(0, 1fr)','var(--missing, 80px) 1fr'])){
   const before=read(),label=axis==='columns'?'Column sizes':'Row sizes',input=page.getByLabel(label,{exact:true}),reset=page.getByRole('button',{name:'Reset '+label.toLowerCase(),exact:true}),total=axis==='columns'?400:300;
   const initial=await input.inputValue();
   await input.fill('1fr; display:none');await input.press('Tab');await settled();assert.equal(read(),before);assert.equal(await input.evaluate(el=>el.checkValidity()),false);
   await input.fill('nonsense');await input.press('Tab');await settled();assert.equal(read(),before);assert.equal(await input.evaluate(el=>el.checkValidity()),false);
   await input.press('Escape');assert.equal(await input.inputValue(),initial);assert.equal(await input.evaluate(el=>el.checkValidity()),true);assert.equal(read(),before,'Escape discards an invalid grid draft');
   await input.fill('120px 1fr');await input.press('Escape');assert.equal(await input.inputValue(),initial);assert.equal(read(),before,'Escape discards a valid unfinished grid draft');
   await input.fill(value);await input.press('Enter');await settled();const expected=value.startsWith('repeat')?Array(3).fill((total-20)/3):value.startsWith('auto')?[40,total-50]:[80,total-90];
   try{await wait(async()=>{const actual=await tracks(axis);return actual.length===expected.length&&actual.every((v,i)=>Math.abs(v-expected[i])<0.03);});}catch(error){console.error(JSON.stringify({axis,value,expected,actual:await tracks(axis),source:read(),validity:await input.evaluate(el=>el.validationMessage)}));throw error;}assert.equal(await input.inputValue(),value);assert.deepEqual(await tracks(axis==='columns'?'rows':'columns'),[100,100]);const edited=read();assert.notEqual(edited,before);if(process.env.RT_E2E_GRID_TRACKS_SCREENSHOT&&axis==='columns'){await input.scrollIntoViewIfNeeded();await page.locator('#panel').screenshot({path:process.env.RT_E2E_GRID_TRACKS_SCREENSHOT});}
   // Render only the saved markup in a separate page with JavaScript disabled.
   await standalone.setContent(edited);assert.equal(await standalone.locator('script').count(),0);
   const standaloneTracks=()=>standalone.locator('#layout').evaluate((el,axis)=>getComputedStyle(el).getPropertyValue('grid-template-'+axis).replace(/\[[^\]]*\]/g,' ').trim().split(/\s+/).map(parseFloat),axis);
   for(const viewportWidth of [768,767,390,1024]){
    await standalone.setViewportSize({width:viewportWidth,height:1024});
    const wanted=viewportWidth>=768?expected:[100,100];
    await wait(async()=>{const actual=await standaloneTracks();return actual.length===wanted.length&&actual.every((v,i)=>Math.abs(v-wanted[i])<0.03);});
   }
   if(value.includes('[content_start]'))assert.match(await standalone.locator('#layout').evaluate((el,axis)=>getComputedStyle(el).getPropertyValue('grid-template-'+axis),axis),/\[content_start\]/);
   if(value.includes('--track_size')){
    await parent.evaluate(el=>el.style.setProperty('--track_size','90px'));
    await wait(async()=>Math.abs((await tracks(axis))[0]-90)<0.03);
    assert.equal(await input.inputValue(),value,'Variable reference stays authored rather than becoming pixels');assert.equal(read(),edited);
    await parent.evaluate(el=>el.style.setProperty('--track_size','80px'));
    await wait(async()=>Math.abs((await tracks(axis))[0]-80)<0.03);
   }
   await reset.click();await settled();assert.deepEqual(await tracks(axis),[100,100]);assert.equal(await reset.isDisabled(),true);const resetSource=read();
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),edited);
   await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();assert.equal(read(),resetSource);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),edited);
   await page.getByLabel('Screen size',{exact:true}).focus();await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await wait(async()=>JSON.stringify(await tracks(axis))==='[100,100]');
   await page.getByLabel('Screen size',{exact:true}).focus();await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();await wait(async()=>await input.inputValue()===value);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),before);
  }
  assert.equal(read(),original);assert.deepEqual(errors,[]);console.log('HTML CUSTOM GRID TRACKS VALIDATION/RENDER/STATIC EXPORT/RESET/RESPONSIVE/EXACT HISTORY PASS',engine);
 }finally{if(browser)await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
