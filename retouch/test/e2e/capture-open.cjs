'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{once}=require('node:events');
const fixture=process.env.RT_INSPECTOR_FIXTURE;if(!fixture)throw Error('Set RT_INSPECTOR_FIXTURE');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){const end=Date.now()+30000;while(Date.now()<end){if(await check())return;await delay(50);}throw Error('Timed out');}
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-capture-open-'));let pending=false,closed=false,assetPending=false,assetClosed=false,assetRequests=0;const children=[];
 const origin=http.createServer((req,res)=>{if(req.url==='/asset.svg'){if(++assetRequests===2){assetPending=true;req.on('close',()=>assetClosed=true);return;}res.setHeader('content-type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>');return;}if(req.url==='/assets'){res.setHeader('content-type','text/html');res.end('<img src="/asset.svg">');return;}if(req.url==='/slow'){pending=true;req.on('close',()=>closed=true);return;}res.setHeader('content-type','text/html');res.end('<!doctype html><h1>Editable website</h1>');});origin.listen(0,'127.0.0.1');await once(origin,'listening');
 const cli=path.resolve(__dirname,'../../bin/retouch.cjs'),url='http://127.0.0.1:'+origin.address().port;
 function run(route,directory,extra=[]){const child=spawn(process.execPath,[cli,'capture',url+route,'--out',directory,'--wait=0','--open',...extra],{cwd:fixture,stdio:['ignore','pipe','pipe']});children.push(child);const state={child,output:'',done:once(child,'exit')};child.stdout.on('data',data=>state.output+=data);child.stderr.on('data',data=>state.output+=data);return state;}
 try{
  const saved=path.join(root,"Website's copy"),active=run('/',saved);let editor;
  await until(()=>{editor=active.output.match(/http:\/\/localhost:\d+\/rt/)?.[0];if(active.child.exitCode!==null)throw Error(active.output);return editor;});
  assert.equal((await fetch(editor+'/__api/health').then(r=>r.json())).service,'retouch');assert.match(await fetch(new URL('/',editor)).then(r=>r.text()),/Editable website/);assert.equal(fs.existsSync(path.join(saved,'capture.json')),true);
  active.child.kill('SIGTERM');assert.equal((await active.done)[0],0);await assert.rejects(fetch(editor));assert.equal(fs.existsSync(path.join(saved,'index.html')),true,'Stop preserves the saved copy');
  const cancelled=run('/slow',path.join(root,'cancelled'));await until(()=>pending);cancelled.child.kill('SIGTERM');assert.equal((await cancelled.done)[0],130);await until(()=>closed);assert.match(cancelled.output,/Capture cancelled/);assert.equal(fs.existsSync(path.join(root,'cancelled')),false);assert.deepEqual(fs.readdirSync(root),["Website's copy"]);
  const assets=run('/assets',path.join(root,'assets'));await until(()=>assetPending);assert.ok(fs.readdirSync(root).some(name=>name.startsWith('.retouch-capture-')));assets.child.kill('SIGTERM');assert.equal((await assets.done)[0],130);await until(()=>assetClosed);assert.deepEqual(fs.readdirSync(root),["Website's copy"],'Cancellation removes staged assets');
  const duplicate=run('/',path.join(root,'duplicate'),['--open']);assert.equal((await duplicate.done)[0],1);assert.match(duplicate.output,/Unknown or duplicate/);assert.equal(fs.existsSync(path.join(root,'duplicate')),false);
  console.log('CAPTURE OPEN, EDITOR HEALTH, SAVED COPY, STOP, CANCELLATION AND DUPLICATE FLAG PASS');
 }finally{for(const child of children)if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await once(child,'exit');}origin.closeAllConnections();await new Promise(resolve=>origin.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
