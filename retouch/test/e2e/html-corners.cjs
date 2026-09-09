'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium';
if(!['chromium','webkit'].includes(engine))throw Error('RT_E2E_BROWSER must be chromium or webkit');
const browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-corners-'));
 const original='<html><head></head><body><main style="width:200px;height:100px;border:2px solid black !important;background:#dbeafe">Frame</main></body></html>';
 const file=path.join(root,'index.html');fs.writeFileSync(file,original);const read=()=>fs.readFileSync(file,'utf8');
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');
 const browser=await browserType.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const app=page.frameLocator('#app');
 const wait=async fn=>{for(let i=0;i<100;i++){try{if(await fn())return;}catch(error){if(!/Execution context was destroyed/.test(error.message))throw error;}await page.waitForTimeout(100);}throw Error('Timed out waiting for layout');};
 const settled=()=>wait(async()=>await page.locator('#panelBody').getAttribute('aria-busy')!=='true');
 try{
  await page.goto(`http://localhost:${server.address().port}/rt`);await page.getByRole('treeitem',{name:'main · Frame',exact:true}).click();await settled();
  const size=async value=>{await page.getByLabel('Screen size',{exact:true}).selectOption(value);await wait(async()=>await app.locator('body').evaluate(()=>innerWidth)===Number(value.split('x')[0]));};
  const corner=property=>app.locator('main').evaluate((el,p)=>getComputedStyle(el).getPropertyValue(p),property);
  const fill=async(label,value)=>{await page.getByLabel(label+' (CSS)',{exact:true}).fill(value);await page.getByLabel(label+' (CSS)',{exact:true}).press('Tab');await settled();};
  await size('390x844');await fill('Corner radius','8px');await wait(async()=>await corner('border-top-left-radius')==='8px');const baseSource=read();
  await size('768x1024');await page.getByLabel('Style screen scope').selectOption('min-[768px]:');await fill('Top left corner','40px 10px');await wait(async()=>await corner('border-top-left-radius')==='40px 10px');const ellipseSource=read();assert.equal(await corner('border-top-right-radius'),'8px');assert.equal(await corner('border-top-width'),'2px');
  if(process.env.RT_E2E_CORNERS_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_CORNERS_SCREENSHOT});
  await size('390x844');await wait(async()=>await corner('border-top-left-radius')==='8px');await size('768x1024');await wait(async()=>await corner('border-top-left-radius')==='40px 10px');
  await fill('Corner radius','20px');await wait(async()=>await corner('border-top-left-radius')==='20px'&&await corner('border-bottom-right-radius')==='20px');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===ellipseSource);await wait(async()=>await corner('border-top-left-radius')==='40px 10px');
  await page.getByRole('button',{name:'Reset top left corner',exact:true}).click();await settled();await wait(async()=>await corner('border-top-left-radius')==='8px');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===ellipseSource);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===baseSource);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
  assert.deepEqual(errors,[]);console.log(engine+': PASS independent/elliptical corners, preserved important stroke, responsive inheritance, uniform replacement and exact undo/reset');
 }finally{await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
