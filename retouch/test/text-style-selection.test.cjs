'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),planner=require('../src/text-style-selection.cjs');
const style={id:'11111111-1111-4111-8111-111111111111',name:'Heading',properties:{'font-size':'32px','font-weight':'700'}};
for(const name of ['html','react']){
 const base=require('../src/adapters/'+name+'.cjs'),adapter=name==='html'?{...base,describe:r=>({...base.describe(r),...require('../src/html-css.cjs').describe(r),...require('../src/html-text-styles.cjs').describe(r)})}:base,tag=e=>e.tag||e.node.openingElement.name.name,relPath=name==='html'?'index.html':'Page.jsx';
 const source=name==='html'?'<html><head></head><body><h1>Heading</h1><p>Body</p></body></html>':'export default function Page(){return <main><h1 className="p-4 hover:text-red-500">Heading</h1><p className="mt-4">Body</p></main>}';
 function resolve(source){const elements=adapter.collect(source,relPath).elements;return {file:'/tmp/'+relPath,relPath,source,elements,element:elements.find(e=>tag(e)==='h1'),hash:adapter.contentHash(source)};}
 test(name+' selection style application composes scoped links in one source snapshot',()=>{
  const r=resolve(source),ids=r.elements.filter(e=>['h1','p'].includes(tag(e))).map(e=>e.id),op={fileHash:r.hash,ids,width:768,scope:'md:'},result=planner.plan(r,op,style,adapter);
  assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);assert.equal(result.edits[0].before,source);assert.equal(result.selection.length,2);
  for(const info of result.selection){assert.equal(info.textStyleLinks[name==='html'?'768':'md:'].id,style.id);assert.equal(info.hash,result.hash);}
  const next=resolve(result.edits[0].after);assert.deepEqual(planner.plan(next,{...op,fileHash:next.hash},style,adapter).edits,[]);
 });
 test(name+' selection style application rejects invalid or stale selections without partial edits',()=>{
  const r=resolve(source),ids=r.elements.filter(e=>['h1','p'].includes(tag(e))).map(e=>e.id);
  for(const op of [{ids,fileHash:'stale'},{ids:[ids[0],ids[0]],fileHash:r.hash},{ids:[ids[0],'aaaaaaaaaa'],fileHash:r.hash}]){const result=planner.plan(r,{width:0,scope:'',...op},style,adapter);assert.equal(result.ok,false);assert.equal(result.edits,undefined);}
  const broken=source.replace('<p','<p data-rt-text-styles="bad"'),invalid=resolve(broken),result=planner.plan(invalid,{ids:invalid.elements.filter(e=>['h1','p'].includes(tag(e))).map(e=>e.id),fileHash:invalid.hash,width:0,scope:''},style,adapter);assert.equal(result.ok,false);assert.equal(result.edits,undefined);
 });
}
