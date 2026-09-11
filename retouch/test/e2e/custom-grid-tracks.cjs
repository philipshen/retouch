'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Next.js, Tailwind and Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-grid-tracks-')),file=path.join(root,'app/page.jsx');fs.mkdirSync(path.dirname(file));fs.symlinkSync(path.join(fixture,'node_modules'),path.join(root,'node_modules'),'dir');
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({private:true,dependencies:{next:'16.2.5',react:'19.2.0','react-dom':'19.2.0',tailwindcss:'4.1.13','@tailwindcss/postcss':'4.1.13'}}));
 fs.writeFileSync(path.join(root,'postcss.config.mjs'),"export default {plugins:{'@tailwindcss/postcss':{}}}");fs.writeFileSync(path.join(root,'app/style.css'),'@import "tailwindcss";');
 fs.writeFileSync(path.join(root,'app/layout.jsx'),"import './style.css';export default function Layout({children}){return <html><body>{children}</body></html>}");
 const original='"use client";export default function Page(){return <main><section id="layout" style={{"--track_size":"80px"}} className="grid grid-cols-[100px_100px] grid-rows-[100px_100px] sm:!grid-cols-[100px_100px] sm:!grid-rows-[100px_100px] md:grid-cols-2 md:grid-rows-2 w-[400px] h-[300px] gap-[10px]"><div className="w-[40px] h-[40px]">One</div><div className="w-[40px] h-[40px]">Two</div></section></main>}';fs.writeFileSync(file,original);const read=()=>fs.readFileSync(file,'utf8');
 let logs='',url,browser,exited=false;const child=spawn(process.execPath,[path.resolve(__dirname,'../../bin/retouch.cjs'),'--',process.execPath,path.join(fixture,'node_modules/next/dist/bin/next'),'dev','--webpack','-p','0'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']}),stopped=new Promise(resolve=>child.once('exit',()=>{exited=true;resolve();}));for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{logs+=chunk;url=logs.match(/http:\/\/localhost:(\d+)/)?.[0];});
 const wait=async fn=>{for(let i=0;i<300;i++){try{if(await fn())return;}catch(error){if(!/ECONNREFUSED|fetch failed|Execution context was destroyed/.test(error.message))throw error;}if(exited)throw Error(logs);await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Timed out: '+logs.slice(-3000));};
 try{
  await wait(()=>url);await wait(async()=>(await fetch(url+'/rt/__api/health')).ok);browser=await browserType.launch();const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('response',async response=>{if(response.url().includes('/__api/op')){const result=await response.json().catch(()=>null);if(result&&!result.ok)console.error(JSON.stringify({operationFailure:result}));}});await page.goto(url+'/rt',{timeout:90000});const parent=page.frameLocator('#app').locator('#layout');await parent.waitFor({timeout:90000});const settled=()=>page.waitForFunction(()=>!panelTasks&&!sourceRequests&&!undoBusy);
  await page.getByLabel('Screen size',{exact:true}).focus();await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await page.getByRole('treeitem',{name:'section · layout',exact:true}).click();const mode=page.getByLabel('Arrange children',{exact:true});await mode.waitFor();await settled();await page.getByLabel('Style screen scope',{exact:true}).selectOption('md:');await settled();
  await page.getByText('Custom grid tracks',{exact:true}).click();
  const tracks=axis=>parent.evaluate((el,axis)=>getComputedStyle(el).getPropertyValue('grid-template-'+axis).replace(/\[[^\]]*\]/g,' ').trim().split(/\s+/).map(parseFloat),axis);
  for(const axis of ['columns','rows'])for(const value of (process.env.RT_E2E_NAMED_ONLY?['[content_start] 80px [rest] 1fr']:['80px minmax(0, 1fr)','repeat(3, minmax(0, 1fr))','[content_start] 80px [rest] 1fr','auto 1fr','var(--track_size) minmax(0, 1fr)','var(--missing, 80px) 1fr'])){
   const before=read(),label=axis==='columns'?'Column sizes':'Row sizes',input=page.getByLabel(label,{exact:true}),reset=page.getByRole('button',{name:'Reset '+label.toLowerCase(),exact:true}),total=axis==='columns'?400:300;
   const initial=await input.inputValue();
   await input.fill('1fr; display:none');await input.press('Tab');await settled();assert.equal(read(),before);assert.equal(await input.evaluate(el=>el.checkValidity()),false);
   await input.fill('nonsense');await input.press('Tab');await settled();assert.equal(read(),before);assert.equal(await input.evaluate(el=>el.checkValidity()),false);
   await input.press('Escape');assert.equal(await input.inputValue(),initial);assert.equal(await input.evaluate(el=>el.checkValidity()),true);assert.equal(read(),before,'Escape discards an invalid grid draft');
   await input.fill('120px 1fr');await input.press('Escape');assert.equal(await input.inputValue(),initial);assert.equal(read(),before,'Escape discards a valid unfinished grid draft');
   await input.fill(value);await input.press('Enter');await settled();const expected=value.startsWith('repeat')?Array(3).fill((total-20)/3):value.startsWith('auto')?[40,total-50]:[80,total-90];
   try{await wait(async()=>{const actual=await tracks(axis);return actual.length===expected.length&&actual.every((v,i)=>Math.abs(v-expected[i])<0.03);});}catch(error){console.error(JSON.stringify({axis,value,expected,actual:await tracks(axis),source:read(),validity:await input.evaluate(el=>el.validationMessage)}));throw error;}assert.equal(await input.inputValue(),value);assert.deepEqual(await tracks(axis==='columns'?'rows':'columns'),[100,100]);const edited=read();assert.notEqual(edited,before);if(process.env.RT_E2E_GRID_TRACKS_SCREENSHOT&&axis==='columns'){await input.scrollIntoViewIfNeeded();await page.locator('#panel').screenshot({path:process.env.RT_E2E_GRID_TRACKS_SCREENSHOT});}
   if(value.includes('--track_size')){
    await parent.evaluate(el=>el.style.setProperty('--track_size','90px'));
    await wait(async()=>Math.abs((await tracks(axis))[0]-90)<0.03);
    assert.equal(await input.inputValue(),value,'Variable reference stays authored rather than becoming pixels');assert.equal(read(),edited);
    await parent.evaluate(el=>el.style.setProperty('--track_size','80px'));
    await wait(async()=>Math.abs((await tracks(axis))[0]-80)<0.03);
   }
   await reset.click();await settled();assert.deepEqual(await tracks(axis),[100,100]);assert.equal(await reset.isDisabled(),true);const resetSource=read();
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),edited);
   await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();assert.equal(read(),resetSource);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),edited);
   await page.getByLabel('Screen size',{exact:true}).focus();await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await wait(async()=>JSON.stringify(await tracks(axis))==='[100,100]');
   await page.getByLabel('Screen size',{exact:true}).focus();await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();await wait(async()=>await input.inputValue()===value);
   await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),before);
  }
  assert.equal(read(),original);assert.deepEqual(errors,[]);console.log(engine+': PASS custom row/column fixed-flex, minmax, repeat, named lines and auto tracks, inherited priority, validation, reset, Phone isolation and exact history');
 }finally{if(browser)await browser.close();if(!exited)child.kill('SIGTERM');await stopped;fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
