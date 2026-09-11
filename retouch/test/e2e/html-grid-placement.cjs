'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const engine=process.env.RT_E2E_BROWSER||'chromium';
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-html-tracks-')),file=path.join(root,'index.html');
 const original='<html><body><main><section id="layout" style="display:grid;grid-template-columns:[left] 100px [middle] 100px [right] 100px [end];grid-template-rows:[left] 100px [middle] 100px [right] 100px [end];width:320px;height:320px;gap:10px"><div id="item" style="width:20px;height:20px">One</div><div style="width:20px;height:20px">Two</div></section></main></body></html>';fs.writeFileSync(file,original);const read=()=>fs.readFileSync(file,'utf8');
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});if(!server.listening)await once(server,'listening');let browser;
 try{
  browser=await require(path.join(fixture,'node_modules/playwright'))[engine].launch();const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:'+server.address().port+'/rt');const parent=page.frameLocator('#app').locator('#layout');await parent.waitFor();
  const settled=()=>page.waitForFunction(()=>!panelTasks&&!sourceRequests&&!undoBusy);
  const wait=async fn=>{for(let i=0;i<200;i++){try{if(await fn())return;}catch(error){if(!/Execution context was destroyed/.test(error.message))throw error;}await page.waitForTimeout(50);}throw Error('Timed out: '+await page.locator('#toasts').textContent());};
  await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await page.getByRole('treeitem',{name:'div · item',exact:true}).click();await settled();await page.getByLabel('Style screen scope',{exact:true}).selectOption('min-[768px]:');await settled();await page.getByText('Custom grid placement',{exact:true}).click();
  const item=page.frameLocator('#app').locator('#item'),standalone=await browser.newPage({javaScriptEnabled:false,viewport:{width:768,height:1024}});
  const position=()=>item.evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return [a.left-b.left,a.top-b.top];});
  const guides=page.getByLabel('Show grid guides',{exact:true});await guides.check();
  await wait(async()=>await page.locator('.grid-guide').count()===12);
  const guideGeometry=await page.evaluate(()=>{const grid=document.getElementById('app').contentDocument.getElementById('layout').getBoundingClientRect();return {columns:[...document.querySelectorAll('.grid-guide.column')].map(el=>parseFloat(el.style.left)-grid.left),rows:[...document.querySelectorAll('.grid-guide.row')].map(el=>parseFloat(el.style.top)-grid.top),noninteractive:[...document.querySelectorAll('.grid-guide')].every(el=>getComputedStyle(el).pointerEvents==='none')};});
  assert.deepEqual(guideGeometry,{columns:[0,100,110,210,220,320],rows:[0,100,110,210,220,320],noninteractive:true});assert.equal(read(),original,'Guides do not change source');
  const parentStyle=await parent.getAttribute('style');
  await parent.evaluate(el=>{Object.assign(el.style,{boxSizing:'content-box',width:'420px',padding:'12px',border:'2px solid black',justifyContent:'center',direction:'rtl',transform:'scale(1.25)',transformOrigin:'top left'});});
  await wait(async()=>await page.evaluate(()=>{const grid=document.getElementById('app').contentDocument.getElementById('layout').getBoundingClientRect(),positions=[...document.querySelectorAll('.grid-guide.column')].map(el=>parseFloat(el.style.left)-grid.left),expected=[384,284,274,174,164,64].map(v=>v*1.25);return positions.length===expected.length&&positions.every((v,i)=>Math.abs(v-expected[i])<.05);}));
  await parent.evaluate(el=>el.style.transform='rotate(15deg)');await wait(async()=>await page.locator('.grid-guide').count()===0);
  await parent.evaluate((el,style)=>style===null?el.removeAttribute('style'):el.setAttribute('style',style),parentStyle);await wait(async()=>await page.locator('.grid-guide').count()===12);assert.equal(read(),original);
  await parent.evaluate(el=>{Object.assign(el.style,{boxSizing:'content-box',width:'200px',height:'200px',overflow:'auto'});el.scrollLeft=70;el.scrollTop=60;});
  await wait(async()=>await page.evaluate(()=>{const el=document.getElementById('app').contentDocument.getElementById('layout'),r=el.getBoundingClientRect(),lines=[...document.querySelectorAll('.grid-guide')];return el.scrollLeft===70&&el.scrollTop===60&&lines.length>0&&lines.every(line=>{const x=parseFloat(line.style.left)-r.left,y=parseFloat(line.style.top)-r.top;return x>=0&&y>=0&&x+parseFloat(line.style.width)<=el.clientWidth+.01&&y+parseFloat(line.style.height)<=el.clientHeight+.01;})&&lines.some(line=>line.classList.contains('column')&&Math.abs(parseFloat(line.style.left)-r.left-30)<.01);}));
  if(process.env.RT_E2E_GRID_CLIP_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_GRID_CLIP_SCREENSHOT});
  await parent.evaluate((el,style)=>{el.scrollLeft=0;el.scrollTop=0;style===null?el.removeAttribute('style'):el.setAttribute('style',style);},parentStyle);
  await parent.evaluate(el=>{const wrap=el.parentElement;wrap.dataset.previousStyle=wrap.getAttribute('style')||'';Object.assign(wrap.style,{width:'180px',height:'180px',overflow:'hidden'});});
  await wait(async()=>await page.evaluate(()=>{const r=document.getElementById('app').contentDocument.getElementById('layout').parentElement.getBoundingClientRect(),lines=[...document.querySelectorAll('.grid-guide')];return lines.length>0&&lines.every(line=>parseFloat(line.style.left)+parseFloat(line.style.width)<=r.right+.01&&parseFloat(line.style.top)+parseFloat(line.style.height)<=r.bottom+.01);}));
  await parent.evaluate(el=>{const wrap=el.parentElement,style=wrap.dataset.previousStyle;style?wrap.setAttribute('style',style):wrap.removeAttribute('style');delete wrap.dataset.previousStyle;});await wait(async()=>await page.locator('.grid-guide').count()===12);assert.equal(read(),original);
  if(process.env.RT_E2E_GRID_GUIDES_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_GRID_GUIDES_SCREENSHOT});
  await guides.uncheck();await wait(async()=>await page.locator('.grid-guide').count()===0);
  for(const [axis,label] of [['column','Column placement'],['row','Row placement']])for(const [value,offset] of [['2 / 3',110],['middle / right',110],['2 / span 2',110],['-2 / -1',220]]){
   const before=read(),input=page.getByLabel(label,{exact:true}),initial=await input.inputValue(),index=axis==='column'?0:1;
   const suggestions=await input.evaluate(el=>[...el.list.options].map(option=>option.value));
   assert.ok(suggestions.includes('middle / right')&&suggestions.includes('2 / 3'),'Placement offers actual parent lines');assert.ok(!suggestions.includes('4 / 5'),'Suggestions do not invent extra tracks');
   await input.fill('0 / 3');await input.press('Enter');assert.equal(await input.evaluate(el=>el.checkValidity()),false);assert.equal(read(),before);
   await input.press('Escape');assert.equal(await input.inputValue(),initial);assert.equal(await input.evaluate(el=>el.checkValidity()),true);
   await input.fill(value);await input.press('Enter');await settled();await wait(async()=>{const p=await position();return p[index]===offset&&p[1-index]===0;});
   const edited=read();assert.notEqual(edited,before);assert.equal(await input.inputValue(),value);
   await standalone.setContent(edited);
   for(const viewportWidth of [768,767,1024]){await standalone.setViewportSize({width:viewportWidth,height:1024});assert.equal(await standalone.locator('#item').evaluate((el,index)=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return index===0?a.left-b.left:a.top-b.top;},index),viewportWidth>=768?offset:0);}
   if(process.env.RT_E2E_GRID_PLACEMENT_SCREENSHOT&&axis==='column'){await input.scrollIntoViewIfNeeded();await page.locator('#panel').screenshot({path:process.env.RT_E2E_GRID_PLACEMENT_SCREENSHOT});}
   await page.getByRole('button',{name:'Reset '+label.toLowerCase(),exact:true}).click();await settled();await wait(async()=>JSON.stringify(await position())==='[0,0]');const resetSource=read();
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),edited);
   await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();assert.equal(read(),resetSource);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),edited);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),before);
  }
  assert.equal(read(),original);assert.deepEqual(errors,[]);console.log('HTML GRID NUMERIC/NAMED/NEGATIVE LINES/SPAN/KEYBOARD/STATIC EXPORT/RESPONSIVE/EXACT HISTORY PASS',engine);
 }finally{if(browser)await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
