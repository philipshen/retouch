'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const catalog=require('../src/text-styles.cjs'),linked=require('../src/html-text-styles.cjs'),html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs'),update=require('../src/text-style-update.cjs'),{applyPlan}=require('../src/transactions.cjs'),{SourceHistory}=require('../src/history.cjs');
const original='<html><head></head><body><p>Hello</p></body></html>';
function resolve(root,file,source){const relPath=path.relative(root,file);return {file,relPath,source,hash:html.contentHash(source),element:html.collect(source,relPath).elements.find(e=>e.tag==='p')};}
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-style-update-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const saved=catalog.change(root,{type:'create',revision:null,name:'Body',properties:{'font-size':'20px','font-weight':'400'}}),style=saved.styles[0];for(const name of ['index.html','second.html']){const file=path.join(root,name),applied=linked.plan(resolve(root,file,original),{type:'applyTextStyle',width:0},style);fs.writeFileSync(file,applied.edits[0].after);}return {root,saved,style,operation:{type:'update',revision:saved.revision,id:style.id,name:style.name,properties:{'font-size':'30px','font-weight':'700'}}};}
function snapshot(root){return Object.fromEntries(['.retouch/text-styles.json','index.html','second.html'].map(name=>[name,fs.readFileSync(path.join(root,name),'utf8')]));}
test('project update plans catalog and unvisited pages together and supports exact transaction undo/redo',t=>{
 const {root,operation}=fixture(t),before=snapshot(root),plan=update.plan(root,operation);assert.equal(plan.ok,true);assert.equal(plan.updated,2);assert.equal(plan.pages,2);assert.equal(plan.edits.length,3);assert.deepEqual(snapshot(root),before,'planning cannot mutate');
 const applied=applyPlan(root,plan);assert.equal(applied.ok,true);const after=snapshot(root);assert.equal(catalog.read(root).styles[0].properties['font-size'],'30px');
 for(const name of ['index.html','second.html'])assert.equal(css.describe(resolve(root,path.join(root,name),after[name])).cssRules[0]['font-size'],'30px');
 const history=new SourceHistory(),id=history.record(applied.edits);assert.equal(history.apply(root,'undo',id,html).ok,true);assert.deepEqual(snapshot(root),before);assert.equal(history.apply(root,'redo',id,html).ok,true);assert.deepEqual(snapshot(root),after);
});
test('invalid linked page refuses the entire update without changing catalog or earlier pages',t=>{
 const {root,operation}=fixture(t),file=path.join(root,'second.html');fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('font-size:20px','font-size:25px'));const before=snapshot(root),plan=update.plan(root,operation);assert.equal(plan.ok,false);assert.match(plan.reason,/second.html/);assert.equal(plan.edits,undefined);assert.deepEqual(snapshot(root),before);
});
test('external edits after planning refuse the transaction before catalog mutation',t=>{
 const {root,operation}=fixture(t),plan=update.plan(root,operation),file=path.join(root,'second.html');fs.appendFileSync(file,'\n<!-- external -->');const before=snapshot(root);assert.equal(applyPlan(root,plan).ok,false);assert.deepEqual(snapshot(root),before);
});
test('rename-only changes do not rewrite linked source and stale catalog updates refuse',t=>{
 const {root,operation}=fixture(t),current=catalog.read(root);const rename=update.plan(root,{...operation,name:'Renamed',properties:current.styles[0].properties});assert.equal(rename.ok,true);assert.equal(rename.edits.length,1);assert.equal(rename.updated,0);assert.equal(update.plan(root,{...operation,revision:'stale'}).ok,false);
});
test('an unindexed linked layer blocks project mutation instead of silently leaving an old style behind',t=>{
 const {root,operation}=fixture(t),file=path.join(root,'second.html');fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('<p ','<template><p ').replace('</p>','</p></template>'));const before=snapshot(root),plan=update.plan(root,operation);assert.equal(plan.ok,false);assert.match(plan.reason,/second.html.*unsupported or ambiguous markup/);assert.deepEqual(snapshot(root),before);
});
test('HTML catalog API propagates direct property updates and records one shared undo',async t=>{
 const {root,operation}=fixture(t),before=snapshot(root),server=require('../src/html-site.cjs').start({root,port:0,quiet:true});
 t.after(async()=>{server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 if(!server.listening)await require('node:events').once(server,'listening');const url='http://localhost:'+server.address().port;
 const shell=await(await fetch(url+'/rt')).text(),token=/__RT_TOKEN = "([0-9a-f]+)"/.exec(shell)[1],headers={'x-retouch-token':token,'content-type':'application/json'};
 const response=await fetch(url+'/rt/__api/text-styles',{method:'POST',headers,body:JSON.stringify(operation)});assert.equal(response.status,200);const result=await response.json();assert.equal(result.updated,2);assert.ok(result.undoId);assert.notDeepEqual(snapshot(root),before);
 const undo=await fetch(url+'/rt/__api/op',{method:'POST',headers,body:JSON.stringify({type:'undo',undoId:result.undoId})});assert.equal(undo.status,200);assert.deepEqual(snapshot(root),before);
});
function reactFixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-react-update-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const saved=catalog.change(root,{type:'create',revision:null,name:'React Body',properties:{'font-size':'20px','font-weight':'400'}}),adapter=require('../src/adapters/react.cjs'),planner=require('../src/jsx-text-styles.cjs');
 for(const relPath of ['Page.jsx','components/Unvisited.tsx']){const file=path.join(root,relPath),source='export default function Text(){return <p className="p-4">Text</p>}';fs.mkdirSync(path.dirname(file),{recursive:true});const result=planner.plan({file,relPath,source,hash:adapter.contentHash(source),element:adapter.collect(source,relPath).elements[0]},{type:'applyTextStyle',scope:''},saved.styles[0]);assert.equal(result.ok,true,result.reason);fs.writeFileSync(file,result.edits[0].after);}
 const snapshot=()=>Object.fromEntries(['.retouch/text-styles.json','Page.jsx','components/Unvisited.tsx'].map(name=>[name,fs.readFileSync(path.join(root,name),'utf8')]));
 return {root,adapter,snapshot,operation:{type:'update',revision:saved.revision,id:saved.id,name:'React Body',properties:{'font-size':'30px','font-weight':'700'}}};
}
test('React project updates include unopened components and refuse malformed source before writing',t=>{
 const {root,snapshot,operation}=reactFixture(t),before=snapshot();fs.mkdirSync(path.join(root,'node_modules'));fs.writeFileSync(path.join(root,'node_modules/ignored.jsx'),'invalid JSX');
 const plan=update.plan(root,operation,'react');assert.equal(plan.ok,true,plan.reason);assert.equal(plan.updated,2);assert.equal(plan.edits.length,3);assert.deepEqual(snapshot(),before);
 fs.writeFileSync(path.join(root,'broken.tsx'),'export default function (');const refused=update.plan(root,operation,'react');assert.equal(refused.ok,false);assert.deepEqual(snapshot(),before);
});
test('React catalog HTTP update commits linked components and catalog with exact shared undo',async t=>{
 const {root,adapter,snapshot,operation}=reactFixture(t),before=snapshot(),server=require('../src/server.cjs').startServer({appRoot:root,adapter,port:0,quiet:true});t.after(async()=>{server.retouchIndex.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});if(!server.listening)await require('node:events').once(server,'listening');
 const url='http://localhost:'+server.address().port,shell=await(await fetch(url+'/rt')).text(),token=/__RT_TOKEN = "([0-9a-f]+)"/.exec(shell)[1],headers={'x-retouch-token':token,'content-type':'application/json'};
 const response=await fetch(url+'/rt/__api/text-styles',{method:'POST',headers,body:JSON.stringify(operation)});assert.equal(response.status,200);const result=await response.json();assert.equal(result.updated,2);assert.ok(result.undoId);assert.ok(snapshot()['components/Unvisited.tsx'].includes('![font-size:30px]'));
 const undo=await fetch(url+'/rt/__api/op',{method:'POST',headers,body:JSON.stringify({type:'undo',undoId:result.undoId})});assert.equal(undo.status,200);assert.deepEqual(snapshot(),before);
});
