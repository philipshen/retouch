'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Next.js, Tailwind and Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-layout-padding-')),file=path.join(root,'app/page.jsx');fs.mkdirSync(path.dirname(file));fs.symlinkSync(path.join(fixture,'node_modules'),path.join(root,'node_modules'),'dir');
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({private:true,dependencies:{next:'16.2.5',react:'19.2.0','react-dom':'19.2.0',tailwindcss:'4.1.13','@tailwindcss/postcss':'4.1.13'}}));
 fs.writeFileSync(path.join(root,'postcss.config.mjs'),"export default {plugins:{'@tailwindcss/postcss':{}}}");fs.writeFileSync(path.join(root,'app/style.css'),'@import "tailwindcss";');
 fs.writeFileSync(path.join(root,'app/layout.jsx'),"import './style.css';export default function Layout({children}){return <html><body>{children}</body></html>}");
 const logical=process.env.RT_E2E_LOGICAL_PADDING||'',writingMode=logical==='rtl'?'horizontal-tb':logical||'horizontal-tb',direction=logical==='rtl'?'rtl':'ltr';
 const inheritedClasses=logical?'sm:!ps-[12px] sm:![padding-inline-end:16px] sm:![padding-block:18px_22px]':'sm:![padding:12px_16px]';
 const basePadding=logical?'p-[10px]':'!p-[10px]';
 const original='"use client";export default function Page(){return <main><section id="layout" className="'+basePadding+' '+inheritedClasses+' md:[padding-left:20px] w-[400px] h-[300px] [writing-mode:'+writingMode+'] [direction:'+direction+']"><div>Content</div></section></main>}';fs.writeFileSync(file,original);const read=()=>fs.readFileSync(file,'utf8');
 let logs='',url,browser,exited=false;const child=spawn(process.execPath,[path.resolve(__dirname,'../../bin/retouch.cjs'),'--',process.execPath,path.join(fixture,'node_modules/next/dist/bin/next'),'dev','--webpack','-p','0'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']}),stopped=new Promise(resolve=>child.once('exit',()=>{exited=true;resolve();}));for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{logs+=chunk;url=logs.match(/http:\/\/localhost:(\d+)/)?.[0];});
 const wait=async fn=>{for(let i=0;i<300;i++){try{if(await fn())return;}catch(error){if(!/ECONNREFUSED|fetch failed|Execution context was destroyed/.test(error.message))throw error;}if(exited)throw Error(logs);await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Timed out: '+logs.slice(-3000));};
 try{
  await wait(()=>url);await wait(async()=>(await fetch(url+'/rt/__api/health')).ok);browser=await browserType.launch();const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(url+'/rt',{timeout:90000});const parent=page.frameLocator('#app').locator('#layout');await parent.waitFor({timeout:90000});const settled=()=>page.waitForFunction(()=>!panelTasks&&!sourceRequests&&!undoBusy);
  await page.getByLabel('Screen size',{exact:true}).focus();await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await page.getByRole('treeitem',{name:'section · layout',exact:true}).click();const mode=page.getByLabel('Arrange children',{exact:true});await mode.waitFor();await settled();await page.getByLabel('Style screen scope',{exact:true}).selectOption('md:');await settled();
  const snapshot=()=>parent.evaluate(el=>{const css=getComputedStyle(el);return ['Top','Right','Bottom','Left'].map(side=>parseFloat(css['padding'+side]));});
  const initial=logical==='rtl'?[18,12,22,16]:logical==='vertical-rl'?[12,18,16,22]:logical==='sideways-lr'?[16,22,12,18]:[12,16,12,16];assert.deepEqual(await snapshot(),initial);
  const units=process.env.RT_E2E_PADDING_UNITS||'px',sharedValue=units==='rem'?'1.5rem':units==='%'?'3.125%':'24',edgeValue=units==='rem'?'1.875rem':units==='%'?'6.25%':'30',edgePixels=units==='%'?48:30;
  const shared=page.getByLabel('Padding',{exact:true});assert.equal(await shared.inputValue(),'');assert.equal(await shared.getAttribute('placeholder'),'Mixed');assert.equal(await page.getByLabel('Padding top',{exact:true}).isVisible(),false);
  await shared.fill('24');await shared.press('Escape');await settled();assert.equal(read(),original);assert.equal(await shared.inputValue(),'');
  await shared.fill('-1');await shared.press('Enter');await settled();assert.equal(read(),original);assert.equal(await shared.evaluate(el=>el.checkValidity()),false);await shared.press('Escape');assert.equal(await shared.evaluate(el=>el.checkValidity()),true);
  await shared.fill(sharedValue);await shared.press('Enter');await settled();await wait(async()=>JSON.stringify(await snapshot())==='[24,24,24,24]');const uniform=read();assert.equal(await shared.inputValue(),sharedValue);
  await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await settled();await wait(async()=>JSON.stringify(await snapshot())==='[10,10,10,10]');
  await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();await wait(async()=>JSON.stringify(await snapshot())==='[24,24,24,24]');
  const resetAll=page.getByRole('button',{name:'Reset padding',exact:true});assert.equal(await resetAll.isEnabled(),true);await resetAll.click();await settled();await wait(async()=>JSON.stringify(await snapshot())===JSON.stringify(initial));const resetAllSource=read();assert.equal(await resetAll.isEnabled(),false);assert.ok(!resetAllSource.includes('md:[padding-left:20px]'));assert.ok(resetAllSource.includes(basePadding+' '+inheritedClasses));
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),uniform);await wait(async()=>JSON.stringify(await snapshot())==='[24,24,24,24]');
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();assert.equal(read(),resetAllSource);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),uniform);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),original);assert.deepEqual(await snapshot(),initial);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();assert.equal(read(),uniform);assert.deepEqual(await snapshot(),[24,24,24,24]);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),original);
  await page.getByText('Individual padding',{exact:true}).click();
  for(const [index,edge] of ['top','right','bottom','left'].entries()){
   const before=read(),input=page.getByLabel('Padding '+edge,{exact:true}),reset=page.getByRole('button',{name:'Reset padding '+edge,exact:true});
   assert.equal(await reset.isDisabled(),edge!=='left');
   await input.fill('45');await input.press('Escape');await settled();assert.equal(read(),before);
   await input.fill(edgeValue);await input.press('Enter');await settled();const expected=initial.map((v,i)=>i===index?edgePixels:v);
   await wait(async()=>JSON.stringify(await snapshot())===JSON.stringify(expected));const edited=read();assert.notEqual(edited,before);assert.ok(edited.includes(inheritedClasses));assert.equal(await input.inputValue(),edgeValue);assert.ok(edited.includes('md:!p'+edge[0]+'-['+(units==='px'?'30px':edgeValue)+']'));
   if(units!=='px'){
    const previous=await parent.evaluate((el,units)=>{const target=units==='rem'?el.ownerDocument.documentElement:el.parentElement,old=target.style.cssText;if(units==='rem')target.style.fontSize='20px';else target.style.width='400px';return old;},units);
    await wait(async()=>Math.abs((await snapshot())[index]-(units==='rem'?37.5:25))<0.01);assert.equal(await input.inputValue(),edgeValue);assert.equal(read(),edited,'relative padding responds without source mutation');
    await parent.evaluate((el,{units,previous})=>{(units==='rem'?el.ownerDocument.documentElement:el.parentElement).style.cssText=previous;},{units,previous});await wait(async()=>JSON.stringify(await snapshot())===JSON.stringify(expected));
   }
   assert.equal(await input.isVisible(),true,'individual padding disclosure survives source refresh');if(process.env.RT_E2E_PADDING_SCREENSHOT&&index===0)await page.screenshot({path:process.env.RT_E2E_PADDING_SCREENSHOT});assert.equal(await reset.isDisabled(),false);await reset.click();await settled();await wait(async()=>JSON.stringify(await snapshot())===JSON.stringify(initial));const resetSource=read();
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),edited);await wait(async()=>JSON.stringify(await snapshot())===JSON.stringify(expected));
   await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();assert.equal(read(),resetSource);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),edited);
   await page.getByLabel('Screen size',{exact:true}).focus();await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await wait(async()=>JSON.stringify(await snapshot())==='[10,10,10,10]');
   await page.getByLabel('Screen size',{exact:true}).focus();await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();await wait(async()=>JSON.stringify(await snapshot())===JSON.stringify(expected));
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),before);await wait(async()=>JSON.stringify(await snapshot())===JSON.stringify(initial));
  }
  assert.equal(read(),original);assert.deepEqual(errors,[]);console.log(engine+': PASS shared padding with mixed values, atomic history, Enter/Escape, invalid input, persistent disclosure and four padding edges, inherited important shorthand, other-edge preservation, reset, Phone isolation and exact history');
 }finally{if(browser)await browser.close();if(!exited)child.kill('SIGTERM');await stopped;fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
