'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{once}=require('node:events'),library=require('../src/variable-library.cjs'),{SourceHistory}=require('../src/history.cjs');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const data=()=>({version:1,collections:[{id:id(1),name:'Theme',defaultMode:id(2),modes:[{id:id(2),name:'Light'}]}],variables:[{id:id(3),collectionId:id(1),name:'Surface',type:'color',values:{[id(2)]:'#ffffff'}}]});
function setup(t){const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'rt-variable-library-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
test('variable library changes use revisions, preserve identities and support exact source undo',t=>{
 const root=setup(t),history=new SourceHistory(),plan=library.planChange(root,{type:'replace',revision:null,library:data()});assert.equal(fs.existsSync(path.join(root,'.retouch')),false);
 const applied=library.commitPlan(root,plan,(root,plan)=>history.commit(root,plan)),saved=library.read(root);assert.equal(saved.variables[0].id,id(3));assert.equal(saved.variables[0].values[id(2)],'#ffffffff');assert.equal(typeof saved.revision,'string');
 assert.throws(()=>library.planChange(root,{type:'replace',revision:null,library:data()}),/changed/);const renamed=data();renamed.variables[0].name='Renamed';const updated=library.commitPlan(root,library.planChange(root,{type:'replace',revision:saved.revision,library:renamed}),(root,plan)=>history.commit(root,plan));assert.equal(library.read(root).variables[0].id,id(3));
 assert.equal(history.apply(root,'undo',updated.undoId,{}).ok,true);assert.deepEqual(library.read(root),saved);assert.equal(history.apply(root,'undo',applied.undoId,{}).ok,true);assert.equal(library.read(root).revision,null);assert.equal(history.apply(root,'redo',applied.undoId,{}).ok,true);assert.deepEqual(library.read(root),saved);
});
test('unsafe storage, stale prepared writes and invalid default-mode aliases leave disk unchanged',t=>{
 const root=setup(t),plan=library.planChange(root,{type:'replace',revision:null,library:data()});fs.mkdirSync(path.join(root,'.retouch'));const file=path.join(root,'.retouch/variables.json');fs.writeFileSync(file,'external');assert.throws(()=>library.commitPlan(root,plan),/source changed/);assert.equal(fs.readFileSync(file,'utf8'),'external');fs.unlinkSync(file);fs.symlinkSync(path.join(root,'missing'),file);assert.throws(()=>library.read(root),/regular/);fs.unlinkSync(file);
 const cyclic=data();cyclic.variables[0].values[id(2)]={alias:id(3)};assert.throws(()=>library.planChange(root,{type:'replace',revision:null,library:cyclic}),/cycle/);assert.equal(fs.existsSync(file),false);
});
test('authenticated variable API persists across restart and restores history',async t=>{
 const root=setup(t);fs.writeFileSync(path.join(root,'index.html'),'<html><body>Variables</body></html>');const previous=process.env.RETOUCH_STATE_DIR;process.env.RETOUCH_STATE_DIR=path.join(root,'history');let server;
 const start=async()=>{server=require('../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');return 'http://127.0.0.1:'+server.address().port;};const stop=async()=>{server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server=null;};
 try{
  let base=await start();const token=async()=>{const html=await fetch(base+'/rt').then(r=>r.text());return /window\.__RT_TOKEN = "([a-f0-9]+)"/.exec(html)[1];};let headers={'x-retouch-token':await token(),'content-type':'application/json'};
  assert.equal((await fetch(base+'/rt/__api/variables')).status,401);assert.equal((await fetch(base+'/rt/__api/variables',{method:'POST',body:'{}'})).status,401);
  const post=async(url,body)=>{const response=await fetch(base+url,{method:'POST',headers,body:JSON.stringify(body)});return {status:response.status,body:await response.json()};};
  const saved=await post('/rt/__api/variables',{type:'replace',revision:null,library:data()});assert.equal(saved.status,200);assert.ok(saved.body.undoId);assert.equal((await post('/rt/__api/variables',{type:'replace',revision:null,library:data()})).status,409);
  assert.equal((await fetch(base+'/rt/__api/variables/resolve',{method:'POST',body:'{}'})).status,401);const preview=await post('/rt/__api/variables/resolve',{revision:saved.body.revision,modes:{}});assert.equal(preview.status,200);assert.equal(preview.body.values[0].value,'#ffffffff');assert.equal((await post('/rt/__api/variables/resolve',{revision:null,modes:{}})).status,409);
  await stop();base=await start();headers={'x-retouch-token':await token(),'content-type':'application/json'};const current=await fetch(base+'/rt/__api/variables',{headers}).then(r=>r.json());assert.equal(current.revision,saved.body.revision);
  assert.equal((await post('/rt/__api/op',{type:'undo',undoId:saved.body.undoId})).status,200);const undone=await fetch(base+'/rt/__api/variables',{headers}).then(r=>r.json());assert.equal(undone.revision,null);assert.deepEqual(undone.collections,[]);
 }finally{if(server)await stop();if(previous===undefined)delete process.env.RETOUCH_STATE_DIR;else process.env.RETOUCH_STATE_DIR=previous;}
});

test('mode preview resolves exact revisions without writes and rejects cyclic mode combinations',t=>{
 const root=setup(t),input=data(),dark=id(4);input.collections[0].modes.push({id:dark,name:'Dark'});input.variables[0].values[dark]={alias:id(3)};library.commitPlan(root,library.planChange(root,{type:'replace',revision:null,library:input}));const saved=library.read(root),file=path.join(root,'.retouch/variables.json'),bytes=fs.readFileSync(file,'utf8');
 assert.equal(library.resolve(root,{revision:saved.revision,modes:{}}).values[0].value,'#ffffffff');assert.throws(()=>library.resolve(root,{revision:saved.revision,modes:{[id(1)]:dark}}),/cycle/);assert.throws(()=>library.resolve(root,{revision:null,modes:{}}),/changed/);assert.throws(()=>library.resolve(root,{revision:saved.revision,modes:{[id(1)]:id(99)}}),/selected mode/);assert.equal(fs.readFileSync(file,'utf8'),bytes);
});

test('HTML variable API binds modes and updates unvisited pages in one undoable transaction',async t=>{
 const root=setup(t),html=require('../src/adapters/html.cjs'),linked=require('../src/html-variable-bindings.cjs'),css=require('../src/html-css.cjs');
 const page=path.join(root,'index.html'),other=path.join(root,'other.html'),original='<html><head></head><body><p>Bound</p></body></html>';fs.writeFileSync(page,original);
 const previous=process.env.RETOUCH_STATE_DIR;process.env.RETOUCH_STATE_DIR=path.join(root,'history');let server;
 const resolve=(file,source)=>({file,relPath:path.basename(file),source,hash:html.contentHash(source),element:html.collect(source,path.basename(file)).elements.find(e=>e.tag==='p')});
 try{
  server=require('../src/html-site.cjs').start({root,port:0,quiet:true});await once(server,'listening');const base='http://127.0.0.1:'+server.address().port,markup=await fetch(base+'/rt').then(r=>r.text()),headers={'x-retouch-token':/window\.__RT_TOKEN = "([a-f0-9]+)"/.exec(markup)[1],'content-type':'application/json'};
  const post=async(url,body)=>{const r=await fetch(base+url,{method:'POST',headers,body:JSON.stringify(body)});return {status:r.status,body:await r.json()};};
  const input=data();input.collections[0].modes.push({id:id(4),name:'Dark'});input.variables[0].values[id(4)]='#000000';
  const saved=await post('/rt/__api/variables',{type:'replace',revision:null,library:input});assert.equal(saved.status,200,JSON.stringify(saved.body));
  const r=resolve(page,original),operation={type:'applyVariable',id:r.element.id,fileHash:r.hash,property:'color',width:768,libraryRevision:saved.body.revision,binding:{id:id(3),modes:{[id(1)]:id(4)}}};
  assert.equal((await post('/rt/__api/op',{...operation,libraryRevision:null})).status,409);assert.equal(fs.readFileSync(page,'utf8'),original);
  const bound=await post('/rt/__api/op',operation);assert.equal(bound.status,200,JSON.stringify(bound.body));assert.ok(bound.body.undoId);
  const beforePage=fs.readFileSync(page,'utf8');assert.equal(css.describe(resolve(page,beforePage)).cssRules[768].color,'#000000ff');
  const planned=linked.plan(resolve(other,original),{type:'applyVariable',property:'color',width:0,binding:{id:id(3)}},input);assert.equal(planned.ok,true,planned.reason);fs.writeFileSync(other,planned.edits[0].after);const beforeOther=fs.readFileSync(other,'utf8'),catalog=path.join(root,'.retouch/variables.json'),beforeCatalog=fs.readFileSync(catalog,'utf8');
  input.variables[0].values[id(2)]='#ff0000';input.variables[0].values[id(4)]='#00ff00';
  const updated=await post('/rt/__api/variables',{type:'replace',revision:saved.body.revision,library:input});assert.equal(updated.status,200,JSON.stringify(updated.body));assert.equal(updated.body.updated,2);assert.equal(css.describe(resolve(page,fs.readFileSync(page,'utf8'))).cssRules[768].color,'#00ff00ff');assert.equal(css.describe(resolve(other,fs.readFileSync(other,'utf8'))).cssRules[0].color,'#ff0000ff');
  const removed=structuredClone(input);removed.variables=[];const rejected=await post('/rt/__api/variables',{type:'replace',revision:updated.body.revision,library:removed});assert.equal(rejected.status,409);assert.equal(library.read(root).revision,updated.body.revision);
  const missingMode=structuredClone(input);missingMode.collections[0].modes.pop();delete missingMode.variables[0].values[id(4)];assert.equal((await post('/rt/__api/variables',{type:'replace',revision:updated.body.revision,library:missingMode})).status,409);
  assert.equal((await post('/rt/__api/op',{type:'undo',undoId:updated.body.undoId})).status,200);assert.equal(fs.readFileSync(page,'utf8'),beforePage);assert.equal(fs.readFileSync(other,'utf8'),beforeOther);assert.equal(fs.readFileSync(catalog,'utf8'),beforeCatalog);
  assert.equal((await post('/rt/__api/op',{type:'undo',undoId:bound.body.undoId})).status,200);assert.equal(fs.readFileSync(page,'utf8'),original);
 }finally{if(server){server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(previous===undefined)delete process.env.RETOUCH_STATE_DIR;else process.env.RETOUCH_STATE_DIR=previous;}
});

test('project variable planning refuses cyclic bound modes, unindexed links and stale page writes atomically',t=>{
 const root=setup(t),planner=require('../src/variable-update.cjs'),linked=require('../src/html-variable-bindings.cjs'),html=require('../src/adapters/html.cjs'),input=data(),file=path.join(root,'index.html'),source='<html><head></head><body><p>Value</p></body></html>';
 input.collections[0].modes.push({id:id(4),name:'Dark'});input.variables[0].values[id(4)]='#000000';library.commitPlan(root,library.planChange(root,{type:'replace',revision:null,library:input}));
 const binding=linked.plan({file,relPath:'index.html',source,hash:html.contentHash(source),element:html.collect(source,'index.html').elements.find(e=>e.tag==='p')},{type:'applyVariable',property:'color',width:0,binding:{id:id(3),modes:{[id(1)]:id(4)}}},input);assert.equal(binding.ok,true,binding.reason);fs.writeFileSync(file,binding.edits[0].after);
 const before=fs.readFileSync(file,'utf8'),saved=library.read(root),operation=()=>({type:'replace',revision:saved.revision,library:input});
 input.variables[0].values[id(4)]={alias:id(3)};const cycle=planner.plan(root,operation());assert.equal(cycle.ok,false);assert.match(cycle.reason,/cycle/);assert.equal(cycle.edits,undefined);
 input.variables[0].values[id(4)]='#ff0000';const badFile=path.join(root,'unvisited.html');fs.writeFileSync(badFile,'<template><p data-rt-variables="{}">Hidden</p></template>');const invalid=planner.plan(root,operation());assert.equal(invalid.ok,false);assert.match(invalid.reason,/unindexed/);assert.equal(invalid.edits,undefined);fs.unlinkSync(badFile);
 const prepared=planner.plan(root,operation());assert.equal(prepared.ok,true,prepared.reason);assert.equal(prepared.edits.length,2);fs.writeFileSync(file,before+'<!-- external edit -->');assert.throws(()=>library.commitPlan(root,prepared),/source changed/);assert.deepEqual(library.read(root),saved);assert.equal(fs.readFileSync(file,'utf8'),before+'<!-- external edit -->');
});
