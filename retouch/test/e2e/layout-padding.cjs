'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Next.js, Tailwind and Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-layout-padding-')),file=path.join(root,'app/page.jsx');fs.mkdirSync(path.dirname(file));fs.symlinkSync(path.join(fixture,'node_modules'),path.join(root,'node_modules'),'dir');
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({private:true,dependencies:{next:'16.2.5',react:'19.2.0','react-dom':'19.2.0',tailwindcss:'4.1.13','@tailwindcss/postcss':'4.1.13'}}));
 fs.writeFileSync(path.join(root,'postcss.config.mjs'),"export default {plugins:{'@tailwindcss/postcss':{}}}");fs.writeFileSync(path.join(root,'app/style.css'),'@import "tailwindcss";');
 fs.writeFileSync(path.join(root,'app/layout.jsx'),"import './style.css';export default function Layout({children}){return <html><body>{children}</body></html>}");
 const original='"use client";export default function Page(){return <main><section id="layout" className="!p-[10px] sm:![padding:12px_16px] md:[padding-left:20px] w-[400px] h-[300px]"><div>Content</div></section></main>}';fs.writeFileSync(file,original);const read=()=>fs.readFileSync(file,'utf8');
 let logs='',url,browser,exited=false;const child=spawn(process.execPath,[path.resolve(__dirname,'../../bin/retouch.cjs'),'--',process.execPath,path.join(fixture,'node_modules/next/dist/bin/next'),'dev','--webpack','-p','0'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']}),stopped=new Promise(resolve=>child.once('exit',()=>{exited=true;resolve();}));for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{logs+=chunk;url=logs.match(/http:\/\/localhost:(\d+)/)?.[0];});
 const wait=async fn=>{for(let i=0;i<300;i++){try{if(await fn())return;}catch(error){if(!/ECONNREFUSED|fetch failed|Execution context was destroyed/.test(error.message))throw error;}if(exited)throw Error(logs);await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Timed out: '+logs.slice(-3000));};
 try{
  await wait(()=>url);await wait(async()=>(await fetch(url+'/rt/__api/health')).ok);browser=await browserType.launch();const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(url+'/rt',{timeout:90000});const parent=page.frameLocator('#app').locator('#layout');await parent.waitFor({timeout:90000});const settled=()=>page.waitForFunction(()=>!panelTasks&&!sourceRequests&&!undoBusy);
  await page.getByLabel('Screen size',{exact:true}).focus();await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await page.getByRole('treeitem',{name:'section · layout',exact:true}).click();const mode=page.getByLabel('Arrange children',{exact:true});await mode.waitFor();await settled();await page.getByLabel('Style screen scope',{exact:true}).selectOption('md:');await settled();
  const snapshot=()=>parent.evaluate(el=>{const css=getComputedStyle(el);return ['Top','Right','Bottom','Left'].map(side=>parseFloat(css['padding'+side]));});
  const initial=[12,16,12,16];assert.deepEqual(await snapshot(),initial);
  for(const [index,edge] of ['top','right','bottom','left'].entries()){
   const before=read(),input=page.getByLabel('Padding '+edge,{exact:true}),reset=page.getByRole('button',{name:'Reset padding '+edge,exact:true});
   assert.equal(await reset.isDisabled(),edge!=='left');
   await input.fill('30');await input.press('Tab');await settled();const expected=initial.map((v,i)=>i===index?30:v);
   await wait(async()=>JSON.stringify(await snapshot())===JSON.stringify(expected));const edited=read();assert.notEqual(edited,before);assert.ok(edited.includes('sm:![padding:12px_16px]'));
   assert.equal(await reset.isDisabled(),false);await reset.click();await settled();await wait(async()=>JSON.stringify(await snapshot())===JSON.stringify(initial));const resetSource=read();
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),edited);await wait(async()=>JSON.stringify(await snapshot())===JSON.stringify(expected));
   await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();assert.equal(read(),resetSource);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),edited);
   await page.getByLabel('Screen size',{exact:true}).focus();await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await wait(async()=>JSON.stringify(await snapshot())==='[10,10,10,10]');
   await page.getByLabel('Screen size',{exact:true}).focus();await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();await wait(async()=>JSON.stringify(await snapshot())===JSON.stringify(expected));
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),before);await wait(async()=>JSON.stringify(await snapshot())===JSON.stringify(initial));
  }
  assert.equal(read(),original);assert.deepEqual(errors,[]);console.log(engine+': PASS four padding edges, inherited important shorthand, other-edge preservation, reset, Phone isolation and exact history');
 }finally{if(browser)await browser.close();if(!exited)child.kill('SIGTERM');await stopped;fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
