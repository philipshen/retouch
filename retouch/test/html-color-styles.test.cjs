'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs'),linked=require('../src/html-color-styles.cjs');
const original='<html><head></head><body><p>Color</p></body></html>',style={id:'11111111-1111-4111-8111-111111111111',name:'Brand',properties:{color:'#3698'}};
const resolve=source=>{const elements=html.collect(source,'index.html').elements;return {file:'/tmp/index.html',relPath:'index.html',source,elements,element:elements.find(e=>e.tag==='p'),hash:html.contentHash(source)};};
const apply=(source,property='color',width=0)=>linked.plan(resolve(source),{type:'applyColorStyle',property,width},style);
test('HTML color links isolate target properties and screen scopes and detach preserves paint',()=>{
 let source=original;for(const [property,width]of [['color',0],['background-color',0],['color',768]]){const result=apply(source,property,width);assert.equal(result.ok,true,result.reason);source=result.edits[0].after;}
 const r=resolve(source),description=linked.describe(r);assert.equal(description.colorStyleLinks[768].color.id,style.id);assert.deepEqual(description.colorStyleOverrides,{0:[],768:[]});assert.deepEqual(apply(source,'color',768).edits,[]);
 const detached=linked.plan(r,{type:'detachColorStyle',property:'color',width:768});assert.equal(detached.ok,true);const fresh=resolve(detached.edits[0].after);assert.deepEqual(css.describe(fresh).cssRules,css.describe(r).cssRules);assert.deepEqual(Object.keys(linked.describe(fresh).colorStyleLinks),['0']);
});
test('HTML palette refresh preserves local overrides across matching values until reset',()=>{
 const initial=apply(original).edits[0].after,r=resolve(initial),edited=css.plan(r,{width:0,property:'color',value:'#fff'}).edits[0].after;
 const next={...style,properties:{color:'#fff'}},first=linked.planFile('/tmp/index.html','index.html',edited,next);assert.equal(first.ok,true,first.reason);assert.equal(first.updated,1);assert.equal(linked.describe(resolve(first.edits[0].after)).colorStyleLinks[0].color.override,true);
 const later={...style,properties:{color:'#000'}},second=linked.planFile('/tmp/index.html','index.html',first.edits[0].after,later);assert.equal(second.ok,true);assert.equal(css.describe(resolve(second.edits[0].after)).cssRules[0].color,'#fff');
 const reset=linked.plan(resolve(second.edits[0].after),{type:'resetColorStyle',property:'color',width:0},later);assert.equal(reset.ok,true);assert.equal(css.describe(resolve(reset.edits[0].after)).cssRules[0].color,'#000');assert.deepEqual(linked.describe(resolve(reset.edits[0].after)).colorStyleOverrides[0],[]);
});
test('HTML color planners refuse malformed links and stale or unsupported operations without edits',()=>{
 for(const op of [{type:'applyColorStyle',property:'color',width:0,fileHash:'stale'},{type:'applyColorStyle',property:'display',width:0},{type:'resetColorStyle',property:'color',width:0},{type:'applyColorStyle',property:'color',width:-1}]){const result=linked.plan(resolve(original),op,style);assert.equal(result.ok,false);assert.equal(result.edits,undefined);}
 const initial=apply(original).edits[0].after;for(const source of [initial+'<p data-rt-color-styles="bad">Bad</p>',initial.replace('<p ','<template ').replace('</p>','</template>')]){const result=linked.planFile('/tmp/index.html','index.html',source,{...style,properties:{color:'#fff'}});assert.equal(result.ok,false);assert.equal(result.edits,undefined);}
});
