'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),radius=require('../shell/svg-radius.js');
for(const kind of ['html','react','liquid'])test(kind+' changes both SVG corner axes atomically and refuses an invalid or dynamic member',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),ids=kind==='react'?require('../src/id.cjs'):adapter;
 const wrap=attrs=>kind==='react'?'export default()=> <svg><rect '+attrs+'/><circle r="2"/></svg>':'<svg><rect '+attrs+'/><circle r="2"/></svg>';
 const resolve=source=>{const relPath=kind==='react'?'app/page.jsx':kind==='liquid'?'sections/main.liquid':'index.html',elements=ids.collectElements?ids.collectElements(source,relPath).elements:ids.collect(source,relPath).elements;return {source,elements,element:elements.find(e=>kind==='react'?ids.jsxElementName(e.node)==='rect':e.tag==='rect'),hash:ids.contentHash(source),file:'/tmp/'+relPath,relPath};};
 const r=resolve(wrap('rx="3" ry="7" width="80" height="60"')),op={type:'setSVGGeometry',fileHash:r.hash,changes:{rx:'12',ry:'12'}},result=adapter.planOp(r,op);assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);assert.equal(result.edits[0].after,r.source.replace('rx="3" ry="7"','rx="12" ry="12"'));assert.deepEqual(resolve(result.edits[0].after).elements.map(e=>e.id),r.elements.map(e=>e.id));
 const reset=adapter.planOp(r,{...op,changes:{rx:null,ry:null}});assert.equal(reset.ok,true);assert.ok(!/r[xy]=/.test(reset.edits[0].after));
 for(const extra of [{changes:{rx:'9',ry:'-1'}},{changes:{rx:'9',onclick:'10'}},{changes:{}},{changes:[]},{changes:null},{property:'rx',changes:{ry:'9'}},{fileHash:'stale'}]){const refused=adapter.planOp(r,{...op,...extra});assert.equal(refused.refused,true);assert.equal(refused.edits,undefined);}
 if(kind!=='html'){const dynamic=resolve(wrap(kind==='react'?'rx={radius} ry="7"':'rx="{{ radius }}" ry="7"'));const refused=adapter.planOp(dynamic,{...op,fileHash:dynamic.hash});assert.equal(refused.refused,true);assert.equal(refused.edits,undefined);}
});
test('Rectangle radius model preserves unequal axes, single-axis SVG defaults and dynamic ownership',()=>{
 const info=(x,y,editable=true)=>({tag:'rect',svgGeometry:{fields:[{name:'rx',value:x,editable},{name:'ry',value:y}]}});
 assert.equal(radius.state(info(null,'8')).value,'8');assert.equal(radius.state(info('8px','8')).value,'8');assert.equal(radius.state(info('8.0','8')).mixed,false);assert.equal(radius.state(info(null,null)).value,'0');assert.equal(radius.state(info('3','7')).mixed,true);assert.equal(radius.state(info('3','7',false)).editable,false);assert.equal(radius.state({...info(null,null),tag:'ellipse'}),null);
});
test('Canvas radius deltas follow each corner direction and clamp or snap to valid radii',()=>{
 const {delta,clamp,points}=require('../shell/svg-radius-canvas.js');
 for(const [i,dx,dy]of [[0,10,10],[1,-10,10],[2,-10,-10],[3,10,-10]])assert.equal(delta(5,{x:0,y:0},{x:dx,y:dy},i,30),15);
 assert.equal(delta(5,{x:0,y:0},{x:300,y:300},0,30),30);assert.equal(delta(5,{x:0,y:0},{x:-300,y:-300},0,30),0);assert.equal(delta(5,{x:0,y:0},{x:8,y:8},0,30,true),10);assert.equal(clamp(2.345,30),2.35);
 const p=points({g:{x:0,y:0,width:100,height:60},m:{a:2,b:0,c:0,d:2,e:10,f:20},rx:5,ry:5},2);assert.deepEqual(p[0],{x:40,y:60});assert.equal(p.length,4);
});
test('Canvas measurement accepts legacy SVGMatrix objects and rejects singular or inconsistent transforms',()=>{
 const {measure}=require('../shell/svg-radius-canvas.js');
 class Point{constructor(x,y){this.x=x;this.y=y;}matrixTransform(m){return {x:m.a*this.x+m.c*this.y+m.e,y:m.b*this.x+m.d*this.y+m.f};}}
 const matrix={a:1,b:0,c:0,d:1,e:10,f:20},target={ownerDocument:{defaultView:{DOMPoint:Point}},getBBox:()=>({x:0,y:0,width:80,height:60}),getScreenCTM:()=>matrix,getBoundingClientRect:()=>({left:10,top:20,right:90,bottom:80}),rx:{baseVal:{value:3}},ry:{baseVal:{value:7}},hasAttribute:()=>true};
 assert.equal(measure(target).limit,30);matrix.d=0;assert.throws(()=>measure(target),/invertible/);matrix.d=1;matrix.e=20;assert.throws(()=>measure(target),/accurately/);
});
