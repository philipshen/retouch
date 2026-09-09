'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{reorder}=require('../src/source-order.cjs');
test('source reorder maps every retained offset across unequal chunks and comments',()=>{
 const source='^AAA/*x*/BBBBB--CC!DDDD$',ranges=[{start:1,end:4},{start:9,end:14},{start:16,end:18},{start:19,end:23}];
 for(const [from,to,expected] of [[0,3,'^BBBBB/*x*/CC--DDDD!AAA$'],[3,0,'^DDDD/*x*/AAA--BBBBB!CC$'],[1,2,'^AAA/*x*/CC--BBBBB!DDDD$']]){const result=reorder(source,ranges,from,to);assert.equal(result.after,expected);const offsets=new Set();for(let i=0;i<source.length;i++){const mapped=result.offset(i);offsets.add(mapped);assert.equal(result.after[mapped],source[i]);}assert.equal(offsets.size,source.length);assert.equal(result.offset(source.length),source.length);}
 for(const [from,to]of [[-1,0],[0,4],[0,0],[0,1.5]])assert.throws(()=>reorder(source,ranges,from,to));
 assert.throws(()=>reorder(source,[{start:1,end:5},{start:4,end:8}],0,1));
});
