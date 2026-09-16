'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parse}=require('../runtime/group-scale-bootstrap.js');
test('saved group scale ranges are ordered and reject ambiguous or unbounded metadata',()=>{
 assert.deepEqual(parse('{"version":1,"ranges":{"1100":2,"0":1.5,"768":1}}'),[[0,1.5],[768,1],[1100,2]]);
 for(const data of [null,[],{version:2,ranges:{0:2}},{version:1,ranges:[]},{version:1,ranges:{}},{version:1,ranges:{'01':2}},{version:1,ranges:{'-1':2}},{version:1,ranges:{7681:2}},{version:1,ranges:{0:'2'}},{version:1,ranges:{0:0}},{version:1,ranges:{0:101}},{version:1,ranges:{0:2},extra:true}])assert.throws(()=>parse(JSON.stringify(data)),/scale/);
});
