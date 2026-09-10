'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),shared=require('../shell/react-selection.js'),R=require('../shell/responsive.js'),{twMerge}=require('tailwind-merge');
test('shared dimensions preserve coupled size utilities and independent companion dimensions',()=>{
 const source='size-[80px] md:!size-[120px] md:h-[100px] lg:w-[300px]';
 const width=shared.change(source,'md:','width',200);assert.ok(R.project(width,'md:').includes('!w-[200px]'));assert.ok(width.includes('md:!size-[120px]'));assert.ok(width.includes('md:h-[100px]'));assert.ok(width.includes('lg:w-[300px]'));assert.deepEqual(shared.change(width,'md:','width',null).split(' ').sort(),source.split(' ').sort());
 const written=twMerge(width);assert.ok(written.includes('md:!size-[120px]'));assert.ok(written.includes('md:!w-[200px]'));
 const height=shared.change(width,'md:','height',60);assert.ok(height.includes('md:!h-[60px]'));assert.ok(height.includes('md:!w-[200px]'));assert.ok(height.includes('md:!size-[120px]'));
 const inherited=shared.change('!size-[80px]','min-[900px]:','width',200,{createElement:()=>({style:{},remove(){}}),documentElement:{append(){}},defaultView:{getComputedStyle:()=>({fontSize:'16px'})},styleSheets:[]});assert.ok(inherited.includes('min-[900px]:!w-[200px]'));
 assert.throws(()=>shared.change('md:[inline-size:2rem]','md:','width',200),/logical sizing/);
 for(const value of [-1,Infinity,100001,'100%'])assert.throws(()=>shared.change(source,'md:','width',value),/supported shared style value/);
});

test('shared dimensions measure outer boxes and preserve content-box padding',()=>{
 const css={boxSizing:'content-box',getPropertyValue:property=>({width:'140px',height:'100px','padding-left':'10px','padding-right':'10px','padding-top':'10px','padding-bottom':'10px','border-left-width':'2px','border-right-width':'2px','border-top-width':'2px','border-bottom-width':'2px'})[property]||''};
 assert.equal(shared.dimensionSize(css,'width'),164);assert.equal(shared.dimensionSize(css,'height'),124);assert.equal(shared.dimensionValue(css,'width',200),176);assert.equal(shared.dimensionValue(css,'height',60),36);assert.equal(shared.dimensionValue(css,'height',null),null);assert.throws(()=>shared.dimensionValue(css,'width',20),/padding and borders/);assert.equal(shared.dimensionValue({...css,boxSizing:'border-box'},'width',200),200);
});

test('automatic and fit-content shared sizes override only one axis with retained priority',()=>{
 const source='size-[80px] md:!size-[120px]';
 assert.ok(shared.change(source,'md:','width','auto').includes('md:!w-auto'));
 const fit=shared.change(source,'md:','width','fit-content');assert.ok(fit.includes('md:!w-fit'));assert.ok(fit.includes('md:!size-[120px]'));
 const height=shared.change(fit,'md:','height','auto');assert.ok(height.includes('md:!h-auto'));assert.ok(height.includes('md:!w-fit'));
 for(const keyword of ['auto','fit-content'])assert.equal(shared.dimensionValue({boxSizing:'content-box',getPropertyValue:()=> '12px'},'width',keyword),keyword);
});

test('resetting a bound dimension replaces its important axis override and preserves fallback utilities',()=>{
 const classes=require('../src/variable-classes.cjs');
 for(const [property,axis]of [['width','w'],['height','h']]){
  const source='md:'+axis+'-40 md:!'+axis+'-fit md:!opacity-50';
  // Disjoint known explicit properties are allowed; unknown important utilities
  // retain the existing refusal, including opacity shorthand here.
  assert.throws(()=>classes.compose(source,property,'24px','md:'),/conflicting important/);
  const input=source.replace('md:!opacity-50','md:![color:red]'),result=classes.compose(input,property,'24px','md:');assert.ok(result.includes('md:!['+property+':24px]'));assert.ok(result.includes('md:'+axis+'-40'));assert.ok(!result.includes(axis+'-fit'));assert.ok(result.includes('md:![color:red]'));
  assert.equal(classes.compose('md:'+axis+'-40 md:'+axis+'-auto!',property,null,'md:'),'md:'+axis+'-40');
 }
});


test('shared size constraints preserve independent bounds and do not inherit fixed-size priority',()=>{
 const source='size-[80px] md:!size-[120px] md:!min-w-[40px] md:max-w-[300px] lg:min-w-[90px]';
 const min=shared.change(source,'md:','min-width',180);assert.ok(min.includes('md:![min-width:180px]'));assert.ok(min.includes('md:max-w-[300px]'));assert.ok(min.includes('lg:min-w-[90px]'));
 const max=shared.change(source,'md:','max-height',100);assert.ok(max.includes('md:[max-height:100px]'));assert.ok(!max.includes('md:![max-height:'));
 assert.ok(shared.change(min,'md:','min-width','auto').includes('md:![min-width:auto]'));
 assert.ok(shared.change(source,'md:','max-width','none').includes('md:[max-width:none]'));
 for(const [property,invalid]of [['width','none'],['min-width','none'],['max-height','auto'],['max-width','30%']])assert.throws(()=>shared.change(source,'md:',property,invalid),/supported shared style/);
 assert.throws(()=>shared.change('md:[min-inline-size:10px]','md:','min-width',180),/logical sizing/);
});

test('shared constraints preserve unmeasured relative values and convert each box axis',()=>{
 const values={'min-width':'50%','max-width':'none','min-height':'auto','max-height':'200px','padding-left':'10px','padding-right':'10px','padding-top':'4px','padding-bottom':'4px'};
 const css={boxSizing:'content-box',getPropertyValue:property=>values[property]||'0px'};
 for(const property of ['min-width','max-width','min-height'])assert.ok(Number.isNaN(shared.dimensionSize(css,property)));
 assert.equal(shared.dimensionSize(css,'max-height'),208);assert.equal(shared.dimensionValue(css,'min-width',180),160);assert.equal(shared.dimensionValue(css,'max-height',100),92);
 assert.equal(shared.dimensionValue(css,'min-width','auto'),'auto');assert.equal(shared.dimensionValue(css,'max-height','none'),'none');
});


test('shared aspect ratios atomically release height while preserving width and scoped bounds',()=>{
 const source='size-[80px] aspect-square md:!size-[120px] md:!aspect-video md:min-h-[24px] lg:aspect-auto';
 const ratio=shared.changeRatio(source,'md:','2:1');assert.ok(ratio.includes('md:![aspect-ratio:2_/_1]'));assert.ok(ratio.includes('md:!h-auto'));assert.ok(ratio.includes('md:!size-[120px]'));assert.ok(ratio.includes('md:min-h-[24px]'));assert.ok(ratio.includes('aspect-square'));assert.ok(ratio.includes('lg:aspect-auto'));
 const reset=shared.changeRatio(ratio,'md:',null);assert.ok(!reset.includes('md:![aspect-ratio:'));assert.ok(reset.includes('md:!h-auto'));
 const auto=shared.changeRatio(source,'md:','auto');assert.ok(auto.includes('md:![aspect-ratio:auto]'));assert.ok(!auto.includes('md:!h-auto'));
 for(const value of ['0 / 1','1 / 0','-1 / 1','Infinity','2; color:red',''])assert.throws(()=>shared.changeRatio(source,'md:',value),/supported shared style/);
 assert.throws(()=>shared.changeRatio('md:[block-size:10px]','md:','16 / 9'),/logical sizing/);
});


test('shared flex factors preserve shorthand basis and independent factors with important priority',()=>{
 const source='flex-none md:!flex-[0_1_100px] md:shrink-0 lg:grow-2';
 const grown=shared.change(source,'md:','flex-grow',1);assert.ok(grown.includes('md:![flex-grow:1]'));assert.ok(grown.includes('md:!flex-[0_1_100px]'));assert.ok(grown.includes('md:shrink-0'));assert.ok(grown.includes('lg:grow-2'));
 const shrunk=shared.change(grown,'md:','flex-shrink',.5);assert.ok(shrunk.includes('md:![flex-shrink:0.5]'));assert.ok(!shrunk.includes('md:shrink-0'));assert.ok(shrunk.includes('md:![flex-grow:1]'));
 assert.deepEqual(shared.change(grown,'md:','flex-grow',null).split(' ').sort(),source.split(' ').sort());
 for(const value of [-1,Infinity,1001,'auto'])assert.throws(()=>shared.change(source,'md:','flex-grow',value),/supported shared style/);
});


test('shared flex basis retains units, shorthand factors, and independent screen overrides',()=>{
 const source='basis-auto md:!flex-[1_0_100px] md:grow-2 md:basis-20 lg:basis-full';
 for(const value of ['0','120px','2rem','50%','auto','content','min-content','max-content','fit-content']){const result=shared.change(source,'md:','flex-basis',value);assert.ok(result.includes('md:![flex-basis:'+value+']'));assert.ok(result.includes('md:!flex-[1_0_100px]'));assert.ok(result.includes('md:grow-2'));assert.ok(result.includes('lg:basis-full'));assert.ok(!result.includes('md:basis-20'));}
 for(const value of ['-1px','100','NaNpx','100001px','50%;color:red','',null]){if(value===null){assert.ok(!shared.change(source,'md:','flex-basis',null).includes('md:basis-20'));continue;}assert.throws(()=>shared.change(source,'md:','flex-basis',value),/supported shared style/);}
});


test('shared item alignment preserves the companion axis of place-self shorthands',()=>{
 const source='place-self-start md:!place-self-end md:self-start md:justify-self-center lg:self-end';
 const aligned=shared.change(source,'md:','align-self','center');assert.ok(aligned.includes('md:![align-self:center]'));assert.ok(aligned.includes('md:!place-self-end'));assert.ok(aligned.includes('md:justify-self-center'));assert.ok(!aligned.includes('md:self-start'));assert.ok(aligned.includes('lg:self-end'));
 const justified=shared.change(aligned,'md:','justify-self','start');assert.ok(justified.includes('md:![justify-self:start]'));assert.ok(justified.includes('md:![align-self:center]'));assert.ok(!justified.includes('md:justify-self-center'));
 const reset=shared.change(justified,'md:','justify-self',null);assert.ok(!reset.includes('[justify-self:'));assert.ok(reset.includes('md:!place-self-end'));
 assert.ok(shared.change('md:![place-self:start_end]','md:','align-self','last baseline').includes('md:![align-self:last_baseline]'));
 assert.throws(()=>shared.change(source,'md:','align-self','space-between'),/supported shared style/);
});
