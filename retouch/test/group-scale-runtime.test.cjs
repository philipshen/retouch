'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parse}=require('../runtime/group-scale-bootstrap.js');
test('saved group scale ranges are ordered and reject ambiguous or unbounded metadata',()=>{
 assert.deepEqual(parse('{"version":1,"ranges":{"1100":2,"0":1.5,"768":1}}'),[[0,1.5],[768,1],[1100,2]]);
 for(const data of [null,[],{version:2,ranges:{0:2}},{version:1,ranges:[]},{version:1,ranges:{}},{version:1,ranges:{'01':2}},{version:1,ranges:{'-1':2}},{version:1,ranges:{7681:2}},{version:1,ranges:{0:'2'}},{version:1,ranges:{0:0}},{version:1,ranges:{0:101}},{version:1,ranges:{0:2},extra:true}])assert.throws(()=>parse(JSON.stringify(data)),/scale/);
});
test('ordered transform metadata validates scopes, member snapshots and bounds',()=>{
 const base={version:1,ranges:{0:1.5}},valid=[{styles:{abc:{0:{factor:1.2,move:[23,-9]}}}},{factor:1.5,min:0,max:1100,offset:[0,0],move:[0,0]}];assert.deepEqual(parse(JSON.stringify({...base,steps:valid})),[[0,1.5]]);
 for(const steps of [null,{},Array(101).fill(valid[1]),[null],[{}],[{...valid[1],max:0}],[{...valid[1],factor:0}],[{...valid[1],move:[Infinity,0]}],[{styles:{abc:{0:{factor:1,move:[0,0],extra:1}}}}],[{styles:{abc:{'-1':{factor:1,move:[0,0]}}}}]])assert.throws(()=>parse(JSON.stringify({...base,steps})),/transform/);
});
