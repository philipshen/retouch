'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),model=require('../shell/svg-parametric.js');
test('Arrow parameters preserve endpoints and recognize symmetric heads in all directions',()=>{
 for(const [x2,y2]of [[100,0],[-100,0],[0,100],[0,-100],[70,30],[-70,-30]])for(const headLength of [0,5,30])for(const headWidth of [0,8,40]){
  const spec={kind:'arrow',x1:0,y1:0,x2,y2,headLength,headWidth},value=model.generate(spec),read=model.describe(value,'arrow');assert.ok(read,JSON.stringify(spec));
  for(const key of Object.keys(spec).filter(key=>key!=='kind'))assert.ok(Math.abs(read[key]-spec[key])<.000002,key);
  const changed=model.generate({...read,headLength:10,headWidth:20}),points=require('../shell/svg-points.js').parse(changed);assert.deepEqual(points.slice(0,2),[{x:0,y:0},{x:x2,y:y2}]);
 }
 const spec={kind:'arrow',x1:0,y1:0,x2:100,y2:0,headLength:12,headWidth:12},value=model.generate(spec);
 assert.equal(model.describe(value.replace('88,6','88,7'),'arrow'),null);
 for(const patch of [{headLength:-1},{headLength:101},{headWidth:-1},{headWidth:Infinity},{x2:0},{x1:100001}])assert.equal(model.generate({...spec,...patch}),null);
});

for(const language of ['html','react','liquid'])test(language+' arrow parameters preserve paint and identity through source edits',()=>{
 const adapter=require('../src/adapters/'+language+'.cjs'),ids=require('../src/id.cjs'),relPath=language==='react'?'page.jsx':language==='liquid'?'main.liquid':'index.html';
 const points=model.generate({kind:'arrow',x1:10,y1:20,x2:100,y2:70,headLength:12,headWidth:12});
 const source=(language==='react'?'export default()=>':'')+'<svg><polyline data-rt-shape="arrow" points="'+points+'" fill="none" stroke="#123456"/></svg>';
 const resolve=source=>{const elements=adapter.collect(source,relPath).elements;return {source,relPath,file:'/tmp/'+relPath,elements,element:elements.find(e=>(language==='react'?ids.jsxElementName(e.node):e.tag)==='polyline'),hash:adapter.contentHash(source)};};
 const r=resolve(source),modelBefore=adapter.describe(r).svgGeometry.parametric;assert.equal(modelBefore.kind,'arrow');
 const value=model.generate({...modelBefore,headLength:20,headWidth:30}),result=adapter.planOp(r,{type:'setSVGGeometry',property:'points',value,fileHash:r.hash});assert.equal(result.ok,true,result.reason);
 const next=resolve(result.edits[0].after),modelAfter=adapter.describe(next).svgGeometry.parametric;assert.ok(Math.abs(modelAfter.headLength-20)<.000002);assert.ok(Math.abs(modelAfter.headWidth-30)<.000002);assert.equal(next.element.id,r.element.id);assert.ok(next.source.includes('stroke="#123456"'));
 const freeform=resolve(next.source.replace(value,'0,0 100,0 80,5 100,0 80,-9'));assert.equal(adapter.describe(freeform).svgGeometry.parametric,null);
});
test('Parametric shapes retain bounds, kind, count and ratio across supported point counts',()=>{
 for(const kind of ['polygon','star'])for(const count of [3,4,5,6,17,64,128,256,...(kind==='polygon'?[512]:[])])for(const ratio of kind==='star'?[0,.001,.38196601125,.75,1]:[1]){
  const spec={kind,count,ratio,x:-30,y:70,width:130,height:80},value=model.generate(spec),read=model.describe(value,kind);assert.ok(read,JSON.stringify(spec));assert.equal(read.kind,kind);assert.equal(read.count,count);assert.ok(Math.abs(read.ratio-ratio)<.000001);for(const key of ['x','y','width','height'])assert.equal(read[key],spec[key]);
 }
});
test('Parametric recognition does not overwrite manually reshaped vertices or malformed metadata',()=>{
 const value=model.generate({kind:'star',count:5,ratio:.5,x:0,y:0,width:100,height:100});assert.equal(model.describe(value.replace(/^50,0/,'49,0'),'star'),null);assert.equal(model.describe(value,'polygon'),null);assert.equal(model.describe(value,'{{ kind }}'),null);
 for(const patch of [{count:2},{count:3.5},{count:257},{ratio:-.1},{ratio:1.1},{width:0},{height:Infinity},{x:100001}])assert.equal(model.generate({kind:'star',count:5,ratio:.5,x:0,y:0,width:100,height:100,...patch}),null);
});
for(const language of ['html','react','liquid'])test(language+' shape parameters survive geometry edits and disappear after freeform edits',()=>{
 const adapter=require('../src/adapters/'+language+'.cjs'),ids=require('../src/id.cjs'),tag=e=>language==='react'?ids.jsxElementName(e.node):e.tag,relPath=language==='react'?'page.jsx':language==='liquid'?'main.liquid':'index.html';
 const wrap=s=>language==='react'?'export default()=>'+s:s;
 for(const kind of ['polygon','star']){
  const value=model.generate({kind,count:kind==='star'?5:3,ratio:.38196601125,x:10,y:20,width:100,height:80}),source=wrap('<svg><polygon data-rt-shape="'+kind+'" points="'+value+'" fill="#abcdef"/></svg>');
  const resolve=source=>{const elements=adapter.collect(source,relPath).elements;return {source,relPath,file:'/tmp/'+relPath,elements,element:elements.find(e=>tag(e)==='polygon'),hash:adapter.contentHash(source)};},r=resolve(source),descriptor=adapter.describe(r).svgGeometry.parametric;assert.equal(descriptor.kind,kind);
  const updated=model.generate({...descriptor,count:7,ratio:1}),result=adapter.planOp(r,{type:'setSVGGeometry',property:'points',value:updated,fileHash:r.hash});assert.equal(result.ok,true,result.reason);const next=resolve(result.edits[0].after),fresh=adapter.describe(next).svgGeometry.parametric;assert.equal(fresh.kind,kind);assert.equal(fresh.count,7);assert.ok(Math.abs(fresh.ratio-1)<.000001);assert.equal(next.element.id,r.element.id);assert.ok(next.source.includes('fill="#abcdef"'));assert.ok(next.source.includes('data-rt-shape="'+kind+'"'));assert.equal(result.edits[0].before,source);
  const edited=adapter.planOp(next,{type:'setSVGGeometry',property:'points',value:'0,0 10,5 30,40 0,80',fileHash:next.hash});assert.equal(edited.ok,true);assert.equal(adapter.describe(resolve(edited.edits[0].after)).svgGeometry.parametric,null);
 }
});
