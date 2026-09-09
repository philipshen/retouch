'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium';
if(!['chromium','webkit'].includes(engine))throw Error('RT_E2E_BROWSER must be chromium or webkit');
const browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-visibility-'));
 const original='<html><head></head><body><main style="display:flex"><h1>Title</h1><p>Paragraph</p></main></body></html>';
 const file=path.join(root,'index.html');fs.writeFileSync(file,original);const read=()=>fs.readFileSync(file,'utf8');
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');
 const browser=await browserType.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const app=page.frameLocator('#app');
 const wait=async fn=>{for(let i=0;i<100;i++){try{if(await fn())return;}catch(error){if(!/Execution context was destroyed/.test(error.message))throw error;}await page.waitForTimeout(100);}throw Error('Timed out waiting for layout');};
 const settled=()=>wait(async()=>await page.locator('#panelBody').getAttribute('aria-busy')!=='true');
 try{
  await page.goto(`http://localhost:${server.address().port}/rt`);
  const heading=page.getByRole('treeitem',{name:'h1 · Title',exact:true}),paragraph=page.getByRole('treeitem',{name:'p · Paragraph',exact:true});await heading.click();await settled();
  const size=async value=>{await page.getByLabel('Screen size',{exact:true}).selectOption(value);await wait(async()=>await app.locator('body').evaluate(()=>innerWidth)===Number(value.split('x')[0]));};
  await size('390x844');const before=await app.locator('p').boundingBox();
  await page.getByLabel('Visible layer',{exact:true}).uncheck();await wait(async()=>!await app.locator('h1').isVisible());await settled();const hiddenSource=read();assert.deepEqual(await app.locator('p').boundingBox(),before,'hidden heading keeps its layout space');
  await paragraph.click();await settled();await heading.click();await settled();assert.equal(await page.getByLabel('Visible layer',{exact:true}).isChecked(),false,'hidden layer stays selectable');
  await page.getByLabel('Visible layer',{exact:true}).check();await wait(async()=>await app.locator('h1').isVisible());await settled();
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===hiddenSource);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
  await paragraph.click({modifiers:['Shift']});await settled();await wait(async()=>await page.getByRole('treeitem',{selected:true}).count()===2);
  await page.getByLabel('Shared Visibility',{exact:true}).selectOption('hidden');await wait(async()=>!await app.locator('h1').isVisible()&&!await app.locator('p').isVisible());await settled();const bothHidden=read();
  await size('768x1024');await page.getByLabel('Style screen scope').selectOption('min-[768px]:');await page.getByLabel('Shared Visibility',{exact:true}).selectOption('visible');await wait(async()=>await app.locator('h1').isVisible()&&await app.locator('p').isVisible());await settled();const tabletShown=read();
  await size('390x844');await wait(async()=>!await app.locator('h1').isVisible()&&!await app.locator('p').isVisible());assert.equal(await app.locator('main').evaluate(el=>getComputedStyle(el).display),'flex','display remains authored');
  if(process.env.RT_E2E_VISIBILITY_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_VISIBILITY_SCREENSHOT});
  await size('768x1024');await page.getByRole('button',{name:'Reset shared visibility',exact:true}).click();await wait(async()=>!await app.locator('h1').isVisible());await settled();assert.equal(read(),bothHidden);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===tabletShown);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===bothHidden);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);await wait(async()=>await app.locator('h1').isVisible()&&await app.locator('p').isVisible());
  assert.deepEqual(errors,[]);console.log(engine+': PASS single and multiple visibility, preserved layout/display, hidden tree selection, screen isolation and exact undo/reset');
 }finally{await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
