'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium';
if(!['chromium','webkit'].includes(engine))throw Error('RT_E2E_BROWSER must be chromium or webkit');
const browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-grid-alignment-'));
 const cases=[['horizontal-tb','ltr'],['horizontal-tb','rtl'],['vertical-rl','ltr'],['vertical-rl','rtl'],['vertical-lr','rtl'],['sideways-lr','ltr']];
 const originals=cases.map(([writing,direction],i)=>{
  const source=`<html><head></head><body><main style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;writing-mode:${writing};direction:${direction};width:200px;height:160px">${Array.from({length:4},(_,n)=>`<div style="width:20px;height:20px;font-size:10px;background:#dbeafe">${n+1}</div>`).join('')}</main></body></html>`;
  fs.writeFileSync(path.join(root,`case-${i}.html`),source);return source;
 });
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');
 const browser=await browserType.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const app=page.frameLocator('#app');
 const wait=async fn=>{for(let i=0;i<100;i++){try{if(await fn())return;}catch(error){if(!/Execution context was destroyed/.test(error.message))throw error;}await page.waitForTimeout(100);}throw Error('Timed out waiting for layout');};
 const settled=()=>wait(async()=>await page.locator('#panelBody').getAttribute('aria-busy')!=='true');
 try{
  const size=async value=>{const input=page.getByLabel('Screen width',{exact:true});await input.fill(String(value));await input.press('Enter');await wait(async()=>await app.locator('body').evaluate(()=>innerWidth)===value);await settled();};
  for(const [index,[writing,direction]]of cases.entries()){
   const file=path.join(root,`case-${index}.html`),read=()=>fs.readFileSync(file,'utf8'),original=originals[index];await page.goto(`http://localhost:${server.address().port}/rt/case-${index}.html`);await page.getByRole('treeitem',{name:'main',exact:true}).click();await settled();
   const matches=(x,y)=>app.locator('main').evaluate((el,[x,y])=>{const parent=el.getBoundingClientRect(),rects=[...el.children].map(child=>child.getBoundingClientRect());return rects.every(r=>Math.abs(r.width-20)<.1&&Math.abs(r.height-20)<.1&&Math.abs((r.x-parent.x)%100-x*40)<.1&&Math.abs((r.y-parent.y)%80-y*30)<.1)&&new Set(rects.map(r=>Math.round(r.x))).size===2&&new Set(rects.map(r=>Math.round(r.y))).size===2;},[x,y]);
   for(let y=0;y<3;y++)for(let x=0;x<3;x++){
    const button=page.getByRole('button',{name:'Align children '+['top','middle','bottom'][y]+' '+['left','center','right'][x],exact:true});await button.click();await wait(()=>read()!==original);await settled();await wait(()=>matches(x,y));assert.equal(await button.getAttribute('aria-pressed'),'true');const changed=read();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===changed);await settled();await wait(()=>matches(x,y));await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();
   }
   const gap=page.getByLabel('Gap (CSS)',{exact:true});assert.equal(await gap.locator('xpath=ancestor::*[contains(@class,"layout-alignment-spacing")][1]').count(),1);assert.equal(await page.getByLabel('Align columns (CSS)',{exact:true}).isVisible(),false);assert.equal(await page.getByLabel('Align items (CSS)',{exact:true}).isVisible(),false);
   const columns=page.getByLabel('Align columns (CSS)',{exact:true}),options=columns.locator('xpath=ancestor::details[1]');await options.locator(':scope > summary').click();await columns.selectOption('center');await wait(()=>read()!==original);await settled();const columnEdit=read();assert.equal(await app.locator('main').evaluate(el=>getComputedStyle(el).justifyItems),'center');await page.getByRole('button',{name:'Reset align columns',exact:true}).click();await wait(()=>read()!==columnEdit);await settled();assert.equal(await app.locator('main').evaluate(el=>getComputedStyle(el).justifyItems),'normal');await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===columnEdit);await settled();await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await options.locator(':scope > summary').click();
   const first=page.getByRole('button',{name:'Align children top left',exact:true});await first.focus();await first.press('ArrowRight');await page.keyboard.press('ArrowDown');assert.equal(await page.getByRole('button',{name:'Align children middle center',exact:true}).evaluate(el=>el===document.activeElement),true);assert.equal(read(),original);
   await size(768);const scope=page.getByLabel('Style screen scope',{exact:true});await wait(async()=>await scope.evaluate(el=>[...el.options].some(option=>option.value==='min-[768px]:')));await scope.selectOption('min-[768px]:');await settled();const center=page.getByRole('button',{name:'Align children middle center',exact:true});await center.click();await wait(()=>read()!==original);await settled();await wait(()=>matches(1,1));const changed=read();await size(390);await wait(async()=>await center.isDisabled());for(const name of ['Normal flow','Vertical stack','Horizontal stack','Adaptive grid'])assert.equal(await page.getByRole('button',{name,exact:true}).isDisabled(),true);assert.equal(read(),changed);assert.equal(await app.locator('main').evaluate(el=>getComputedStyle(el).justifyItems),'normal');await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();await size(768);await scope.selectOption('');await settled();
   if(index===0)await page.screenshot({path:'/tmp/retouch-single-grid-alignment-'+engine+'.png'});
  }
  assert.deepEqual(errors,[]);console.log(engine+': PASS nine grid cell positions across six writing directions, compact controls, responsive scope guards and exact undo/redo');
 }finally{await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
