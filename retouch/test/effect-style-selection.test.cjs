'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),base=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs'),linked=require('../src/html-effect-styles.cjs'),planner=require('../src/text-style-selection.cjs'),adapter={...base,describe:r=>({...base.describe(r),...css.describe(r),...linked.describe(r)})};
const source='<html><head></head><body><p>One</p><p>Two</p></body></html>',style={id:'11111111-1111-4111-8111-111111111111',name:'Soft',properties:{filter:'blur(2px)','box-shadow':'none'}};
function resolve(source){const elements=base.collect(source,'index.html').elements;return {source,file:'/tmp/index.html',relPath:'index.html',hash:base.contentHash(source),elements,element:elements.find(e=>e.tag==='p')};}
function run(r,type,style,patch={}){return planner.plan(r,{type,ids:r.elements.filter(e=>e.tag==='p').map(e=>e.id),fileHash:r.hash,width:768,...patch},style,adapter,'effect');}
test('selection effects apply together and detach without losing their declarations',()=>{
 const result=run(resolve(source),'applyEffectStyleSelection',style);assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);for(const info of result.selection){assert.equal(info.effectStyleLinks[768].id,style.id);assert.deepEqual(info.cssRules[768],style.properties);assert.equal(info.effectStyleLinks[0],undefined);}
 const r=resolve(result.edits[0].after);assert.deepEqual(run(r,'applyEffectStyleSelection',style).edits,[]);const detached=run(r,'detachEffectStyleSelection');assert.equal(detached.ok,true,detached.reason);for(let i=0;i<2;i++){assert.deepEqual(detached.selection[i].effectStyleLinks,{});assert.deepEqual(detached.selection[i].cssRules,result.selection[i].cssRules);}
});
test('mixed effect reset follows each linked definition and refuses unavailable styles atomically',()=>{
 const other={...style,id:'22222222-2222-4222-8222-222222222222',name:'Strong',properties:{filter:'blur(4px)'}};let current=source;
 for(let i=0;i<2;i++){const r=resolve(current),element=r.elements.filter(e=>e.tag==='p')[i],result=linked.plan({...r,element},{type:'applyEffectStyle',width:768},i?other:style);assert.equal(result.ok,true,result.reason);current=result.edits[0].after;}
 const r=resolve(current),library={styles:[{...style,properties:{filter:'blur(6px)'}},{...other,properties:{filter:'blur(8px)'}}]},reset=run(r,'resetEffectStyleSelection',library);assert.equal(reset.ok,true,reset.reason);assert.deepEqual(reset.selection.map(info=>info.cssRules[768].filter),['blur(6px)','blur(8px)']);const missing=run(r,'resetEffectStyleSelection',{styles:[style]});assert.equal(missing.ok,false);assert.equal(missing.edits,undefined);
 for(const patch of [{fileHash:'stale'},{width:-1},{ids:[r.element.id,r.element.id]}]){const result=run(r,'applyEffectStyleSelection',style,patch);assert.equal(result.ok,false);assert.equal(result.edits,undefined);}
 const malformed=run(resolve(source.replace('<p>Two','<p data-rt-effect-styles="bad">Two')),'applyEffectStyleSelection',style);assert.equal(malformed.ok,false);assert.equal(malformed.edits,undefined);
});
