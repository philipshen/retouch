'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const R=require('../shell/responsive.js');
const inspector=require('../shell/inspector.js');
test('screen-scoped style edits preserve base, other breakpoints, states and arbitrary colons',()=>{
 const before='text-base md:text-lg hover:text-red-500 lg:text-xl md:hover:text-blue-500 bg-[url(https://example.com/a)]';
 const projection=R.project(before,'md:');
 assert.equal(projection,'text-lg');
 const next=R.replaceScope(before,inspector.replace(projection,t=>t.startsWith('text-'),'text-2xl'),'md:');
 assert.equal(next,'text-base hover:text-red-500 lg:text-xl md:hover:text-blue-500 bg-[url(https://example.com/a)] md:text-2xl');
 assert.equal(R.project(next),'text-base bg-[url(https://example.com/a)]');
 assert.equal(R.replaceScope(next,'','md:'),before.replace('md:text-lg ',''));
});
test('base editing preserves all variants and important declarations remain important',()=>{
 const before='!opacity-50 md:opacity-75 focus:opacity-100';
 const edited=inspector.replace(R.project(before),t=>t.startsWith('opacity-'),'opacity-100');
 assert.equal(R.replaceScope(before,edited),'md:opacity-75 focus:opacity-100 !opacity-100');
 assert.equal(R.project('min-[768px]:bg-[color:var(--brand)] md:hover:opacity-50','min-[768px]:'),'bg-[color:var(--brand)]');
 assert.throws(()=>R.replaceScope(before,'lg:opacity-25','md:'),/unprefixed/);
 assert.throws(()=>R.replaceScope(before,'opacity-25','[&:hover]:'),/Unsupported/);
});
test('loaded CSS discovers actual named breakpoint variants without evaluating config',()=>{
 const d={styleSheets:[{cssRules:[{media:{mediaText:'(width >= 48rem)'},cssRules:[{selectorText:'.tablet\\:flex'}, {selectorText:'.hover\\:text-red'}]}]}]};
 assert.deepEqual(R.discover(d),[{prefix:'tablet:',label:'tablet',condition:'(width >= 48rem)'}]);
});

test('nested Tailwind v4 rules retain their outer selector during breakpoint discovery',()=>{
 const d={styleSheets:[{cssRules:[{selectorText:'.md\\:opacity-90',cssRules:[{media:{mediaText:'(width >= 48rem)'},cssRules:[{style:{opacity:'.9'}}]}]}]}]};
 assert.deepEqual(R.discover(d),[{prefix:'md:',label:'md',condition:'(width >= 48rem)'}]);
});
test('new widths reuse named breakpoints and retain the project unit and initial font metrics',()=>{
 const d={createElement:()=>({style:{},remove(){}}),documentElement:{append(){}},defaultView:{getComputedStyle:()=>({fontSize:'20px'})}};
 const choices=[{prefix:'tablet:',label:'tablet',condition:'(width >= 48rem)'}];
 assert.equal(R.atWidth(d,960,choices).prefix,'tablet:');
 assert.equal(R.atWidth(d,1000,choices).prefix,'min-[50rem]:');
 assert.equal(R.atWidth(d,1000,[{prefix:'wide:',label:'wide',condition:'(min-width: 800px)'}]).prefix,'min-[1000px]:');
});
