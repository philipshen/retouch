'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{rectangle,enclosed}=require('../shell/selection-marquee.js');
test('Marquee containment normalizes drag direction and excludes partial or empty boxes',()=>{
 const rect=rectangle({x:110,y:220},{x:10,y:20});assert.deepEqual(rect,{left:10,top:20,width:100,height:200});
 assert.equal(enclosed(rect,{left:10,top:20,right:110,bottom:220,width:100,height:200}),true);
 assert.equal(enclosed(rect,{left:9,top:20,right:110,bottom:220,width:101,height:200}),false);
 assert.equal(enclosed(rect,{left:10,top:20,right:111,bottom:220,width:101,height:200}),false);
 assert.equal(enclosed(rect,{left:10,top:20,right:10,bottom:220,width:0,height:200}),false);
});
