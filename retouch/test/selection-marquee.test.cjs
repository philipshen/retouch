'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{rectangle,moved,enclosed,clip}=require('../shell/selection-marquee.js');
test('Marquee containment normalizes drag direction and excludes partial or empty boxes',()=>{
 const rect=rectangle({x:110,y:220},{x:10,y:20});assert.deepEqual(rect,{left:10,top:20,width:100,height:200});
 assert.equal(enclosed(rect,{left:10,top:20,right:110,bottom:220,width:100,height:200}),true);
 assert.equal(enclosed(rect,{left:9,top:20,right:110,bottom:220,width:101,height:200}),false);
 assert.equal(enclosed(rect,{left:10,top:20,right:111,bottom:220,width:101,height:200}),false);
 assert.equal(enclosed(rect,{left:10,top:20,right:10,bottom:220,width:0,height:200}),false);
});

test('Marquee clips gray canvas coordinates to visible page before picking',()=>{
 assert.deepEqual(clip({left:-50,top:-20,width:200,height:160},100,100),{left:0,top:0,width:100,height:100});
 assert.equal(clip({left:-50,top:20,width:30,height:10},100,100).width,0);
 assert.equal(enclosed(clip({left:0,top:0,width:200,height:200},100,100),{left:0,top:90,right:10,bottom:110,width:10,height:20}),false);
});

test('Marquee activation uses four screen pixels at low and high canvas zoom',()=>{
 for(const scale of [.01,.1,.25,1,2]){assert.equal(moved({x:0,y:0},{x:3/scale,y:0},scale),false);assert.equal(moved({x:0,y:0},{x:4/scale,y:0},scale),true);}
});
