'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),bindings=require('../src/variable-bindings.cjs'),linked=require('../src/html-variable-bindings.cjs'),html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function fixture(){return {version:1,collections:[{id:id(1),name:'Theme',defaultMode:id(2),modes:[{id:id(2),name:'Light'},{id:id(3),name:'Dark'}]}],variables:[['color','#ffffff','#000000'],['number',24,48],['boolean',true,false],['string','Arial, sans-serif','Georgia, serif']].map(([type,light,dark],i)=>({id:id(i+4),collectionId:id(1),name:type,type,values:{[id(2)]:light,[id(3)]:dark}}))};}
const original='<html><head></head><body><p>Variable</p></body></html>';
function resolve(source){return {file:'/tmp/index.html',relPath:'index.html',source,hash:html.contentHash(source),element:html.collect(source,'index.html').elements.find(e=>e.tag==='p')};}
function apply(source,property,binding,width=0,library=fixture()){return linked.plan(resolve(source),{type:'applyVariable',property,binding,width},library);}
test('typed variable binding conversion validates CSS values and unit semantics',()=>{
 const library=fixture(),value=(property,n,extra={})=>bindings.resolve(library,property,{id:id(n),...extra}).value;
 assert.equal(value('color',4),'#ffffffff');assert.equal(value('padding',5),'24px');assert.equal(value('width',5,{unit:'%'}),'24%');assert.equal(value('line-height',5),'24');assert.equal(value('visibility',6),'visible');assert.equal(value('font-family',7),'Arial, sans-serif');assert.equal(value('visibility',6,{modes:{[id(1)]:id(3)}}),'hidden');
 for(const [property,n,extra]of [['opacity',5,{}],['color',5,{}],['width',4,{}],['width',5,{unit:''}],['font-family',7,{unit:'px'}],['width',5,{unit:'evil'}],['width',5,{modes:null}],['width',5,{modes:{[id(1)]:id(99)}}]])assert.throws(()=>value(property,n,extra));
});

test('presentation projections preserve per-binding modes and units with temporary typed assignments',()=>{
 const library=fixture(),before=JSON.stringify(library),requests=[
  {property:'color',binding:{id:id(4)}},
  {property:'color',binding:{id:id(4),modes:{[id(1)]:id(3)}}},
  {property:'width',binding:{id:id(5),unit:'rem'}},
  {property:'letter-spacing',binding:{id:id(5),unit:'%'}},
  {property:'visibility',binding:{id:id(6)}},
  {property:'font-family',binding:{id:id(7)}}
 ];
 assert.deepEqual(bindings.project(library,requests,{[id(5)]:12.5,[id(6)]:false,[id(7)]:'Georgia, serif'}).map(x=>x.value),['#ffffffff','#000000ff','12.5rem','0.125em','hidden','Georgia, serif']);
 assert.deepEqual(bindings.project(library,requests.slice(0,2),{[id(4)]:'#f00'}).map(x=>x.value),['#ff0000ff','#ff0000ff']);
 assert.equal(JSON.stringify(library),before);
 assert.deepEqual(bindings.project(library,requests).map(x=>x.value),['#ffffffff','#000000ff','24rem','0.24em','visible','Arial, sans-serif']);
});

test('binding projection refuses invalid CSS or requests before returning partial output',()=>{
 const library=fixture(),valid={property:'width',binding:{id:id(5)}};
 for(const requests of [null,{},Array(257).fill(valid),[valid,{property:'background-image',binding:{id:id(7)}}],[valid,{property:'opacity',binding:{id:id(5)}}],[{...valid,extra:true}],[{property:'color',binding:{id:id(4),modes:{[id(1)]:id(99)}}}]])assert.throws(()=>bindings.project(library,requests));
 assert.throws(()=>bindings.project(library,[valid],{[id(5)]:-1}),/cannot control/);
 assert.throws(()=>bindings.project(library,[],{[id(99)]:false}));
 assert.deepEqual(bindings.project(library,[]),[]);
});
test('HTML bindings retain identities, per-scope mode selection and appearance on detach',()=>{
 let source=apply(original,'color',{id:id(4)}).edits[0].after;
 source=apply(source,'color',{id:id(4),modes:{[id(1)]:id(3)}},768).edits[0].after;
 const info=linked.describe(resolve(source));assert.deepEqual(info.variableOverrides,{0:[],768:[]});assert.equal(info.variableLinks[768].color.id,id(4));assert.equal(css.describe(resolve(source)).cssRules[768].color,'#000000ff');assert.deepEqual(apply(source,'color',{id:id(4),modes:{[id(1)]:id(3)}},768).edits,[]);
 const detached=linked.plan(resolve(source),{type:'detachVariable',property:'color',width:768});assert.equal(detached.ok,true,detached.reason);assert.deepEqual(css.describe(resolve(detached.edits[0].after)).cssRules,css.describe(resolve(source)).cssRules);assert.equal(linked.describe(resolve(detached.edits[0].after)).variableLinks[768],undefined);
});
test('refresh follows renamed aliases while preserving overrides until explicit reset',()=>{
 const library=fixture();library.variables.push({id:id(8),collectionId:id(1),name:'Alias',type:'color',values:{[id(2)]:{alias:id(4)},[id(3)]:{alias:id(4)}}});
 let source=apply(original,'color',{id:id(8)},0,library).edits[0].after;
 source=css.plan(resolve(source),{width:0,property:'color',value:'#123456ff'}).edits[0].after;
 library.variables[0].name='Renamed';library.variables[0].values[id(2)]='#123456';
 let result=linked.planFile('/tmp/index.html','index.html',source,library);assert.equal(result.ok,true,result.reason);source=result.edits[0].after;assert.equal(linked.describe(resolve(source)).variableLinks[0].color.override,true);
 library.variables[0].values[id(2)]='#ff0000';result=linked.planFile('/tmp/index.html','index.html',source,library);source=result.edits[0].after;assert.equal(css.describe(resolve(source)).cssRules[0].color,'#123456ff');
 result=linked.plan(resolve(source),{type:'resetVariable',property:'color',width:0},library);assert.equal(result.ok,true,result.reason);assert.equal(css.describe(resolve(result.edits[0].after)).cssRules[0].color,'#ff0000ff');assert.deepEqual(linked.describe(resolve(result.edits[0].after)).variableOverrides[0],[]);
});
test('invalid and unindexed links and stale operations refuse without partial source edits',()=>{
 const library=fixture(),source=apply(original,'width',{id:id(5)}).edits[0].after;
 for(const bad of [source+'<p data-rt-variables="bad">Bad</p>',source.replace('<p ','<template ').replace('</p>','</template>')]){const result=linked.planFile('/tmp/index.html','index.html',bad,library);assert.equal(result.ok,false);assert.equal(result.edits,undefined);}
 library.variables=library.variables.filter(v=>v.id!==id(5));const result=linked.planFile('/tmp/index.html','index.html',source,library);assert.equal(result.ok,false);assert.equal(result.edits,undefined);
 assert.equal(linked.plan(resolve(original),{type:'applyVariable',property:'width',width:0,binding:{id:id(5)},fileHash:'old'},fixture()).ok,false);
});

test('removing a scope binding removes its CSS override and preserves narrower bindings',()=>{
 const library=fixture();let source=apply(original,'color',{id:id(4)},0,library).edits[0].after;const base=source;
 source=apply(source,'color',{id:id(4),modes:{[id(1)]:id(3)}},768,library).edits[0].after;
 const result=linked.plan(resolve(source),{type:'removeVariable',property:'color',width:768});assert.equal(result.ok,true,result.reason);const after=resolve(result.edits[0].after);assert.deepEqual(linked.links(after),linked.links(resolve(base)));assert.deepEqual(css.describe(after).cssRules,css.describe(resolve(base)).cssRules);
 assert.equal(linked.plan(after,{type:'removeVariable',property:'color',width:768}).ok,false);
});

test('percentage tracking bindings preserve percentage metadata and author relative em values',()=>{
 const library=fixture(),spec={id:id(5),unit:'%'};
 assert.equal(bindings.resolve(library,'letter-spacing',spec).value,'0.24em');
 assert.equal(bindings.resolve(library,'padding',spec).value,'24%');
 assert.equal(bindings.resolve(library,'line-height',spec).value,'24%');
 let source=apply(original,'letter-spacing',spec,768,library).edits[0].after;
 assert.equal(css.describe(resolve(source)).cssRules[768]['letter-spacing'],'0.24em');
 assert.equal(linked.describe(resolve(source)).variableLinks[768]['letter-spacing'].unit,'%');
 library.variables[1].values[id(2)]=-12.5;
 const updated=linked.planFile('/tmp/index.html','index.html',source,library);assert.equal(updated.ok,true,updated.reason);source=updated.edits[0].after;
 assert.equal(css.describe(resolve(source)).cssRules[768]['letter-spacing'],'-0.125em');
 const detached=linked.plan(resolve(source),{type:'detachVariable',property:'letter-spacing',width:768});assert.equal(detached.ok,true,detached.reason);assert.equal(css.describe(resolve(detached.edits[0].after)).cssRules[768]['letter-spacing'],'-0.125em');
});
