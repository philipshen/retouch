'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),g=require('../shell/svg-gradient-canvas.js');
test('gradient coordinates resolve bounding-box and viewport percentages',()=>{assert.equal(g.coordinate('25%',0,400,true),.25);assert.equal(g.coordinate('25%',0,400,false),100);assert.equal(g.coordinate('12px',0,400,false),12);assert.equal(g.coordinate(null,.5,400,true),.5);assert.throws(()=>g.coordinate('calc(1 + 2)',0,400,false));});
test('linear handles edit only their endpoint',()=>{assert.deepEqual(g.change('linearGradient',{x1:0,y1:0,x2:1,y2:0},1,{x:.75,y:.4}),{x1:0,y1:0,x2:.75,y2:.4});assert.deepEqual(g.positions('linearGradient',{x1:.1,y1:.2,x2:.8,y2:.7}),[{x:.1,y:.2},{x:.8,y:.7}]);});
test('radial center carries focus and radius drag measures Euclidean distance',()=>{const v={cx:.5,cy:.5,r:.5,fx:.3,fy:.4};assert.deepEqual(g.change('radialGradient',v,0,{x:.6,y:.8}),{cx:.6,cy:.8,r:.5,fx:.4,fy:.7});assert.equal(g.change('radialGradient',v,1,{x:.8,y:.9}).r,.5);assert.deepEqual(g.change('radialGradient',v,2,{x:.4,y:.2}),{...v,fx:.4,fy:.2});});

test('endpoint edits retain untouched precision and returning to the start is a no-op',()=>{const v={x1:.333333333333,y1:.123456789,x2:.987654321,y2:.222222222};assert.equal(g.change('linearGradient',v,1,{x:.8,y:.7}).x1,v.x1);assert.deepEqual(g.change('linearGradient',v,1,{x:v.x2,y:v.y2}),v);});

test('offscreen gradient handles stay reachable at the canvas edge',()=>{assert.deepEqual(g.visiblePoint({x:200,y:-10},400,300),{x:200,y:8});assert.deepEqual(g.visiblePoint({x:500,y:310},400,300),{x:392,y:292});});
