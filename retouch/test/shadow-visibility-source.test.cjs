'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../shell/shadow-visibility.js'),R=require('../shell/responsive.js'),V=require('../shell/html-css-values.js'),html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs'),selection=require('../src/html-css-selection.cjs');
const original='<html><head></head><body><h1>First</h1><h1>Second</h1></body></html>',shadow={x:2,y:4,blur:8,spread:0,color:'color(display-p3 0.2 0.4 0.6 / 0.75)',inset:true,hidden:true},hidden=S.write([shadow]);
function resolve(source){const elements=html.collect(source,'index.html').elements;return {source,file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(source),elements,element:elements.find(element=>element.tag==='h1')};}
test('class visibility writes preserve other scopes and reset both declarations together',()=>{
 const initial='shadow-lg blur-sm md:shadow-sm hover:shadow-xl',next=S.classes(initial,'md:',hidden),projected=R.project(next,'md:');assert.ok(projected.includes('!['+S.property+':'+hidden[S.property]+']'));assert.ok(projected.includes('![box-shadow:'+hidden['box-shadow'].replace(/\s/g,'_')+']'));assert.equal(S.classes(next,'md:',hidden),next);assert.ok(next.includes('shadow-lg'));assert.ok(next.includes('hover:shadow-xl'));assert.ok(next.includes('blur-sm'));
 const reset=S.classes(next,'md:',{'box-shadow':null,[S.property]:null});assert.equal(R.project(reset,'md:'),'');assert.equal(reset,'shadow-lg blur-sm hover:shadow-xl');
 for(const changes of [{[S.property]:hidden[S.property]},{...hidden,'box-shadow':'none'},{...hidden,[S.property]:null},{...hidden,opacity:'0'}])assert.throws(()=>S.classes(initial,'md:',changes));assert.throws(()=>S.classes('md:!ring-2','md:',hidden),/important/);
});
test('HTML saves visibility with the matching stack in one scoped source edit',()=>{
 const result=css.plan(resolve(original),{width:768,changes:hidden});assert.equal(result.ok,true);assert.equal(result.edits.length,1);assert.equal(result.edits[0].before,original);const source=result.edits[0].after,values=css.describe(resolve(source)).cssRules;assert.deepEqual(values,{768:hidden});assert.deepEqual(S.read(values[768]['box-shadow'],values[768][S.property]),[shadow]);assert.ok(source.includes('<h1>Second</h1>'));
 const reset=css.plan(resolve(source),{width:768,changes:{'box-shadow':null,[S.property]:null}});assert.equal(reset.ok,true);assert.deepEqual(css.describe(resolve(reset.edits[0].after)).cssRules,{});
});
test('ordinary replacement and reset remove stale owned or inherited shadow visibility',()=>{
 const source=css.plan(resolve(original),{width:0,changes:hidden}).edits[0].after;
 const replaced=css.plan(resolve(source),{width:768,property:'box-shadow',value:'none'});assert.equal(replaced.ok,true);assert.deepEqual(css.describe(resolve(replaced.edits[0].after)).cssRules[768],{'box-shadow':'none',[S.property]:'none'});
 const base=css.plan(resolve(source),{width:0,property:'box-shadow',value:null});assert.equal(base.ok,true);assert.deepEqual(css.describe(resolve(base.edits[0].after)).cssRules,{});
});
test('HTML refuses malformed or inconsistent visibility without producing edits',()=>{
 for(const changes of [{[S.property]:hidden[S.property]},{...hidden,[S.property]:'rtsh1-ff'},{...hidden,'box-shadow':'none'},{...hidden,[S.property]:null}]){const result=css.plan(resolve(original),{width:0,changes});assert.equal(result.refused,true);assert.equal(result.edits,undefined);}
 assert.equal(V.valid(S.property,hidden[S.property]),true);assert.equal(V.valid(S.property,'rtsh1-ff'),false);assert.equal(V.valid(S.property,null),true);
});
test('a bad layer prevents the whole HTML visibility selection write',()=>{
 const resolved=resolve(original),ids=resolved.elements.filter(element=>element.tag==='h1').map(element=>element.id),result=selection.plan(resolved,{ids,fileHash:resolved.hash,width:0,changesById:{[ids[0]]:hidden,[ids[1]]:{...hidden,'box-shadow':'none'}}});assert.equal(result.refused,true);assert.equal(result.edits,undefined);assert.equal(resolved.source,original);
 const valid=selection.plan(resolved,{ids,fileHash:resolved.hash,width:0,changesById:Object.fromEntries(ids.map(id=>[id,hidden]))});assert.equal(valid.ok,true);assert.equal(valid.edits.length,1);assert.equal(valid.edits[0].before,original);
});
