'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),model=require('../shell/svg-parametric.js');
test('Reversing an arrow swaps endpoints and reflects its head without losing dimensions',()=>{
 for(const [x2,y2]of [[100,0],[-100,0],[0,100],[0,-100],[70,30],[-70,-30]]){
  const value=model.generate({kind:'arrow',x1:10,y1:20,x2,y2,headLength:12,headWidth:20}),reversed=model.reverseArrow(value),before=model.describe(value,'arrow'),after=model.describe(reversed,'arrow');
  assert.deepEqual([after.x1,after.y1,after.x2,after.y2],[before.x2,before.y2,before.x1,before.y1]);
  for(const key of ['headLength','headWidth'])assert.ok(Math.abs(after[key]-before[key])<.000002);
  assert.equal(model.reverseArrow(reversed),value);
 }
 assert.equal(model.reverseArrow('0,0 100,0 80,5 100,0 80,-9'),null);
 const edge=model.generate({kind:'arrow',x1:100000,y1:0,x2:99900,y2:100,headLength:1,headWidth:40});assert.ok(edge);assert.equal(model.reverseArrow(edge),null);
});
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
 const value=model.generate({...modelBefore,headLength:20,headWidth:30,startArrow:true}),result=adapter.planOp(r,{type:'setSVGGeometry',property:'points',value,fileHash:r.hash});assert.equal(result.ok,true,result.reason);
 const next=resolve(result.edits[0].after),modelAfter=adapter.describe(next).svgGeometry.parametric;assert.equal(modelAfter.startArrow,true);assert.ok(Math.abs(modelAfter.headLength-20)<.000002);assert.ok(Math.abs(modelAfter.headWidth-30)<.000002);assert.equal(next.element.id,r.element.id);assert.ok(next.source.includes('stroke="#123456"'));
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


test('Double-ended arrows retain symmetric heads, reversibility and freeform ownership',()=>{
 for(const [x2,y2]of [[100,0],[0,100],[-60,40]]){
  const spec={kind:'arrow',x1:0,y1:0,x2,y2,headLength:12,headWidth:20,startArrow:true},value=model.generate(spec),parsed=model.describe(value,'arrow');
  assert.equal(value.split(' ').length,10);assert.equal(parsed.startArrow,true);assert.ok(model.describe(model.generate(parsed),'arrow'));const numbers=text=>text.split(/[ ,]/).map(Number);assert.ok(numbers(model.generate(parsed)).every((n,i)=>Math.abs(n-numbers(value)[i])<.00001));assert.equal(model.reverseArrow(model.reverseArrow(value)),value);
  const single=model.generate({...parsed,startArrow:false});assert.equal(single.split(' ').length,5);assert.equal(model.describe(single,'arrow').startArrow,undefined);
  const changed=value.split(' ');changed[7]='1,2';assert.equal(model.describe(changed.join(' '),'arrow'),null);
 }
 assert.equal(model.generate({kind:'arrow',x1:0,y1:0,x2:100,y2:0,headLength:12,headWidth:20,startArrow:'yes'}),null);
});


test('Start arrowhead dimensions remain independent in every shaft direction',()=>{
 for(const [x2,y2]of [[100,0],[0,100],[-60,40]]){
  const spec={kind:'arrow',x1:0,y1:0,x2,y2,headLength:12,headWidth:20,startArrow:true,startHeadLength:5,startHeadWidth:8},value=model.generate(spec),parsed=model.describe(value,'arrow');
  for(const key of ['headLength','headWidth','startHeadLength','startHeadWidth'])assert.ok(Math.abs(parsed[key]-spec[key])<.00001);
  const changed=model.generate({...parsed,startHeadWidth:16});assert.deepEqual(changed.split(' ').slice(0,5),model.generate(parsed).split(' ').slice(0,5));assert.equal(model.reverseArrow(model.reverseArrow(value)),value);
  for(const updates of [{startHeadLength:-1},{startHeadLength:200},{startHeadWidth:-1},{startHeadWidth:Infinity}])assert.equal(model.generate({...spec,...updates}),null);
 }
});


test('Editing one rounded arrowhead preserves the other exact coordinates',()=>{
 const value=model.generate({kind:'arrow',x1:0,y1:0,x2:-60,y2:40,headLength:12,headWidth:20,startArrow:true,startHeadLength:5,startHeadWidth:8});
 const changed=model.changeArrow(value,{startHeadWidth:17});assert.deepEqual(changed.split(' ').slice(0,5),value.split(' ').slice(0,5));
 const end=model.changeArrow(changed,{headLength:15});assert.deepEqual(end.split(' ').slice(5),changed.split(' ').slice(5));
 assert.equal(model.changeArrow(value,{startArrow:false}),value.split(' ').slice(0,5).join(' '));assert.equal(model.changeArrow(value,{x1:100}),null);
});


test('Arrow endpoint selectors preserve existing heads across all four combinations',()=>{
 const original=model.generate({kind:'arrow',x1:0,y1:0,x2:-60,y2:40,headLength:12,headWidth:20,startArrow:true,startHeadLength:5,startHeadWidth:8});
 const start=model.changeArrow(original,{endArrow:false});assert.equal(start.split(' ').length,6);assert.deepEqual(start.split(' ').slice(-4),original.split(' ').slice(-4));assert.equal(model.describe(start,'arrow').endArrow,false);
 const line=model.changeArrow(start,{startArrow:false});assert.equal(line,original.split(' ').slice(0,2).join(' '));assert.equal(model.describe(line,'arrow').endArrow,false);
 const end=model.changeArrow(line,{endArrow:true});assert.equal(end.split(' ').length,5);assert.equal(model.describe(end,'arrow').startArrow,undefined);
 for(const value of [original,start,line,end])assert.equal(model.reverseArrow(model.reverseArrow(value)),value);
 const restored=model.changeArrow(start,{endArrow:true});assert.deepEqual(restored.split(' ').slice(-4),start.split(' ').slice(-4));
 assert.equal(model.changeArrow(original,{endArrow:'none'}),null);
});


test('Swapping arrowheads exchanges enabled ends and dimensions without moving the shaft',()=>{
 for(const [x2,y2]of [[100,0],[0,100],[-60,40]])for(const startArrow of [false,true])for(const endArrow of [false,true]){
  const spec={kind:'arrow',x1:0,y1:0,x2,y2,headLength:12,headWidth:20,startArrow,endArrow,startHeadLength:5,startHeadWidth:8},value=model.generate(spec),swapped=model.swapArrowheads(value),parsed=model.describe(swapped,'arrow');
  assert.deepEqual(swapped.split(' ').slice(0,2),value.split(' ').slice(0,2));assert.equal(!!parsed.startArrow,endArrow);assert.equal(parsed.endArrow!==false,startArrow);
  if(startArrow){assert.ok(Math.abs(parsed.headLength-5)<.00001);assert.ok(Math.abs(parsed.headWidth-8)<.00001);}if(endArrow){assert.ok(Math.abs(parsed.startHeadLength-12)<.00001);assert.ok(Math.abs(parsed.startHeadWidth-20)<.00001);}
  assert.equal(model.swapArrowheads(swapped),value);
 }
 assert.equal(model.swapArrowheads('0,0 100,0 80,5 100,0 80,-9'),null);
 const edge=model.generate({kind:'arrow',x1:100000,y1:0,x2:99900,y2:100,headLength:1,headWidth:40});assert.equal(model.swapArrowheads(edge),null);
});
