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
test('minimum-width anchor inheritance includes intermediate scopes in size order',()=>{
 const d={createElement:()=>({style:{},remove(){}}),documentElement:{append(){}},defaultView:{getComputedStyle:()=>({fontSize:'16px'})}},choices=[{prefix:'md:',condition:'(width >= 48rem)'},{prefix:'lg:',condition:'(min-width: 1024px)'},{prefix:'range:',condition:'(width >= 48rem) and (width < 64rem)'}];
 const classes='right-[20px] w-[80px] lg:opacity-90 md:left-[30px] md:right-auto min-[900px]:w-[100px] hover:left-0 md:hover:right-0 range:top-0 min-[1200px]:right-0';
 const inherited=R.inherited(classes,'lg:',d,choices);assert.equal(inherited,'right-[20px] w-[80px] left-[30px] right-auto w-[100px]');assert.equal(inspector.inferredAnchor('opacity-90','x',inherited),'start');
 assert.equal(R.inherited(classes,'md:',d,choices),'right-[20px] w-[80px]');assert.equal(R.inherited(classes,'',d,choices),'right-[20px] w-[80px]');assert.equal(R.inherited(classes,'max-[1000px]:',d,choices),'right-[20px] w-[80px]');
});
test('anchor inference resolves inherited auto resets, shorthands and important priorities',()=>{
 assert.equal(inspector.inferredAnchor('left-[20px] right-auto','x','left-auto right-[30px]'),'start');
 assert.equal(inspector.inferredAnchor('right-auto','x','left-auto right-[30px]!'),'end');
 assert.equal(inspector.inferredAnchor('inset-x-0 w-auto','x'),'stretch');
 assert.equal(inspector.inferredAnchor('w-[100px]','x','left-[5%] w-[20%] right-auto'),'start');
 assert.equal(inspector.inferredAnchor('right-[5%] left-auto w-[20%]','x'),'scale');
});
