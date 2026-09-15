'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{pivot}=require('../shell/local-rotate.js');
test('recovers the fixed rotation pivot from a quarter turn',()=>{
 for(const center of [{x:0,y:0},{x:-20,y:45},{x:140.5,y:-71.25}])for(const before of [{x:3,y:9},{x:-100,y:200},center]){
  const after={x:center.x-(before.y-center.y),y:center.y+(before.x-center.x)};assert.deepEqual(pivot(before,after),center);
 }
});
