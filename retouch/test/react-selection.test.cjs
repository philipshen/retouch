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
 assert.equal(changeContainer('block md:grid hover:flex gap-2','md:','mode','column'),'block hover:flex gap-2 md:flex md:flex-col');
 assert.equal(changeContainer('!flex !flex-row','md:','mode','column'),'!flex !flex-row md:!flex md:!flex-col');
 assert.equal(changeContainer('![flex-flow:row_wrap]','md:','wrap','nowrap'),'![flex-flow:row_wrap] md:!flex-nowrap');
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
