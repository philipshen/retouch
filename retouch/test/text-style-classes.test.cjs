'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {encode}=require('../src/text-style-classes.cjs'),tokens=require('../src/class-tokens.cjs'),responsive=require('../shell/responsive.js');
const full={'font-family':'"标题_Font", sans-serif','font-size':'32px','font-weight':'537.5','font-style':'oblique','font-optical-sizing':'none','font-variation-settings':'"wght" 537.5, "GRAD" -30','font-variant-numeric':'tabular-nums slashed-zero','font-variant-ligatures':'no-common-ligatures discretionary-ligatures','font-variant-caps':'all-small-caps','font-variant-position':'super','line-height':'1.4','letter-spacing':'-0.02em','text-indent':'24px','text-wrap':'balance','text-align':'center','text-decoration-line':'underline line-through','text-decoration-style':'wavy','text-decoration-thickness':'3px','text-underline-offset':'-2px','text-decoration-skip-ink':'none','text-decoration-color':'#123456','text-transform':'uppercase'};
test('every catalog typography property has a validated scoped class encoding',()=>{
 const encoded=encode(full);assert.equal(Object.keys(encoded).length,22);
 assert.equal(encoded['font-family'],'![font-family:"标题\\_Font",_sans-serif]');assert.equal(encoded['font-variation-settings'],'![font-variation-settings:"wght"_537.5,_"GRAD"_-30]');
 const scoped=responsive.replaceScope('hover:text-red-500 md:p-4',Object.values(encoded).join(' '),'md:');
 for(const token of scoped.split(' '))assert.equal(tokens.valid(token),true,token);
 assert.ok(scoped.includes('hover:text-red-500'));assert.deepEqual(encode(Object.fromEntries(Object.entries(full).reverse())),encoded);
});
test('text style encodings refuse injection, missing values and unsupported properties',()=>{
 for(const input of [null,[],{}, {color:'red'}, {'font-size':'32px;color:red'}, {'font-size':32}, {'font-family':'"x" onmouseover="bad"'}, {'font-variation-settings':'"wght" 1; color:red'}])assert.throws(()=>encode(input));
});
module.exports={full};
test('React and Liquid source writers preserve all encoded typography tokens',()=>{
 const classes=require('../src/text-style-classes.cjs').compose('p-4 font-serif font-bold text-lg/7 md:text-4xl hover:underline',full);
 for(const kind of ['react','liquid']){
  const adapter=require('../src/adapters/'+kind+'.cjs'),relPath=kind==='react'?'Page.jsx':'sections/main.liquid',source=kind==='react'?'export default function Page(){return <p className="p-4">Text</p>}':'<p class="p-4">Text</p>';
  const resolve=value=>({source:value,relPath,file:'/tmp/'+relPath,hash:adapter.contentHash(value),element:adapter.collect(value,relPath).elements[0]});
  const result=adapter.planOp(resolve(source),{type:'setClasses',classes});assert.equal(result.ok,true,result.reason);
  const saved=adapter.describe(resolve(result.edits[0].after)).className;
  for(const token of classes.split(' '))assert.ok(saved.split(' ').includes(token),kind+' '+token);
 }
});
test('style composition replaces only owned typography in the chosen scope',()=>{
 const {compose}=require('../src/text-style-classes.cjs');
 const original='p-4 text-red-500 font-serif !font-bold md:font-light md:text-lg/7 hover:font-black [&:hover]:opacity-50';
 const result=compose(original,{'font-weight':'500'},'');assert.ok(result.includes('font-serif'));assert.ok(!result.includes('!font-bold'));assert.ok(result.endsWith('![font-weight:500]'));assert.ok(result.includes('md:font-light'));assert.ok(result.includes('text-red-500'));
 const scoped=compose(original,{'font-size':'40px','line-height':'1.2'},'md:');assert.ok(!scoped.includes('md:text-lg/7'));assert.ok(scoped.includes('md:font-light'));assert.ok(scoped.includes('!font-bold'));assert.ok(scoped.includes('md:![font-size:40px]'));assert.ok(scoped.includes('md:![line-height:1.2]'));assert.ok(scoped.includes('[&:hover]:opacity-50'));
 assert.equal(compose(scoped,{'font-size':'40px','line-height':'1.2'},'md:'),scoped);
});
test('partial composition does not silently discard coupled utility properties or shorthands',()=>{
 const {compose}=require('../src/text-style-classes.cjs');
 assert.equal(compose('text-lg/7',{'font-size':'40px'}),'leading-7 ![font-size:40px]');assert.equal(compose('text-lg/7',{'line-height':'1.2'}),'text-lg ![line-height:1.2]');assert.equal(compose('md:!text-lg/7',{'font-size':'40px'},'md:'),'md:!leading-7 md:![font-size:40px]');
 assert.throws(()=>compose('![font:italic_20px_serif]',{'font-size':'40px'}),/shorthand/);
 assert.doesNotThrow(()=>compose('text-[calc(1em/2)]',{'font-size':'40px'}));
 assert.throws(()=>compose('p-4',{'font-size':'40px'},'md:hover:'),/scope/);
});
test('override detection distinguishes canonical ownership, local resets and important competitors',()=>{
 const {overrides}=require('../src/text-style-classes.cjs'),baseline={'font-size':'32px','font-weight':'500'};
 assert.deepEqual(overrides('![font-size:32px] ![font-weight:500] font-bold md:!text-lg',baseline),[]);
 assert.deepEqual(overrides('![font-size:32px] !font-bold',baseline),['font-weight']);
 assert.deepEqual(overrides('![font-size:32px] ![font-weight:500] !text-lg',baseline),['font-size']);
 assert.deepEqual(overrides('md:![font-size:32px] md:![font-weight:500] !text-lg',baseline,'md:'),[]);
});
test('paragraph indentation replaces only its scoped tokens and remains a text style override',()=>{
 const I=require('../shell/inspector.js'),styles=require('../src/text-style-classes.cjs');
 for(const token of ['indent-4','-indent-2','indent-[12%]','[text-indent:-24px]'])assert.equal(I.textIndentToken(token),true,token);
 assert.equal(I.textIndentToken('tracking-wide'),false);
 const before='indent-4 md:-indent-2 md:tracking-wide hover:indent-8',after=styles.compose(before,{'text-indent':'24px'},'md:');
 assert.equal(after,'indent-4 md:tracking-wide hover:indent-8 md:![text-indent:24px]');
 assert.deepEqual(styles.overrides(after,{'text-indent':'12px'},'md:'),['text-indent']);
 for(const value of ['-24px','0','10%','1.5em'])assert.ok(styles.encode({'text-indent':value}));
 for(const value of ['12','normal','24px; color:red'])assert.throws(()=>styles.encode({'text-indent':value}));
});
test('underline detail tokens remain independent and support linked style overrides',()=>{
 const styles=require('../src/text-style-classes.cjs'),I=require('../shell/inspector.js'),css=require('../shell/html-css-values.js');
 const baseline='underline decoration-wavy decoration-2 decoration-red-500 underline-offset-4 md:decoration-blue-500';
 const changed=styles.compose(baseline,{'text-decoration-color':'#123456'});
 assert.ok(changed.includes('decoration-wavy'));assert.ok(changed.includes('decoration-2'));assert.ok(changed.includes('underline-offset-4'));assert.ok(changed.includes('md:decoration-blue-500'));assert.ok(!changed.split(' ').includes('decoration-red-500'));
 for(const token of ['decoration-2','decoration-[2px]','decoration-[length:2px]','decoration-[length:var(--line-width)]','decoration-[percentage:10%]','decoration-from-font']){assert.equal(I.decorationMatchers['text-decoration-thickness'](token),true);assert.equal(I.decorationMatchers['text-decoration-color'](token),false);}
 assert.deepEqual(styles.overrides(changed,{'text-decoration-color':'#abcdef'}),['text-decoration-color']);
 for(const property of ['text-decoration-line','text-decoration-style','text-decoration-color','text-decoration-thickness']){assert.equal(css.overlaps('text-decoration',property),true);assert.equal(css.overlaps(property,'text-decoration'),true);}
 for(const [property,value]of [['text-decoration-style','wavy'],['text-decoration-thickness','auto'],['text-decoration-thickness','from-font'],['text-decoration-thickness','10%'],['text-underline-offset','-2px'],['text-underline-offset','auto'],['text-decoration-color','currentColor'],['text-decoration-skip-ink','none']])assert.ok(styles.encode({[property]:value}));
 for(const [property,value]of [['text-decoration-thickness','-1px'],['text-decoration-style','wavy;color:red'],['text-decoration-skip-ink','never'],['text-underline-offset','url(x)']])assert.throws(()=>styles.encode({[property]:value}));
});
test('wrap style tokens and text styles preserve unrelated type and screen properties',()=>{
 const styles=require('../src/text-style-classes.cjs'),I=require('../shell/inspector.js'),css=require('../shell/html-css-values.js');
 for(const token of ['text-wrap','text-nowrap','text-balance','text-pretty','[text-wrap:balance]'])assert.ok(I.textWrapToken(token));
 for(const token of ['text-blue-500','text-2xl','whitespace-pre-wrap'])assert.equal(I.textWrapToken(token),false);
 assert.equal(styles.compose('text-wrap text-lg md:text-nowrap md:tracking-wide hover:text-balance',{'text-wrap':'pretty'},'md:'),'text-wrap text-lg md:tracking-wide hover:text-balance md:![text-wrap:pretty]');
 assert.deepEqual(styles.overrides('text-balance',{'text-wrap':'wrap'}),['text-wrap']);
 for(const value of ['wrap','nowrap','balance','pretty'])assert.ok(styles.encode({'text-wrap':value}));
 for(const value of ['auto','balance;color:red','inherit'])assert.throws(()=>styles.encode({'text-wrap':value}));
 for(const property of ['text-wrap-mode','text-wrap-style'])assert.ok(css.overlaps('text-wrap',property));
});
