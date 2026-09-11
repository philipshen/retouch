'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE for Next.js and Playwright');
const engine=process.env.RT_E2E_BROWSER||'chromium',browserType=require(path.join(fixture,'node_modules/playwright'))[engine];
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-component-batch-')),file=path.join(root,'app/page.jsx');fs.mkdirSync(path.dirname(file));fs.symlinkSync(path.join(fixture,'node_modules'),path.join(root,'node_modules'),'dir');
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({private:true,dependencies:{next:'16.2.5',react:'19.2.0','react-dom':'19.2.0'}}));fs.writeFileSync(path.join(root,'app/layout.jsx'),'export default function Layout({children}){return <html><body>{children}</body></html>}');
 const original='"use client"; export function Card({title="Default"}){return <h2>{title}</h2>} export default function Page(){const dynamic="Dynamic";return <main><Card title="First"/><Card title="Second"/><Card title={dynamic}/><p>Untouched</p></main>}';fs.writeFileSync(file,original);
 let logs='',url,browser;const child=spawn(process.execPath,[path.resolve(__dirname,'../../bin/retouch.cjs'),'--',process.execPath,path.join(fixture,'node_modules/next/dist/bin/next'),'dev','--webpack','-p','0'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});let exited=false;const stopped=new Promise(resolve=>child.once('exit',()=>{exited=true;resolve();}));for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{logs+=chunk;url=logs.match(/http:\/\/localhost:(\d+)/)?.[0];});
 const wait=async fn=>{for(let i=0;i<240;i++){try{if(await fn())return;}catch(error){if(!/Execution context was destroyed|ECONNREFUSED|fetch failed/.test(error.message))throw error;}if(exited)throw Error(logs);await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Timed out: '+logs.slice(-2000));};
 try{
  await wait(()=>url);await wait(async()=>(await fetch(url+'/rt/__api/health')).ok);browser=await browserType.launch();const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));await page.goto(url+'/rt',{timeout:90000});const app=page.frameLocator('#app');await app.locator('h2').first().waitFor({timeout:90000});
  const token=/__RT_TOKEN = "([0-9a-f]+)"/.exec(await (await fetch(url+'/rt')).text())[1],headers={'x-retouch-token':token,'content-type':'application/json'},read=()=>fs.readFileSync(file,'utf8');
  const op=async body=>(await fetch(url+'/rt/__api/op',{method:'POST',headers,body:JSON.stringify(body)})).json(),resolve=async id=>(await(await fetch(url+'/rt/__api/resolve?id='+id,{headers})).json()).element;
  const ids=await app.locator('h2').evaluateAll(els=>els.map(el=>el.getAttribute('data-rt-i')));assert.equal(new Set(ids).size,3);assert.ok(ids.every(id=>/^[a-f0-9]{10}$/.test(id)));
  const info=await resolve(ids[0]),operation={type:'setComponentPropSelection',id:ids[0],ids:ids.slice(0,2),fileHash:info.hash,name:'title',value:'Shared'};
  const saved=await op(operation);assert.ok(saved.ok,saved.reason);assert.ok(saved.undoId);assert.equal(saved.selection.length,2);const after=read();assert.equal(after,original.replace('title="First"','title={"Shared"}').replace('title="Second"','title={"Shared"}'));
  const rendered=values=>wait(async()=>JSON.stringify(await app.locator('h2').allTextContents())===JSON.stringify(values));await rendered(['Shared','Shared','Dynamic']);assert.equal(await app.locator('p').textContent(),'Untouched');
  assert.equal((await op(operation)).refused,true);assert.equal(read(),after);
  const noop=await op({...operation,fileHash:saved.hash});assert.ok(noop.ok,noop.reason);assert.equal(noop.undoId,undefined);assert.equal(read(),after);
  const rejected=await op({...operation,fileHash:saved.hash,ids:[ids[0],ids[2]],value:'Invalid batch'});assert.equal(rejected.refused,true);assert.equal(read(),after);
  const undone=await op({type:'undo',undoId:saved.undoId});assert.ok(undone.ok,undone.reason);assert.equal(read(),original);await rendered(['First','Second','Dynamic']);
  const redone=await op({type:'redo',undoId:saved.undoId});assert.ok(redone.ok,redone.reason);assert.equal(read(),after);await rendered(['Shared','Shared','Dynamic']);
  assert.equal((await resolve(ids[1])).hash,saved.hash);assert.ok((await op({type:'undo',undoId:saved.undoId})).ok);assert.equal(read(),original);await rendered(['First','Second','Dynamic']);assert.deepEqual(errors,[]);
  console.log(engine+': PASS component-property batch API, compiled React usages, untouched siblings, fresh metadata, no-op/stale/dynamic refusal and one exact Undo/Redo transaction');
 }finally{if(browser)await browser.close();if(!exited)child.kill('SIGTERM');await stopped;fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
