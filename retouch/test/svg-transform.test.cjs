'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),A=require('../shell/svg-affine.js');
test('SVG transform lists preserve multiplication order and pivoted rotation',()=>{
 assert.deepEqual(A.parse('translate(10 20) scale(2,3)'),[2,0,0,3,10,20]);assert.deepEqual(A.parse('scale(2) translate(10 20)'),[2,0,0,2,20,40]);assert.ok(A.equivalent(A.parse('rotate(90 10 20)'),[0,1,-1,0,30,10]));assert.deepEqual(A.parse(null),A.identity());
 for(const value of [17,'matrix(1 0 0 1 2)','translate(1,,2)',',translate(1)','translate(1),','translate(1),,scale(2)','translate(1,)','url(#bad)','rotate(10 20)','scale(Infinity)','scale(1e9)','translate(1) script(2)'])assert.equal(A.parse(value),null,String(value));
 assert.ok(A.equivalent(A.parse(A.format(A.parse('rotate(12) skewX(3)'))),A.parse('rotate(12) skewX(3)')));
});
test('SVG resizing composes after authored transforms and expands horizontal/vertical vector bounds',()=>{
 assert.deepEqual(A.resize([1,0,0,1,10,20],{x:5,y:5,width:40,height:20},{x:0,y:0,width:80,height:40}),[2,0,0,2,0,10]);
 const point=(m,x,y)=>({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]});
 for(const [before,after,a,b]of [[{x:10,y:20,width:80,height:0},{x:10,y:20,width:100,height:30},[10,20],[90,20]],[{x:10,y:20,width:0,height:80},{x:-20,y:20,width:30,height:100},[10,20],[10,100]]]){const m=A.resize(A.identity(),before,after);assert.deepEqual(point(m,...a),{x:after.x,y:after.y});assert.deepEqual(point(m,...b),{x:after.x+after.width,y:after.y+after.height});}
 assert.equal(A.resize(A.identity(),{width:0,height:0},{width:10,height:10}),null);
});
for(const kind of ['html','react','liquid'])test(kind+' SVG transform edits preserve curves, groups, identity and literal source ownership',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),ids=kind==='react'?require('../src/id.cjs'):adapter;
 const resolve=(source,tag)=>{const relPath=kind==='react'?'app/page.jsx':kind==='liquid'?'sections/main.liquid':'index.html',elements=kind==='react'?ids.collectElements(source,relPath).elements:ids.collect(source,relPath).elements;return {source,relPath,elements,element:elements.find(e=>kind==='react'?ids.jsxElementName(e.node)===tag:e.tag===tag),file:'/tmp/'+relPath,hash:ids.contentHash(source)};};
 const wrap=body=>kind==='react'?'export default()=> <svg>'+body+'</svg>':'<svg>'+body+'</svg>';
 for(const tag of ['rect','circle','ellipse','line','polygon','polyline','path','g','text','image','use']){
  const body='<'+tag+' transform="translate(10 20) rotate(12)"'+(tag==='path'?' d="M0 0 C20 10 30 40 50 50 A10 20 30 0 1 80 70"':'')+'>'+(tag==='g'?'<circle r="5"/>':tag==='text'?'Hello':'')+'</'+tag+'><rect width="10"/>',r=resolve(wrap(body),tag),shape=adapter.describe(r).svgTransform;assert.ok(shape?.editable,kind+' '+tag);
  const matrix=A.multiply(shape.matrix,[2,0,0,3,-5,-7]),result=adapter.planOp(r,{type:'setSVGTransform',matrix,fileHash:r.hash});assert.equal(result.ok,true,result.reason);assert.equal(result.edits[0].after,r.source.replace('translate(10 20) rotate(12)',A.format(matrix)));assert.deepEqual(resolve(result.edits[0].after,tag).elements.map(e=>e.id),r.elements.map(e=>e.id));
  for(const op of [{matrix:[1,2]},{matrix:[1,0,0,1,Infinity,0]},{matrix:[1,0,0,1,1e6,0]},{fileHash:'stale'}]){const bad=adapter.planOp(r,{type:'setSVGTransform',matrix,fileHash:r.hash,...op});assert.equal(bad.refused,true);assert.equal(bad.edits,undefined);}
 }
 if(kind!=='html'){const body=kind==='react'?'<rect transform={position} />':'<rect transform="{{ position }}"/>',r=resolve(wrap(body),'rect');assert.equal(adapter.describe(r).svgTransform.editable,false);assert.equal(adapter.planOp(r,{type:'setSVGTransform',matrix:A.identity(),fileHash:r.hash}).refused,true);}
 const outside=resolve(kind==='react'?'export default()=> <rect/>':'<html><body><rect></rect></body></html>','rect');assert.equal(adapter.describe(outside).svgTransform,null);
});
test('Vector dimensions include authored scale, preserve rotation and lock proportions',()=>{
 const m=A.parse('translate(10 20) rotate(30) scale(2 3)'),g={x:5,y:7,width:40,height:20},size=A.dimensions(m,g);assert.ok(Math.abs(size.width-80)<1e-8);assert.equal(size.height,60);
 const next=A.resizeDimension(m,g,'width',160,true),result=A.dimensions(next,g);assert.ok(Math.abs(result.width-160)<1e-8);assert.ok(Math.abs(result.height-120)<1e-8);assert.ok(Math.abs(Math.atan2(next[1],next[0])-Math.PI/6)<1e-8);
 const point=m=>[m[0]*g.x+m[2]*g.y+m[4],m[1]*g.x+m[3]*g.y+m[5]];point(m).forEach((v,i)=>assert.ok(Math.abs(v-point(next)[i])<1e-8));
 for(const value of [0,-1,Infinity,100001])assert.equal(A.resizeDimension(m,g,'width',value),null);
 assert.equal(A.resizeDimension(m,{...g,height:0},'height',10,true),null);
});
test('Vector position and rotation preserve center, scale, skew and reflection',()=>{
 const g={x:10,y:20,width:60,height:40},point=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
 for(const source of ['translate(17 -9) rotate(10) scale(2 3)','rotate(-40) skewX(15) scale(-2 3)']){const m=A.parse(source),rotated=A.setPose(m,g,'rotation',55),size=A.dimensions(m,g),after=A.dimensions(rotated,g);assert.ok(Math.abs(A.pose(rotated,g).rotation-55)<1e-8);for(const key of ['width','height'])assert.ok(Math.abs(size[key]-after[key])<1e-8);point(m,40,40).forEach((v,i)=>assert.ok(Math.abs(v-point(rotated,40,40)[i])<1e-8));assert.ok(Math.abs((m[0]*m[3]-m[1]*m[2])-(rotated[0]*rotated[3]-rotated[1]*rotated[2]))<1e-8);
 const translated=A.setPose(m,g,'x',-99);assert.ok(Math.abs(A.pose(translated,g).x+99)<1e-8);assert.equal(A.pose(translated,g).y,A.pose(m,g).y);assert.deepEqual(translated.slice(0,4),m.slice(0,4));}
 for(const [axis,value]of [['x',Infinity],['y',100001],['rotation',361],['unknown',0]])assert.equal(A.setPose(A.identity(),g,axis,value),null);
});
