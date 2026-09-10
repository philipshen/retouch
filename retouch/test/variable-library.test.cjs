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
  await stop();base=await start();headers={'x-retouch-token':await token(),'content-type':'application/json'};const current=await fetch(base+'/rt/__api/variables',{headers}).then(r=>r.json());assert.equal(current.revision,saved.body.revision);
  assert.equal((await post('/rt/__api/op',{type:'undo',undoId:saved.body.undoId})).status,200);const undone=await fetch(base+'/rt/__api/variables',{headers}).then(r=>r.json());assert.equal(undone.revision,null);assert.deepEqual(undone.collections,[]);
 }finally{if(server)await stop();if(previous===undefined)delete process.env.RETOUCH_STATE_DIR;else process.env.RETOUCH_STATE_DIR=previous;}
});
