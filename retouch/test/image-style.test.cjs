'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../shell/image-style.js'),R=require('../shell/responsive.js');
test('fit and position edits remain independent and preserve size and breakpoint variants',()=>{
 const before='w-40 object-cover object-top md:object-contain';
 assert.equal(S.fit(before,'contain'),'w-40 object-top md:object-contain object-contain');
 assert.equal(S.position(before,25,75),'w-40 object-cover md:object-contain object-[25%_75%]');
 assert.equal(S.position('!object-left object-cover',0,50),'object-cover !object-[0%_50%]');
});
test('image framing composes with responsive edit scope and validates input',()=>{
 const before='object-cover object-center md:object-left';
 assert.equal(R.replaceScope(before,S.position(R.project(before,'md:'),100,0),'md:'),'object-cover object-center md:object-[100%_0%]');
 for(const x of [-1,101,NaN,Infinity])assert.throws(()=>S.position('',x,50));
 assert.throws(()=>S.fit('','invalid'));
});

test('position inputs use committed class values before the renderer catches up',()=>{
 assert.deepEqual(S.coordinates('object-cover !object-[25%_50%]','100% 50%'),[25,50]);
 assert.deepEqual(S.coordinates('object-cover','20% 80%'),[20,80]);
 assert.ok(S.coordinates('object-cover','10px 50%').some(Number.isNaN));
});
