'use strict';
// Run against a disposable copy of test/fixtures/inspector, with dependencies
// installed and `retouch -- npm run dev -- --port 3491` running in that copy.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = process.env.RT_INSPECTOR_FIXTURE;
if (!root) throw new Error('RT_INSPECTOR_FIXTURE must name the disposable inspector fixture.');
const { chromium } = require(path.join(root,'node_modules/playwright'));
const file = path.join(root,'app/page.jsx');
const original = fs.readFileSync(file,'utf8');
const url = process.env.RT_E2E_URL || 'http://localhost:3491';
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn, label) { for(let i=0;i<100;i++){if(await fn())return;await sleep(100);}throw new Error('Timed out: '+label); }
const read = () => fs.readFileSync(file,'utf8');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1320,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ops=[];page.on('response',async r=>{if(r.url().endsWith('/rt/__api/op')){try{ops.push({request:r.request().postDataJSON(),response:await r.json()});}catch{}}});
 const frame=page.frameLocator('#app');
 const select=async selector=>{
   const target=frame.locator(selector);await target.click();
   await page.waitForFunction(()=>document.querySelector('#panelBody').getAttribute('aria-busy')==='false');
   await page.getByRole('combobox',{name:'Positioning',exact:true}).waitFor();
   if(await target.getAttribute('contenteditable')==='true')await target.press('Escape');
 };
 const css=(selector,prop)=>frame.locator(selector).evaluate((el,p)=>getComputedStyle(el)[p],prop);
 const rect=selector=>frame.locator(selector).evaluate(el=>el.getBoundingClientRect().toJSON());
 async function reset() {
   if(read()!==original){fs.writeFileSync(file,original);await sleep(400);}
   await page.goto(url+'/rt');await frame.locator('#anchor-target').waitFor();
 }
 try {
   await reset();
   const panel=await page.locator('#panel').boundingBox(), app=await page.locator('#app').boundingBox();
   assert.ok(app.x+app.width<=panel.x+1,'inspector is on the right');
   await select('#anchor-target');
   const before=await rect('#anchor-target');
   await page.getByLabel('Positioning',{exact:true}).selectOption('absolute');
   await until(async()=>await css('#anchor-target','position')==='absolute','absolute CSS');
   const after=await rect('#anchor-target');
   for(const key of ['x','y','width','height'])assert.ok(Math.abs(before[key]-after[key])<1,`absolute preserves ${key}`);
   assert.match(read(),/md:opacity-90/);
   await select('#anchor-target');
   await page.getByLabel('Horizontal anchor',{exact:true}).selectOption('end');
   await until(()=>/right-\[[\d.]+px\]/.test(read()),'right anchor source');
   const authoredRight=Number(/right-\[([\d.]+)px\]/.exec(read())[1]);
   await until(async()=>{const c=await rect('#anchor-target'),p=await rect('#anchor-parent');return Math.abs(p.right-c.right-authoredRight)<1;},'right anchor CSS before measuring resize');
   let child=await rect('#anchor-target'), parent=await rect('#anchor-parent');
   const right=parent.right-child.right;
   await page.setViewportSize({width:1520,height:900});
   await until(async()=>{const c=await rect('#anchor-target'),p=await rect('#anchor-parent');return Math.abs(p.right-c.right-right)<1;},'right anchor compiled and follows resize');
   child=await rect('#anchor-target');parent=await rect('#anchor-parent');
   assert.ok(Math.abs(parent.right-child.right-right)<1,'right anchor follows container resize');
   await select('#anchor-target');
   await page.getByLabel('Horizontal anchor',{exact:true}).selectOption('center');
   await until(()=>read().includes('left-[calc(50%'),'center source');
   await sleep(500);
   child=await rect('#anchor-target');parent=await rect('#anchor-parent');
   const center=child.x+child.width/2-(parent.x+parent.width/2);
   await page.setViewportSize({width:1320,height:900});
   await until(async()=>{const c=await rect('#anchor-target'),p=await rect('#anchor-parent');return Math.abs(c.x+c.width/2-(p.x+p.width/2)-center)<1;},'center anchor after canvas resize');
   child=await rect('#anchor-target');parent=await rect('#anchor-parent');
   assert.ok(Math.abs(child.x+child.width/2-(parent.x+parent.width/2)-center)<1,'center anchor follows resize');
   await select('#anchor-target');
   await page.getByLabel('Horizontal anchor',{exact:true}).selectOption('stretch');
   await until(()=>read().includes('w-auto'),'stretch source');await sleep(500);
   const width=(await rect('#anchor-target')).width;
   await page.setViewportSize({width:1420,height:900});
   await until(async()=>Math.abs((await rect('#anchor-target')).width-width-100)<1,'stretch after canvas resize');
   assert.ok(Math.abs((await rect('#anchor-target')).width-width-100)<1,'both edges stretch with parent');
   await page.screenshot({path:'/tmp/retouch-inspector-anchors.png'});
   for(let n=0;n<4;n++) {const prior=read();await page.getByRole('button',{name:'Undo',exact:true}).click();await until(()=>read()!==prior,'undo source');await frame.locator('#anchor-target').waitFor();}
   assert.equal(read(),original,'anchor undo restores exact bytes');
   console.log('PASS right panel, absolute bounds, right/center/stretch anchors, resize, preserved variants, exact undo');

   await reset();await select('h1');
   await page.getByLabel('Typography class',{exact:true}).selectOption('type-caption');
   await until(async()=>await css('h1','fontSize')==='14px','typography computed size');
   assert.match(read(),/className="mb-4 type-caption"/);assert.match(read(),/<h1 /,'class swap preserves HTML semantics');
   await select('h1');
   const preview=page.frameLocator('iframe[title="Typography preview"]');
   await preview.locator('body div').waitFor();
   assert.equal(await preview.locator('body div').evaluate(el=>getComputedStyle(el).fontSize),'14px');
   await page.getByLabel('Opacity (%)',{exact:true}).fill('45');
   await page.getByLabel('Opacity (%)',{exact:true}).press('Tab');
   await until(async()=>await css('h1','opacity')==='0.45','opacity CSS');
   await page.getByRole('button',{name:'Choose fill',exact:true}).click();
   await page.getByLabel('Fill hex color',{exact:true}).fill('#123abc');
   await page.getByLabel('Fill hex color',{exact:true}).press('Enter');
   await until(async()=>await css('h1','backgroundColor')==='rgb(18, 58, 188)','fill CSS');
   await page.getByRole('button',{name:'Choose text color',exact:true}).click();
   await page.getByLabel('Text hex color',{exact:true}).fill('#efabcd');
   await page.getByLabel('Text hex color',{exact:true}).press('Enter');
   await until(async()=>await css('h1','color')==='rgb(239, 171, 205)','text color CSS');
   await page.getByLabel('Shadow preset',{exact:true}).selectOption('shadow-lg');
   await until(async()=>await css('h1','boxShadow')!=='none','shadow preset CSS');
   await page.getByLabel('Shadow Blur',{exact:true}).fill('18');await page.getByLabel('Shadow Blur',{exact:true}).press('Tab');
   await page.getByRole('button',{name:'Apply custom shadow',exact:true}).click();
   await until(async()=>String(await css('h1','boxShadow')).includes('18px'),'custom shadow CSS');
   assert.match(read(),/shadow-\[0px_4px_18px_0px_#00000033\]/);
   await page.screenshot({path:'/tmp/retouch-inspector-appearance.png'});
   await page.reload();await frame.locator('h1').waitFor();
   assert.equal(await css('h1','fontSize'),'14px');assert.equal(await css('h1','opacity'),'0.45');
   assert.equal(await css('h1','color'),'rgb(239, 171, 205)');assert.equal(await css('h1','backgroundColor'),'rgb(18, 58, 188)');
   assert.match(await css('h1','boxShadow'),/18px/,'saved appearance survives a full reload');
   console.log('PASS project typography class swap and preview, opacity, fill, text color, preset and custom shadows');

   await reset();await select('#anchor-target');
   await page.keyboard.down('Alt');await frame.locator('#spacing-target').hover();
   await page.locator('.measure-padding').first().waitFor();
   assert.ok((await page.locator('.measure-line').allTextContents()).includes('32 px'),'sibling gap is measured');
   assert.ok((await page.locator('.measure-line.padding').allTextContents()).includes('Padding 20'),'padding is measured');
   await page.screenshot({path:'/tmp/retouch-inspector-measure.png'});
   await page.keyboard.up('Alt');await until(async()=>await page.locator('.measure-line').count()===0,'measurement dismissal');
   assert.equal(read(),original,'measurement never writes');
   console.log('PASS real Alt+hover padding and sibling spacing, release cleanup, no source write');

   await select('#swap-image');
   await page.getByRole('button',{name:'Browse project images',exact:true}).click();
   await page.getByRole('button',{name:'second.svg',exact:true}).click();
   await until(async()=>String(await frame.locator('#swap-image').getAttribute('src')).includes('/second.svg'),'image replacement');
   assert.match(read(),/src="\/second.svg"/);
   assert.equal(await frame.locator('#swap-image').evaluate(el=>el.complete&&el.naturalWidth>0),true);
   await page.getByRole('button',{name:'Undo',exact:true}).click();
   await until(()=>read()===original,'image undo');
   await until(async()=>!await page.getByRole('button',{name:'Undo',exact:true}).isDisabled(),'image undo refreshed');
   await select('#swap-image');
   await page.locator('#panel input[type="file"]').setInputFiles({name:'upload.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="red"/></svg>')});
   await until(async()=>String(await frame.locator('#swap-image').getAttribute('src')).startsWith('/rt-assets/'),'uploaded image rendered');
   const uploaded=await frame.locator('#swap-image').getAttribute('src');assert.ok(fs.existsSync(path.join(root,'public',uploaded)));
   await until(async()=>await frame.locator('#swap-image').evaluate(el=>el.complete&&el.naturalWidth===120),'uploaded image loaded');
   await page.getByRole('button',{name:'Undo',exact:true}).click();await until(()=>read()===original,'upload swap undo');
   fs.unlinkSync(path.join(root,'public',uploaded));
   assert.deepEqual(errors,[]);
   console.log('PASS project image swap and upload, actual images loaded, exact undo, no browser errors');
 } catch(e) { console.error('Browser errors:',errors,'Status:',await page.locator('#status').textContent(),'Ops:',JSON.stringify(ops));console.error('Server image:',(await (await fetch(url)).text()).match(/id="swap-image"[^>]+/g));await page.screenshot({path:'/tmp/retouch-inspector-failure.png'});throw e; }
 finally {fs.writeFileSync(file,original);await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
