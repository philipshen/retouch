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
 assert.equal(L.sizeClasses('h-40','height','fill',0,{display:'grid'}),'h-auto self-stretch');
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

test('reset sizing removes the selected axis overrides and flex main-axis sizing only',()=>{
 const source='!size-20 !w-[100px] [width:90px] h-40 min-w-10 md:w-60 flex-1 basis-20 grow shrink-0';
 assert.equal(L.sizeClasses(source,'width','reset',0),'!size-20 h-40 min-w-10 md:w-60 flex-1 basis-20 grow shrink-0');
 assert.equal(L.sizeClasses(source,'width','reset',0,{display:'flex',direction:'row'}),'!size-20 h-40 min-w-10 md:w-60');
 assert.equal(L.sizeClasses('h-20 w-10 flex-1','height','reset',0,{display:'flex',direction:'row'}),'w-10 flex-1');
 const scoped='w-20 md:!size-40 md:!w-60 md:h-40 lg:w-80';
 assert.equal(R.replaceScope(scoped,L.sizeClasses(R.project(scoped,'md:'),'width','reset',0),'md:'),'w-20 lg:w-80 md:!size-40 md:h-40');
});

test('main-axis size changes replace arbitrary flex geometry and retain cross-axis styles',()=>{
 const source='[flex:2_1_40px] [flex-grow:3] [flex-shrink:0] [flex-basis:60px] flex-2/3 flex-(--layout) h-20 md:[flex:1] flex-col';
 for(const mode of ['fixed','hug','fill','reset']){const result=L.sizeClasses(source,'width',mode,100,{display:'flex',direction:'row'});assert.ok(!result.includes('[flex:2_1_40px]'));assert.ok(!result.includes('[flex-grow:3]'));assert.ok(!result.includes('[flex-shrink:0]'));assert.ok(!result.includes('[flex-basis:60px]'));assert.ok(!result.includes('flex-2/3'));assert.ok(!result.includes('flex-(--layout)'));assert.ok(result.includes('h-20 md:[flex:1] flex-col'));}
 assert.equal(L.sizeClasses('[flex-basis:60px] h-20','height','reset',0,{display:'flex',direction:'row'}),'[flex-basis:60px]');
});

test('cross-axis and grid fill stretch the margin box instead of using content-box percentages',()=>{
 assert.equal(L.sizeClasses('w-full self-center h-40','width','fill',0,{display:'flex',direction:'column'}),'h-40 w-auto self-stretch');
 assert.equal(L.sizeClasses('h-20 [align-self:center] w-40','height','fill',0,{display:'flex',direction:'row'}),'w-40 h-auto self-stretch');
 assert.equal(L.sizeClasses('w-full justify-self-end self-center','width','fill',0,{display:'grid'}),'self-center w-auto justify-self-stretch');
 assert.equal(L.sizeClasses('!size-20 !self-start justify-self-end','height','fill',0,{display:'grid'}),'!size-20 justify-self-end !h-auto !self-stretch');
});

test('stretch fill overrides important alignment shorthand while preserving its other axis',()=>{
 assert.equal(L.sizeClasses('!place-self-center size-20','width','fill',0,{display:'grid'}),'!place-self-center size-20 !w-auto !justify-self-stretch');
 assert.equal(L.sizeClasses('![place-self:center] w-20','height','fill',0,{display:'flex',direction:'row'}),'![place-self:center] w-20 !h-auto !self-stretch');
});

test('reset removes stretch sizing alignment but preserves other alignment choices',()=>{
 assert.equal(L.sizeClasses('w-auto !justify-self-stretch self-center','width','reset',0,{display:'grid'}),'self-center');
 assert.equal(L.sizeClasses('h-auto [align-self:stretch] justify-self-center','height','reset',0,{display:'flex',direction:'row'}),'justify-self-center');
 assert.equal(L.sizeClasses('w-auto self-center','width','reset',0,{display:'flex',direction:'column'}),'self-center');
});

test('vertical writing modes map physical dimensions to flex and grid axes',()=>{
 for(const writingMode of ['vertical-rl','vertical-lr','sideways-rl','sideways-lr']){
  assert.deepEqual(L.layoutAxes({writingMode,direction:'row-reverse'}),{inline:'height',block:'width',main:'height'});
  assert.equal(L.sizeClasses('h-20','height','fill',0,{display:'flex',direction:'row',writingMode}),'h-auto flex-1');
  assert.equal(L.sizeClasses('w-20','width','fill',0,{display:'flex',direction:'row',writingMode}),'w-auto self-stretch');
  assert.equal(L.sizeClasses('w-20','width','fill',0,{display:'flex',direction:'column-reverse',writingMode}),'w-auto flex-1');
  assert.equal(L.sizeClasses('h-20','height','fill',0,{display:'grid',writingMode}),'h-auto justify-self-stretch');
  assert.equal(L.sizeClasses('w-20','width','fill',0,{display:'grid',writingMode}),'w-auto self-stretch');
 }
});

test('physical gap edits follow writing mode and preserve the other shorthand axis',()=>{
 assert.equal(L.gapClasses('!gap-4 gap-x-2 [column-gap:8px] gap-y-3 md:gap-10','width',30,'horizontal-tb'),'!gap-4 gap-y-3 md:gap-10 !gap-x-[30px]');
 assert.equal(L.gapClasses('!gap-4 gap-y-2 [row-gap:8px] gap-x-3','width',30,'vertical-lr'),'!gap-4 gap-x-3 !gap-y-[30px]');
 assert.equal(L.gapClasses('[gap:12px_20px]! gap-x-4','height',15,'vertical-rl'),'[gap:12px_20px]! !gap-x-[15px]');
 assert.equal(L.gapClasses('md:!gap-4 gap-x-2','width',30,'horizontal-tb'),'md:!gap-4 gap-x-[30px]');
 for(const value of [-1,NaN,10001])assert.throws(()=>L.gapClasses('','width',value));
});

test('gap values preserve supported units and reject invalid or oversized source tokens',()=>{
 for(const value of ['10%','1.5rem','.5em','2vw','2vh','4ch','normal'])assert.equal(L.gapValue(value),value);
 assert.equal(L.gapValue(' 12.5 '),'12.5px');assert.equal(L.gapClasses('!gap-4','width','15%'),'!gap-4 !gap-x-[15%]');
 for(const value of ['',-1,Infinity,'10001px','2px hidden','calc(10% + 2px)','auto','-1%'])assert.throws(()=>L.gapValue(value));
});

test('resetting one gap preserves shorthand, opposite axis and other breakpoints',()=>{
 const classes='!gap-4 !gap-x-[15%] [column-gap:8px] gap-y-3 md:gap-x-10';
 assert.equal(L.gapClasses(classes,'width',null,'horizontal-tb'),'!gap-4 gap-y-3 md:gap-x-10');
 assert.equal(L.gapClasses(classes,'height',null,'vertical-lr'),'!gap-4 gap-y-3 md:gap-x-10');
 assert.equal(L.gapClasses('!gap-4 gap-y-3','width',null,'horizontal-tb'),'!gap-4 gap-y-3');
 const source='gap-4 md:!gap-[10%] md:!gap-x-[15%] md:gap-y-8 lg:gap-10';
 assert.equal(R.replaceScope(source,L.gapClasses(R.project(source,'md:'),'width',null),'md:'),'gap-4 lg:gap-10 md:!gap-[10%] md:gap-y-8');
});

test('breakpoint gap edits can override inherited important shorthand or axis declarations',()=>{
 assert.equal(L.gapClasses('gap-4','width',30,'horizontal-tb','!gap-2'),'gap-4 !gap-x-[30px]');
 assert.equal(L.gapClasses('','height','15%','vertical-lr','![column-gap:10%]'),'!gap-x-[15%]');
 assert.equal(L.gapClasses('','width',30,'horizontal-tb','!gap-y-2'),'gap-x-[30px]');
 assert.equal(L.gapClasses('gap-x-4 gap-y-2','width',null,'horizontal-tb','!gap-2'),'gap-y-2');
});

test('breakpoint sizing overrides inherited important dimensions and main-axis flex values',()=>{
 assert.equal(L.sizeClasses('','width','fixed',200,{inheritedClasses:'!w-40 !h-20'}),'!w-[200px]');
 assert.equal(L.sizeClasses('','height','hug',0,{inheritedClasses:'!size-40'}),'!h-fit');
 assert.equal(L.sizeClasses('','width','fill',0,{display:'flex',direction:'row',inheritedClasses:'![flex-basis:100px]'}),'!w-auto !flex-1');
 assert.equal(L.sizeClasses('','width','fill',0,{display:'grid',inheritedClasses:'!place-self-center'}),'!w-auto !justify-self-stretch');
 assert.equal(L.sizeClasses('','width','fixed',200,{inheritedClasses:'!h-20 !min-w-40'}),'w-[200px]');
 assert.equal(L.sizeClasses('w-40 h-20','width','reset',0,{inheritedClasses:'!size-40'}),'h-20');
});

test('layout modes override inherited important display and flow while retaining wrapping and other scopes',()=>{
 assert.equal(L.modeClasses('[display:grid] [flex-direction:column] p-4 md:block','row','!grid'),'p-4 md:block !flex !flex-row');
 assert.equal(L.modeClasses('grid [flex-flow:column_wrap]!','row'),'[flex-flow:column_wrap]! !flex !flex-row');
 assert.equal(L.modeClasses('flex flex-col','flow','![display:grid]'),'!block');
 assert.equal(L.modeClasses('block','grid','!w-40'),'grid');
});


test('arrangement controls replace arbitrary properties and override relevant inherited shorthands',()=>{
 assert.equal(L.arrangementClasses('[flex-wrap:wrap] p-4','wrap','nowrap','![flex-flow:column_wrap]'),'p-4 !flex-nowrap');
 assert.equal(L.arrangementClasses('[align-items:start] justify-items-end','align','center','!place-items-end'),'justify-items-end !items-center');
 assert.equal(L.arrangementClasses('[justify-content:end] justify-self-end','justify','between','[place-content:center]!'),'justify-self-end !justify-between');
 assert.equal(L.arrangementClasses('[grid-template-columns:1fr] grid-rows-2','columns',3,'![grid-template:100px/1fr]'),'grid-rows-2 !grid-cols-3');
 assert.equal(L.arrangementClasses('![flex-flow:column_wrap]','wrap','nowrap'),'![flex-flow:column_wrap] !flex-nowrap');
 assert.equal(L.arrangementClasses('','align','center','!place-content-end'),'items-center');
 assert.throws(()=>L.arrangementClasses('','columns',1.5));
 assert.throws(()=>L.arrangementClasses('','wrap','bad'));
});


test('padding edges preserve shorthands and other edges with scoped important priority and reset',()=>{
 assert.equal(L.paddingClasses('p-4 px-8 [padding-left:8px] pr-2 md:pl-2','left',30,'!p-6'),'p-4 px-8 pr-2 md:pl-2 !pl-[30px]');
 assert.equal(L.paddingClasses('![padding:12px_16px]','bottom',20),'![padding:12px_16px] !pb-[20px]');
 assert.equal(L.paddingClasses('','left',30,'!px-4'),'!pl-[30px]');
 assert.equal(L.paddingClasses('','top',30,'!px-4 !pb-2'),'pt-[30px]');
 assert.equal(L.paddingClasses('!pl-4 [padding-left:8px] p-2 pr-3','left',null),'p-2 pr-3');
 assert.equal(L.paddingClasses('','right',0),'pr-[0px]');
 for(const value of [-1,10001,Infinity,NaN,'20'])assert.throws(()=>L.paddingClasses('','left',value));
 assert.throws(()=>L.paddingClasses('','wrong',20));
});


test('size limits replace arbitrary declarations and respect inherited important constraints',()=>{
 assert.equal(L.limitClasses('[max-width:200px] min-w-4 md:max-w-2','max-width','300','!max-w-40'),'min-w-4 md:max-w-2 !max-w-[300px]');
 assert.equal(L.limitClasses('','min-height','120','![min-height:80px]'),'!min-h-[120px]');
 assert.equal(L.limitClasses('','min-height','120','!max-h-40 !min-w-20'),'min-h-[120px]');
 assert.equal(L.limitClasses('[min-width:20px] !min-w-4 max-w-40','min-width',null),'max-w-40');
 assert.equal(L.ownLimit('min-w-[20px] ![min-width:30px]','min-width'),'30px');
 assert.equal(L.ownLimit('md:![min-width:30px]','min-width'),null);
 assert.equal(L.ownLimit('[max-height:calc(100%_-_20px)]','max-height'),'calc(100% - 20px)');
});


test('grid span priority handles arbitrary placement and inherited area without changing the other axis',()=>{
 assert.equal(L.spanClasses('[grid-column:2/4] [grid-column-start:3] [grid-column-end:5] row-span-2','column',3,'![grid-area:1/1/3/3]'),'row-span-2 !col-span-3');
 assert.equal(L.spanClasses('![grid-area:1/1/3/3]','row','auto'),'![grid-area:1/1/3/3] !row-auto');
 assert.equal(L.spanClasses('','row','full','!row-start-2'),'!row-span-full');
 assert.equal(L.spanClasses('','column',2,'!row-span-2'),'col-span-2');
});
