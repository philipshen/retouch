'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),ids=require('../src/id.cjs'),gradient=require('../src/source-svg-gradient.cjs');
for(const kind of ['react','liquid']){
 const adapter=require('../src/adapters/'+kind+'.cjs'),wrap=body=>kind==='react'?'export default()=>('+body+');':body;
 const original=wrap('<svg><defs><linearGradient id="paint" gradientUnits="userSpaceOnUse"><stop offset="0" '+(kind==='react'?'stopColor={"red"}':'stop-color=\'red\'')+'/><stop offset="100%" '+(kind==='react'?'stopColor':'stop-color')+'="blue"/></linearGradient></defs><rect fill="url(#paint)" width="40"/><circle fill="url(#paint)" r="10"/></svg>');
 function resolve(source=original){const relPath=kind==='react'?'app/page.jsx':'sections/main.liquid',elements=adapter.collect(source,relPath).elements;return {source,relPath,elements,element:elements.find(el=>(kind==='react'?ids.jsxElementName(el.node):el.tag)==='rect'),file:'/tmp/'+relPath,hash:ids.contentHash(source)};}
 test(kind+' gradient inspector maps source attributes to DOM names',()=>{const g=adapter.describe(resolve()).svgGradients;assert.equal(g.length,1);assert.equal(g[0].reason,null);assert.equal(g[0].stops[0].color,'red');assert.equal(g[0].fields.find(f=>f.name==='gradientUnits').value,'userSpaceOnUse');});
 test(kind+' gradient changes preserve identities and unrelated source',()=>{
  for(const op of [{stop:0,changes:{'stop-color':'#00ff00','stop-opacity':'50%',offset:'25%'}},{changes:{x2:'80%',gradientUnits:'objectBoundingBox',spreadMethod:'reflect'}}]){const r=resolve(),result=adapter.planOp(r,{type:'setSVGGradient',paint:'fill',fileHash:r.hash,...op});assert.equal(result.ok,true,result.reason);const fresh=resolve(result.edits[0].after),g=gradient.describe(fresh,kind)[0];assert.deepEqual(fresh.elements.map(e=>e.id),r.elements.map(e=>e.id));assert.ok(fresh.source.includes('<rect fill="url(#paint)" width="40"/><circle fill="url(#paint)" r="10"/>'));if(op.stop===0){assert.deepEqual(g.stops[0],{offset:'25%',color:'#00ff00',opacity:'50%'});if(kind==='liquid')assert.ok(fresh.source.includes("stop-color='#00ff00'"));else assert.ok(fresh.source.includes('stopColor="#00ff00"'));}else assert.equal(g.fields.find(f=>f.name==='gradientUnits').value,'objectBoundingBox');}
 });
 test(kind+' gradient refuses dynamic stops, duplicate values, inheritance and stale edits',()=>{
  const target=kind==='react'?'stopColor={"red"}':"stop-color='red'";
  for(const replacement of [kind==='react'?'stopColor={color}':'stop-color="{{ color }}"',kind==='react'?'stopColor="red" {...props}':'stop-color="red" {{ attrs }}',kind==='react'?'stopColor="red" stopColor="blue"':'stop-color="red" stop-color="blue"','style="stop-color:red"']){const r=resolve(original.replace(target,replacement)),g=gradient.describe(r,kind)[0];assert.ok(g.reason);assert.equal(gradient.plan(r,{paint:'fill',fileHash:r.hash,stop:0,changes:{offset:'0.2'}},kind).refused,true);}
  for(const replacement of ['href="#other"','xlink:href="#other"']){const r=resolve(original.replace('id="paint"','id="paint" '+replacement));assert.ok(gradient.describe(r,kind)[0].reason);}
  const r=resolve();for(const op of [{fileHash:'stale',changes:{x2:'40%'}},{stop:0,changes:{offset:'101%'}},{stop:0,changes:{'stop-color':'red;stroke:blue'}},{changes:{x2:'2',onclick:'x'}}])assert.equal(gradient.plan(r,{paint:'fill',fileHash:r.hash,...op},kind).refused,true);
 });
 test(kind+' radial geometry reset restores default and keeps namespace boundaries',()=>{
  const r=resolve(original.replaceAll('linearGradient','radialGradient')),result=gradient.plan(r,{paint:'fill',fileHash:r.hash,changes:{fx:'25%',r:'60%'}},kind);assert.equal(result.ok,true,result.reason);const fresh=resolve(result.edits[0].after),reset=gradient.plan(fresh,{paint:'fill',fileHash:fresh.hash,changes:{fx:null}},kind);assert.equal(reset.ok,true);assert.equal(gradient.describe(resolve(reset.edits[0].after),kind)[0].fields.find(f=>f.name==='fx').value,null);
  assert.deepEqual(gradient.describe(resolve(original.replace('<rect','<foreignObject><rect').replace('/><circle','/></foreignObject><circle')),kind),[]);
 });
}
