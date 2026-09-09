'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{stackLayout,flexAlignment,valid}=require('../shell/html-css-values.js'),html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs');
test('Stack controls choose physical horizontal and vertical axes across writing modes',()=>{
 for(const mode of ['horizontal-tb','vertical-rl','vertical-lr','sideways-rl','sideways-lr'])for(const axis of ['horizontal','vertical']){
  const changes=stackLayout(axis,mode);assert.equal(changes.display,'flex');assert.equal(changes['flex-wrap'],'nowrap');assert.equal(changes['flex-direction'],(axis==='horizontal')===(mode==='horizontal-tb')?'row':'column');
 }
});
test('Alignment control maps physical positions through RTL, reversed flex and vertical writing',()=>{
 const cases=[
  [{},['flex-start','flex-start']],
  [{direction:'rtl'},['flex-end','flex-start']],
  [{flexDirection:'row-reverse'},['flex-end','flex-start']],
  [{direction:'rtl',flexDirection:'column'},['flex-start','flex-end']],
  [{writingMode:'vertical-rl'},['flex-start','flex-end']],
  [{writingMode:'vertical-lr',flexDirection:'column-reverse'},['flex-end','flex-start']],
  [{writingMode:'sideways-lr'},['flex-end','flex-start']]
 ];
 for(const [state,expected]of cases){const topLeft=flexAlignment(0,0,state);assert.deepEqual(Object.values(topLeft),expected);assert.deepEqual(Object.values(flexAlignment(1,1,state)),['center','center']);assert.deepEqual(Object.values(flexAlignment(2,2,state)),expected.map(v=>v==='flex-start'?'flex-end':'flex-start'));for(const [property,value]of Object.entries(topLeft))assert.equal(valid(property,value),true);}
});
test('Stack and alignment changes form one responsive source edit and refuse conflicting declarations atomically',()=>{
 const source='<html><head></head><body><main><p>One</p><p>Two</p></main></body></html>',elements=html.collect(source,'index.html').elements,r={source,elements,element:elements.find(e=>e.tag==='main'),hash:html.contentHash(source),file:'/tmp/index.html',relPath:'index.html'},changes={...stackLayout('horizontal'),...flexAlignment(2,2)};
 const result=css.plan(r,{changes,width:768,fileHash:r.hash});assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);const after=result.edits[0].after,next=html.collect(after,'index.html').elements;assert.deepEqual(css.describe({...r,source:after,elements:next,element:next.find(e=>e.tag==='main')}).cssRules,{768:changes});
 const conflict=source.replace('<main>','<main style="display:block !important">'),items=html.collect(conflict,'index.html').elements,refusal=css.plan({...r,source:conflict,hash:html.contentHash(conflict),elements:items,element:items.find(e=>e.tag==='main')},{changes,width:768});assert.equal(refusal.refused,true);assert.equal(refusal.edits,undefined);
});
