'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium';
if(!['chromium','webkit'].includes(engine))throw Error('RT_E2E_BROWSER must be chromium or webkit');
const browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-adaptive-grid-'));
 const original='<html><head></head><body><main style="gap:16px">'+Array.from({length:8},(_,i)=>`<div style="min-height:80px;background:#dbeafe">Card ${i+1}</div>`).join('')+'</main></body></html>';
 const file=path.join(root,'index.html');fs.writeFileSync(file,original);const read=()=>fs.readFileSync(file,'utf8');
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');
 const browser=await browserType.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const app=page.frameLocator('#app');
 const wait=async fn=>{for(let i=0;i<100;i++){try{if(await fn())return;}catch(error){if(!/Execution context was destroyed/.test(error.message))throw error;}await page.waitForTimeout(100);}throw Error('Timed out waiting for layout');};
 const settled=()=>wait(async()=>await page.locator('#panelBody').getAttribute('aria-busy')!=='true');
 try{
  await page.goto(`http://localhost:${server.address().port}/rt`);await page.getByRole('treeitem',{name:'main',exact:true}).click();await settled();
  const size=async value=>{await page.getByLabel('Screen size',{exact:true}).selectOption(value);await wait(async()=>await app.locator('body').evaluate(()=>innerWidth)===Number(value.split('x')[0]));};
  const columns=()=>app.locator('main > div').evaluateAll(els=>new Set(els.map(el=>Math.round(el.getBoundingClientRect().left))).size);
  await size('390x844');await page.getByRole('button',{name:'Adaptive grid',exact:true}).click();await wait(async()=>await app.locator('main').evaluate(el=>getComputedStyle(el).display)==='grid');await settled();const baseSource=read();
  assert.equal(await page.getByLabel('Minimum column size (px)',{exact:true}).inputValue(),'240');
  for(const [screen,count]of [['390x844',1],['768x1024',3],['1440x900',5]]){await size(screen);await wait(async()=>await columns()===count);assert.equal(read(),baseSource,'resizing does not write source');}
  if(process.env.RT_E2E_ADAPTIVE_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_ADAPTIVE_SCREENSHOT});
  await size('390x844');await page.getByLabel('Screen width',{exact:true}).fill('240');await page.getByLabel('Screen width',{exact:true}).press('Tab');await wait(async()=>await app.locator('body').evaluate(()=>innerWidth)===240);await wait(async()=>await columns()===1);assert.equal(await app.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'narrow grid fits without overflow');
  await size('768x1024');await page.getByLabel('Style screen scope').selectOption('min-[768px]:');assert.equal(await page.getByLabel('Minimum column size (px)',{exact:true}).inputValue(),'240','inherited adaptive minimum');
  await page.getByLabel('Minimum column size (px)',{exact:true}).fill('350');await page.getByLabel('Minimum column size (px)',{exact:true}).press('Tab');await wait(async()=>await columns()===2);await settled();const tabletSource=read();
  await size('390x844');await wait(async()=>await columns()===1);await size('1440x900');await wait(async()=>await columns()===3);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===baseSource);await wait(async()=>await columns()===5);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===tabletSource);await wait(async()=>await columns()===3);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
  assert.deepEqual(errors,[]);console.log(engine+': PASS adaptive grid column counts at phone/tablet/desktop, narrow fit, inherited minimum, scoped override and exact undo/redo');
 }finally{await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
