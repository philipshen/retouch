'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Next.js, Tailwind and Playwright');
const writingMode=process.env.RT_E2E_WRITING_MODE||'horizontal-tb',textDirection=process.env.RT_E2E_DIRECTION||'ltr';
if(!['horizontal-tb','vertical-rl','vertical-lr','sideways-rl','sideways-lr'].includes(writingMode)||!['ltr','rtl'].includes(textDirection))throw Error('Unsupported writing direction');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-layout-mode-')),file=path.join(root,'app/page.jsx');fs.mkdirSync(path.dirname(file));fs.symlinkSync(path.join(fixture,'node_modules'),path.join(root,'node_modules'),'dir');
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({private:true,dependencies:{next:'16.2.5',react:'19.2.0','react-dom':'19.2.0',tailwindcss:'4.1.13','@tailwindcss/postcss':'4.1.13'}}));
 fs.writeFileSync(path.join(root,'postcss.config.mjs'),"export default {plugins:{'@tailwindcss/postcss':{}}}");fs.writeFileSync(path.join(root,'app/style.css'),'@import "tailwindcss";');
 fs.writeFileSync(path.join(root,'app/layout.jsx'),"import './style.css';export default function Layout({children}){return <html><body>{children}</body></html>}");
 const original='"use client";export default function Page(){return <main><section id="layout" className="!block sm:!rounded-[20px] sm:!overflow-x-hidden sm:!overflow-y-auto sm:!grid sm:![flex-flow:column_wrap] sm:!place-items-end sm:!place-content-end sm:![grid-template-columns:40px_40px] sm:![grid-template-rows:40px_40px] md:[display:grid] md:grid-cols-2 w-[400px] h-[300px] gap-[10px]"><div className="w-[40px] h-[40px]">One</div><div className="w-[40px] h-[40px]">Two</div></section><p id="sample" className="sm:!border-[2px] sm:!border-dashed text-[20px] leading-[28px]">Design with intention</p></main>}';fs.writeFileSync(file,original.replace('className="!block','className="[writing-mode:'+writingMode+'] [direction:'+textDirection+'] !block'));const read=()=>fs.readFileSync(file,'utf8');
 let logs='',url,browser,exited=false;const child=spawn(process.execPath,[path.resolve(__dirname,'../../bin/retouch.cjs'),'--',process.execPath,path.join(fixture,'node_modules/next/dist/bin/next'),'dev','--webpack','-p','0'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']}),stopped=new Promise(resolve=>child.once('exit',()=>{exited=true;resolve();}));for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{logs+=chunk;url=logs.match(/http:\/\/localhost:(\d+)/)?.[0];});
 const wait=async fn=>{for(let i=0;i<300;i++){try{if(await fn())return;}catch(error){if(!/ECONNREFUSED|fetch failed|Execution context was destroyed/.test(error.message))throw error;}if(exited)throw Error(logs);await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Timed out: '+logs.slice(-3000));};
 try{
  await wait(()=>url);await wait(async()=>(await fetch(url+'/rt/__api/health')).ok);browser=await browserType.launch();const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(url+'/rt',{timeout:90000});const parent=page.frameLocator('#app').locator('#layout');await parent.waitFor({timeout:90000});const settled=()=>page.waitForFunction(()=>!panelTasks&&!sourceRequests&&!undoBusy);
  await page.getByLabel('Screen size',{exact:true}).focus();await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await page.getByRole('treeitem',{name:'section · layout',exact:true}).click();const mode=page.getByLabel('Arrange children',{exact:true});await mode.waitFor();await settled();await page.getByLabel('Style screen scope',{exact:true}).selectOption('md:');await settled();
  assert.equal(await page.getByLabel('Style screen scope',{exact:true}).locator('option:checked').textContent(),'768 px and larger · md');
  const rangeStatus=page.getByRole('status',{name:'Edit range status',exact:true});assert.equal(await rangeStatus.getAttribute('data-match'),'true');
  const beforePreview=read();await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await settled();
  await wait(async()=>await rangeStatus.getAttribute('data-match')==='false');assert.equal(await rangeStatus.isVisible(),true);
  const previewBreakpoint=page.getByRole('button',{name:'Preview this breakpoint',exact:true});assert.equal(await previewBreakpoint.isVisible(),true);
  await previewBreakpoint.click();await settled();await wait(async()=>await rangeStatus.getAttribute('data-match')==='true');assert.equal(read(),beforePreview);
  await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();
  await page.evaluate(()=>document.fonts.ready);assert.equal(await page.evaluate(()=>[...document.fonts].some(font=>font.family==='Inter'&&font.status==='loaded')),true);
  const originalSource=read();
  if(process.env.RT_E2E_NUMERIC_SCRUB){
   let field=page.getByLabel('Corner radius (px)',{exact:true});
   const scrub=async(delta,modifier,cancel=false,during=null)=>{await wait(async()=>{try{await field.scrollIntoViewIfNeeded();return true;}catch(error){if(/not attached/.test(error.message))return false;throw error;}});const label=field.locator('xpath=..').locator('[data-numeric-scrub]'),box=await label.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);if(modifier)await page.keyboard.down(modifier);await page.mouse.down();await page.mouse.move(box.x+box.width/2+delta,box.y+box.height/2,{steps:3});assert.equal(read(),originalSource,'drag does not write source');if(await field.getAttribute('aria-label')==='Opacity (%)')assert.equal(await parent.evaluate(el=>Number(getComputedStyle(el).opacity)),await rangeStatus.getAttribute('data-match')==='false'?1:Number(await field.inputValue())/100);if(during)await during();if(cancel)await page.keyboard.press(typeof cancel==='string'?cancel:'Escape');await page.mouse.up();if(modifier)await page.keyboard.up(modifier);};
   for(const [delta,modifier,expected] of [[12,null,32],[3,'Shift',50],[15,'Alt',21.5],[-100,null,0]]){
    assert.equal(Number(await field.inputValue()),20);await scrub(delta,modifier);await wait(()=>read()!==originalSource);await settled();await wait(async()=>parent.evaluate((el,n)=>parseFloat(getComputedStyle(el).borderTopLeftRadius)===n,expected));assert.match(read(),/md:!rounded-/);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),originalSource,'one undo restores entire drag');
   }
   for(const cancellation of [true,'Tab']){await scrub(15,null,cancellation);assert.equal(await field.inputValue(),'20');assert.equal(read(),originalSource);}await scrub(0,null);assert.equal(read(),originalSource);await field.fill('27');await field.press('Tab');await wait(()=>read()!==originalSource);await settled();await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),originalSource);field=page.getByLabel('Opacity (%)',{exact:true});const initialStyle=await parent.getAttribute('style');
   await scrub(-25,null,true);assert.equal(await parent.evaluate(el=>getComputedStyle(el).opacity),'1');assert.equal(await parent.getAttribute('style'),initialStyle);assert.equal(read(),originalSource);
   await scrub(-25,null,true,()=>parent.evaluate(el=>el.style.setProperty('--runtime-preview-check','retained')));assert.equal(await parent.evaluate(el=>el.style.getPropertyValue('--runtime-preview-check')),'retained');assert.equal(await parent.evaluate(el=>el.style.getPropertyValue('opacity')),'');await parent.evaluate((el,style)=>{if(style===null)el.removeAttribute('style');else el.setAttribute('style',style);},initialStyle);
   await page.getByLabel('Screen size',{exact:true}).focus();await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await settled();await wait(async()=>await rangeStatus.getAttribute('data-match')==='false');await scrub(-25,null,true);assert.equal(read(),originalSource);assert.equal(await parent.getAttribute('style'),initialStyle);await page.getByLabel('Screen size',{exact:true}).focus();await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();await wait(async()=>await rangeStatus.getAttribute('data-match')==='true');
   await scrub(-25,null,false,async()=>{await field.evaluate(el=>el.parentElement.remove());await wait(async()=>parent.evaluate(el=>getComputedStyle(el).opacity==='1'));});assert.equal(read(),originalSource);assert.equal(await parent.getAttribute('style'),initialStyle);await page.evaluate(()=>renderPanel());await settled();
   await scrub(-25,null);await wait(()=>read()!==originalSource);await settled();await wait(async()=>parent.evaluate(el=>getComputedStyle(el).opacity==='0.75'));assert.equal(await parent.getAttribute('style'),initialStyle);await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),originalSource);await wait(async()=>parent.evaluate(el=>getComputedStyle(el).opacity==='1'));
   assert.deepEqual(errors,[]);console.log(engine+': PASS inspector numeric label dragging, modifiers, lower bound, draft cancellation, responsive source, single undo, direct typing and live opacity preview');return;
  }
  assert.equal(await page.locator('#panel').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
  assert.equal(await page.locator('#frameWrap').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(229, 229, 229)');
  assert.deepEqual(await page.locator('#panelBody > .inspector-section > h3').allTextContents(),['Position','Layout','Appearance','Fill','Stroke','Effects']);
  await page.getByRole('button',{name:'Horizontal layout',exact:true}).click();await settled();await wait(async()=>parent.evaluate(el=>getComputedStyle(el).display==='flex'&&getComputedStyle(el).flexDirection===(getComputedStyle(el).writingMode==='horizontal-tb'?'row':'column')));assert.equal(await page.getByRole('button',{name:'Horizontal layout',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),originalSource);
  const clipping=page.getByLabel('Clip content',{exact:true});assert.equal(await clipping.evaluate(el=>el.indeterminate),true);
  await clipping.check();await settled();await wait(async()=>parent.evaluate(el=>getComputedStyle(el).overflowX==='clip'&&getComputedStyle(el).overflowY==='clip'));assert.match(read(),/md:!overflow-clip/);
  await clipping.uncheck();await settled();await wait(async()=>parent.evaluate(el=>getComputedStyle(el).overflowX==='visible'&&getComputedStyle(el).overflowY==='visible'));
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(await clipping.isChecked(),true);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),originalSource);assert.equal(await clipping.evaluate(el=>el.indeterminate),true);
  await page.getByRole('button',{name:'Vertical layout',exact:true}).click();await settled();
  await wait(async()=>parent.evaluate(el=>getComputedStyle(el).display==='flex'&&getComputedStyle(el).flexDirection===(getComputedStyle(el).writingMode==='horizontal-tb'?'column':'row')));
  assert.equal(await page.getByRole('button',{name:'Vertical layout',exact:true}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),originalSource);
  for(const direction of ['row','column','row-reverse','column-reverse']){
   await page.getByLabel('Arrange children',{exact:true}).selectOption(direction);await settled();const beforeAlignment=read();
   for(const corner of ['top left','bottom right']){
    await page.getByRole('button',{name:'Align children '+corner,exact:true}).click();await settled();
    await wait(async()=>parent.evaluate((el,corner)=>{const p=el.getBoundingClientRect(),r=[...el.children].map(child=>child.getBoundingClientRect());return corner==='top left'?Math.abs(Math.min(...r.map(r=>r.left))-p.left)<1&&Math.abs(Math.min(...r.map(r=>r.top))-p.top)<1:Math.abs(Math.max(...r.map(r=>r.right))-p.right)<1&&Math.abs(Math.max(...r.map(r=>r.bottom))-p.bottom)<1;},corner));
    assert.equal(await page.getByRole('button',{name:'Align children '+corner,exact:true}).getAttribute('aria-pressed'),'true');
    if(direction==='row'&&corner==='bottom right'){await page.locator('#panel').evaluate(panel=>{panel.scrollTop+=panel.querySelector('[data-section=layout]').getBoundingClientRect().top-panel.getBoundingClientRect().top-48;});await page.locator('#panel').screenshot({path:'/private/tmp/retouch-figma-alignment-'+engine+'.png'});}
    await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),beforeAlignment);
   }
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),originalSource);
  }
  const opacity=page.getByLabel('Opacity (%)',{exact:true});await opacity.fill('75');await opacity.press('Tab');await settled();await wait(async()=>parent.evaluate(el=>getComputedStyle(el).opacity==='0.75'));
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),originalSource);
  await page.getByText('Individual corners',{exact:true}).click();
  const corner=page.getByLabel('Top left radius (px)',{exact:true});await corner.fill('12');await corner.press('Tab');await settled();
  await wait(async()=>parent.evaluate(el=>getComputedStyle(el).borderTopLeftRadius==='12px'&&getComputedStyle(el).borderTopRightRadius==='20px'));
  await page.getByRole('button',{name:'Reset top left radius',exact:true}).click();await settled();await wait(async()=>parent.evaluate(el=>getComputedStyle(el).borderTopLeftRadius==='20px'));
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(async()=>parent.evaluate(el=>getComputedStyle(el).borderTopLeftRadius==='12px'));
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),originalSource);
  const sharedRadius=page.getByLabel('Corner radius (px)',{exact:true});await sharedRadius.fill('6');await sharedRadius.press('Tab');await settled();
  await wait(async()=>parent.evaluate(el=>['borderTopLeftRadius','borderTopRightRadius','borderBottomLeftRadius','borderBottomRightRadius'].every(property=>getComputedStyle(el)[property]==='6px')));
  await page.getByRole('button',{name:'Reset corner radius',exact:true}).click();await settled();await wait(async()=>parent.evaluate(el=>getComputedStyle(el).borderTopLeftRadius==='20px'));
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();await wait(async()=>parent.evaluate(el=>getComputedStyle(el).borderTopLeftRadius==='6px'));
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),originalSource);
  await page.locator('#panel').evaluate(panel=>{panel.scrollTop+=panel.querySelector('[data-section=appearance]').getBoundingClientRect().top-panel.getBoundingClientRect().top-48;});await page.locator('#panel').screenshot({path:'/private/tmp/retouch-corners-'+engine+'.png'});
  await page.getByText('Layer actions',{exact:true}).click();assert.equal(await page.getByRole('button',{name:'Lock selection',exact:true}).isVisible(),true);await page.getByText('Layer actions',{exact:true}).click();
  await page.locator('#panel').evaluate(el=>el.scrollTop=0);
  assert.deepEqual(errors,[]);await page.screenshot({path:process.env.RT_UI_SCREENSHOT||'/private/tmp/retouch-figma-light-'+engine+'.png',fullPage:true});await page.locator('#panel').evaluate(panel=>{panel.scrollTop+=panel.querySelector('[data-section=appearance]').getBoundingClientRect().top-panel.getBoundingClientRect().top-48;});await page.locator('#panel').screenshot({path:'/private/tmp/retouch-figma-paint-'+engine+'.png'});await page.getByRole('treeitem',{name:'p · sample',exact:true}).click();await settled();
  const textElement=page.frameLocator('#app').locator('#sample'),beforeStroke=read();
  const strokeWidth=page.getByLabel('Border width (px)',{exact:true});await strokeWidth.fill('6');await strokeWidth.press('Tab');await settled();await wait(async()=>textElement.evaluate(el=>getComputedStyle(el).borderTopWidth==='6px'&&getComputedStyle(el).borderTopStyle==='dashed'));
  await page.getByRole('button',{name:'Reset border width',exact:true}).click();await settled();await wait(async()=>textElement.evaluate(el=>getComputedStyle(el).borderTopWidth==='2px'));
  for(let i=0;i<2;i++){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();}assert.equal(read(),beforeStroke);
  await page.getByLabel('Border style',{exact:true}).selectOption('solid');await settled();await wait(async()=>textElement.evaluate(el=>getComputedStyle(el).borderTopStyle==='solid'&&getComputedStyle(el).borderTopWidth==='2px'));
  await page.getByRole('button',{name:'Reset border style',exact:true}).click();await settled();await wait(async()=>textElement.evaluate(el=>getComputedStyle(el).borderTopStyle==='dashed'));
  for(let i=0;i<2;i++){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();}assert.equal(read(),beforeStroke);
  const type=page.locator('[data-section="typography"]');await type.waitFor();
  assert.equal(await type.locator('.type-preview').isVisible(),false);
  assert.equal(await page.getByRole('button',{name:'Apply text',exact:true}).isVisible(),false);
  await page.getByText('Text content',{exact:true}).click();assert.equal(await page.getByRole('button',{name:'Apply text',exact:true}).isVisible(),true);await page.getByText('Text content',{exact:true}).click();
  assert.equal(await page.getByLabel('Font size (px)',{exact:true}).locator('xpath=ancestor::*[contains(@class,"property-pair")]').count(),1);
  await page.getByRole('button',{name:'Align text center',exact:true}).click();await settled();
  await wait(async()=>page.frameLocator('#app').locator('#sample').evaluate(el=>getComputedStyle(el).textAlign==='center'));
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),originalSource);
  await page.locator('#panel').evaluate(panel=>{panel.scrollTop+=panel.querySelector('[data-section=typography]').getBoundingClientRect().top-panel.getBoundingClientRect().top-48;});
  await page.locator('#panel').screenshot({path:'/private/tmp/retouch-figma-type-'+engine+'.png'});assert.deepEqual(errors,[]);
  console.log(engine+' '+writingMode+' '+textDirection+': PASS light workspace, section order, segmented layout edits, opacity edits, exact undo, layer actions and screenshot');
 }finally{if(browser)await browser.close();if(!exited)child.kill('SIGTERM');await stopped;fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
