'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Index,writer,makeApp,cleanup,id}=require('./helpers.cjs'),spacing=require('../src/list-spacing.cjs'),source=require('../src/rich-text-source.cjs'),rich=require('../src/rich-text.cjs');
test('list spacing preference patches one literal attribute and preserves other source bytes',()=>{
 const original='<ol start="7" class="items"><li>One</li></ol>',saved=spacing.patch(original,12.5);assert.equal(saved,'<ol start="7" class="items" data-retouch-list-spacing="12.5"><li>One</li></ol>');assert.equal(spacing.patch(saved,0),saved.replace('"12.5"','"0"'));assert.equal(spacing.patch(saved,null),saved.replace('data-retouch-list-spacing="12.5"',''));
 assert.equal(spacing.patch('<ul />',18,true),'<ul  data-retouch-list-spacing="18"/>');
 for(const value of [-1,10001,NaN,Infinity,'12',{}])assert.throws(()=>spacing.patch(original,value),/Invalid/);
 for(const raw of ['<ol {...attrs}><li>One</li></ol>','<ol data-retouch-list-spacing={gap}><li>One</li></ol>','<ol data-retouch-list-spacing="3" data-retouch-list-spacing="4"/>'])assert.throws(()=>spacing.patch(raw,18,true),/controlled/);
 assert.throws(()=>spacing.patch('<ul class="{{ class }}"><li>One</li></ul>',18),/controlled/);assert.throws(()=>spacing.patch('<li>One</li>',18),/controlled/);
 assert.ok(require('../src/text-paragraphs.cjs').patchSpacing('<li>Item</li>',1e-7).includes('margin-block-end: 1e-7px;'));
 const tree=[{t:'block',tag:'ol',listSpacing:18,children:[{t:'block',tag:'li',children:[{t:'text',value:'One'}]}]}];assert.equal(rich.validateChildrenTree(tree,0),null);assert.ok(source.rewrite('Before','id',tree,{parentTag:'div'}).includes('data-retouch-list-spacing="18"'));assert.ok(rich.validateChildrenTree([{t:'block',tag:'li',listSpacing:18,children:[]}],0));
});
for(const kind of ['react','html','liquid'])test(kind+' keeps an independent spacing preference on a one-item list',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),name=kind==='react'?'Text.tsx':kind==='html'?'index.html':'text.liquid',inner='<ol start="7"><li title="keep"><a href="/kept">One</a></li></ol>',original=(kind==='react'?'export const Text = () => ':'')+'<div>'+inner+'</div>'+(kind==='react'?';':'');
 const root=makeApp({[name]:original}),file=path.join(root,name);
 try{
  const index=new Index(root,adapter);index.scanAll();const elements=kind==='react'?id.collectElements(original,name).elements:adapter.collect(original,name).elements,tag=e=>kind==='react'?e.node.openingElement.name.name:e.tag,resolved=index.resolve(elements.find(e=>tag(e)==='div').id),list=kind==='html'?source.describe(inner,resolved.element.id).descriptor.children[0]:elements.find(e=>tag(e)==='ol');
  const result=(kind==='react'?writer:adapter).applyOp(resolved,{type:'setChildren',children:[{t:'keep',id:list.id,listSpacing:12.5}]});assert.equal(result.ok,true,JSON.stringify(result));assert.equal(fs.readFileSync(file,'utf8'),original.replace('<ol start="7">','<ol start="7" data-retouch-list-spacing="12.5">'));
 }finally{cleanup(root);}
});
