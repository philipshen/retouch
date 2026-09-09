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
 assert.deepEqual(R.discover(d),[{prefix:'tablet:',label:'tablet',queries:[['(width >= 48rem)']],condition:'(width >= 48rem)'}]);
});

test('nested Tailwind v4 rules retain their outer selector during breakpoint discovery',()=>{
 const d={styleSheets:[{cssRules:[{selectorText:'.md\\:opacity-90',cssRules:[{media:{mediaText:'(width >= 48rem)'},cssRules:[{style:{opacity:'.9'}}]}]}]}]};
 assert.deepEqual(R.discover(d),[{prefix:'md:',label:'md',queries:[['(width >= 48rem)']],condition:'(width >= 48rem)'}]);
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


test('breakpoint discovery retains nested conditions and repeated alternatives without broadening parent rules',()=>{
 const leaf={selectorText:'.tablet\\:flex'};
 const nested={selectorText:leaf.selectorText,style:{length:0},cssRules:[{media:{mediaText:'(min-height: 60rem)'},cssRules:[{style:{length:1}}]}]};
 const d={styleSheets:[{media:{mediaText:'screen'},cssRules:[
   {media:{mediaText:'(min-width: 48rem)'},cssRules:[nested]},
   {media:{mediaText:'(min-width: 90rem)'},cssRules:[leaf,leaf]}
 ]}]};
 const [choice]=R.discover(d);assert.deepEqual(choice.queries,[['screen','(min-width: 48rem)','(min-height: 60rem)'],['screen','(min-width: 90rem)']]);
 const window=values=>({matchMedia:q=>({matches:values.includes(q)})});assert.equal(R.matches(choice,window(['screen','(min-width: 48rem)'])),false);assert.equal(R.matches(choice,window(['screen','(min-width: 48rem)','(min-height: 60rem)'])),true);assert.equal(R.matches(choice,window(['screen','(min-width: 90rem)'])),true);assert.equal(R.matches({prefix:'unknown:'},window([])),null);
 const metrics={createElement:()=>({style:{},remove(){}}),documentElement:{append(){}},defaultView:{getComputedStyle:()=>({fontSize:'16px'})}};
 assert.equal(R.atWidth(metrics,768,[choice]).prefix,'min-[48rem]:');assert.equal(R.atWidth(metrics,768,[{prefix:'range:',condition:'(min-width: 48rem) and (max-width: 64rem)'}]).prefix,'min-[48rem]:');assert.equal(R.atWidth(metrics,768,[{prefix:'unknown:'}]).prefix,'min-[768px]:');
 assert.equal(R.inherited('left-0 tablet:left-10','min-[1000px]:',metrics,[choice]),'left-0');
});


test('imported and adopted stylesheets retain media context and tolerate inaccessible or cyclic imports',()=>{
 const imported={media:{mediaText:'(min-width: 700px)'},cssRules:[{selectorText:'.imported\\:flex'}]},adopted={cssRules:[{media:{mediaText:'(min-width: 900px)'},cssRules:[{selectorText:'.adopted\\:flex'}]}]},blocked={get cssRules(){throw Error('SecurityError')}};
 const parent={cssRules:[{media:{mediaText:'(min-width: 700px)'},styleSheet:imported},{styleSheet:blocked},{media:{mediaText:'(min-height: 800px)'},styleSheet:imported}]};
 imported.cssRules.push({styleSheet:parent});
 const choices=R.discover({styleSheets:[parent,{disabled:true,cssRules:[{selectorText:'.disabled\\:flex',media:{mediaText:'(min-width: 1px)'}}]}],adoptedStyleSheets:[adopted]});
 assert.deepEqual(choices.map(c=>c.prefix),['adopted:','imported:']);assert.deepEqual(choices[1].queries,[['(min-width: 700px)'],['(min-height: 800px)','(min-width: 700px)']]);assert.deepEqual(choices[0].queries,[['(min-width: 900px)']]);
});
