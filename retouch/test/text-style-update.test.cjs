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
