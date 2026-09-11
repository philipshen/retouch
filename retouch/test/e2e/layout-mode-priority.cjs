'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Next.js, Tailwind and Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-layout-mode-')),file=path.join(root,'app/page.jsx');fs.mkdirSync(path.dirname(file));fs.symlinkSync(path.join(fixture,'node_modules'),path.join(root,'node_modules'),'dir');
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({private:true,dependencies:{next:'16.2.5',react:'19.2.0','react-dom':'19.2.0',tailwindcss:'4.1.13','@tailwindcss/postcss':'4.1.13'}}));
 fs.writeFileSync(path.join(root,'postcss.config.mjs'),"export default {plugins:{'@tailwindcss/postcss':{}}}");fs.writeFileSync(path.join(root,'app/style.css'),'@import "tailwindcss";');
 fs.writeFileSync(path.join(root,'app/layout.jsx'),"import './style.css';export default function Layout({children}){return <html><body>{children}</body></html>}");
 const original='"use client";export default function Page(){return <main><section id="layout" className="!block sm:!grid sm:![flex-flow:column_wrap] sm:!place-items-end sm:!place-content-end sm:![grid-template-columns:40px_40px] sm:![grid-template-rows:40px_40px] md:[display:grid] md:grid-cols-2 w-[400px] h-[300px] gap-[10px]"><div className="w-[40px] h-[40px]">One</div><div className="w-[40px] h-[40px]">Two</div></section></main>}';fs.writeFileSync(file,original);const read=()=>fs.readFileSync(file,'utf8');
 let logs='',url,browser,exited=false;const child=spawn(process.execPath,[path.resolve(__dirname,'../../bin/retouch.cjs'),'--',process.execPath,path.join(fixture,'node_modules/next/dist/bin/next'),'dev','--webpack','-p','0'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']}),stopped=new Promise(resolve=>child.once('exit',()=>{exited=true;resolve();}));for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{logs+=chunk;url=logs.match(/http:\/\/localhost:(\d+)/)?.[0];});
 const wait=async fn=>{for(let i=0;i<300;i++){try{if(await fn())return;}catch(error){if(!/ECONNREFUSED|fetch failed|Execution context was destroyed/.test(error.message))throw error;}if(exited)throw Error(logs);await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Timed out: '+logs.slice(-3000));};
 try{
  await wait(()=>url);await wait(async()=>(await fetch(url+'/rt/__api/health')).ok);browser=await browserType.launch();const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(url+'/rt',{timeout:90000});const parent=page.frameLocator('#app').locator('#layout');await parent.waitFor({timeout:90000});const settled=()=>page.waitForFunction(()=>!panelTasks&&!sourceRequests&&!undoBusy);
  await page.getByLabel('Screen size',{exact:true}).focus();await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await page.getByRole('treeitem',{name:'section · layout',exact:true}).click();const mode=page.getByLabel('Arrange children',{exact:true});await mode.waitFor();await settled();await page.getByLabel('Style screen scope',{exact:true}).selectOption('md:');await settled();
  const states=[];
  for(const value of ['row','column','row-reverse','column-reverse','grid','flow']){
   const before=read();await mode.selectOption(value);await settled();await wait(async()=>parent.evaluate((el,value)=>{const css=getComputedStyle(el);return css.display===(value==='grid'?'grid':value==='flow'?'block':'flex')&&(['grid','flow'].includes(value)||css.flexDirection===value);},value));assert.equal(await mode.inputValue(),value);const source=read();assert.notEqual(source,before);assert.ok(source.includes('!block sm:!grid sm:![flex-flow:column_wrap]'));assert.ok(!source.includes('md:[display:grid]'));states.push({before,after:source,value});
   const checks=value==='row'?[['Wrap children','nowrap','flexWrap','nowrap'],['Align children','center','alignItems','center'],['Distribute children','between','justifyContent','space-between']]:value==='grid'?[['Columns','3','gridTemplateColumns',null],['Rows','3','gridTemplateRows',null]]:[];
   for(const [label,next,prop,expected] of checks){
    const baseline=read(),control=page.getByLabel(label,{exact:true});
    if(['Columns','Rows'].includes(label)){await control.fill(next);await control.press('Tab');}else await control.selectOption(next);
    await settled();await wait(async()=>parent.evaluate((el,{prop,expected})=>{const actual=getComputedStyle(el)[prop];return expected===null?actual.split(/\s+/).length===3:actual===expected;},{prop,expected}));
    if(['Columns','Rows'].includes(label)){
     assert.equal(await control.inputValue(),'3');
     const other=label==='Columns'?'gridTemplateRows':'gridTemplateColumns';assert.equal(await parent.evaluate((el,other)=>getComputedStyle(el)[other],other),'40px 40px');
    }
    const edited=read();assert.notEqual(edited,baseline);
    await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),baseline);
    await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();assert.equal(read(),edited);
    await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),baseline);
   }
   if(!['grid','flow'].includes(value)){assert.equal(await parent.evaluate(el=>getComputedStyle(el).flexWrap),'wrap');const boxes=await parent.locator('div').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top};}));if(value.startsWith('row'))assert.ok(value.endsWith('reverse')?boxes[0].left>boxes[1].left:boxes[0].left<boxes[1].left);else assert.ok(value.endsWith('reverse')?boxes[0].top>boxes[1].top:boxes[0].top<boxes[1].top);}
  }
  await page.getByLabel('Screen size',{exact:true}).focus();await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await wait(async()=>await parent.evaluate(el=>getComputedStyle(el).display)==='block');await page.getByLabel('Screen size',{exact:true}).focus();await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();
  for(const state of [...states].reverse()){await page.getByRole('button',{name:'Undo',exact:true}).click();await settled();assert.equal(read(),state.before);}
  assert.equal(read(),original);for(const state of states){await page.getByRole('button',{name:'Redo',exact:true}).click();await settled();assert.equal(read(),state.after);assert.equal(await mode.inputValue(),state.value);}assert.deepEqual(errors,[]);console.log(engine+': PASS arrangement controls and breakpoint layout modes, inherited display/flow priority, real child ordering, wrap preservation, Phone isolation and exact history');
 }finally{if(browser)await browser.close();if(!exited)child.kill('SIGTERM');await stopped;fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
