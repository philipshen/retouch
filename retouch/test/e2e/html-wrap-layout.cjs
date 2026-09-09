'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium';
if(!['chromium','webkit'].includes(engine))throw Error('RT_E2E_BROWSER must be chromium or webkit');
const browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-flex-writing-'));
 const modes=[['horizontal-tb','row','ltr'],['horizontal-tb','row-reverse','rtl'],['horizontal-tb','column','rtl'],['vertical-rl','row','ltr'],['vertical-lr','column-reverse','ltr'],['vertical-rl','row','rtl']];
 const cases=modes.flatMap(mode=>['wrap','wrap-reverse'].map(wrap=>[...mode,wrap]));
 const originals=cases.map(([writing,direction,textDirection,wrap],i)=>{
  const source=`<html><head></head><body><main style="display:flex;flex-direction:${direction};writing-mode:${writing};direction:${textDirection};flex-wrap:${wrap};width:250px;height:250px"><div style="width:100px;height:100px;flex:none">One</div><div style="width:100px;height:100px;flex:none">Two</div><div style="width:100px;height:100px;flex:none">Three</div><div style="width:100px;height:100px;flex:none">Four</div></main></body></html>`;
  fs.writeFileSync(path.join(root,`case-${i}.html`),source);return source;
 });
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');
 const browser=await browserType.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const app=page.frameLocator('#app');
 const wait=async fn=>{for(let i=0;i<100;i++){try{if(await fn())return;}catch(error){if(!/Execution context was destroyed/.test(error.message))throw error;}await page.waitForTimeout(100);}throw Error('Timed out waiting for layout');};
 const settled=()=>wait(async()=>await page.locator('#panelBody').getAttribute('aria-busy')!=='true');
 try{
  for(const [index,[writing,direction,textDirection,wrap]]of cases.entries()){
   const file=path.join(root,`case-${index}.html`),read=()=>fs.readFileSync(file,'utf8');
   await page.goto(`http://localhost:${server.address().port}/rt/case-${index}.html`);
   await page.getByRole('treeitem',{name:'main',exact:true}).click();await settled();
   for(const corner of ['top left','bottom right']){
    await page.getByRole('button',{name:'Align children '+corner,exact:true}).click();await settled();
    await wait(async()=>await app.locator('main').evaluate((el,corner)=>{const p=el.getBoundingClientRect(),boxes=[...el.children].map(c=>c.getBoundingClientRect());return corner==='top left'?Math.abs(Math.min(...boxes.map(b=>b.left))-p.left)<1&&Math.abs(Math.min(...boxes.map(b=>b.top))-p.top)<1:Math.abs(Math.max(...boxes.map(b=>b.right))-p.right)<1&&Math.abs(Math.max(...boxes.map(b=>b.bottom))-p.bottom)<1;},corner));
    const boxes=await app.locator('main > div').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top};}));assert.equal(new Set(boxes.map(b=>b.left)).size,2,'two columns');assert.equal(new Set(boxes.map(b=>b.top)).size,2,'two rows');
    if(index===0&&process.env.RT_E2E_WRAP_SCREENSHOT)await page.screenshot({path:process.env.RT_E2E_WRAP_SCREENSHOT});
    await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===originals[index]);
   }
   await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await wait(async()=>await app.locator('body').evaluate(()=>innerWidth)===768);await page.getByLabel('Style screen scope').selectOption('min-[768px]:');
   await page.getByLabel('Child wrapping',{exact:true}).selectOption('nowrap');await wait(async()=>await app.locator('main').evaluate(el=>getComputedStyle(el).flexWrap)==='nowrap');await settled();
   await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await wait(async()=>await app.locator('body').evaluate(()=>innerWidth)===390);await wait(async()=>await app.locator('main').evaluate(el=>getComputedStyle(el).flexWrap)===wrap);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===originals[index]);
  }
  assert.deepEqual(errors,[]);console.log(engine+': PASS 12 normal/reverse wrapping geometries, RTL/vertical axes, screen-scoped wrapping and exact undo');
 }finally{await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
