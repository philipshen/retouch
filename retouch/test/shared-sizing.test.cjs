'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),shared=require('../shell/react-selection.js'),R=require('../shell/responsive.js'),{twMerge}=require('tailwind-merge');
test('shared dimensions preserve coupled size utilities and independent companion dimensions',()=>{
 const source='size-[80px] md:!size-[120px] md:h-[100px] lg:w-[300px]';
 const width=shared.change(source,'md:','width',200);assert.ok(R.project(width,'md:').includes('!w-[200px]'));assert.ok(width.includes('md:!size-[120px]'));assert.ok(width.includes('md:h-[100px]'));assert.ok(width.includes('lg:w-[300px]'));assert.deepEqual(shared.change(width,'md:','width',null).split(' ').sort(),source.split(' ').sort());
 const written=twMerge(width);assert.ok(written.includes('md:!size-[120px]'));assert.ok(written.includes('md:!w-[200px]'));
 const height=shared.change(width,'md:','height',60);assert.ok(height.includes('md:!h-[60px]'));assert.ok(height.includes('md:!w-[200px]'));assert.ok(height.includes('md:!size-[120px]'));
 const inherited=shared.change('!size-[80px]','min-[900px]:','width',200,{createElement:()=>({style:{},remove(){}}),documentElement:{append(){}},defaultView:{getComputedStyle:()=>({fontSize:'16px'})},styleSheets:[]});assert.ok(inherited.includes('min-[900px]:!w-[200px]'));
 assert.throws(()=>shared.change('md:[inline-size:2rem]','md:','width',200),/logical sizing/);
 for(const value of [-1,Infinity,100001,'auto'])assert.throws(()=>shared.change(source,'md:','width',value),/supported shared style value/);
});

test('shared dimensions measure outer boxes and preserve content-box padding',()=>{
 const css={boxSizing:'content-box',getPropertyValue:property=>({width:'140px',height:'100px','padding-left':'10px','padding-right':'10px','padding-top':'10px','padding-bottom':'10px','border-left-width':'2px','border-right-width':'2px','border-top-width':'2px','border-bottom-width':'2px'})[property]||''};
 assert.equal(shared.dimensionSize(css,'width'),164);assert.equal(shared.dimensionSize(css,'height'),124);assert.equal(shared.dimensionValue(css,'width',200),176);assert.equal(shared.dimensionValue(css,'height',60),36);assert.equal(shared.dimensionValue(css,'height',null),null);assert.throws(()=>shared.dimensionValue(css,'width',20),/padding and borders/);assert.equal(shared.dimensionValue({...css,boxSizing:'border-box'},'width',200),200);
});
