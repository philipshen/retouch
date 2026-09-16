'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs'),{plan}=require('../src/html-group-scale.cjs');
const source='<!doctype html><html><head></head><body><main><div data-rt-group style="display:contents"><h1>Heading</h1><p>Text</p></div><p>Outside</p></main></body></html>';
function resolve(source){const relPath='index.html',elements=html.collect(source,relPath).elements;return {source,relPath,elements,element:elements.find(item=>item.tag==='div'),file:'/site/index.html',hash:html.contentHash(source)};}
test('HTML group scaling persists ranges, stable identities and one private runtime in one source edit',()=>{
 const r=resolve(source),first=plan(r,{fileHash:r.hash,width:0,factor:1.5});assert.equal(first.ok,true,first.reason);assert.equal(first.edits.length,1);assert.equal(first.edits[0].before,source);const next=resolve(first.edits[0].after);assert.deepEqual(next.elements.map(item=>item.id),r.elements.map(item=>item.id));assert.equal(next.elements.find(item=>item.tag==='h1').node.attrs.some(attr=>attr.name==='data-rt-scale-member'),true);
 const second=plan(next,{fileHash:next.hash,width:1100,factor:2});assert.equal(second.ok,true,second.reason);const final=resolve(second.edits[0].after),metadata=JSON.parse(final.element.node.attrs.find(attr=>attr.name==='data-rt-scale').value);assert.deepEqual(metadata,{version:1,ranges:{0:1.5,1100:3}});assert.equal((final.source.match(/<script data-rt-scale-runtime="1">/g)||[]).length,1);assert.ok(final.source.includes('<p>Outside</p>'));assert.deepEqual(plan(final,{fileHash:final.hash,width:0,factor:1}).edits,[]);
});
test('HTML scaling rejects stale source, invalid factors and modified runtime',()=>{
 const r=resolve(source);assert.equal(plan(r,{fileHash:'stale',width:0,factor:2}).ok,false);
 for(const factor of [0,101,NaN,'2'])assert.equal(plan(r,{fileHash:r.hash,width:0,factor}).ok,false);
 const first=plan(r,{fileHash:r.hash,width:0,factor:2}),edited=resolve(first.edits[0].after.replace('<script data-rt-scale-runtime="1">','<script data-rt-scale-runtime="1">/* host edit */'));assert.match(plan(edited,{fileHash:edited.hash,width:0,factor:2}).reason,/outside/);
});
test('saved scaling is one exact undoable source transaction',t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{applyPlan}=require('../src/transactions.cjs'),{SourceHistory}=require('../src/history.cjs');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-scale-history-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const file=path.join(root,'index.html');fs.writeFileSync(file,source);
 const r={...resolve(source),file},result=applyPlan(root,plan(r,{fileHash:r.hash,width:0,factor:1.5}));assert.equal(result.ok,true,result.reason);const history=new SourceHistory(),id=history.record(result.edits),saved=fs.readFileSync(file,'utf8');assert.notEqual(saved,source);assert.equal(history.apply(root,'undo',id,{}).ok,true);assert.equal(fs.readFileSync(file,'utf8'),source);assert.equal(history.apply(root,'redo',id,{}).ok,true);assert.equal(fs.readFileSync(file,'utf8'),saved);
});
test('scale anchors compose separately from pixel moves and survive range inheritance',()=>{
 let r=resolve(source);const step=op=>{const result=plan(r,{fileHash:r.hash,width:0,...op});assert.equal(result.ok,true,result.reason);r=resolve(result.edits[0].after);return JSON.parse(r.element.node.attrs.find(attr=>attr.name==='data-rt-scale').value);};
 step({factor:1.5});const anchored=step({factor:2,offset:[-.5,-.5]});assert.deepEqual(anchored.offsets,{0:[-.75,-.75]});assert.equal(anchored.ranges[0],3);
 const moved=step({factor:1,move:[23,-9]});assert.deepEqual(moved.pixels,{0:[23,-9]});assert.deepEqual(moved.offsets,anchored.offsets);
 const inherited=step({factor:.5,width:1100});assert.equal(inherited.ranges[1100],1.5);assert.deepEqual(inherited.offsets[1100],[-.75,-.75]);assert.deepEqual(inherited.pixels[1100],[23,-9]);
});
