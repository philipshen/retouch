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
