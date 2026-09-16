'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{change}=require('../shell/react-selection.js');
test('React shared styles preserve unrelated classes, scopes and important markers',()=>{
 assert.equal(change('p-4 opacity-80 hover:opacity-40 md:opacity-60','md:','opacity',25),'p-4 opacity-80 hover:opacity-40 md:opacity-[0.25]');
 assert.equal(change('opacity-80! hover:opacity-40','','opacity',50),'hover:opacity-40 !opacity-[0.5]');
 assert.equal(change('opacity-80!','md:','opacity',25),'opacity-80! md:!opacity-[0.25]');
 assert.equal(change('visible md:invisible hover:visible','md:','visibility','collapse'),'visible hover:visible md:collapse');
 assert.equal(change('mix-blend-screen isolate','','mix-blend-mode','multiply'),'isolate mix-blend-multiply');
 assert.equal(change('mix-blend-screen md:mix-blend-multiply hover:mix-blend-overlay','md:','mix-blend-mode','plus-lighter'),'mix-blend-screen hover:mix-blend-overlay md:mix-blend-plus-lighter');
 assert.equal(change('mix-blend-screen isolate','','isolation','auto'),'mix-blend-screen isolation-auto');
 assert.equal(change('opacity-80 md:opacity-60 hover:opacity-20','md:','opacity',null),'opacity-80 hover:opacity-20');
 assert.equal(change('[opacity:.2] shadow-lg','','opacity',75),'shadow-lg opacity-[0.75]');
});
test('React shared style controls validate values before generating any source classes',()=>{
 for(const [property,value]of [['opacity',NaN],['opacity',-1],['opacity',101],['visibility','none'],['mix-blend-mode','multiply;bad'],['unknown',null]])assert.throws(()=>change('p-4','',property,value));
 assert.equal(change(null,'','visibility','hidden'),'invisible');
 const original='opacity-80 hover:opacity-95 md:opacity-90';assert.equal(change(original,'','visibility',null),original);assert.equal(change(original,'lg:','opacity',null),original);
});
test('shared typography edits canonical linked classes and retain other scopes and priorities',()=>{
 const cases=[['font-size',40,'[font-size:40px]'],['font-weight',550,'[font-weight:550]'],['line-height',42,'[line-height:42px]'],['letter-spacing',-1.5,'[letter-spacing:-1.5px]'],['text-align','center','[text-align:center]'],['font-style','italic','[font-style:italic]'],['text-transform','uppercase','[text-transform:uppercase]']];
 const source='p-4 md:![font-size:32px] md:![font-weight:700] md:![line-height:38px] md:![letter-spacing:2px] md:![text-align:left] md:![font-style:normal] md:![text-transform:none] hover:text-red-500 text-sm';
 for(const [property,value,token]of cases){const next=change(source,'md:',property,value);assert.ok(next.includes('md:!'+token),next);assert.ok(next.includes('p-4'));assert.ok(next.includes('hover:text-red-500'));assert.ok(next.includes('text-sm'));assert.equal(change(next,'md:',property,value),next);assert.ok(!change(next,'md:',property,null).includes('md:!'+token));}
 assert.equal(change('!text-lg','md:','font-size',40),'!text-lg md:![font-size:40px]');
});
test('shared typography rejects invalid values and font shorthands without changing classes',()=>{
 for(const [property,value]of [['font-size',-1],['font-size',2001],['font-weight',0],['font-weight',500.5],['line-height',Infinity],['letter-spacing',-1001],['text-align','left;bad'],['font-style','oblique 90deg'],['text-transform','bad']])assert.throws(()=>change('p-4','',property,value));
 assert.equal(change('md:text-lg/7','md:','font-size',40),'md:leading-7 md:[font-size:40px]');assert.equal(change('md:text-lg/7','md:','line-height',null),'md:text-lg');
 assert.throws(()=>change('[font:italic_16px_serif]','','font-weight',500),/shorthand/);
 assert.equal(change('md:text-lg/7','','font-size',40),'md:text-lg/7 [font-size:40px]');
});
test('shared font families preserve quotes, Unicode, underscores and responsive ownership',()=>{
 const I=require('../shell/inspector.js'),value='"Example_Font 字", serif',token=I.fontFamilyClass(value),source='font-sans md:!font-serif font-bold hover:font-mono p-4';
 const next=change(source,'md:','font-family',value);assert.ok(next.includes('md:!'+token));assert.ok(next.includes('font-bold'));assert.ok(next.includes('font-sans'));assert.ok(next.includes('hover:font-mono'));assert.equal(change(next,'md:','font-family',value),next);assert.equal(change(next,'md:','font-family',null),'font-sans font-bold hover:font-mono p-4');
 for(const bad of ['',42,'serif; color:red','url(evil)'])assert.throws(()=>change(source,'','font-family',bad));
 assert.throws(()=>change('[font:italic_16px_serif]','','font-family','serif'),/shorthand/);
});
test('shared explicit typography overrides named page styles without removing them',()=>{
 const document={styleSheets:[{cssRules:[{selectorText:'.editorial',style:{getPropertyValue:property=>property==='font-family'?'Georgia, serif':''}}]}]};
 assert.equal(change('editorial p-4','','font-family','monospace',document),'editorial p-4 ![font-family:monospace]');
 assert.equal(change('editorial p-4','','font-size',40,document),'editorial p-4 ![font-size:40px]');
 assert.equal(change('editorial p-4 ![font-family:monospace]','','font-family',null,document),'editorial p-4');
});

test('shared edits split combined size and leading while retaining scope and importance',()=>{
 assert.equal(change('p-4 text-lg/7 md:text-xl/9 hover:text-sm/6','','font-size',40),'md:text-xl/9 hover:text-sm/6 p-4 leading-7 [font-size:40px]');
 assert.equal(change('md:!text-lg/7','md:','line-height',50),'md:!text-lg md:![line-height:50px]');
 assert.equal(change('text-[20px]/[calc(1/2)]!','','font-size',24),'!leading-[calc(1/2)] ![font-size:24px]');
 assert.equal(change('text-lg/7','','font-size',null),'leading-7');
 assert.throws(()=>change('text-lg/','','font-size',24),/incomplete/);
});

test('single-layer typography replacement matches shared decomposition for numeric, preset and reset paths',()=>{
 const I=require('../shell/inspector.js'),original='p-4 !text-lg/7 md:text-xl/9';
 assert.equal(I.replaceTypography(original,I.fontSizeToken,'text-[40px]'),'p-4 !leading-7 md:text-xl/9 !text-[40px]');
 assert.equal(I.replaceTypography(original,I.fontSizeToken,'text-4xl'),'p-4 !leading-7 md:text-xl/9 !text-4xl');
 assert.equal(I.replaceTypography(original,I.lineHeightToken,''),'p-4 !text-lg md:text-xl/9');
});

test('fluid and explicitly typed font sizes remain editable without consuming text colors',()=>{
 const I=require('../shell/inspector.js');
 for(const token of ['text-[clamp(16px,2vw,24px)]','text-[length:var(--body-size)]','text-(length:--body-size)','text-[length:calc(20px/2)]/[1.4]','text-[min(3vw,24px)]'])assert.equal(I.fontSizeToken(token),true,token);
 for(const token of ['text-red-500','text-[color:var(--brand)]','text-[rgb(20,30,40)]','text-[var(--ambiguous)]','text-(--ambiguous)'])assert.equal(I.fontSizeToken(token),false,token);
 assert.equal(I.replaceTypography('text-[length:calc(20px/2)]/[1.4] text-[color:var(--brand)]',I.fontSizeToken,'text-[40px]'),'leading-[1.4] text-[color:var(--brand)] text-[40px]');
 assert.equal(change('md:!text-[clamp(16px,2vw,24px)]/9 hover:text-red-500','md:','font-size',40),'hover:text-red-500 md:!leading-9 md:![font-size:40px]');
});
test('shared relative spacing writes font-relative tokens and preserves combined sizes',()=>{
 const {changeRelative}=require('../shell/react-selection.js');
 assert.equal(changeRelative('p-4 md:!text-lg/9 hover:leading-8','md:','line-height',200),'p-4 hover:leading-8 md:!text-lg md:![line-height:2]');
 assert.equal(changeRelative('!tracking-[2px] md:tracking-wide','','letter-spacing',10),'md:tracking-wide ![letter-spacing:0.1em]');
 assert.equal(changeRelative('','','letter-spacing',-2),'[letter-spacing:-0.02em]');
 assert.equal(change('!text-lg/9','','line-height','normal'),'!text-lg ![line-height:normal]');
 for(const [property,value]of [['font-size',100],['line-height',-1],['line-height',NaN],['letter-spacing',-101],['letter-spacing',1001]])assert.throws(()=>changeRelative('p-4','',property,value));
});

test('shared blur keeps each layer stack and unrelated responsive classes',()=>{
 const {changeBlur}=require('../shell/react-selection.js');
 const a=changeBlur('blur-sm p-4 md:![filter:brightness(0.8)_blur(2px)] hover:blur-lg','md:','filter','brightness(0.8) blur(2px)',4),b=changeBlur('shadow-lg md:contrast-125','md:','filter','contrast(1.25) blur(6px)',4);
 assert.ok(a.includes('md:![filter:brightness(0.8)_blur(4px)]'));assert.ok(a.includes('blur-sm'));assert.ok(a.includes('hover:blur-lg'));assert.equal(b,'shadow-lg md:![filter:contrast(1.25)_blur(4px)]');
 assert.equal(changeBlur('','md:','backdrop-filter','blur(2px)',0),'md:![backdrop-filter:none]');
 for(const value of ['url(#external)','blur(1px) blur(2px)'])assert.throws(()=>changeBlur('','md:','filter',value,4),/single blur/);
 for(const amount of [-1,1001,Infinity])assert.throws(()=>changeBlur('','md:','filter','none',amount));
});

test('shared padding preserves scopes, important shorthands and logical edges',()=>{
 const {changePadding}=require('../shell/react-selection.js');
 const source='!p-4 hover:p-8 md:ps-2 text-red-500';
 const next=changePadding(source,'md:','right','2rem',null,{direction:'rtl'});
 assert.equal(next,'!p-4 hover:p-8 text-red-500 md:!pr-[2rem]');
 assert.equal(changePadding(next,'md:','all',null),'!p-4 hover:p-8 text-red-500');
 assert.equal(changePadding('py-2 md:p-4','md:','all','5%'),'py-2 md:p-4 md:pt-[5%] md:pr-[5%] md:pb-[5%] md:pl-[5%]');
 for(const value of ['-1','auto','red','10001','1px; color:red'])assert.throws(()=>changePadding(source,'md:','all',value));
 assert.throws(()=>changePadding(source,'','diagonal',1));
});

test('shared gaps map physical axes per writing mode and preserve scoped priority',()=>{
 const {changeGap}=require('../shell/react-selection.js');
 assert.equal(changeGap('!gap-2 hover:gap-4 md:gap-x-1','md:','width','2rem'),'!gap-2 hover:gap-4 md:!gap-x-[2rem]');
 assert.equal(changeGap('gap-2 md:gap-y-1','md:','width','5%',null,'vertical-rl'),'gap-2 md:gap-y-[5%]');
 assert.equal(changeGap('gap-2 md:gap-y-1','md:','height','normal',null,'vertical-rl'),'gap-2 md:gap-y-1 md:gap-x-[normal]');
 assert.equal(changeGap('gap-2 md:gap-y-1','md:','width',null,null,'vertical-rl'),'gap-2');
 for(const value of ['-2','auto','1px;display:none','10001px'])assert.throws(()=>changeGap('','','width',value));
});
test('shared container layout preserves scopes, shorthand priorities and unrelated alignment',()=>{
 const {changeContainer}=require('../shell/react-selection.js');
 assert.equal(changeContainer('block md:grid hover:flex gap-2','md:','mode','column'),'block hover:flex gap-2 md:!flex md:!flex-col');
 assert.equal(changeContainer('!flex !flex-row','md:','mode','column'),'!flex !flex-row md:!flex md:!flex-col');
 assert.equal(changeContainer('![flex-flow:row_wrap]','md:','wrap','nowrap'),'![flex-flow:row_wrap] md:!flex-nowrap');
 assert.equal(changeContainer('flex-row md:flex-wrap hover:flex-col','md:','wrap','wrap-reverse'),'flex-row hover:flex-col md:!flex-wrap-reverse');
 assert.equal(changeContainer('place-items-center md:items-start justify-items-end','md:','align','stretch'),'place-items-center justify-items-end md:items-stretch');
 assert.equal(changeContainer('justify-items-end justify-self-center md:justify-between','md:','justify','end'),'justify-items-end justify-self-center md:justify-end');
 assert.equal(changeContainer('flex flex-row md:flex md:flex-col hover:grid','md:','mode',null),'flex flex-row hover:grid');
 assert.throws(()=>changeContainer('flex','','mode','invalid'));
 assert.throws(()=>changeContainer('flex','','unknown','row'));
});
test('shared grid track counts and flow preserve scope and shorthand priorities',()=>{
 const {changeContainer}=require('../shell/react-selection.js');
 assert.equal(changeContainer('grid-cols-2 md:grid-cols-4 hover:grid-cols-6','md:','columns',3),'grid-cols-2 hover:grid-cols-6 md:grid-cols-3');
 assert.equal(changeContainer('![grid:100px_/_1fr_1fr]','md:','rows',4),'![grid:100px_/_1fr_1fr] md:!grid-rows-4');
 assert.equal(changeContainer('grid-flow-row md:grid-flow-col','md:','flow','col-dense'),'grid-flow-row md:grid-flow-col-dense');
 assert.equal(changeContainer('grid-cols-2 md:grid-cols-3 md:grid-rows-4','md:','columns',null),'grid-cols-2 md:grid-rows-4');
 for(const value of [0,25,2.5,NaN,'3'])assert.throws(()=>changeContainer('grid','','columns',value));
 assert.throws(()=>changeContainer('grid','','flow','invalid'));
});
test('shared custom grid tracks preserve responsive and important templates',()=>{
 const {changeGridTracks}=require('../shell/react-selection.js');
 assert.equal(changeGridTracks('grid-cols-2 md:grid-cols-3 hover:grid-cols-4','md:','columns','40px 1fr'),'grid-cols-2 hover:grid-cols-4 md:grid-cols-[40px_1fr]');
 assert.equal(changeGridTracks('![grid:100px_/_1fr_1fr]','md:','rows','repeat(4, 30px)'),'![grid:100px_/_1fr_1fr] md:!grid-rows-[repeat(4,_30px)]');
 assert.equal(changeGridTracks('grid-cols-2 md:grid-cols-[40px_1fr]','md:','columns',null),'grid-cols-2');
 assert.throws(()=>changeGridTracks('grid','','columns','repeat(2, 1fr'));
 assert.throws(()=>changeGridTracks('grid','','columns','1fr;display:none'));
});
test('shared physical child alignment follows each writing mode and preserves scope',()=>{
 const {changeContainerAlignment}=require('../shell/react-selection.js');
 const horizontal=changeContainerAlignment('flex md:items-center hover:justify-center','md:',2,2,{flexDirection:'column',flexWrap:'wrap'});
 assert.equal(horizontal,'flex hover:justify-center md:[justify-content:flex-end] md:[align-items:flex-end] md:[align-content:flex-end]');
 const vertical=changeContainerAlignment('!place-items-center','md:',2,2,{writingMode:'vertical-rl',flexDirection:'column',flexWrap:'wrap'});
 assert.ok(vertical.includes('md:[justify-content:flex-start]'));assert.ok(vertical.includes('md:![align-items:flex-end]'));assert.ok(vertical.includes('md:[align-content:flex-end]'));
 assert.throws(()=>changeContainerAlignment('flex','',3,0));
});

test('shared clipping replaces both overflow axes only in the edited scope',()=>{
 const {changeClip}=require('../shell/react-selection.js');
 const source='overflow-x-auto overflow-y-hidden md:overflow-x-scroll hover:overflow-visible';
 const clipped=changeClip(source,'md:',true);
 assert.equal(clipped,'overflow-x-auto overflow-y-hidden hover:overflow-visible md:overflow-clip');
 assert.equal(changeClip(clipped,'md:',false),'overflow-x-auto overflow-y-hidden hover:overflow-visible md:overflow-visible');
 assert.equal(changeClip(clipped,'md:',null),'overflow-x-auto overflow-y-hidden hover:overflow-visible');
 assert.equal(changeClip('!overflow-hidden','md:',false),'!overflow-hidden md:!overflow-visible');
 assert.equal(changeClip('[overflow-inline:auto] ![overflow-block:hidden]','',false),'!overflow-visible');
 assert.throws(()=>changeClip('','', 'auto'));
});

test('shared sizing modes use each parent axis and preserve responsive priorities',()=>{
 const {changeSizeMode}=require('../shell/react-selection.js');
 const source='w-20 md:!basis-20 md:grow-0 hover:w-40',row={display:'flex',direction:'row'};
 const fill=changeSizeMode(source,'md:','width','fill',0,row);
 assert.ok(fill.includes('md:!flex-1'));assert.ok(fill.includes('hover:w-40'));assert.ok(!fill.includes('basis-20'));
 const fixed=changeSizeMode(fill,'md:','width','fixed',100,row);assert.ok(fixed.includes('md:!flex-none'));assert.ok(fixed.includes('md:!w-[100px]'));
 assert.ok(changeSizeMode(fill,'md:','width','hug',0,row).includes('md:!w-fit'));
 assert.equal(changeSizeMode(fill,'md:','width','reset',0,row),'w-20 hover:w-40');
 assert.ok(!changeSizeMode(fill,'md:','width','auto',0,row).includes('flex-1'));
 const verticalGrid=changeSizeMode('h-10','md:','width','fill',0,{display:'grid',writingMode:'vertical-rl'});
 assert.ok(verticalGrid.includes('md:self-stretch'));assert.ok(!verticalGrid.includes('justify-self'));
 assert.throws(()=>changeSizeMode('[inline-size:100px]','','width','fill',0,row));
});

test('shared rotation retains responsive and axis ownership and important priority',()=>{
 const {rotationDegrees}=require('../shell/react-selection.js');
 const original='rotate-12 md:!rotate-45 hover:rotate-90 rotate-x-12 scale-125';
 assert.equal(change(original,'md:','rotate',-30),'rotate-12 hover:rotate-90 rotate-x-12 scale-125 md:![rotate:-30deg]');
 assert.equal(change(original,'md:','rotate',null),'rotate-12 hover:rotate-90 rotate-x-12 scale-125');
 for(const value of [NaN,Infinity,-361,361,'90'])assert.throws(()=>change(original,'','rotate',value));
 assert.equal(rotationDegrees('none'),0);assert.equal(rotationDegrees('.25turn'),90);assert.equal(rotationDegrees('100grad'),90);assert.equal(rotationDegrees('z 30deg'),30);assert.ok(Math.abs(rotationDegrees('3.141592653589793rad')-180)<1e-8);assert.ok(Number.isNaN(rotationDegrees('x 30deg')));
});
test('shared SVG stroke changes preserve paints, other scopes and priority',()=>{
 assert.equal(change('stroke-red-500 stroke-2 md:stroke-4 hover:stroke-8','md:','stroke-width','7'),'stroke-red-500 stroke-2 hover:stroke-8 md:[stroke-width:7]');
 assert.equal(change('!stroke-2 fill-blue-500','md:','stroke-width','3%'),'!stroke-2 fill-blue-500 md:![stroke-width:3%]');
 assert.equal(change('stroke-2 md:[stroke-width:7] md:stroke-blue-500','md:','stroke-width',null),'stroke-2 md:stroke-blue-500');
 assert.equal(change('[stroke-linecap:butt] [stroke-linejoin:miter]','','stroke-linecap','round'),'[stroke-linejoin:miter] [stroke-linecap:round]');
 for(const [property,value]of [['stroke-width','-1'],['stroke-linecap','invalid'],['stroke-dasharray','1;fill:red'],['vector-effect','bad']])assert.throws(()=>change('stroke-2','',property,value));
});


test('shared responsive grid alignment preserves other scopes and promotes inherited shorthand priority',()=>{
 const {changeContainerAlignment}=require('../shell/react-selection.js');
 assert.equal(changeContainerAlignment('grid !place-items-center md:justify-items-start hover:items-end','md:',0,2,{display:'grid',direction:'rtl'}),'grid !place-items-center hover:items-end md:![justify-items:end] md:![align-items:end]');
});


test('shared adaptive grid changes only the selected responsive scope',()=>{
 const {changeAdaptiveGrid}=require('../shell/react-selection.js'),R=require('../shell/responsive.js'),L=require('../shell/layout.js');
 const source='flex grid-cols-2 md:grid-cols-4 hover:grid-cols-6';const next=changeAdaptiveGrid(source,'md:',180);assert.equal(R.project(next,''),'flex grid-cols-2');assert.ok(next.includes('hover:grid-cols-6'));assert.equal(L.adaptiveMinimum(R.project(next,'md:')),180);assert.ok(next.includes('md:!grid'));assert.equal(L.ownGridTemplate(R.project(next,'md:'),'rows'),'none');
});


test('shared stack presets write only the selected scope using each container writing mode',()=>{
 const {changeStack}=require('../shell/react-selection.js'),R=require('../shell/responsive.js');
 const source='grid grid-cols-2 md:flex-wrap hover:block',changed=changeStack(source,'md:','vertical',{writingMode:'vertical-rl'});
 assert.equal(R.project(changed,''),'grid grid-cols-2');assert.ok(changed.includes('hover:block'));assert.equal(R.project(changed,'md:'),'!flex !flex-row !flex-nowrap');
});


test('alignment reset clears only its own responsive scope and keeps no-op source order',()=>{
 const {resetContainerAlignment}=require('../shell/react-selection.js');
 const source='grid md:!place-items-center md:![align-items:start] hover:items-end md:justify-items-end';
 assert.equal(resetContainerAlignment(source,'md:',{display:'grid'}),'grid hover:items-end md:!place-items-center');
 const unchanged='md:!place-items-center grid hover:items-end';assert.equal(resetContainerAlignment(unchanged,'md:',{display:'grid'}),unchanged);
});

test('inline rotation overrides are important and scoped while reset reveals the source',()=>{
 const {changeRotation}=require('../shell/react-selection.js'),el={style:{getPropertyValue:()=> '25deg',getPropertyPriority:()=>''},ownerDocument:null};
 assert.equal(changeRotation('p-4','',45,el),'p-4 ![rotate:45deg]');
 assert.equal(changeRotation('p-4 rotate-12 md:rotate-30','md:',45,el),'p-4 rotate-12 md:![rotate:45deg]');
 assert.equal(changeRotation('p-4 rotate-12 md:![rotate:45deg]','md:',null,el),'p-4 rotate-12');
 const important={...el,style:{...el.style,getPropertyPriority:()=> 'important'}};
 assert.throws(()=>changeRotation('p-4','',45,important),/important inline/);
 assert.equal(changeRotation('p-4 ![rotate:45deg]','',null,important),'p-4');
});

test('shared inline gaps use per-element writing axes, scoped priority and removable resets',()=>{
 const {changeGap}=require('../shell/react-selection.js'),el=(values={},priority={})=>({style:{getPropertyValue:p=>values[p]||'',getPropertyPriority:p=>priority[p]||''}});
 assert.equal(changeGap('flex','md:','width','12',null,'horizontal-tb',el({gap:'4px'})),'flex md:!gap-x-[12px]');
 assert.equal(changeGap('grid','md:','width','12',null,'vertical-rl',el({'row-gap':'8px'})),'grid md:!gap-y-[12px]');
 assert.equal(changeGap('grid','md:','height','12',null,'vertical-rl',el({'row-gap':'8px'})),'grid md:gap-x-[12px]');
 assert.throws(()=>changeGap('flex','md:','width','12',null,'horizontal-tb',el({gap:'4px'},{gap:'important'})),/important inline gap/);
 assert.equal(changeGap('flex md:!gap-x-[12px]','md:','width',null,null,'horizontal-tb',el({gap:'4px'},{gap:'important'})),'flex');
});

test('shared inline padding preserves source priority and supports reset',()=>{
 const {changePadding}=require('../shell/react-selection.js'),el={style:{getPropertyValue:p=>p==='padding'?'4px':'',getPropertyPriority:()=>''}};
 assert.equal(changePadding('block','md:','all',12,null,{},el),'block md:!pt-[12px] md:!pr-[12px] md:!pb-[12px] md:!pl-[12px]');
 el.style.getPropertyPriority=p=>p==='padding'?'important':'';
 assert.throws(()=>changePadding('block','md:','left',12,null,{},el),/important inline/);
 assert.equal(changePadding('block md:!pl-[12px]','md:','all',null,null,{},el),'block');
});

test('inline overflow clipping uses scoped priority and permits reset over important source styles',()=>{
 const {changeClip}=require('../shell/react-selection.js');
 for(const property of ['overflow','overflow-x','overflow-y','overflow-inline','overflow-block']){
  const el={style:{getPropertyValue:p=>p===property?'auto':'',getPropertyPriority:()=>''}};
  const clipped=changeClip('block','md:',true,null,el);assert.equal(clipped,'block md:!overflow-clip');
  assert.equal(changeClip(clipped,'md:',false,null,el),'block md:!overflow-visible');
  el.style.getPropertyPriority=p=>p===property?'important':'';
  assert.throws(()=>changeClip('block','md:',true,null,el),/important inline/);
  assert.equal(changeClip(clipped,'md:',null,null,el),'block');
 }
});

test('inline child alignment preserves shorthand source priority and scoped reset',()=>{
 const {changeContainerAlignment,resetContainerAlignment}=require('../shell/react-selection.js'),el={style:{getPropertyValue:p=>['place-items','place-content'].includes(p)?'center':'',getPropertyPriority:()=>''}};
 const context={display:'flex',flexDirection:'row',flexWrap:'wrap',writingMode:'horizontal-tb'},changed=changeContainerAlignment('flex','md:',2,2,context,null,el);
 assert.match(changed,/md:!\[justify-content:flex-end\]/);assert.match(changed,/md:!\[align-items:flex-end\]/);assert.match(changed,/md:!\[align-content:flex-end\]/);
 assert.equal(resetContainerAlignment(changed,'md:',context),'flex');
 el.style.getPropertyPriority=p=>p==='place-items'?'important':'';
 assert.throws(()=>changeContainerAlignment('flex','md:',2,2,context,null,el),/important inline/);
});

test('alignment menus override inline shorthands per property and leave reset available',()=>{
 const {changeContainer}=require('../shell/react-selection.js'),el={style:{getPropertyValue:p=>p==='place-items'?'center':'',getPropertyPriority:()=>''}};
 assert.equal(changeContainer('flex','md:','align','baseline',null,el),'flex md:!items-baseline');
 assert.equal(changeContainer('flex','md:','justify','between',null,el),'flex md:justify-between');
 el.style.getPropertyValue=p=>p==='place-content'?'center':'';
 assert.equal(changeContainer('flex','md:','justify','evenly',null,el),'flex md:!justify-evenly');
 el.style.getPropertyPriority=p=>p==='place-content'?'important':'';
 assert.throws(()=>changeContainer('flex','md:','justify','between',null,el),/important inline/);
 assert.equal(changeContainer('flex md:!justify-evenly','md:','justify',null,null,el),'flex');
});

test('inline layout controls allow ordinary declarations, guard priority and retain reset',()=>{
 const {changeStack,changeContainer}=require('../shell/react-selection.js'),el={style:{getPropertyValue:p=>p==='flex-flow'?'column wrap':'',getPropertyPriority:()=>''}};
 assert.equal(changeStack('p-2','md:','horizontal',{writingMode:'vertical-rl'},null,el),'p-2 md:!flex md:!flex-col md:!flex-nowrap');
 assert.equal(changeContainer('p-2','md:','mode','row',null,el),'p-2 md:!flex md:!flex-row');
 assert.equal(changeContainer('p-2','md:','wrap','wrap-reverse',null,el),'p-2 md:!flex-wrap-reverse');
 el.style.getPropertyPriority=p=>p==='flex-flow'?'important':'';
 assert.throws(()=>changeStack('p-2','md:','horizontal',{},null,el),/important inline/);
 assert.throws(()=>changeContainer('p-2','md:','mode','row',null,el),/important inline/);
 assert.throws(()=>changeContainer('p-2','md:','wrap','wrap',null,el),/important inline/);
 assert.equal(changeStack('p-2','md:','flow',{},null,el),'p-2 md:!block');
 assert.equal(changeContainer('p-2 md:!flex-row md:!flex','md:','mode',null,null,el),'p-2');
});

test('shared sizing overrides ordinary inline dimensions and flex rules at its scope',()=>{
 const {changeSizeMode}=require('../shell/react-selection.js'),R=require('../shell/responsive.js');
 const context={display:'flex',direction:'row',writingMode:'horizontal-tb',inlineDimensions:['width'],inlineFlex:true};
 for(const mode of ['fixed','hug','fill','auto']){const next=changeSizeMode('h-10','md:','width',mode,100,context),active=R.project(next,'md:');assert.match(active,/!w-/);assert.equal(R.project(next,''),'h-10');if(mode==='fixed'||mode==='hug')assert.match(active,/!flex-none/);if(mode==='fill')assert.match(active,/!flex-1/);assert.equal(changeSizeMode(next,'md:','width','reset',0,context),'h-10');}
});

test('shared grid controls override ordinary inline rules and guard important declarations',()=>{
 const {changeContainer,changeGridTracks}=require('../shell/react-selection.js');
 const el={style:{getPropertyValue:key=>['grid-template-columns','grid-auto-flow'].includes(key)?'inline':'',getPropertyPriority:()=>''}};
 assert.equal(changeContainer('','md:','columns',3,null,el),'md:!grid-cols-3');
 assert.equal(changeContainer('','md:','flow','col-dense',null,el),'md:!grid-flow-col-dense');
 assert.equal(changeGridTracks('','md:','columns','40px 80px',null,el),'md:!grid-cols-[40px_80px]');
 el.style.getPropertyPriority=key=>key==='grid-template-columns'?'important':'';
 assert.throws(()=>changeContainer('','md:','columns',3,null,el),/important inline/);
 assert.throws(()=>changeGridTracks('','md:','columns','40px 80px',null,el),/important inline/);
 assert.equal(changeGridTracks('md:!grid-cols-[40px_80px]','md:','columns',null,null,el),'');
});

test('inline grid values hide overridden ordinary custom track utilities',()=>{
 const {ownGridTemplate}=require('../shell/layout.js');
 assert.equal(ownGridTemplate('grid-cols-[20px_30px]','columns',true),null);
 assert.equal(ownGridTemplate('!grid-cols-[20px_30px]','columns',true),'20px 30px');
});

test('adaptive grid refuses important inline layout rules and overrides ordinary inline rules',()=>{
 const {changeAdaptiveGrid}=require('../shell/react-selection.js');
 for(const property of ['display','grid','grid-template','grid-template-columns','grid-template-rows']){
  const el={style:{getPropertyPriority:name=>name===property?'important':''}};
  assert.throws(()=>changeAdaptiveGrid('flex','md:',180,null,el),/important inline/);
 }
 const el={style:{getPropertyPriority:()=>''}},next=changeAdaptiveGrid('flex','md:',180,null,el);
 assert.match(next,/md:!grid\b/);assert.match(next,/md:!grid-cols-/);assert.match(next,/md:!grid-rows-/);
});

test('shared font size overrides ordinary inline values and allows reset beneath important inline values',()=>{
 const normal={style:{getPropertyValue:()=> '24px',getPropertyPriority:()=>''}},important={style:{getPropertyValue:()=> '24px',getPropertyPriority:()=> 'important'}};
 const next=change('font-bold text-sm md:text-lg hover:text-xl','md:','font-size',40,null,false,normal);
 assert.equal(next,'font-bold text-sm hover:text-xl md:![font-size:40px]');
 assert.throws(()=>change(next,'md:','font-size',50,null,false,important),/important inline/);
 assert.equal(change(next,'md:','font-size',null,null,false,important),'font-bold text-sm hover:text-xl');
});

test('inline spacing overrides preserve percentage semantics and guard important inline rules',()=>{
 const el=priority=>({style:{getPropertyValue:()=> '1.5',getPropertyPriority:()=>priority}});
 assert.equal(change('font-bold','md:','line-height',200,null,true,el('')),'font-bold md:![line-height:2]');
 assert.equal(change('font-bold','md:','letter-spacing',10,null,true,el('')),'font-bold md:![letter-spacing:0.1em]');
 for(const property of ['line-height','letter-spacing']){
  assert.throws(()=>change('','md:',property,10,null,false,el('important')),/important inline/);
  assert.equal(change('md:!['+property+':2px]','md:',property,null,null,false,el('important')),'');
 }
});

test('inline font face changes override only their longhand and retain reset under important inline rules',()=>{
 const el=priority=>({style:{getPropertyValue:()=> 'inline',getPropertyPriority:()=>priority}});
 for(const [property,value,token]of [['font-family','monospace','[font-family:monospace]'],['font-weight',500,'[font-weight:500]'],['font-style','normal','[font-style:normal]']]){
  const changed=change('text-lg','md:',property,value,null,false,el(''));
  assert.equal(changed,'text-lg md:!'+token);
  assert.throws(()=>change('text-lg','md:',property,value,null,false,el('important')),/important inline/);
  assert.equal(change(changed,'md:',property,null,null,false,el('important')),'text-lg');
 }
});

test('shared decoration replaces only its selected scope and preserves color and style',()=>{
 const source='underline decoration-red-500 decoration-wavy md:line-through hover:overline';
 assert.equal(change(source,'md:','text-decoration-line','underline line-through'),'underline decoration-red-500 decoration-wavy hover:overline md:[text-decoration-line:underline_line-through]');
 assert.equal(change(source,'md:','text-decoration-line',null),'underline decoration-red-500 decoration-wavy hover:overline');
 assert.equal(change('!underline','md:','text-decoration-line','none'),'!underline md:![text-decoration-line:none]');
 assert.throws(()=>change(source,'','text-decoration-line','underline; color:red'));
 const el={style:{getPropertyPriority:()=>'',getPropertyValue:()=> 'overline'}};assert.equal(change('p-4','','text-decoration-line','underline',null,false,el),'p-4 ![text-decoration-line:underline]');el.style.getPropertyPriority=()=> 'important';assert.throws(()=>change('p-4','','text-decoration-line','none',null,false,el),/important inline/);assert.equal(change('p-4 !underline','','text-decoration-line',null,null,false,el),'p-4');
});

test('shared underline details preserve other decoration properties',()=>{
 const source='underline decoration-red-500 decoration-dotted decoration-2 underline-offset-4 md:decoration-wavy';
 for(const [property,value,removed]of [['text-decoration-style','double','decoration-dotted'],['text-decoration-thickness','3px','decoration-2'],['text-underline-offset','-2px','underline-offset-4'],['text-decoration-skip-ink','none',null]]){
  const next=change(source,'',property,value);assert.ok(next.includes('['+property+':'+value+']'));assert.ok(next.includes('underline'));assert.ok(next.includes('decoration-red-500'));assert.ok(next.includes('md:decoration-wavy'));if(removed)assert.ok(!next.split(' ').includes(removed));assert.equal(change(next,'',property,value),next);
 }
 assert.throws(()=>change(source,'','text-decoration-thickness','-2px'));assert.throws(()=>change(source,'','text-underline-offset','2px; color:red'));
});

test('shared decoration color preserves thickness style and line properties',()=>{
 const source='underline decoration-2 decoration-wavy decoration-red-500 md:decoration-blue-500';
 assert.equal(change(source,'','text-decoration-color','currentColor'),'md:decoration-blue-500 underline decoration-2 decoration-wavy [text-decoration-color:currentColor]');
 assert.equal(change(source,'','text-decoration-color',null),'md:decoration-blue-500 underline decoration-2 decoration-wavy');
 assert.throws(()=>change(source,'','text-decoration-color','red; display:none'));
});

test('shared paragraph indentation preserves unrelated and responsive classes',()=>{
 const source='indent-4 md:-indent-2 hover:indent-8 text-lg';
 assert.equal(change(source,'md:','text-indent','-12px'),'indent-4 hover:indent-8 text-lg md:[text-indent:-12px]');
 assert.equal(change(source,'md:','text-indent','10%'),'indent-4 hover:indent-8 text-lg md:[text-indent:10%]');
 assert.equal(change(source,'md:','text-indent',null),'indent-4 hover:indent-8 text-lg');
 assert.throws(()=>change(source,'','text-indent','auto'));assert.throws(()=>change(source,'','text-indent','12px; display:none'));
});

test('shared wrap style preserves whitespace and guards important inline longhands',()=>{
 assert.equal(change('whitespace-pre-wrap text-balance md:text-nowrap','md:','text-wrap','pretty'),'whitespace-pre-wrap text-balance md:[text-wrap:pretty]');
 assert.equal(change('!text-nowrap','md:','text-wrap','wrap'),'!text-nowrap md:![text-wrap:wrap]');
 const el={style:{getPropertyPriority:key=>key==='text-wrap-mode'?'important':'',getPropertyValue:()=>''}};assert.throws(()=>change('','','text-wrap','wrap',null,false,el),/important inline/);
 el.style.getPropertyPriority=()=>'';el.style.getPropertyValue=key=>key==='text-wrap-mode'?'nowrap':'';assert.equal(change('','','text-wrap','balance',null,false,el),'![text-wrap:balance]');
 assert.throws(()=>change('','','text-wrap','invalid'));
});

test('shared wrap replaces mode/style classes and inherits their priority',()=>{
 const source='whitespace-pre-wrap [text-wrap-mode:nowrap] [text-wrap-style:balance] hover:[text-wrap-mode:wrap]';
 const next=change(source,'','text-wrap','pretty');assert.ok(next.includes('whitespace-pre-wrap'));assert.ok(next.includes('hover:[text-wrap-mode:wrap]'));assert.ok(next.includes('[text-wrap:pretty]'));assert.ok(!next.includes('[text-wrap-mode:nowrap]'));assert.ok(!next.includes('[text-wrap-style:balance]'));
 assert.equal(change('![text-wrap-mode:nowrap] [text-wrap-style:balance]','md:','text-wrap','wrap'),'![text-wrap-mode:nowrap] [text-wrap-style:balance] md:![text-wrap:wrap]');
 assert.equal(change('text-wrap md:[text-wrap-mode:nowrap] md:[text-wrap-style:balance]','md:','text-wrap',null),'text-wrap');
});

test('shared capital forms and position preserve shorthand features and responsive priorities',()=>{
 for(const [property,value]of [['font-variant-caps','all-small-caps'],['font-variant-position','super']]){
  const shorthand='![font-variant:small-caps_oldstyle-nums]';
  const doc={styleSheets:[],createElement:()=>({style:{setProperty(){},getPropertyValue:key=>({'font-variant-caps':'small-caps','font-variant-numeric':'oldstyle-nums','font-variant-position':'normal'})[key]||''}})};
  const expanded=change(shorthand,'',property,value,doc);assert.ok(expanded.includes('![font-variant-numeric:oldstyle-nums]'));assert.ok(expanded.includes('!['+property+':'+value+']'));assert.ok(!expanded.includes('[font-variant:'));
  assert.equal(change(shorthand,'md:',property,value),shorthand+' md:!['+property+':'+value+']');
  const source=shorthand+' md:['+property+':normal] hover:['+property+':normal]';
  const next=change(source,'md:',property,value);
  assert.ok(next.includes('md:!['+property+':'+value+']'));
  assert.equal(change(next,'md:',property,null),shorthand+' hover:['+property+':normal]');
  assert.throws(()=>change(source,'md:',property,'invalid'));
  const el={style:{getPropertyPriority:key=>key===property?'important':'',getPropertyValue:()=>''}};
  assert.throws(()=>change(source,'md:',property,value,null,false,el),/important inline/);
  el.style.getPropertyPriority=()=>'';el.style.getPropertyValue=key=>key===property?'normal':'';
  assert.equal(change('','',property,value,null,false,el),'!['+property+':'+value+']');
 }
});

test('shared number and ligature edits replace only their feature family',()=>{
 const source='oldstyle-nums tabular-nums md:ordinal hover:slashed-zero [font-variant-ligatures:none]';
 assert.equal(change(source,'md:','font-variant-numeric','lining-nums proportional-nums'),'oldstyle-nums tabular-nums hover:slashed-zero [font-variant-ligatures:none] md:[font-variant-numeric:lining-nums_proportional-nums]');
 assert.equal(change(source,'','font-variant-ligatures','common-ligatures no-contextual'),'md:ordinal hover:slashed-zero oldstyle-nums tabular-nums [font-variant-ligatures:common-ligatures_no-contextual]');
 assert.equal(change('!oldstyle-nums','md:','font-variant-numeric','tabular-nums'),'!oldstyle-nums md:![font-variant-numeric:tabular-nums]');
 for(const [property,value]of [['font-variant-numeric','lining-nums oldstyle-nums'],['font-variant-ligatures','common-ligatures no-common-ligatures']])assert.throws(()=>change(source,'',property,value));
});

test('shared variable font settings retain other feature classes and responsive priority',()=>{
 const source='![font-variation-settings:"wght"_400] md:[font-variation-settings:"wght"_700,"wdth"_90] oldstyle-nums';
 const value='"wght" 550, "wdth" 90';
 assert.equal(change(source,'md:','font-variation-settings',value),'![font-variation-settings:"wght"_400] oldstyle-nums md:![font-variation-settings:"wght"_550,_"wdth"_90]');
 assert.equal(change(source,'md:','font-variation-settings',null),'![font-variation-settings:"wght"_400] oldstyle-nums');
 for(const value of ['"bad" 1','"wght" 10001','"wght" NaN','normal; color:red'])assert.throws(()=>change(source,'md:','font-variation-settings',value));
 const el={style:{getPropertyPriority:()=> 'important',getPropertyValue:()=>''}};assert.throws(()=>change(source,'md:','font-variation-settings','normal',null,false,el),/important inline/);
});

test('shared font metadata intersects supported axis ranges without inventing defaults',()=>{
 const {sharedAxisRanges}=require('../shell/inspector.js');
 const first={axes:[{tag:'wght',name:'Weight',min:100,max:900},{tag:'wdth',name:'Width',min:75,max:125}]},second={axes:[{tag:'wght',name:'Weight',min:300,max:700}]};
 assert.deepEqual(sharedAxisRanges([first,second]),[{tag:'wght',name:'Weight',min:300,max:700}]);
 assert.deepEqual(sharedAxisRanges([first,{axes:[]}]),[]);assert.deepEqual(sharedAxisRanges([first,null]),[]);assert.deepEqual(sharedAxisRanges([]),[]);
 assert.deepEqual(sharedAxisRanges([first,{axes:[{tag:'wght',min:950,max:1000}]}]),[]);
});

test('shared font presets use each font coordinates and reject ambiguous or invalid styles',()=>{
 const {sharedFontPresets}=require('../shell/inspector.js');
 const font=(value,name='Bold')=>({axes:[{tag:'wght',min:100,max:900}],instances:[{name,coordinates:[['wght',value]]}]});
 assert.deepEqual(sharedFontPresets([font(700),font(650)]),[{name:'Bold',coordinates:[[['wght',700]],[['wght',650]]]}]);
 assert.deepEqual(sharedFontPresets([font(700),font(650,'Strong')]),[]);
 assert.deepEqual(sharedFontPresets([font(700),font(1000)]),[]);
 const duplicate=font(700);duplicate.instances.push(duplicate.instances[0]);assert.deepEqual(sharedFontPresets([duplicate]),[]);
 assert.deepEqual(sharedFontPresets([font(700),null]),[]);assert.deepEqual(sharedFontPresets([]),[]);
});

test('shared optical sizing retains manual axes and responsive priority',()=>{
 const source='![font-optical-sizing:none] [font-variation-settings:"opsz"_24]';
 assert.equal(change(source,'md:','font-optical-sizing','auto'),source+' md:![font-optical-sizing:auto]');
 assert.equal(change(source+' md:[font-optical-sizing:auto]','md:','font-optical-sizing',null),source);
 assert.throws(()=>change(source,'','font-optical-sizing','invalid'));
 const el={style:{getPropertyPriority:()=> 'important',getPropertyValue:()=>''}};assert.throws(()=>change(source,'','font-optical-sizing','auto',null,false,el),/important inline/);
});

test('shared vertical text classes preserve horizontal layout and responsive priority',()=>{
 const {changeTextVertical}=require('../shell/react-selection.js');
 assert.equal(changeTextVertical('items-start justify-end md:items-end hover:items-center','md:','align-items','center'),'items-start justify-end hover:items-center md:[align-items:center]');
 assert.equal(changeTextVertical('!content-start justify-end','md:','align-content','flex-end'),'!content-start justify-end md:![align-content:flex-end]');
 assert.equal(changeTextVertical('![place-content:center_start]','md:','justify-content','center'),'![place-content:center_start] md:![justify-content:center]');
 assert.equal(changeTextVertical('content-start md:content-end justify-center','md:','align-content',null),'content-start justify-center');
 const el={style:{getPropertyPriority:key=>key==='place-content'?'important':'',getPropertyValue:()=>''}};assert.throws(()=>changeTextVertical('','','align-content','center',null,el),/important inline/);
 assert.throws(()=>changeTextVertical('','','color','center'));assert.throws(()=>changeTextVertical('','','align-content','bad'));
});
