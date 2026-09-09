'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Playwright');
const {chromium}=require(path.join(fixture,'node_modules/playwright'));
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-flex-writing-'));
 const cases=[['horizontal-tb','row','width','height'],['horizontal-tb','column','height','width'],['vertical-rl','row','height','width'],['vertical-lr','column','width','height'],['vertical-rl','row-reverse','height','width'],['vertical-rl','column-reverse','width','height']];
 const originals=cases.map(([writing,direction],i)=>{
  const source=`<html><head></head><body><main style="display:flex;flex-direction:${direction};writing-mode:${writing};align-items:flex-start;width:600px;height:600px"><div style="width:100px;height:40px">Text</div><div style="width:100px;height:40px">Sibling</div></main></body></html>`;
  fs.writeFileSync(path.join(root,`case-${i}.html`),source);return source;
 });
 const server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const app=page.frameLocator('#app');
 const wait=async fn=>{for(let i=0;i<100;i++){try{if(await fn())return;}catch(error){if(!/Execution context was destroyed/.test(error.message))throw error;}await page.waitForTimeout(100);}throw Error('Timed out waiting for layout');};
 const settled=()=>wait(async()=>await page.locator('#panelBody').getAttribute('aria-busy')!=='true');
 try{
  for(const [index,[writing,direction,axis,cross]]of cases.entries()){
   const file=path.join(root,`case-${index}.html`),read=()=>fs.readFileSync(file,'utf8');
   await page.goto(`http://localhost:${server.address().port}/rt/case-${index}.html`);
   await page.getByRole('treeitem',{name:'div · Text',exact:true}).click();
   const layer=app.locator('main > div').first(),crossBefore=await layer.evaluate((el,axis)=>el.getBoundingClientRect()[axis],cross);
   await page.getByRole('button',{name:'Fill available space',exact:true}).click();
   await wait(async()=>await layer.evaluate(el=>getComputedStyle(el).flexGrow)==='1');await settled();
   const filled=read(),fillSize=await layer.evaluate((el,axis)=>el.getBoundingClientRect()[axis],axis);
   assert.ok(fillSize>400,`${writing} ${direction}: fills ${axis}`);
   assert.equal(await layer.evaluate((el,axis)=>el.getBoundingClientRect()[axis],cross),crossBefore,'cross dimension retained');
   assert.ok(filled.includes(`${axis}:auto !important`));assert.ok(!filled.includes(`${cross}:auto !important`));
   await page.getByRole('button',{name:'Hug contents',exact:true}).click();
   await wait(async()=>await layer.evaluate(el=>getComputedStyle(el).flexGrow)==='0');await settled();
   assert.ok(await layer.evaluate((el,axis)=>el.getBoundingClientRect()[axis],axis)<fillSize,'hug follows content along main axis');
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===filled);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(()=>read()===originals[index]);
  }
  assert.deepEqual(errors,[]);console.log('PASS horizontal, vertical and reversed flex fill/hug dimensions, cross-size preservation and exact one-step undo');
 }finally{await browser.close();server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
