'use strict';
const fs=require('node:fs'),os=require('node:os'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine],{script}=require('../../src/group-scale-runtime.cjs');
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-saved-scale-')),file=path.join(directory,'index.html');let browser,server;
 const original='<!doctype html><html><head><style>main{display:flex;flex-direction:column;gap:16px}h1{font:700 32px Georgia}p{font:16px Arial}@media(min-width:700px){main{flex-direction:row;gap:24px}}@media(min-width:1000px){main{display:grid;grid-template-columns:repeat(3,1fr);gap:32px}}[data-rt-group]{display:contents}</style></head><body><main><div data-rt-frame data-rt-group><h1>Headline</h1><p>Other text</p></div><p>Named text</p></main></body></html>';
 const html=require('../../src/adapters/html.cjs'),planner=require('../../src/html-group-scale.cjs');
 const scale=(source,width,factor)=>{const relPath='index.html',elements=html.collect(source,relPath).elements,r={source,relPath,elements,element:elements.find(item=>item.tag==='div'),file,hash:html.contentHash(source)},result=planner.plan(r,{fileHash:r.hash,width,factor});assert.equal(result.ok,true,result.reason);return result.edits[0].after;};
 const saved=scale(scale(original,0,1.5),1000,4/3);fs.writeFileSync(file,saved);
 try{
  let baselineSource=original;server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(req.url==='/baseline'?baselineSource:fs.readFileSync(file));});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
  browser=await browserType.launch();const page=await browser.newPage(),baseline=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.addInitScript(()=>{window.scaleErrors=[];document.addEventListener('retouch:scale-error',event=>scaleErrors.push(event.detail.message));});await page.goto(url);await baseline.goto(url+'/baseline');
  const measure=p=>p.locator('h1,p').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));
  const verify=async(factor,shift=[0,0],pixels=[0,0],memberMoves={},memberFactors={})=>{await baseline.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});const before=await measure(baseline),visible=before.slice(0,-1).filter(r=>r[2]>0&&r[3]>0),left=Math.min(...visible.map(r=>r[0])),top=Math.min(...visible.map(r=>r[1])),width=Math.max(...visible.map(r=>r[0]+r[2]))-left,height=Math.max(...visible.map(r=>r[1]+r[3]))-top,expected=before.map((r,i)=>i===before.length-1||!r[2]||!r[3]?r:[left+(r[0]-left)*factor+shift[0]*width+pixels[0]+(memberMoves[i]?.[0]||0),top+(r[1]-top)*factor+shift[1]*height+pixels[1]+(memberMoves[i]?.[1]||0),r[2]*factor*(memberFactors[i]??1),r[3]*factor*(memberFactors[i]??1)]);for(let i=0;i<100;i++){if((await measure(page)).every((r,n)=>r.every((v,j)=>Math.abs(v-expected[n][j])<.1)))return;await page.waitForTimeout(20);}console.error({errors,scaleErrors:await page.evaluate(()=>scaleErrors)});assert.deepEqual(await measure(page),expected);};
  for(const width of [390,768,1100,1440,523]){await baseline.setViewportSize({width,height:900});await page.setViewportSize({width,height:900});await verify(width>=1000?2:1.5);await page.reload();await verify(width>=1000?2:1.5);}
  assert.equal(await page.locator('[data-rt]').count(),0,'Saved pages do not need editor instrumentation');assert.deepEqual(await page.evaluate(()=>Object.keys(window).filter(key=>key.startsWith('Retouch'))),[],'Runtime modules stay private');
  await page.locator('[data-rt-group]').evaluate(el=>el.setAttribute('data-rt-scale',JSON.stringify({version:1,ranges:{0:.5}})));await verify(.5);
  await page.locator('[data-rt-group]').evaluate(el=>el.setAttribute('data-rt-scale',JSON.stringify({version:1,ranges:{0:1.5},offsets:{0:[-.25,-.25]},pixels:{0:[23,-9]}})));await verify(1.5,[-.25,-.25],[23,-9]);
  await page.locator('[data-rt-group]').evaluate(el=>el.removeAttribute('data-rt-scale'));await verify(1);assert.deepEqual(await page.locator('h1,p').evaluateAll(nodes=>nodes.map(el=>el.getAttribute('style'))),[null,null,null]);
  fs.writeFileSync(file,original);await page.reload();await verify(1);fs.writeFileSync(file,saved);await page.reload();await verify(1.5);
  const ungroup=source=>{const relPath='index.html',elements=html.collect(source,relPath).elements,r={source,relPath,elements,element:elements.find(item=>item.tag==='div'),file,hash:html.contentHash(source)},result=require('../../src/html-frame-selection.cjs').plan(r,{type:'removeFrame',fileHash:r.hash});assert.equal(result.ok,true,result.reason);return result.edits[0].after;};
  baselineSource=ungroup(original);fs.writeFileSync(file,ungroup(saved));await baseline.reload();await page.reload();
  assert.equal(await page.locator('[data-rt-group]').count(),0);assert.equal(await page.locator('script[data-rt-scale-set]').count(),1);
  for(const width of [390,768,1100,1440,523]){await baseline.setViewportSize({width,height:900});await page.setViewportSize({width,height:900});await verify(width>=1000?2:1.5);await page.reload();await verify(width>=1000?2:1.5);}
  assert.deepEqual(await page.evaluate(()=>scaleErrors),[]);
  const regroup=source=>{const relPath='index.html',elements=html.collect(source,relPath).elements,roots=[elements.find(item=>item.tag==='h1'),elements.find(item=>item.tag==='p')],r={source,relPath,elements,element:roots[0],file,hash:html.contentHash(source)},result=require('../../src/html-frame-selection.cjs').plan(r,{type:'groupSelection',fileHash:r.hash,ids:roots.map(item=>item.id)});assert.equal(result.ok,true,result.reason);return result.edits[0].after;};
  baselineSource=regroup(ungroup(original));const regrouped=regroup(ungroup(saved));fs.writeFileSync(file,regrouped);await baseline.reload();await page.reload();assert.equal(await page.locator('script[data-rt-scale-set]').count(),0);assert.equal(await page.locator('[data-rt-group][data-rt-scale]').count(),1);
  for(const width of [390,768,1100,1440,523]){await baseline.setViewportSize({width,height:900});await page.setViewportSize({width,height:900});await verify(width>=1000?2:1.5);await page.reload();await verify(width>=1000?2:1.5);}
  fs.writeFileSync(file,scale(regrouped,0,2));await page.reload();for(const width of [390,1100,523]){await baseline.setViewportSize({width,height:900});await page.setViewportSize({width,height:900});await verify(width>=1000?2:3);}assert.deepEqual(await page.evaluate(()=>scaleErrors),[]);
  baselineSource=ungroup(original);await baseline.reload();
  const moveReleased=(source,width,changes)=>{const relPath='index.html',elements=html.collect(source,relPath).elements,r={source,relPath,elements,element:elements.find(item=>item.tag==='h1'),file,hash:html.contentHash(source)},result=require('../../src/html-css.cjs').plan(r,{type:'setCSS',fileHash:r.hash,width,changes});assert.equal(result.ok,true,result.reason);return result.edits[0].after;};
  const independentlyMoved=moveReleased(moveReleased(ungroup(saved),0,{'--rt-scale-move-x':'23px','--rt-scale-move-y':'-9px'}),1000,{'--rt-scale-move-x':'41px'});fs.writeFileSync(file,independentlyMoved);await page.reload();
  for(const width of [390,768,1100,1440,523]){await baseline.setViewportSize({width,height:900});await page.setViewportSize({width,height:900});await verify(width>=1000?2:1.5,[0,0],[0,0],{0:[width>=1000?41:23,-9]});await page.reload();await verify(width>=1000?2:1.5,[0,0],[0,0],{0:[width>=1000?41:23,-9]});}
  assert.deepEqual(await page.evaluate(()=>scaleErrors),[]);
  const independentlyScaled=moveReleased(moveReleased(independentlyMoved,0,{'--rt-scale-factor':'1.4'}),1000,{'--rt-scale-factor':'.75'});fs.writeFileSync(file,independentlyScaled);await page.reload();
  for(const width of [390,768,1100,1440,523]){await baseline.setViewportSize({width,height:900});await page.setViewportSize({width,height:900});await verify(width>=1000?2:1.5,[0,0],[0,0],{0:[width>=1000?41:23,-9]},{0:width>=1000?.75:1.4});await page.reload();await verify(width>=1000?2:1.5,[0,0],[0,0],{0:[width>=1000?41:23,-9]},{0:width>=1000?.75:1.4});}
  assert.deepEqual(await page.evaluate(()=>scaleErrors),[]);
  // Compose against an already transformed baseline, including a responsive child override.
  const composedBase=regroup(independentlyScaled);
  for(const [scope,factor] of [[0,1.5],[1000,.5]]){
   baselineSource=composedBase;fs.writeFileSync(file,scale(composedBase,scope,factor));await baseline.reload();await page.reload();
   for(const width of [390,768,1100,1440,523]){await baseline.setViewportSize({width,height:900});await page.setViewportSize({width,height:900});const active=scope===0?width<1000:width>=1000;await verify(active?factor:1);await page.reload();await verify(active?factor:1);}
   assert.deepEqual(await page.evaluate(()=>scaleErrors),[]);
  }
  const duplicate=source=>{const relPath='index.html',elements=html.collect(source,relPath).elements,r={source,relPath,elements,element:elements.find(item=>item.tag==='h1'),file,hash:html.contentHash(source)},result=html.planOp(r,{type:'duplicateElement',fileHash:r.hash});assert.equal(result.ok,true,result.reason);return result.edits[0].after;};
  baselineSource=duplicate(ungroup(original));fs.writeFileSync(file,duplicate(ungroup(saved)));await baseline.reload();await page.reload();
  for(const width of [390,768,1100,1440,523]){await baseline.setViewportSize({width,height:900});await page.setViewportSize({width,height:900});await verify(width>=1000?2:1.5);await page.reload();await verify(width>=1000?2:1.5);}
  assert.deepEqual(await page.evaluate(()=>scaleErrors),[]);
  baselineSource=duplicate(original);fs.writeFileSync(file,duplicate(saved));await baseline.reload();await page.reload();
  for(const width of [390,768,1100,1440,523]){await baseline.setViewportSize({width,height:900});await page.setViewportSize({width,height:900});await verify(width>=1000?2:1.5);}
  const identities=await page.locator('h1').evaluateAll(nodes=>nodes.map(el=>el.getAttribute('data-rt-scale-member')));assert.equal(new Set(identities).size,2);assert.equal(await page.locator('[data-rt]').count(),0);
  const hideMembers=source=>source.replace('</style>','@media(min-width:1000px){h1+p{display:none}}@media(min-width:1400px){h1{display:none}}</style>');
  for(const released of [false,true]){
   baselineSource=hideMembers(released?ungroup(original):original);fs.writeFileSync(file,hideMembers(released?ungroup(saved):saved));await baseline.reload();await page.reload();
   for(const width of [390,1100,1440,768,1440,523]){await baseline.setViewportSize({width,height:900});await page.setViewportSize({width,height:900});await verify(width>=1000?2:1.5);await page.reload();await verify(width>=1000?2:1.5);assert.deepEqual(await page.evaluate(()=>scaleErrors),[]);}
   for(const [selector,display]of [['h1+p','none'],['main','none'],['main',''],['h1+p','']]){for(const document of [baseline,page])await document.locator(selector).evaluate((el,display)=>el.style.display=display,display);await verify(1.5);assert.deepEqual(await page.evaluate(()=>scaleErrors),[]);}

  }
  assert.deepEqual(await page.evaluate(()=>scaleErrors),[]);assert.deepEqual(errors,[]);console.log('SAVED GROUP SCALE RUNTIME PASS',engine,{bytes:Buffer.byteLength(script())});
 }finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));fs.rmSync(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
