'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../shell/layout.js'),R=require('../shell/responsive.js');
test('layout mode replaces conflicting displays and direction, preserving unrelated styles',()=>{
 assert.equal(L.modeClasses('inline-flex flex-col p-4 md:grid hover:block','row'),'p-4 md:grid hover:block flex flex-row');
 assert.equal(L.modeClasses('!flex flex-row','grid'),'!grid');
 assert.throws(()=>L.modeClasses('','unknown'));
});
test('fill and fixed sizing account for the parent flex axis without losing constraints',()=>{
 assert.equal(L.sizeClasses('w-40 min-w-4 md:w-20','width','fill',0,{display:'flex',direction:'row'}),'min-w-4 md:w-20 w-auto flex-1');
 assert.equal(L.sizeClasses('h-40 flex-1','height','fixed',100,{display:'flex',direction:'column'}),'h-[100px] flex-none');
 assert.equal(L.sizeClasses('w-full','width','hug',0),'w-fit');
 assert.equal(L.sizeClasses('h-40','height','fill',0,{display:'grid'}),'h-full');
 assert.throws(()=>L.sizeClasses('','width','fixed',NaN));
});
test('responsive layout proposals preserve source base and other variants',()=>{
 const source='block p-4 md:flex md:flex-col lg:grid';
 assert.equal(R.replaceScope(source,L.modeClasses(R.project(source,'md:'),'row'),'md:'),'block p-4 lg:grid md:flex md:flex-row');
});

test('fill removes conflicting explicit flex basis, growth and shrink settings',()=>{
 assert.equal(L.sizeClasses('w-20 basis-40 grow-0 shrink-0 md:grow-0 flex-wrap','width','fill',0,{display:'flex',direction:'row'}),'md:grow-0 flex-wrap w-auto flex-1');
});
