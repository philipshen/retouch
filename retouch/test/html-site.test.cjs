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

test('HTML image assets list root files with encoded URLs and upload into a contained image directory',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-html-assets-')),outside=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-html-outside-'));
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
 fs.writeFileSync(path.join(root,'index.html'),'<img src="first.svg">');
 fs.writeFileSync(path.join(root,'photo #1.svg'),svg);
 for(const folder of ['.hidden','node_modules']){fs.mkdirSync(path.join(root,folder));fs.writeFileSync(path.join(root,folder,'secret.svg'),svg);}
 fs.symlinkSync(outside,path.join(root,'linked'));fs.writeFileSync(path.join(outside,'outside.svg'),svg);
 const server=start({root,port:0,quiet:true});await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 try{
  const shell=await (await fetch(base+'/rt')).text(),token=/__RT_TOKEN = "([a-f0-9]+)"/.exec(shell)[1],headers={'x-retouch-token':token};
  const images=await (await fetch(base+'/rt/__api/images',{headers})).json();assert.deepEqual(images.images,[{src:'/photo%20%231.svg',name:'photo #1.svg'}]);
  assert.equal(await (await fetch(base+images.images[0].src)).text(),svg);
  const upload=name=>fetch(base+'/rt/__api/upload?name='+encodeURIComponent(name),{method:'POST',headers,body:svg});
  assert.equal((await upload('page.html')).status,409);
  const saved=await (await upload('new image.svg')).json();assert.equal(saved.ok,true);assert.match(saved.src,/^\/rt-assets\/rt-[a-f0-9]+-new-image.svg$/);
  assert.equal(await (await fetch(base+saved.src)).text(),svg);
  fs.rmSync(path.join(root,'rt-assets'),{recursive:true});fs.symlinkSync(outside,path.join(root,'rt-assets'));
  assert.equal((await upload('escape.svg')).status,409);assert.deepEqual(fs.readdirSync(outside),['outside.svg']);
 }finally{server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});fs.rmSync(outside,{recursive:true,force:true});}
});

test('HTML page catalog uses navigable encoded routes and excludes private or reserved trees',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-html-pages-'));
 for(const file of ['index.html','index.htm','about us.html','guide/index.htm','.hidden/private.html','node_modules/demo.html','rt/index.html']){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),'<h1>'+file+'</h1>');}
 fs.symlinkSync(path.join(root,'guide'),path.join(root,'alias'));
 const server=start({root,port:0,quiet:true});await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal((await fetch(base+'/rt/__api/pages')).status,401);
  const shell=await (await fetch(base+'/rt')).text(),token=/__RT_TOKEN = "([a-f0-9]+)"/.exec(shell)[1];
  const result=await (await fetch(base+'/rt/__api/pages',{headers:{'x-retouch-token':token}})).json();
  assert.equal(result.available,true);assert.deepEqual(result.pages.map(p=>p.url).sort(),['/','/about%20us.html','/guide/','/index.htm']);
  for(const page of result.pages)assert.equal((await fetch(base+page.url)).status,200,page.path);
  fs.writeFileSync(path.join(root,'new.html'),'<html><body><h1>Just created</h1></body></html>');
  const created=await (await fetch(base+'/new.html')).text(),id=/<h1 data-rt="([a-f0-9]+)"/.exec(created)[1];
  const resolved=await (await fetch(base+'/rt/__api/resolve?id='+id,{headers:{'x-retouch-token':token}})).json();assert.equal(resolved.ok,true,'served new pages resolve immediately');

 }finally{server.retouchIndex.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
});
