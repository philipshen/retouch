'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-position-'));
 const original='<html><head><style>body{margin:0}main{position:relative;box-sizing:border-box;width:calc(100% - 40px);height:50vh;margin:20px;border:10px solid #475569;padding:20px;background:#dbeafe}.box{width:80px;height:40px;padding:4px;border:2px solid black;margin:11px 13px;background:#f87171}</style></head><body><main><div class="box" aria-label="Box">Box</div></main><div aria-label="Protected" style="left:0!important">Protected</div></body></html>';
 const file=path.join(root,'index.html');fs.writeFileSync(file,original);const read=()=>fs.readFileSync(file,'utf8');
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');
 const browser=await browserType.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));const app=page.frameLocator('#app');
 const wait=async fn=>{for(let i=0;i<100;i++){try{if(await fn())return;}catch(error){if(!/Execution context was destroyed/.test(error.message))throw error;}await page.waitForTimeout(100);}throw Error('Timed out waiting for anchors');};
 const settled=()=>wait(async()=>await page.locator('#panelBody').getAttribute('aria-busy')!=='true');
 const box=()=>app.locator('.box').evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement,pr=p.getBoundingClientRect();return {x:r.left-pr.left-p.clientLeft,y:r.top-pr.top-p.clientTop,width:r.width,height:r.height,parentWidth:p.clientWidth,parentHeight:p.clientHeight,position:getComputedStyle(el).position};});
 const close=(a,b)=>assert.ok(Math.abs(a-b)<.3,`${a} differs from ${b}`),same=(a,b)=>{for(const p of ['x','y','width','height'])close(a[p],b[p]);};
 const snapshots=[original];const change=async(label,value)=>{await page.getByLabel(label,{exact:true}).selectOption(value);await wait(()=>read()!==snapshots.at(-1));await settled();snapshots.push(read());};
 const size=async value=>{await page.getByLabel('Screen size',{exact:true}).selectOption(value);await wait(async()=>await app.locator('body').evaluate(()=>innerWidth)===Number(value.split('x')[0]));await settled();};
 try{
  await page.goto(`http://localhost:${server.address().port}/rt`);await size('390x844');await page.getByRole('treeitem',{name:'div · Box',exact:true}).click();await settled();await wait(async()=>await page.getByLabel('Positioning',{exact:true}).count()===1);
  const before=await box();await change('Positioning','absolute');same(await box(),before);assert.equal((await box()).position,'absolute');
  await change('Horizontal anchor','end');same(await box(),before);const right=before.parentWidth-before.x-before.width;
  await size('768x1024');let b=await box();close(b.parentWidth-b.x-b.width,right);close(b.width,before.width);
  await change('Horizontal anchor','center');const center=b.x-b.parentWidth/2;await size('1440x900');b=await box();close(b.x-b.parentWidth/2,center);close(b.width,before.width);
  await change('Horizontal anchor','scale');const ratio=b.x/b.parentWidth,widthRatio=b.width/b.parentWidth;await size('768x1024');b=await box();close(b.x,ratio*b.parentWidth);close(b.width,widthRatio*b.parentWidth);
  await change('Horizontal anchor','stretch');const edges={left:b.x,right:b.parentWidth-b.x-b.width};await size('1440x900');b=await box();close(b.x,edges.left);close(b.parentWidth-b.x-b.width,edges.right);
  await change('Vertical anchor','center');const vertical=b.y-b.parentHeight/2;await size('768x1024');b=await box();close(b.y-b.parentHeight/2,vertical);
  await size('390x844');const phone=await box();await size('768x1024');await page.getByLabel('Style screen scope').selectOption('min-[768px]:');await change('Horizontal anchor','start');const tablet=await box();await size('1440x900');close((await box()).x,tablet.x);await size('390x844');same(await box(),phone);
  await size('768x1024');if(process.env.RT_E2E_POSITION_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_POSITION_SCREENSHOT});
  await size('768x1024');await page.getByRole('button',{name:'Reset positioning and size',exact:true}).click();await settled();await wait(()=>read()!==snapshots.at(-1));snapshots.push(read());
  for(let i=snapshots.length-2;i>=0;i--){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===snapshots[i]);}assert.equal((await box()).position,'static');
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===snapshots[1]);assert.equal((await box()).position,'absolute');await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
  await page.getByRole('treeitem',{name:'div · Protected',exact:true}).click();await settled();await page.getByLabel('Positioning',{exact:true}).selectOption('absolute');await wait(async()=>await page.getByLabel('Positioning',{exact:true}).inputValue()==='static');await settled();assert.equal(read(),original,'important inline positioning refused without changing source');
  await app.locator('main').evaluate(el=>el.style.transform='scale(.8)');await page.getByRole('treeitem',{name:'div · Box',exact:true}).click();await settled();await page.getByLabel('Positioning',{exact:true}).selectOption('absolute');await wait(async()=>await page.getByText('Anchor placement requires an element and ancestors without transforms or zoom.',{exact:true}).count()>0);assert.equal(read(),original);assert.equal(await page.getByLabel('Positioning',{exact:true}).inputValue(),'static');
  assert.deepEqual(errors,[]);console.log(engine+': PASS HTML flow-to-absolute geometry, border/padding/margin handling, edge/center/stretch/scale constraints, responsive scopes/reset and exact undo/redo');
 }finally{await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
