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
