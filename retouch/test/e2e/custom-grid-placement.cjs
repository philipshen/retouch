'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Next.js, Tailwind and Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-grid-tracks-')),file=path.join(root,'app/page.jsx');fs.mkdirSync(path.dirname(file));fs.symlinkSync(path.join(fixture,'node_modules'),path.join(root,'node_modules'),'dir');
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({private:true,dependencies:{next:'16.2.5',react:'19.2.0','react-dom':'19.2.0',tailwindcss:'4.1.13','@tailwindcss/postcss':'4.1.13'}}));
 fs.writeFileSync(path.join(root,'postcss.config.mjs'),"export default {plugins:{'@tailwindcss/postcss':{}}}");fs.writeFileSync(path.join(root,'app/style.css'),'@import "tailwindcss";');
 fs.writeFileSync(path.join(root,'app/layout.jsx'),"import './style.css';export default function Layout({children}){return <html><body>{children}</body></html>}");
 const original=String.raw`"use client";export default function Page(){return <main><section id="layout" className="grid grid-cols-[[content\_start]_100px_[middle]_100px_[right]_100px_[end]] grid-rows-[[content\_start]_100px_[middle]_100px_[right]_100px_[end]] w-[320px] h-[320px] gap-[10px]"><div id="item" className="w-[20px] h-[20px] sm:!col-start-1 sm:!col-end-2 sm:!row-start-1 sm:!row-end-2 md:col-start-1 md:col-end-2 md:row-start-1 md:row-end-2">One</div><div className="w-[20px] h-[20px]">Two</div></section></main>}`;fs.writeFileSync(file,original);const read=()=>fs.readFileSync(file,'utf8');
 let logs='',url,browser,exited=false;const child=spawn(process.execPath,[path.resolve(__dirname,'../../bin/retouch.cjs'),'--',process.execPath,path.join(fixture,'node_modules/next/dist/bin/next'),'dev','--webpack','-p','0'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']}),stopped=new Promise(resolve=>child.once('exit',()=>{exited=true;resolve();}));for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{logs+=chunk;url=logs.match(/http:\/\/localhost:(\d+)/)?.[0];});
 const wait=async fn=>{for(let i=0;i<300;i++){try{if(await fn())return;}catch(error){if(!/ECONNREFUSED|fetch failed|Execution context was destroyed/.test(error.message))throw error;}if(exited)throw Error(logs);await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Timed out: '+logs.slice(-3000));};
 try{
  await wait(()=>url);await wait(async()=>(await fetch(url+'/rt/__api/health')).ok);browser=await browserType.launch();const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('response',async response=>{if(response.url().includes('/__api/op')){const result=await response.json().catch(()=>null);if(result&&!result.ok)console.error(JSON.stringify({operationFailure:result}));}});await page.goto(url+'/rt',{timeout:90000});const parent=page.frameLocator('#app').locator('#layout');await parent.waitFor({timeout:90000});const settled=()=>page.waitForFunction(()=>!panelTasks&&!sourceRequests&&!undoBusy);
  await page.getByLabel('Screen size',{exact:true}).focus();await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await page.getByRole('treeitem',{name:'div · item',exact:true}).click();await settled();await page.getByLabel('Style screen scope',{exact:true}).selectOption('md:');await settled();
  await page.getByText('Custom grid placement',{exact:true}).click();
  const item=page.frameLocator('#app').locator('#item');
  const position=()=>item.evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return [a.left-b.left,a.top-b.top];});
  for(const [axis,label] of [['column','Column placement'],['row','Row placement']])for(const [value,offset] of [['2 / 3',110],['middle / right',110],['content_start / middle',0],['2 / span 2',110],['-2 / -1',220]]){
   const before=read(),input=page.getByLabel(label,{exact:true}),initial=await input.inputValue(),index=axis==='column'?0:1;
   await input.fill('0 / 3');await input.press('Enter');assert.equal(await input.evaluate(el=>el.checkValidity()),false);assert.equal(read(),before);
   await input.press('Escape');assert.equal(await input.inputValue(),initial);assert.equal(await input.evaluate(el=>el.checkValidity()),true);
   await input.fill(value);await input.press('Enter');await settled();await wait(async()=>{const p=await position();return p[index]===offset&&p[1-index]===0;});
   const edited=read();assert.notEqual(edited,before);assert.equal(await input.inputValue(),value);
   await page.getByLabel('Screen size',{exact:true}).focus();await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await settled();await wait(async()=>JSON.stringify(await position())==='[0,0]');
   await page.getByLabel('Screen size',{exact:true}).focus();await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();await wait(async()=>(await position())[index]===offset);
   if(process.env.RT_E2E_GRID_PLACEMENT_SCREENSHOT&&axis==='column'){await input.scrollIntoViewIfNeeded();await page.locator('#panel').screenshot({path:process.env.RT_E2E_GRID_PLACEMENT_SCREENSHOT});}
   await page.getByRole('button',{name:'Reset '+label.toLowerCase(),exact:true}).click();await settled();await wait(async()=>JSON.stringify(await position())==='[0,0]');const resetSource=read();
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),edited);
   await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();assert.equal(read(),resetSource);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),edited);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),before);
  }
  assert.equal(read(),original);assert.deepEqual(errors,[]);console.log('TAILWIND GRID PLACEMENT/PRIORITY/NAMED LINES/RESPONSIVE/EXACT HISTORY PASS',engine);
 }finally{if(browser)await browser.close();if(!exited)child.kill('SIGTERM');await stopped;fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
