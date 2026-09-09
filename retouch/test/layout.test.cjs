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

test('size limits preserve dimensions, other limits and responsive variants',()=>{
 const source='w-full min-w-20 max-w-xl md:max-w-2xl min-h-10';
 assert.equal(L.limitClasses(source,'max-width','480'),'w-full min-w-20 md:max-w-2xl min-h-10 max-w-[480px]');
 assert.equal(L.limitClasses('!max-w-xl w-full','max-width','75%'),'w-full !max-w-[75%]');
 assert.equal(L.limitClasses(source,'min-width',null),'w-full max-w-xl md:max-w-2xl min-h-10');
 assert.equal(R.replaceScope(source,L.limitClasses(R.project(source,'md:'),'max-width','30rem'),'md:'),'w-full min-w-20 max-w-xl min-h-10 md:max-w-[30rem]');
 assert.equal(L.ownLimit('min-w-[25%]','min-width'),'25%');
 assert.equal(L.ownLimit('md:min-w-[25%]','min-width'),null);
});
test('size limits validate units and retain explicit unlimited/intrinsic values',()=>{
 for(const v of ['auto','min-content','max-content','fit-content','0','1.5rem','75%'])assert.ok(L.limitValue(v,'min-width'));
 assert.equal(L.limitValue('none','max-height'),'none');
 for(const v of ['-1','NaN','1px] hidden','auto','calc(100% - 1px)'])assert.throws(()=>L.limitValue(v,'max-width'));
 assert.throws(()=>L.limitClasses('','bad','1'));
});
