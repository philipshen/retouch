'use strict';
const path=require('node:path'),assert=require('node:assert/strict');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const browser=await browserType.launch();
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<div id="host" style="width:240px"></div>');await page.addStyleTag({path:path.resolve(__dirname,'../../shell/shell.css')});await page.addScriptTag({path:path.resolve(__dirname,'../../shell/layers.js')});
  await page.evaluate(()=>{
   window.source=new DOMParser().parseFromString('<main data-rt="main"><div data-rt="a" aria-label="A">A</div><div data-rt="b" aria-label="B">B</div></main><section data-rt="other" aria-label="Other"></section>','text/html');
   window.events=[];window.chosen=[];
   window.layers=RetouchLayers.mount({host:document.querySelector('#host'),multiSelectEnabled:true,onAction(){},onSelectMany(){},onSelect(el,{toggle=false}={}){events.push(el.getAttribute('data-rt'));chosen=toggle?[...chosen,el]:[el];layers.selection(el,{classSelection:true},false,chosen);}});layers.attach(source);
  });
  const item=name=>page.getByRole('treeitem',{name,exact:true});
  await item('div · A').click();
  const b=await item('div · B').boundingBox();await page.keyboard.down('Meta');await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();
  await page.evaluate(()=>{window.held=document.querySelector('[role=treeitem][title="div · B"]');source.querySelector('main').appendChild(source.createTextNode(' Live update'));});
  await item('main · Live update').waitFor();
  await page.mouse.up();await page.keyboard.up('Meta');
  assert.deepEqual(await page.evaluate(()=>events),['a','b'],'a source refresh between press and release must preserve the click');
  assert.equal(await page.evaluate(()=>held.isConnected),true,'unchanged source layer keeps its button');
  assert.equal(await page.getByRole('treeitem',{selected:true}).count(),2);
  await item('div · B').focus();await page.evaluate(()=>source.querySelector('[data-rt=b]').setAttribute('aria-label','Renamed'));
  await item('div · Renamed').waitFor();assert.equal(await item('div · Renamed').evaluate(el=>el===document.activeElement),true,'rename preserves keyboard focus');
  await page.evaluate(()=>source.querySelector('section').appendChild(source.querySelector('[data-rt=b]')));
  await page.waitForFunction(()=>document.querySelector('[title="section · Other"]')?.getAttribute('aria-expanded')==='true');
  await item('div · Renamed').focus();await page.keyboard.press('ArrowLeft');assert.equal(await item('section · Other').evaluate(el=>el===document.activeElement),true,'keyboard navigation uses the new parent');
  await page.getByLabel('Find a layer').fill('Renamed');assert.equal(await item('div · A').count(),0);assert.equal(await item('div · Renamed').count(),1);
  await page.getByLabel('Find a layer').fill('');await page.getByRole('button',{name:'Collapse section · Other',exact:true}).click();assert.equal(await item('div · Renamed').count(),0);
  await page.getByRole('button',{name:'Expand section · Other',exact:true}).click();assert.equal(await item('div · Renamed').count(),1);
  await page.addScriptTag({path:path.resolve(__dirname,'../../shell/component-instances.js')});
  const scanRace=await page.evaluate(async()=>{
   const host=document.createElement('div');document.body.append(host);const pending=[],scans=RetouchLayers.mount({host,onSelect(){},onAction(){},readComponents:()=>new Promise(resolve=>pending.push(resolve))});scans.attach(source);pending[0]({ok:true,components:[]});await Promise.resolve();await Promise.resolve();
   let firstDone=false;const first=scans.refresh().then(()=>{firstDone=true;}),second=scans.refresh();pending[1]({ok:true,components:[]});for(let i=0;i<8;i++)await Promise.resolve();const premature=firstDone;pending[2]({ok:true,components:[]});await Promise.all([first,second]);return {premature,firstDone,count:pending.length};
  });assert.deepEqual(scanRace,{premature:false,firstDone:true,count:3});
  await page.evaluate(()=>{
   const kinds=document.createElement('div');document.body.append(kinds);
   window.iconLayers=RetouchLayers.mount({host:kinds,onSelect(){},onAction(){}});
   iconLayers.attach(new DOMParser().parseFromString('<main data-rt="frame"><h1 data-rt="text">Title</h1><img data-rt="image" alt="Photo"><svg data-rt="vector"></svg><input data-rt="element"></main>','text/html'));
  });
  for(const [name,kind] of [['main','frame'],['h1 · Title','text'],['img · Photo','image'],['svg','vector'],['input','element']]){
   const row=page.getByRole('treeitem',{name,exact:true});
   assert.equal(await row.getAttribute('data-layer-kind'),kind);
   assert.notEqual(await row.evaluate(el=>getComputedStyle(el,'::before').maskImage),'none');
  }
  if(process.env.RT_E2E_LAYER_TYPES_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_LAYER_TYPES_SCREENSHOT});
  assert.deepEqual(errors,[]);console.log(engine+': PASS layer click across live refresh, modifier selection, button identity, rename focus, reparented keyboard navigation, search and disclosure');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
