'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{change}=require('../shell/react-selection.js');
test('React shared styles preserve unrelated classes, scopes and important markers',()=>{
 assert.equal(change('p-4 opacity-80 hover:opacity-40 md:opacity-60','md:','opacity',25),'p-4 opacity-80 hover:opacity-40 md:opacity-[0.25]');
 assert.equal(change('opacity-80! hover:opacity-40','','opacity',50),'hover:opacity-40 !opacity-[0.5]');
 assert.equal(change('opacity-80!','md:','opacity',25),'opacity-80! md:!opacity-[0.25]');
 assert.equal(change('visible md:invisible hover:visible','md:','visibility','collapse'),'visible hover:visible md:collapse');
 assert.equal(change('mix-blend-screen isolate','','mix-blend-mode','multiply'),'isolate mix-blend-multiply');
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
