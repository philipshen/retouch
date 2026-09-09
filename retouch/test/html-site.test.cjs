'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{once}=require('node:events');
const {start}=require('../src/html-site.cjs');
test('HTML site serves stamped documents and assets, edits through authenticated API and undoes exactly',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-html-site-'));
 const original='<!doctype html><html><head><link rel="stylesheet" href="site.css"></head><body><h1 class="title">Hello</h1></body></html>';
 fs.writeFileSync(path.join(root,'index.html'),original);fs.writeFileSync(path.join(root,'site.css'),'.title{color:red}');fs.writeFileSync(path.join(root,'.secret'),'hidden');fs.symlinkSync('/etc/passwd',path.join(root,'escape.html'));
 const server=start({root,port:0,quiet:true});await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 try{
  const page=await (await fetch(base)).text();const id=/<h1 data-rt="([a-f0-9]+)"/.exec(page)[1];assert.equal(fs.readFileSync(path.join(root,'index.html'),'utf8'),original);
  assert.equal(await (await fetch(base+'/site.css')).text(),'.title{color:red}');
  for(const p of ['/.secret','/escape.html','/package.json','/%2e%2e%5csecret'])assert.equal((await fetch(base+p)).status,403,p);
  const shell=await (await fetch(base+'/rt')).text(),token=/__RT_TOKEN = "([a-f0-9]+)"/.exec(shell)[1];
  const op=async value=>{const r=await fetch(base+'/rt/__api/op',{method:'POST',headers:{'x-retouch-token':token},body:JSON.stringify(value)});return r.json();};
  assert.equal((await op({id,type:'setClasses',classes:'w-40'})).refused,true);
  const styled=await op({id,type:'setCSS',width:768,property:'width',value:'320px'});assert.equal(styled.ok,true);
  assert.deepEqual(styled.element.cssRules,{768:{width:'320px'}});
  assert.equal((await op({type:'undo',undoId:styled.undoId})).ok,true);assert.equal(fs.readFileSync(path.join(root,'index.html'),'utf8'),original);
  const result=await op({id,type:'setText',text:'New & clear'});assert.equal(result.ok,true);
  assert.ok((await (await fetch(base)).text()).includes('New &amp; clear'));
  assert.equal((await op({type:'undo',undoId:result.undoId})).ok,true);assert.equal(fs.readFileSync(path.join(root,'index.html'),'utf8'),original);
 }finally{server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
});
