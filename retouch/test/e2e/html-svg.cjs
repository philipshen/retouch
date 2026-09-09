'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium';
if(!['chromium','webkit'].includes(engine))throw Error('RT_E2E_BROWSER must be chromium or webkit');
const browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-svg-'));
 const original='<html><head></head><body><svg width="300" height="150" viewBox="0 0 200 100"><rect aria-label="Box" x="5" y="5" width="40" height="20" fill="red"/><circle cx="100" cy="30" r="10" fill="blue"/><ellipse cx="30" cy="70" rx="10" ry="5" fill="green"/><line x1="60" y1="70" x2="100" y2="70" stroke="black"/></svg><p>Unchanged</p></body></html>';
 const file=path.join(root,'index.html');fs.writeFileSync(file,original);const read=()=>fs.readFileSync(file,'utf8');
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');
 const browser=await browserType.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const app=page.frameLocator('#app');
 const wait=async fn=>{for(let i=0;i<100;i++){try{if(await fn())return;}catch(error){if(!/Execution context was destroyed/.test(error.message))throw error;}await page.waitForTimeout(100);}throw Error('Timed out waiting for layout');};
 const settled=()=>wait(async()=>await page.locator('#panelBody').getAttribute('aria-busy')!=='true');
 try{
  await page.goto(`http://localhost:${server.address().port}/rt`);await app.locator('rect').click();await settled();await wait(async()=>await page.getByLabel('Shape Width',{exact:true}).count()===1);
  assert.equal(await page.getByRole('treeitem',{name:'rect · Box',exact:true}).getAttribute('aria-selected'),'true');
  const fill=async(label,value)=>{await page.getByLabel('Shape '+label,{exact:true}).fill(value);await page.getByLabel('Shape '+label,{exact:true}).press('Tab');await settled();};
  await fill('Width','80');await wait(async()=>await app.locator('rect').evaluate(el=>el.getBBox().width)===80);assert.equal(await app.locator('rect').evaluate(el=>el.getBoundingClientRect().width),120,'SVG viewBox scales source geometry');const wideSource=read();
  if(process.env.RT_E2E_SVG_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_SVG_SCREENSHOT});
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);await wait(async()=>await app.locator('rect').evaluate(el=>el.getBBox().width)===40);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();await wait(()=>read()===wideSource);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
  for(const [tag,label,value,attribute]of [['circle','Radius','20','r'],['ellipse','Horizontal radius','15','rx'],['line','End X','180','x2']]){
   await page.getByRole('treeitem',{name:tag,exact:true}).click();await settled();await fill(label,value);await wait(async()=>await app.locator(tag).getAttribute(attribute)===value);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===original);
  }
  assert.equal(await app.locator('p').textContent(),'Unchanged');
  assert.deepEqual(errors,[]);console.log(engine+': PASS inline SVG canvas/tree selection, primitive geometry, viewBox scaling and exact source undo/redo');
 }finally{await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
