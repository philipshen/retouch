 'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),base=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs'),colors=require('../src/html-color-styles.cjs'),planner=require('../src/text-style-selection.cjs');
const adapter={...base,describe:r=>({...base.describe(r),...css.describe(r),...colors.describe(r)})},source='<html><head></head><body><h1>Title</h1><p>Body</p></body></html>',style={id:'11111111-1111-4111-8111-111111111111',name:'Brand',properties:{color:'#12345678'}};
function resolve(source){const elements=adapter.collect(source,'index.html').elements;return {file:'/tmp/index.html',relPath:'index.html',source,elements,element:elements.find(e=>e.tag==='h1'),hash:adapter.contentHash(source)};}
function run(r,type,style,extra={}){return planner.plan(r,{type,ids:r.elements.filter(e=>['h1','p'].includes(e.tag)).map(e=>e.id),fileHash:r.hash,width:768,property:'background-color',...extra},style,adapter,'color');}
test('color selection applies one property and scope atomically and detaches without changing paint',()=>{
 const r=resolve(source),applied=run(r,'applyColorStyleSelection',style);assert.equal(applied.ok,true,applied.reason);assert.equal(applied.edits.length,1);
 for(const info of applied.selection){assert.equal(info.colorStyleLinks[768]['background-color'].id,style.id);assert.equal(info.cssRules[768]['background-color'],'#12345678');assert.equal(info.colorStyleLinks[0],undefined);}
 const next=resolve(applied.edits[0].after);assert.deepEqual(run(next,'applyColorStyleSelection',style).edits,[]);
 const detached=run(next,'detachColorStyleSelection');assert.equal(detached.ok,true,detached.reason);for(let i=0;i<2;i++){assert.deepEqual(detached.selection[i].colorStyleLinks,{});assert.deepEqual(detached.selection[i].cssRules,applied.selection[i].cssRules);}
});
test('color selection reset follows mixed links, skips unlinked layers and refuses missing definitions',()=>{
 const other={...style,id:'22222222-2222-4222-8222-222222222222',name:'Other',properties:{color:'#abcdef'}};let current=source;
 for(const [tag,value]of [['h1',style],['p',other]]){const r=resolve(current),result=colors.plan({...r,element:r.elements.find(e=>e.tag===tag)},{type:'applyColorStyle',width:768,property:'background-color'},value);assert.equal(result.ok,true,result.reason);current=result.edits[0].after;}
 const r=resolve(current),library={styles:[{...style,properties:{color:'#000'}},{...other,properties:{color:'#fff'}}]},reset=run(r,'resetColorStyleSelection',library);assert.equal(reset.ok,true,reset.reason);assert.deepEqual(reset.selection.map(info=>info.cssRules[768]['background-color']),['#000','#fff']);
 const missing=run(r,'resetColorStyleSelection',{styles:[style]});assert.equal(missing.ok,false);assert.equal(missing.edits,undefined);
 const unlinked=resolve(source);assert.deepEqual(run(unlinked,'resetColorStyleSelection',library).edits,[]);
});
test('color selection refuses stale, invalid or malformed selections without a partial edit',()=>{
 const r=resolve(source);for(const extra of [{fileHash:'stale'},{property:'opacity'},{ids:[r.element.id,r.element.id]},{ids:[r.element.id,'aaaaaaaaaa']}]){const result=run(r,'applyColorStyleSelection',style,extra);assert.equal(result.ok,false);assert.equal(result.edits,undefined);}
 const broken=resolve(source.replace('<p','<p data-rt-color-styles="bad"')),result=run(broken,'applyColorStyleSelection',style);assert.equal(result.ok,false);assert.equal(result.edits,undefined);
});
