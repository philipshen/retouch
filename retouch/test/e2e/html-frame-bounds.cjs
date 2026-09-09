'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium';
if(!['chromium','webkit'].includes(engine))throw Error('RT_E2E_BROWSER must be chromium or webkit');
const browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-frame-bounds-'));
 const original='<html><head></head><body><main style="width:200px;height:80px;position:relative;background:#dbeafe"><div style="position:absolute;left:180px;top:20px;width:80px;height:40px;background:#f87171">Overflow</div></main></body></html>';
 const file=path.join(root,'index.html');fs.writeFileSync(file,original);const read=()=>fs.readFileSync(file,'utf8');
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');
 const browser=await browserType.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const app=page.frameLocator('#app');
 const wait=async fn=>{for(let i=0;i<100;i++){try{if(await fn())return;}catch(error){if(!/Execution context was destroyed/.test(error.message))throw error;}await page.waitForTimeout(100);}throw Error('Timed out waiting for layout');};
 const settled=()=>wait(async()=>await page.locator('#panelBody').getAttribute('aria-busy')!=='true');
 try{
  await page.goto(`http://localhost:${server.address().port}/rt`);await page.getByRole('treeitem',{name:'main',exact:true}).click();await settled();
  const size=async value=>{await page.getByLabel('Screen size',{exact:true}).selectOption(value);await wait(async()=>await app.locator('body').evaluate(()=>innerWidth)===Number(value.split('x')[0]));};
  const height=()=>app.locator('main').evaluate(el=>el.getBoundingClientRect().height);
  const outsideHit=()=>app.locator('main > div').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.right-5,r.top+5)===el;});
  await size('390x844');assert.equal(await outsideHit(),true);
  await page.getByLabel('Frame aspect ratio',{exact:true}).fill('1:1');await page.getByLabel('Frame aspect ratio',{exact:true}).press('Tab');await wait(async()=>await height()===200);await settled();const ratioSource=read();
  await page.getByLabel('Clip content',{exact:true}).check();await wait(async()=>!await outsideHit());await settled();const clippedSource=read();
  await page.getByRole('button',{name:'Reset clipping',exact:true}).click();await wait(async()=>await outsideHit());await settled();
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===clippedSource);await wait(async()=>!await outsideHit());
  if(process.env.RT_E2E_FRAME_BOUNDS_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_FRAME_BOUNDS_SCREENSHOT});
  await size('768x1024');await page.getByLabel('Style screen scope').selectOption('min-[768px]:');await page.getByLabel('Frame aspect ratio',{exact:true}).fill('16/9');await page.getByLabel('Frame aspect ratio',{exact:true}).press('Tab');await wait(async()=>Math.abs(await height()-112.5)<1);await settled();
  await page.getByLabel('Clip content',{exact:true}).uncheck();await wait(async()=>await outsideHit());await settled();
  await size('390x844');await wait(async()=>await height()===200&&!await outsideHit());
  for(let i=0;i<3;i++){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();}await wait(()=>read()===ratioSource);await wait(async()=>await outsideHit());
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);await wait(async()=>await height()===80);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===ratioSource);await wait(async()=>await height()===200);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
  assert.deepEqual(errors,[]);console.log(engine+': PASS frame ratio dimensions, overflow hit-test clipping, responsive overrides, reset and exact atomic undo/redo');
 }finally{await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
