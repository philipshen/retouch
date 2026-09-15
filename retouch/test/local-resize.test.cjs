'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{anchored}=require('../shell/local-resize.js');
test('resizing compensates for changed transform origins and retains the chosen anchor',()=>{
 const before={x:10,y:20,width:100,height:80,rotation:90,transformOrigin:'50px 40px'},after={...before,width:140,transformOrigin:'70px 40px'};
 const edge=anchored(before,after,{x:0,y:0}),center=anchored(before,after,{x:-20,y:0});
 assert.ok(Math.abs(edge.x+10)<1e-9);assert.ok(Math.abs(edge.y-40)<1e-9);assert.equal(edge.width,140);
 assert.ok(Math.abs(center.x+10)<1e-9);assert.ok(Math.abs(center.y-20)<1e-9);
});
test('resizing compensates for a size-dependent matrix translation',()=>{
 const before={x:10,y:20,width:100,height:80,transformMatrix:[1,0,0,1,10,0]},after={...before,width:140,transformMatrix:[1,0,0,1,14,0]},next=anchored(before,after,{x:0,y:0});
 assert.equal(next.x,6);assert.equal(next.y,20);assert.deepEqual(next.transformMatrix,after.transformMatrix);
});
