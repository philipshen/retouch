'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),react=require('../src/adapters/react.cjs'),linked=require('../src/jsx-text-styles.cjs');
const source='export default function Page(){return <p className="p-4 font-bold md:text-lg/7 hover:text-red-500">Text</p>}';
const style={id:'11111111-1111-4111-8111-111111111111',name:'Heading',properties:{'font-family':'"Example_Font", serif','font-size':'32px','line-height':'1.4','font-weight':'500'}};
const resolve=source=>({file:'/tmp/Page.jsx',relPath:'Page.jsx',source,hash:react.contentHash(source),element:react.collect(source,'Page.jsx').elements[0]});
const apply=(text,scope='')=>linked.plan(resolve(text),{type:'applyTextStyle',scope},style);
test('React typography and per-scope links serialize together without changing layer identity',()=>{
 const base=apply(source);assert.equal(base.ok,true,base.reason);assert.equal(base.edits.length,1);assert.equal(base.edits[0].before,source);
 const next=apply(base.edits[0].after,'md:');assert.equal(next.ok,true,next.reason);const r=resolve(next.edits[0].after),info=react.describe(r),links=linked.describe(r).textStyleLinks;
 assert.equal(r.element.id,resolve(source).element.id);assert.equal(links[''].id,style.id);assert.equal(links['md:'].id,style.id);assert.deepEqual(links['md:'].properties,style.properties);
 assert.ok(info.className.includes('p-4'));assert.ok(info.className.includes('hover:text-red-500'));assert.ok(!info.className.includes('md:text-lg/7'));assert.ok(info.className.includes('md:![font-size:32px]'));
 assert.deepEqual(apply(r.source,'md:').edits,[]);
});
test('React detach preserves rendered classes and other scope links',()=>{
 const before=apply(apply(source).edits[0].after,'md:').edits[0].after,r=resolve(before),result=linked.plan(r,{type:'detachTextStyle',scope:'md:'});assert.equal(result.ok,true);
 const after=resolve(result.edits[0].after);assert.equal(react.describe(after).className,react.describe(r).className);assert.deepEqual(Object.keys(linked.describe(after).textStyleLinks),['']);
});
test('React text style writer refuses stale source, dynamic metadata and ambiguous spread attributes',()=>{
 assert.equal(linked.plan(resolve(source),{type:'applyTextStyle',fileHash:'stale'},style).ok,false);
 for(const text of [source.replace('<p ','<p className="other" '),source.replace('<p ','<p {...props} '),source.replace('<p ','<p data-rt-text-styles={getLinks()} '),source.replace('className="p-4 font-bold md:text-lg/7 hover:text-red-500"','className={classes}')])assert.equal(apply(text).ok,false);
 assert.equal(apply(source,'md:hover:').ok,false);
});
test('React override reset removes changed and obsolete properties only in its scope',()=>{
 const before=apply(apply(source).edits[0].after,'md:').edits[0].after;
 const modified=before.replace('md:![font-size:32px]','md:!text-[40px]');
 assert.deepEqual(linked.describe(resolve(modified)).textStyleOverrides,{'':[], 'md:':['font-size']});
 const next={...style,properties:{'font-size':'48px','line-height':'1.2'}};
 const result=linked.plan(resolve(modified),{type:'resetTextStyle',scope:'md:'},next);assert.equal(result.ok,true,result.reason);
 const after=resolve(result.edits[0].after),info=react.describe(after);
 assert.ok(info.className.includes('![font-size:32px]'));assert.ok(info.className.includes('md:![font-size:48px]'));assert.ok(!info.className.includes('md:!text-[40px]'));assert.ok(!info.className.includes('md:![font-family:'));
 assert.deepEqual(linked.describe(after).textStyleOverrides,{'':[], 'md:':[]});assert.equal(linked.plan(resolve(source),{type:'resetTextStyle',scope:'md:'},style).ok,false);
});
test('React refresh preserves local edits across successive matching library values and scopes',()=>{
 let before=apply(apply(source).edits[0].after,'md:').edits[0].after;before=before.replace('md:![font-size:32px]','md:!text-[40px]');
 const next={...style,properties:{...style.properties,'font-size':'40px','font-weight':'600'}};
 const first=linked.planFile('/tmp/Page.jsx','Page.jsx',before,next);assert.equal(first.ok,true,first.reason);assert.equal(first.updated,2);assert.equal(first.edits.length,1);
 let r=resolve(first.edits[0].after),info=react.describe(r);assert.ok(info.className.includes('![font-size:40px]'));assert.ok(info.className.includes('md:!text-[40px]'));assert.ok(info.className.includes('md:![font-weight:600]'));assert.deepEqual(info.textStyleLinks['md:'].overrides,['font-size']);
 const later={...next,properties:{...next.properties,'font-size':'60px'}};const second=linked.planFile('/tmp/Page.jsx','Page.jsx',r.source,later);assert.equal(second.ok,true);r=resolve(second.edits[0].after);assert.ok(react.describe(r).className.includes('md:!text-[40px]'));assert.ok(react.describe(r).className.includes('![font-size:60px]'));assert.deepEqual(linked.planFile('/tmp/Page.jsx','Page.jsx',r.source,later).edits,[]);
 const reset=linked.plan(r,{type:'resetTextStyle',scope:'md:'},later);assert.equal(reset.ok,true);assert.deepEqual(linked.describe(resolve(reset.edits[0].after)).textStyleOverrides['md:'],[]);
});
test('React refresh preserves explicit resets and new local properties while removing obsolete inherited ones',()=>{
 let before=apply(source).edits[0].after.replace('![font-size:32px]','').replace('hover:text-red-500','tracking-[3px] hover:text-red-500');
 const next={...style,properties:{'font-size':'48px','letter-spacing':'1px'}};
 const result=linked.planFile('/tmp/Page.jsx','Page.jsx',before,next);assert.equal(result.ok,true,result.reason);const info=react.describe(resolve(result.edits[0].after));
 assert.ok(!info.className.includes('![font-size:'));assert.ok(info.className.includes('tracking-[3px]'));assert.ok(!info.className.includes('![font-weight:'));assert.deepEqual(info.textStyleLinks[''].overrides,['font-size','letter-spacing']);
});
test('React refresh ignores unlinked spreads but refuses malformed linked metadata without returning partial edits',()=>{
 const before=apply(source).edits[0].after.replace('return <p','return <><p').replace('</p>}','</p><span {...props}/></>}');
 const next={...style,properties:{...style.properties,'font-size':'48px'}};assert.equal(linked.planFile('/tmp/Page.jsx','Page.jsx',before,next).ok,true);
 const broken=before.replace('<span {...props}/>','<span data-rt-text-styles={getLinks()}/>');const result=linked.planFile('/tmp/Page.jsx','Page.jsx',broken,next);assert.equal(result.ok,false);assert.equal(result.edits,undefined);
});
