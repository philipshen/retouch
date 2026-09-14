'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Index,writer,makeApp,cleanup,id}=require('./helpers.cjs'),rich=require('../src/rich-text.cjs'),source=require('../src/rich-text-source.cjs');
const text=value=>({t:'text',value}),paragraph=children=>({t:'paragraph',children});
test('logical text paragraphs constrain markup and preserve phrasing content models',()=>{
 const tree=[paragraph([text('One')]),paragraph([{t:'break'}]),paragraph([text('Three')])];
 assert.equal(rich.validateChildrenTree(tree,0),null);
 assert.match(source.rewrite('Before','id',tree,{parentTag:'h1'}),/^<span data-retouch-paragraph="" style="display: block;">One<\/span>/);
 assert.throws(()=>source.rewrite('Before','id',[paragraph([{t:'block',tag:'ul',children:[]}])],{parentTag:'h1'}),/cannot contain/);
 for(const parentTag of ['table','input','img','br','option'])assert.throws(()=>source.rewrite('Before','id',tree,{parentTag}),/cannot contain/);
 assert.ok(rich.validateChildrenTree([{...paragraph([]),onclick:'bad'}],0));
 assert.throws(()=>source.rewrite('Before','id',tree,{parentTag:'ul'}),/cannot contain|Lists must/);
});
for(const kind of ['react','html','liquid'])test(kind+' paragraph boundaries keep heading semantics and owned formatting',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),name=kind==='react'?'Text.tsx':kind==='html'?'index.html':'text.liquid';
 const inner='<strong title="Keep > this">Headline</strong>',original=(kind==='react'?'export const Text = () => ':'')+'<h1 id="heading">'+inner+'</h1>'+(kind==='react'?';':'');
 const root=makeApp({[name]:original}),file=path.join(root,name);
 try{
  const index=new Index(root,adapter);index.scanAll();const elements=kind==='react'?id.collectElements(original,name).elements:adapter.collect(original,name).elements,tag=e=>kind==='react'?e.node.openingElement.name.name:e.tag,resolved=index.resolve(elements.find(e=>tag(e)==='h1').id);
  const strong=kind==='html'?source.describe(inner,resolved.element.id).descriptor.children[0]:elements.find(e=>tag(e)==='strong');
  const result=(kind==='react'?writer:adapter).applyOp(resolved,{type:'setChildren',children:[paragraph([{t:'keep',id:strong.id,children:[text('Head')]}]),paragraph([{t:'copy',id:strong.id,children:[text('line')]}])]});assert.equal(result.ok,true,JSON.stringify(result));
  const saved=fs.readFileSync(file,'utf8');assert.ok(saved.includes('<h1 id="heading">'));assert.ok(saved.includes('</h1>'));assert.equal((saved.match(/data-retouch-paragraph=""/g)||[]).length,2);assert.equal((saved.match(/title="Keep > this"/g)||[]).length,2);assert.ok(saved.includes('>Head</strong></span><span'));
 }finally{cleanup(root);}
});
