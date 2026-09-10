'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),react=require('../src/adapters/react.cjs'),catalog=require('../src/effect-styles.cjs');
const original='export default function Page(){return <main><p className="p-4">One</p><p className="opacity-50">Two</p></main>}';
async function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-react-effect-api-')),file=path.join(root,'Page.jsx');fs.writeFileSync(file,original);
 const library=catalog.change(root,{type:'create',revision:null,name:'Floating',properties:{filter:'blur(2px)','box-shadow':'none'}}),style=library.styles[0];
 const server=require('../src/server.cjs').startServer({appRoot:root,adapter:react,port:0,quiet:true});t.after(async()=>{server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});});if(!server.listening)await require('node:events').once(server,'listening');
 const url='http://localhost:'+server.address().port,shell=await(await fetch(url+'/rt')).text(),token=/__RT_TOKEN = "([0-9a-f]+)"/.exec(shell)[1],headers={'x-retouch-token':token,'content-type':'application/json'},read=()=>fs.readFileSync(file,'utf8');
 const current=()=>{const source=read(),elements=react.collect(source,'Page.jsx').elements.filter(e=>e.node.openingElement.name.name==='p');return {id:elements[0].id,ids:elements.map(e=>e.id),fileHash:react.contentHash(source),scope:'md:',styleId:style.id,libraryRevision:catalog.read(root).revision};};
 async function post(endpoint,operation){const response=await fetch(url+endpoint,{method:'POST',headers,body:JSON.stringify(operation)});return {status:response.status,...await response.json()};}
 const op=operation=>post('/rt/__api/op',operation),snapshot=()=>Object.fromEntries(['Page.jsx','.retouch/effect-styles.json','Other.jsx'].filter(name=>fs.existsSync(path.join(root,name))).map(name=>[name,fs.readFileSync(path.join(root,name),'utf8')]));
 return {root,file,read,current,op,post,snapshot,style};
}
test('React effect API applies a selection, detaches without changing classes and undoes exact bytes',async t=>{
 const f=await fixture(t),before=f.snapshot(),applied=await f.op({...f.current(),type:'applyEffectStyleSelection'});assert.equal(applied.ok,true,applied.reason);assert.equal(applied.selection.length,2);assert.ok(applied.undoId);for(const layer of applied.selection){assert.equal(layer.classEffectStyles,true);assert.equal(layer.effectStyleLinks['md:'].id,f.style.id);assert.deepEqual(layer.effectStyleOverrides['md:'],[]);}
 const after=f.snapshot(),detached=await f.op({...f.current(),type:'detachEffectStyleSelection'});assert.equal(detached.ok,true,detached.reason);assert.deepEqual(detached.selection.map(e=>e.className),applied.selection.map(e=>e.className));for(const layer of detached.selection)assert.deepEqual(layer.effectStyleLinks,{});
 assert.equal((await f.op({type:'undo',undoId:detached.undoId})).ok,true);assert.deepEqual(f.snapshot(),after);assert.equal((await f.op({type:'undo',undoId:applied.undoId})).ok,true);assert.deepEqual(f.snapshot(),before);
});
test('React effect catalog updates include unopened source, preserve local overrides, and support exact shared undo',async t=>{
 const f=await fixture(t);assert.equal((await f.op({...f.current(),type:'applyEffectStyleSelection'})).ok,true);const copied=f.read();fs.writeFileSync(path.join(f.root,'Other.jsx'),copied);
 const id=f.current().id,resolved=react.collect(copied,'Page.jsx').elements.find(e=>e.id===id),info=react.describe({file:f.file,relPath:'Page.jsx',source:copied,hash:react.contentHash(copied),element:resolved});
 const local=await f.op({...f.current(),type:'setClasses',classes:info.className.replace('md:![filter:blur(2px)]','md:![filter:blur(8px)]')});assert.equal(local.ok,true);const before=f.snapshot(),revision=catalog.read(f.root).revision;
 const updated=await f.post('/rt/__api/effect-styles',{type:'update',revision,id:f.style.id,name:f.style.name,properties:{filter:'blur(4px)'}});assert.equal(updated.ok,true,updated.reason);assert.equal(updated.updated,4);assert.ok(f.read().includes('md:![filter:blur(8px)]'));assert.ok(fs.readFileSync(path.join(f.root,'Other.jsx'),'utf8').includes('md:![filter:blur(4px)]'));
 const reset=await f.op({...f.current(),type:'resetEffectStyleSelection'});assert.equal(reset.ok,true,reset.reason);for(const layer of reset.selection){assert.deepEqual(layer.effectStyleOverrides['md:'],[]);assert.ok(layer.className.includes('md:![filter:blur(4px)]'));}
 assert.equal((await f.op({type:'undo',undoId:reset.undoId})).ok,true);assert.equal((await f.op({type:'undo',undoId:updated.undoId})).ok,true);assert.deepEqual(f.snapshot(),before);
 const fromLayer=await f.op({...f.current(),type:'updateEffectStyle',name:f.style.name,properties:{filter:'blur(6px)'}});assert.equal(fromLayer.ok,true,fromLayer.reason);assert.ok(fs.readFileSync(path.join(f.root,'Other.jsx'),'utf8').includes('md:![filter:blur(6px)]'));assert.equal((await f.op({type:'undo',undoId:fromLayer.undoId})).ok,true);assert.deepEqual(f.snapshot(),before);
});
test('React effect API rejects stale source/library and malformed project metadata without partial writes',async t=>{
 const f=await fixture(t),before=f.snapshot();for(const patch of [{fileHash:'stale'},{libraryRevision:'stale'}]){const result=await f.op({...f.current(),type:'applyEffectStyle',...patch});assert.equal(result.status,409);assert.equal(result.ok,false);assert.deepEqual(f.snapshot(),before);}
 assert.equal((await f.op({...f.current(),type:'applyEffectStyle'})).ok,true);fs.writeFileSync(path.join(f.root,'Other.jsx'),'export default function Other(){return <p data-rt-effect-styles="bad">Other</p>}');const linked=f.snapshot();
 for(const endpoint of ['catalog','layer']){const operation={id:f.style.id,name:f.style.name,properties:{filter:'blur(9px)'}},result=endpoint==='catalog'?await f.post('/rt/__api/effect-styles',{...operation,type:'update',revision:catalog.read(f.root).revision}):await f.op({...f.current(),type:'updateEffectStyle',name:operation.name,properties:operation.properties});assert.equal(result.ok,false);assert.deepEqual(f.snapshot(),linked);}
});
