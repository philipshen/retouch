'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../src/effect-style-classes.cjs'),S=require('../shell/shadow-visibility.js'),R=require('../shell/responsive.js');
const model=[{x:2,y:4,blur:8,spread:0,color:'#33669980',inset:false,hidden:true}],hidden=S.write(model),base=S.classes('p-4','',hidden),tablet=S.classes(base,'md:',S.write([{...model[0],x:12}]));
test('saved effect replacement clears hidden metadata in its own scope and preserves other scopes',()=>{
 const next=C.compose(tablet,{'box-shadow':'none'},'md:');
 assert.equal(R.project(next,''),R.project(tablet,''));assert.ok(R.project(next,'md:').includes('![--rt-hidden-shadows:none]'));assert.ok(!R.project(next,'md:').includes('rtsh1-'));assert.deepEqual(C.overrides(next,{'box-shadow':'none'},'md:'),[]);
 const phone=C.compose(tablet,{'box-shadow':'none'});assert.equal(R.project(phone,'md:'),R.project(tablet,'md:'));assert.ok(!R.project(phone,'').includes('rtsh1-'));
});
test('applying a shadow at a larger screen masks inherited hidden metadata',()=>{
 const next=C.compose(base,{'box-shadow':'0px 1px 2px #12345680'},'md:');assert.equal(R.project(next,''),R.project(base,''));assert.ok(R.project(next,'md:').includes('![--rt-hidden-shadows:none]'));assert.deepEqual(C.overrides(next,{'box-shadow':'0px 1px 2px #12345680'},'md:'),[]);
});
test('resetting a shadow removes its metadata while filter-only styles preserve it',()=>{
 const reset=C.compose(tablet,{},'md:',['box-shadow']);assert.equal(R.project(reset,'md:'),'');assert.equal(R.project(reset,''),R.project(base,''));
 const filter=C.compose(tablet,{filter:'blur(2px)'},'md:');assert.ok(R.project(filter,'md:').includes(R.project(tablet,'md:')));assert.equal(R.project(filter,''),R.project(base,''));
});
test('hidden shadows remain local overrides during library refresh',()=>{
 const baseline={'box-shadow':'0px 2px 4px #33669980'},next={'box-shadow':'none'},result=C.refresh(tablet,baseline,next,'md:');assert.equal(result.classes,tablet);assert.deepEqual(result.overrides,['box-shadow']);
});
