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
 test(name+' selection reset follows mixed links and detach preserves appearance',()=>{
  const linked=require('../src/'+(name==='html'?'html':'jsx')+'-text-styles.cjs'),scope=name==='html'?'0':'',r=resolve(source),ids=r.elements.filter(e=>['h1','p'].includes(tag(e))).map(e=>e.id),other={...style,id:'22222222-2222-4222-8222-222222222222',name:'Body',properties:{'font-size':'20px'}};
  let current=source;
  for(let i=0;i<ids.length;i++){const state=resolve(current),element=state.elements.find(e=>e.id===ids[i]),result=linked.plan({...state,element},{type:'applyTextStyle',width:0,scope:''},i?other:style);assert.equal(result.ok,true,result.reason);current=result.edits[0].after;}
  const state=resolve(current),library={styles:[{...style,properties:{'font-size':'48px'}},{...other,properties:{'font-size':'24px'}}]},op={ids,fileHash:state.hash,width:0,scope:'',type:'resetTextStyleSelection'};
  const reset=planner.plan(state,op,library,adapter);assert.equal(reset.ok,true,reset.reason);assert.deepEqual(reset.selection.map(info=>info.textStyleLinks[scope].properties['font-size']),['48px','24px']);
  const missing=planner.plan(state,op,{styles:[library.styles[0]]},adapter);assert.equal(missing.ok,false);assert.equal(missing.edits,undefined);
  const next=resolve(reset.edits[0].after),detached=planner.plan(next,{...op,type:'detachTextStyleSelection',fileHash:next.hash},undefined,adapter);assert.equal(detached.ok,true,detached.reason);
  for(let i=0;i<2;i++){assert.deepEqual(detached.selection[i].textStyleLinks,{});if(name==='react')assert.equal(detached.selection[i].className,reset.selection[i].className);else assert.deepEqual(detached.selection[i].cssRules,reset.selection[i].cssRules);}
  const clear=resolve(detached.edits[0].after);assert.deepEqual(planner.plan(clear,{...op,type:'detachTextStyleSelection',fileHash:clear.hash},undefined,adapter).edits,[]);
  const one=linked.plan(r,{type:'applyTextStyle',width:0,scope:''},style),partial=resolve(one.edits[0].after),unlinkedBefore=adapter.describe({...partial,element:partial.elements.find(e=>e.id===ids[1])}),partialReset=planner.plan(partial,{...op,fileHash:partial.hash},library,adapter);assert.equal(partialReset.ok,true,partialReset.reason);assert.deepEqual(partialReset.selection[1].textStyleLinks,{});if(name==='react')assert.equal(partialReset.selection[1].className,unlinkedBefore.className);else assert.deepEqual(partialReset.selection[1].cssRules,unlinkedBefore.cssRules);
 });

}
