'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{freeSpace,offset}=require('../shell/image-position.js');
test('image positioning follows cover, contain, natural and scale-down object sizing',()=>{
 assert.deepEqual(freeSpace(200,200,400,200,'cover'),[-200,0]);assert.deepEqual(freeSpace(200,200,400,200,'contain'),[0,100]);assert.deepEqual(freeSpace(200,200,100,50,'scale-down'),[100,150]);assert.deepEqual(freeSpace(200,200,400,200,'scale-down'),[0,100]);assert.deepEqual(freeSpace(200,200,400,200,'fill'),[0,0]);assert.deepEqual(freeSpace(200,200,400,100,'none'),[-200,100]);assert.throws(()=>freeSpace(0,200,400,200,'cover'));
});
test('drag distances follow the painted image and clamp at frame edges without moving a filled axis',()=>{
 assert.deepEqual(offset([50,50],[-200,0],50,50),[25,50]);assert.deepEqual(offset([50,50],[0,100],50,25),[50,75]);assert.deepEqual(offset([50,50],[-200,100],1000,-1000),[0,0]);
});

test('screen deltas invert rotated, reflected and skewed image axes',()=>{
 const {localDelta}=require('../shell/image-position.js');assert.deepEqual(localDelta([0,1,-1,0],0,50),[50,0]);assert.deepEqual(localDelta([-1,0,0,1],-50,0),[50,0]);const skew=localDelta([1,.25,.5,1],50,12.5);assert.equal(skew[0],50);assert.equal(skew[1],0);assert.throws(()=>localDelta([1,1,1,1],10,10));
});
