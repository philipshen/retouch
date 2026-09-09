'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE,engine=process.env.RT_E2E_BROWSER||'chromium',kind=process.env.RT_E2E_RENDERER||'html';
if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-svg-vertices-')),file=path.join(root,kind==='react'?'app/page.jsx':'index.html');fs.mkdirSync(path.dirname(file),{recursive:true});
  const body='<main><svg width="600" height="400" viewBox="0 0 300 200"><g transform="translate(30 20) rotate(20) scale(1.2 .8)"><polygon aria-label="Triangle" points="20,20 90,20 60,90" fill="#a5b4fc"/><polyline aria-label="Open line" points="100,30 140,40 170,90" fill="none" stroke="blue"/></g></svg><p>Keep this text</p></main>';
  const original=kind==='react'?'"use client"; export default function Page(){return '+body+';}':'<html><body>'+body+'</body></html>';fs.writeFileSync(file,original);
  let url,server,child,stopped,browser,logs='';
  const read=()=>fs.readFileSync(file,'utf8'),wait=async(fn)=>{for(let i=0;i<300;i++){try{if(await fn())return;}catch(e){if(!/Execution context was destroyed|fetch failed/.test(e.message))throw e;}await new Promise(r=>setTimeout(r,100));}throw Error('Timed out '+logs.slice(-2000));};
  try{
    if(kind==='react'){
      fs.symlinkSync(path.join(fixture,'node_modules'),path.join(root,'node_modules'),'dir');fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({private:true,dependencies:{next:'16.2.5',react:'19.2.0','react-dom':'19.2.0'}}));
      fs.writeFileSync(path.join(root,'app/layout.jsx'),'export default function Layout({children}){return <html><body>{children}</body></html>}');
      child=spawn(process.execPath,[path.resolve(__dirname,'../../bin/retouch.cjs'),'--',process.execPath,path.join(fixture,'node_modules/next/dist/bin/next'),'dev','--webpack','-p','0'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
      stopped=new Promise(r=>child.once('exit',r));for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{logs+=data;url=logs.match(/http:\/\/localhost:\d+/)?.[0];});await wait(()=>url);await wait(async()=>{try{return (await fetch(url+'/rt/__api/health')).ok;}catch{return false;}});
    }else{server=require('../../src/html-site.cjs').start({root,port:0,quiet:true});if(!server.listening)await once(server,'listening');url='http://localhost:'+server.address().port;}
    browser=await browserType.launch();const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url+'/rt',{timeout:90000});const app=page.frameLocator('#app');await app.locator('polygon').waitFor({timeout:90000});
    const settled=()=>wait(async()=>await page.locator('#panelBody').getAttribute('aria-busy')!=='true');
    await page.getByLabel('Screen size',{exact:true}).selectOption('768x1024');await settled();
    const select=async(name)=>{await page.getByRole('treeitem',{name,exact:true}).click();await settled();};
    const start=async()=>{await page.getByRole('button',{name:'Edit vector points',exact:true}).click();await page.getByRole('group',{name:'Edit vector points',exact:true}).waitFor();};
    const undo=async()=>{await page.getByRole('button',{name:'Undo',exact:true}).click();await wait(()=>read()===original);await settled();};
    for(const zoom of [50,100,200]){
      await page.getByLabel('Canvas zoom (%)',{exact:true}).fill(String(zoom));await page.getByLabel('Canvas zoom (%)',{exact:true}).press('Enter');await select('polygon · Triangle');await start();
      const handle=page.getByRole('button',{name:'Vector point 2',exact:true}),b=await handle.boundingBox();
      const expected=await app.locator('polygon').evaluate((el,{dx,dy,zoom})=>{const m=el.getScreenCTM().inverse(),a=new DOMPoint(0,0).matrixTransform(m),b=new DOMPoint(dx/(zoom/100),dy/(zoom/100)).matrixTransform(m);return {x:90+b.x-a.x,y:20+b.y-a.y};},{dx:20,dy:10,zoom});
      await page.mouse.move(b.x+6,b.y+6);await page.mouse.down();await page.mouse.move(b.x+26,b.y+16,{steps:4});
      assert.equal(read(),original);assert.equal(await app.locator('polygon').getAttribute('points'),'20,20 90,20 60,90');
      if(process.env.RT_E2E_VERTEX_SCREENSHOT&&zoom===100)await page.screenshot({path:process.env.RT_E2E_VERTEX_SCREENSHOT});
      await page.mouse.up();await wait(()=>read()!==original);await settled();
      const actual=await app.locator('polygon').evaluate(el=>[...Array(el.points.numberOfItems)].map((_,i)=>{const p=el.points.getItem(i);return{x:p.x,y:p.y};}));
      assert.ok(Math.abs(actual[1].x-expected.x)<.01&&Math.abs(actual[1].y-expected.y)<.01,JSON.stringify({actual,expected}));assert.deepEqual(actual[0],{x:20,y:20});assert.deepEqual(actual[2],{x:60,y:90});
      const saved=read();await undo();await page.getByRole('button',{name:'Redo',exact:true}).click();await wait(()=>read()===saved);await settled();await undo();
    }
    await page.getByLabel('Canvas zoom (%)',{exact:true}).fill('100');await page.getByLabel('Canvas zoom (%)',{exact:true}).press('Enter');
    await select('polyline · Open line');await start();await page.getByRole('button',{name:'Vector point 3',exact:true}).click();assert.equal(await page.locator('.svg-vertex-surface').count(),1,'click selects a point for keyboard editing');await page.keyboard.press('Shift+ArrowRight');await page.keyboard.press('ArrowUp');assert.equal(read(),original);await page.keyboard.press('Enter');await wait(()=>read()!==original);await settled();assert.equal(await app.locator('polyline').getAttribute('points'),'100,30 140,40 180,89');await undo();
    await page.getByRole('button',{name:'Edit vector points',exact:true}).evaluate(button=>{button.click();button.click();});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r)))));assert.equal(await page.locator('.svg-vertex-surface').count(),1,'repeated activation leaves one point editor');await page.keyboard.press('Escape');
    await start();await page.keyboard.press('ArrowRight');await page.keyboard.press('Escape');assert.equal(read(),original);assert.equal(await page.locator('.svg-vertex-surface').count(),0);
    await start();await page.keyboard.press('ArrowRight');await page.getByLabel('Screen size',{exact:true}).selectOption('390x844');await wait(async()=>await page.locator('.svg-vertex-surface').count()===0);assert.equal(read(),original);
    await select('polyline · Open line');await start();await app.locator('polyline').evaluate(el=>el.setAttribute('points','100,30 140,40 180,90'));await wait(async()=>await page.locator('.svg-vertex-surface').count()===0);assert.equal(read(),original);await app.locator('polyline').evaluate(el=>el.setAttribute('points','100,30 140,40 170,90'));
    assert.equal(await app.locator('p').textContent(),'Keep this text');assert.deepEqual(errors,[]);console.log(engine+' '+kind+': PASS transformed SVG vertex dragging at 50/100/200%, isolated previews, keyboard points, exact undo/redo, Escape/screen/stale cancellation');
  }finally{if(browser)await browser.close();if(child){child.kill('SIGTERM');await stopped;}if(server){server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));}fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
