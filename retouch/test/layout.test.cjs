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

test('grid spans replace axis placement without altering other axes, sizes or scopes',()=>{
 assert.equal(L.spanClasses('col-start-2 col-end-4 col-span-2 row-span-2 w-full md:col-span-3','column',3),'row-span-2 w-full md:col-span-3 col-span-3');
 assert.equal(L.spanClasses('!row-[2_/_5] col-start-2','row','full'),'col-start-2 !row-span-full');
 assert.equal(L.spanClasses('col-span-full','column','auto'),'col-auto');
 assert.equal(L.spanClasses('col-card -col-start-2 col-end-[footer] row-card','column',2),'col-card row-card col-span-2');
 assert.equal(R.replaceScope('col-span-2 md:col-start-3',L.spanClasses('col-start-3','column',1),'md:'),'col-span-2 md:col-span-1');
 for(const value of [0,25,NaN,1.5,'2'])assert.throws(()=>L.spanClasses('','row',value));
 assert.equal(L.spanValue('2','4'),'');
 assert.equal(L.spanValue('span 3','span 3'),'3');
 assert.equal(L.spanValue('1','-1'),'full');
});

test('single sizing overrides important shorthand without replacing the other dimension',()=>{
 const source='!size-[120px] [width:80px] h-[90px] md:size-[200px]';
 assert.equal(L.sizeClasses(source,'width','fixed',160),'!size-[120px] h-[90px] md:size-[200px] !w-[160px]');
 assert.equal(L.sizeClasses('size-[120px]! [height:80px] w-[90px]','height','hug',0),'size-[120px]! w-[90px] !h-fit');
 assert.equal(L.sizeClasses('!size-20 basis-40','width','fill',0,{display:'flex',direction:'row'}),'!size-20 !w-auto !flex-1');
 assert.equal(L.sizeClasses('md:!size-20 w-10','width','fixed',100),'md:!size-20 w-[100px]');
 assert.equal(L.sizeClasses('![width:80px] size-20','width','fixed',100),'size-20 !w-[100px]');
});
