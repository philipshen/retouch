'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { base, replace, nearestAnchor, anchorClasses } = require('../shell/inspector.js');
const { twMerge } = require('tailwind-merge');

test('base edits preserve breakpoint and state variants, including arbitrary values', () => {
  assert.equal(base('md:left-[calc(50%-20px)]'), null);
  assert.equal(base('text-[color:var(--ink)]'), 'text-[color:var(--ink)]');
  assert.equal(replace('opacity-50 md:opacity-20 hover:opacity-100', t=>t.startsWith('opacity-'),'opacity-[0.4]'), 'md:opacity-20 hover:opacity-100 opacity-[0.4]');
  assert.equal(replace('opacity-50! md:opacity-20', t=>t.startsWith('opacity-'),'opacity-[0.4]'), 'md:opacity-20 !opacity-[0.4]');
});
test('important property edits do not duplicate important markers', () => {
  assert.equal(replace('!text-[42px] md:text-lg', t=>t.startsWith('text-'),'!text-[44px]'),'md:text-lg !text-[44px]');
});
test('anchor conversion preserves unrelated and responsive styles and pins existing bounds', () => {
  const g = { x: 420, y: 20, width: 160, height: 80, parentWidth: 600, parentHeight: 300 };
  assert.equal(nearestAnchor(g.x,g.width,g.parentWidth), 'end');
  assert.equal(nearestAnchor(220,160,600), 'center');
  assert.equal(nearestAnchor(20,160,600), 'start');
  const result = twMerge(anchorClasses('relative w-full h-auto mt-4 p-6 text-red-500 md:relative md:w-1/2 md:top-5 hover:opacity-50',g,'end','start'));
  for(const token of ['absolute','right-[20px]','top-[20px]','w-[160px]','h-[80px]','m-0','p-6','text-red-500','md:relative','md:w-1/2','md:top-5','hover:opacity-50']) assert.ok(result.split(' ').includes(token),token);
  assert.ok(!result.split(' ').includes('relative'));
  const stretch=anchorClasses(result,g,'stretch','center');
  assert.match(stretch,/left-\[420px\] right-\[20px\] w-auto/);
  assert.match(stretch,/top-\[calc\(50%-130px\)\] bottom-auto h-\[80px\]/);
});
test('positioned class edits retain important geometry, proportional anchors and inherited scope modes',()=>{
 const I=require('../shell/inspector.js'),g={x:20,y:30,width:80,height:40,parentWidth:400,parentHeight:200};
 const changed=I.anchorClasses('absolute right-[20px]! top-[30px] w-[80px] h-[40px] bg-red-500 md:opacity-50',g,'end','start');
 for(const token of ['!absolute','!right-[300px]','!w-[80px]','bg-red-500','md:opacity-50'])assert.ok(changed.split(' ').includes(token),token);
 const scaled=I.anchorClasses('absolute left-[20px] top-[30px] w-[80px] h-[40px]',g,'scale','scale');assert.equal(I.inferredAnchor(scaled,'x'),'scale');assert.equal(I.inferredAnchor(scaled,'y'),'scale');assert.match(scaled,/left-\[5%\]/);assert.match(scaled,/h-\[20%\]/);
 assert.match(I.anchorClasses('opacity-90',g,'end','start','right-[20px]!'),/!right-\[300px\]/);assert.equal(I.inferredAnchor('opacity-50','x','right-[20px]'),'end');assert.equal(I.inferredAnchor('left-[20px] right-auto','x','right-[20px]'),'start');assert.throws(()=>I.axisClasses({...g,parentWidth:0},'x','scale'));
});

test('page font encoding preserves underscores and font weights while rejecting executable CSS',()=>{
 const I=require('../shell/inspector.js');
 assert.equal(I.fontFamilyClass('"Page Face", serif'),'[font-family:"Page_Face",_serif]');
 assert.equal(I.fontFamilyClass('Studio_Test, serif'),String.raw`[font-family:Studio\_Test,_serif]`);
 for(const value of ['Arial; color:red','url(test)','var(--font)','"Unclosed','Arial,'])assert.equal(I.fontFamilyClass(value),null);
 assert.equal(I.replace('font-serif font-bold md:font-mono',I.fontFamilyToken,I.fontFamilyClass('serif')),'font-bold md:font-mono [font-family:serif]');
 const d={fonts:[{family:'"Page Face"'}],body:{nodeType:1,tagName:'BODY'},createTreeWalker:()=>{let used=false;return {nextNode:()=>used?null:(used=true,{nodeType:3,nodeValue:'Hello',parentElement:{tagName:'P'}})};},defaultView:{getComputedStyle:()=>({fontFamily:'Georgia, serif'})}};
 assert.deepEqual(I.fontFamilies(d,'monospace').map(([value])=>value),['system-ui','sans-serif','serif','monospace','"Page Face"','Georgia, serif']);
});

test('font search matches family names and fallbacks without accents or quote sensitivity',()=>{
 const {filterFonts}=require('../shell/inspector.js'),choices=[['"Café Sans", serif','Café Sans, serif'],['Studio_Test, monospace','Studio_Test, monospace']];
 assert.deepEqual(filterFonts(choices,' CAFE "sans" '),[choices[0]]);
 assert.deepEqual(filterFonts(choices,'studio mono'),[choices[1]]);
 assert.deepEqual(filterFonts(choices,'missing'),[]);assert.deepEqual(filterFonts(choices,''),choices);
});

test('font file status preserves mixed face states without claiming glyph coverage',()=>{
 const {fontFaceStates,fontFaceLabel}=require('../shell/inspector.js');
 const states=fontFaceStates({fonts:[{family:'"Page Face"',status:'loaded'},{family:'Page Face',status:'loading'},{family:'Page Face',status:'error'},{family:'Page Face',status:'unloaded'}]});
 assert.equal(fontFaceLabel('"PAGE FACE", serif',states),'1 loading · 1 failed · 1 not loaded · 1 loaded');
 assert.equal(fontFaceLabel('serif',states),'System / fallback family');assert.equal(fontFaceLabel('Unknown, serif',states),'No page font declaration');
 assert.equal(fontFaceLabel('"serif"',states),'No page font declaration');
 const namedGeneric=fontFaceStates({fonts:[{family:'"serif"',status:'loaded'}]});assert.equal(fontFaceLabel('serif',namedGeneric),'System / fallback family');assert.equal(fontFaceLabel('"serif"',namedGeneric),'1 loaded');assert.equal(fontFaceLabel('"Name,WithComma"',states),'Font status unavailable');
});

test('custom font weights preserve families and other scopes and validate the CSS range',()=>{
 const {fontWeightToken,fontWeightClass,replace}=require('../shell/inspector.js');
 for(const value of [1,537.5,1000])assert.equal(fontWeightClass(value),`font-[${value}]`);
 for(const value of [0,1001,NaN,Infinity,'500'])assert.equal(fontWeightClass(value),null);
 assert.equal(replace('font-bold font-serif md:font-[625.5]',fontWeightToken,fontWeightClass(537.5)),'font-serif md:font-[625.5] font-[537.5]');
 assert.equal(replace('font-[537.5] font-serif',fontWeightToken,''),'font-serif');
});

test('line-height overrides replace automatic and explicit spacing without changing font or other scopes',()=>{
 const {replace,lineHeightToken}=require('../shell/inspector.js');
 assert.equal(replace('font-serif font-[537.5] leading-[80px] md:leading-6',lineHeightToken,'[line-height:normal]'),'font-serif font-[537.5] md:leading-6 [line-height:normal]');
 assert.equal(replace('text-lg [line-height:normal]',lineHeightToken,'leading-[45px]'),'text-lg leading-[45px]');
 assert.equal(replace('text-lg leading-[45px]',lineHeightToken,''),'text-lg');
});

test('numeric font features combine independent groups and reject conflicts',()=>{
 const v=require('../shell/html-css-values.js'),{numericToken}=require('../shell/inspector.js');
 assert.equal(v.numericChange('oldstyle-nums ordinal','Number width','tabular-nums'),'oldstyle-nums ordinal tabular-nums');
 assert.equal(v.numericChange('tabular-nums oldstyle-nums','Number width','proportional-nums'),'oldstyle-nums proportional-nums');
 assert.equal(v.numericChange('ordinal','Ordinals',''),'normal');
 for(const value of ['normal ordinal','tabular-nums proportional-nums','ordinal ordinal','url(x)','', 'lining-nums oldstyle-nums'])assert.equal(v.valid('font-variant-numeric',value),false,value);
 assert.equal(v.valid('font-variant-numeric',null),true);
 assert.equal(v.valid('font-variant-numeric','oldstyle-nums tabular-nums diagonal-fractions ordinal slashed-zero'),true);
 assert.equal(v.overlaps('font','font-variant-numeric'),true);assert.equal(v.overlaps('font-variant-numeric','font-variant'),true);
 assert.equal(replace('font-bold tabular-nums ordinal md:oldstyle-nums',numericToken,'[font-variant-numeric:normal]'),'font-bold md:oldstyle-nums [font-variant-numeric:normal]');
});

test('variable font axes preserve independent tags and scoped overrides',()=>{
 const v=require('../shell/html-css-values.js'),{variationToken}=require('../shell/inspector.js');
 assert.deepEqual(v.parseVariations('"wght" 200, "GRAD" -12.5, "wght" 850'),[['wght',850],['GRAD',-12.5]]);
 assert.equal(v.serializeVariations([]),'normal');assert.equal(v.serializeVariations([['wght',537.5],['wdth',85]]),'"wght" 537.5, "wdth" 85');
 for(const value of ['"wght" Infinity','"wght" 10001','"wght" 1; color:red','"weight" 200','"wght\' 200','normal, "wght" 200',''])assert.equal(v.valid('font-variation-settings',value),false,value);
 assert.equal(v.valid('font-variation-settings',null),true);assert.equal(v.overlaps('font','font-variation-settings'),true);
 assert.equal(replace('font-bold [font-variation-settings:"wght"_200] md:[font-variation-settings:"wdth"_80]',variationToken,'[font-variation-settings:"wght"_850]'),'font-bold md:[font-variation-settings:"wdth"_80] [font-variation-settings:"wght"_850]');
});

test('class writers allow quoted axis values without allowing injected declarations',()=>{
 const {valid}=require('../src/class-tokens.cjs');
 assert.equal(valid('md:![font-variation-settings:"wght"_537.5,_"GRAD"_-12]'),true);
 for(const token of ['[font-variation-settings:"wght"_850;color:red]','[font-variation-settings:"weight"_850]','[font-variation-settings:"wght"_NaN]','[font-variation-settings:"wght"_850]"onclick="x'])assert.equal(valid(token),false,token);
});
test('canonical typography property classes replace cleanly while preserving unrelated scopes and colors',()=>{
 const I=require('../shell/inspector.js');
 for(const [predicate,property,value,replacement]of [
  ['fontSizeToken','font-size','32px','text-[40px]'],['fontWeightToken','font-weight','700','font-[500]'],['letterSpacingToken','letter-spacing','2px','tracking-[1px]'],['textAlignToken','text-align','center','text-left'],['fontStyleToken','font-style','oblique','not-italic'],['decorationToken','text-decoration-line','underline_line-through','no-underline'],['caseToken','text-transform','uppercase','normal-case']
 ]){
  const token='!['+property+':'+value+']',other='md:'+token,classes=token+' text-red-500 p-4 '+other;
  assert.equal(I.replace(classes,I[predicate],replacement),'text-red-500 p-4 '+other+' !'+replacement);
  assert.equal(I.replace(classes,I[predicate],''),'text-red-500 p-4 '+other);
 }
 const encoded=Object.values(require('../src/text-style-classes.cjs').encode({'font-family':'serif','font-size':'32px','font-weight':'700','font-style':'oblique','font-optical-sizing':'auto','font-variation-settings':'normal','font-variant-numeric':'tabular-nums','line-height':'1.4','letter-spacing':'2px','text-align':'center','text-decoration-line':'underline line-through','text-transform':'uppercase'}));
 assert.equal(I.replace(encoded.join(' ')+' p-4 hover:text-red-500',I.textOverrideToken,''),'p-4 hover:text-red-500');
});

test('corner radius edits preserve other corners and scopes while overriding inherited important radii',()=>{
 const {cornerRadiusClasses:radius}=require('../shell/inspector.js');
 assert.equal(radius('rounded-[8px] rounded-tr-[4px] md:rounded-xl','tl',12,'!rounded-lg'),'rounded-[8px] rounded-tr-[4px] md:rounded-xl !rounded-tl-[12px]');
 assert.equal(radius('[border-top-left-radius:4px] rounded-br-sm','tl',6),'rounded-br-sm rounded-tl-[6px]');
 assert.equal(radius('!rounded-tl-sm [border-bottom-right-radius:8px] md:rounded-xl',null,4),'md:rounded-xl !rounded-[4px]');
 assert.equal(radius('',null,0,'[border-radius:12px]!'),'!rounded-[0px]');
 assert.throws(()=>radius('','bad',12));assert.throws(()=>radius('',null,-1));
});

test('corner reset removes local physical overrides and preserves shared radii and other scopes',()=>{
 const radius=require('../shell/inspector.js').cornerRadiusClasses;
 assert.equal(radius('rounded-lg !rounded-tl-[12px] [border-top-left-radius:4px] md:rounded-sm','tl',null),'rounded-lg md:rounded-sm');
 assert.equal(radius('!rounded-lg rounded-tr-md [border-bottom-left-radius:4px] md:rounded-sm',null,null),'md:rounded-sm');
});

test('stroke width and style edits retain inherited priority and reset local declarations',()=>{
 const stroke=require('../shell/inspector.js').borderClasses;
 assert.equal(stroke('[border-top-width:2px] border-b-4 border-red-500 md:border-8','width',6,'!border-2'),'border-red-500 md:border-8 !border-[6px]');
 assert.equal(stroke('border-dashed [border-left-style:double] border-2','style','solid','!border-dotted'),'border-2 !border-solid');
 assert.equal(stroke('!border-4 border-dashed md:border-8','width',null),'border-dashed md:border-8');
 assert.equal(stroke('border-4 !border-dashed','style',null),'border-4');
 assert.throws(()=>stroke('','width',-1));assert.throws(()=>stroke('','style','bad'));
});

test('layout parent skips nested contents wrappers but stops at a real box',()=>{
 const {layoutParent}=require('../shell/inspector.js'),document={defaultView:{getComputedStyle:el=>({display:el.display})}},grid={display:'grid',parentElement:null},outer={display:'contents',parentElement:grid},inner={display:'contents',parentElement:outer},child={ownerDocument:document,parentElement:inner};
 assert.equal(layoutParent(child),grid);inner.display='block';assert.equal(layoutParent(child),inner);child.parentElement=null;assert.equal(layoutParent(child),null);
});

test('rotation layout recovery handles off-center origins and negative quarter turns',()=>{
 const {rotationLayoutRect}=require('../shell/inspector.js');
 const g=rotationLayoutRect({left:90,top:220},100,50,90,[20,10]);
 assert.ok(Math.abs(g.left-110)<1e-9);assert.ok(Math.abs(g.top-230)<1e-9);assert.equal(g.width,100);assert.equal(g.height,50);
 const negative=rotationLayoutRect({left:200,top:100},100,50,-90,[0,0]);assert.ok(Math.abs(negative.left-200)<1e-9);assert.ok(Math.abs(negative.top-200)<1e-9);
 assert.throws(()=>rotationLayoutRect({left:0,top:0},0,20,30,[0,0]));
});
