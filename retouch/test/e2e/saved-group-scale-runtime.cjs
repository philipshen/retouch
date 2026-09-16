'use strict';
const fs=require('node:fs'),os=require('node:os'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine],{script}=require('../../src/group-scale-runtime.cjs');
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-saved-scale-')),file=path.join(directory,'index.html');let browser,server;
 const original='<!doctype html><html><head><style>main{display:flex;flex-direction:column;gap:16px}h1{font:700 32px Georgia}p{font:16px Arial}@media(min-width:700px){main{flex-direction:row;gap:24px}}@media(min-width:1000px){main{display:grid;grid-template-columns:repeat(3,1fr);gap:32px}}[data-rt-group]{display:contents}</style></head><body><main><div data-rt-group><h1>Headline</h1><p>Other text</p></div><p>Named text</p></main></body></html>';
 const html=require('../../src/adapters/html.cjs'),planner=require('../../src/html-group-scale.cjs');
 const scale=(source,width,factor)=>{const relPath='index.html',elements=html.collect(source,relPath).elements,r={source,relPath,elements,element:elements.find(item=>item.tag==='div'),file,hash:html.contentHash(source)},result=planner.plan(r,{fileHash:r.hash,width,factor});assert.equal(result.ok,true,result.reason);return result.edits[0].after;};
 const saved=scale(scale(original,0,1.5),1000,4/3);fs.writeFileSync(file,saved);
 try{
  server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(req.url==='/baseline'?original:fs.readFileSync(file));});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
  browser=await browserType.launch();const page=await browser.newPage(),baseline=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.addInitScript(()=>{window.scaleErrors=[];document.addEventListener('retouch:scale-error',event=>scaleErrors.push(event.detail.message));});await page.goto(url);await baseline.goto(url+'/baseline');
  const measure=p=>p.locator('h1,p').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));
  const verify=async factor=>{const before=await measure(baseline),left=Math.min(...before.slice(0,2).map(r=>r[0])),top=Math.min(...before.slice(0,2).map(r=>r[1])),expected=before.map((r,i)=>i===2?r:[left+(r[0]-left)*factor,top+(r[1]-top)*factor,r[2]*factor,r[3]*factor]);for(let i=0;i<100;i++){if((await measure(page)).every((r,n)=>r.every((v,j)=>Math.abs(v-expected[n][j])<.1)))return;await page.waitForTimeout(20);}console.error({errors,scaleErrors:await page.evaluate(()=>scaleErrors)});assert.deepEqual(await measure(page),expected);};
  for(const width of [390,768,1100,1440,523]){await baseline.setViewportSize({width,height:900});await page.setViewportSize({width,height:900});await verify(width>=1000?2:1.5);await page.reload();await verify(width>=1000?2:1.5);}
  assert.equal(await page.locator('[data-rt]').count(),0,'Saved pages do not need editor instrumentation');assert.deepEqual(await page.evaluate(()=>Object.keys(window).filter(key=>key.startsWith('Retouch'))),[],'Runtime modules stay private');
  await page.locator('[data-rt-group]').evaluate(el=>el.setAttribute('data-rt-scale',JSON.stringify({version:1,ranges:{0:.5}})));await verify(.5);
  await page.locator('[data-rt-group]').evaluate(el=>el.removeAttribute('data-rt-scale'));await verify(1);assert.deepEqual(await page.locator('h1,p').evaluateAll(nodes=>nodes.map(el=>el.getAttribute('style'))),[null,null,null]);
  fs.writeFileSync(file,original);await page.reload();await verify(1);fs.writeFileSync(file,saved);await page.reload();await verify(1.5);
  assert.deepEqual(await page.evaluate(()=>scaleErrors),[]);assert.deepEqual(errors,[]);console.log('SAVED GROUP SCALE RUNTIME PASS',engine,{bytes:Buffer.byteLength(script())});
 }finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));fs.rmSync(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
