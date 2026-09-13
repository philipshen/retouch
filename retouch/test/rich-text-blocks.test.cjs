'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const rich=require('../src/rich-text.cjs'),blocks=require('../src/rich-text-blocks.cjs'),source=require('../src/rich-text-source.cjs');
const {Index,writer,makeApp,cleanup,id}=require('./helpers.cjs');
const {SourceHistory}=require('../src/history.cjs');
const text=value=>({t:'text',value}),block=(tag,children,extra={})=>({t:'block',tag,children,...extra});
const list=[block('p',[text('Intro & <safe>')]),block('ol',[block('li',[{t:'wrap',tag:'strong',children:[text('First')]},block('ul',[block('li',[{t:'link',href:'/docs',children:[text('Nested')]}])])]),block('li',[text('Second')])],{start:3})];
test('paragraph/list vocabulary bounds structure, nesting, and authored attributes',()=>{
 assert.equal(rich.validateChildrenTree(list,0),null);
 for(const node of [block('script',[]),block('p',[],{onclick:'evil'}),block('ul',[],{start:2}),block('ol',[],{start:0}),block('ol',[],{start:1.5}),block('ol',[],{start:1000001})])assert.ok(rich.validateChildrenTree([node],0));
 assert.match(rich.validateChildrenTree([{t:'link',href:'/safe',children:list}],0),/cannot contain/);
 let nested=[text('Deep')];for(let i=0;i<5;i++)nested=[block('ul',[block('li',nested)])];
 assert.equal(rich.validateChildrenTree(nested,0),null);assert.equal(blocks.placement(nested,'div',()=>null),null);
 assert.match(blocks.placement([block('ul',[block('li',nested)])],'div',()=>null),/five/);
 let inline=[text('Deep')];for(let i=0;i<9;i++)inline=[{t:'wrap',tag:'strong',children:inline}];
 assert.match(rich.validateChildrenTree(inline,0),/Nesting/);
});
test('source placement prevents browser-repaired lists and nested paragraphs',()=>{
 for(const parent of ['p','h1','span','svg','Custom'])assert.throws(()=>source.rewrite('Text','id',list,{parentTag:parent}),/cannot contain/);
 for(const tree of [[block('li',[text('orphan')])],[block('ul',[text('orphan')])],[block('p',[block('p',[text('nested')])])],[{t:'wrap',tag:'strong',children:list}]])assert.throws(()=>source.rewrite('Text','id',tree),/contain|need/);
 const original='<div class="source">Kept block</div>',kept=source.describe(original,'id').descriptor.children[0];
 assert.throws(()=>source.rewrite(original,'id',[block('p',[{t:'keep',id:kept.id}])]),/contain/);
 const linkedBlock='<a href="/keep"><div>Block</div></a>',anchor=source.describe(linkedBlock,'id').descriptor.children[0];
 assert.throws(()=>source.rewrite(linkedBlock,'id',[block('p',[{t:'keep',id:anchor.id}])]),/inline/);
 const paragraph='<p class="source">Kept text</p>',p=source.describe(paragraph,'id').descriptor.children[0];
 assert.throws(()=>source.rewrite(paragraph,'id',[{t:'keep',id:p.id,children:list}]),/contain/);
});
for(const kind of ['react','html','liquid'])test(`${kind} paragraph/list writes preserve source links and exact transaction history`,()=>{
 const adapter=kind==='react'?require('../src/adapters/react.cjs'):require('../src/adapters/'+kind+'.cjs');
 const fileName=kind==='react'?'Text.tsx':kind==='html'?'index.html':'text.liquid';
 const inner='<a href="/original" title="Keep me">Source link</a>';
 const original=kind==='react'?'export const Text = () => <div className="copy">'+inner+'</div>;':'<div class="copy">'+inner+'</div>';
 const root=makeApp({[fileName]:original}),file=path.join(root,fileName);
 try{
  const index=new Index(root,adapter);index.scanAll();
  const resolve=()=>{index.indexFile(file);const current=fs.readFileSync(file,'utf8');const elements=kind==='react'?id.collectElements(current,fileName).elements:adapter.collect(current,fileName).elements;const element=elements.find(el=>kind==='react'?el.node.openingElement.name.name==='div':el.tag==='div');return index.resolve(element.id);};
  const resolved=resolve();let linkId;
  if(kind==='html')linkId=source.describe(inner,resolved.element.id).descriptor.children[0].id;
  else linkId=resolved.elements.find(el=>kind==='react'?el.node.openingElement.name.name==='a':el.tag==='a').id;
  const children=[...list,block('p',[{t:'keep',id:linkId}])],history=new SourceHistory();
  const apply=kind==='react'?writer:adapter,result=apply.applyOp(resolved,{type:'setChildren',children,fileHash:resolved.hash});
  assert.equal(result.ok,true,JSON.stringify(result));
  const changed=fs.readFileSync(file,'utf8');assert.ok(changed.includes('<ol start="3"><li><strong>First</strong><ul><li><a href='));assert.ok(changed.includes('<p>'+inner+'</p>'));assert.ok(changed.includes('Intro &amp; &lt;safe&gt;'));
  const token=history.record(result.edits);assert.equal(history.apply(root,'undo',token,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),original);assert.equal(history.apply(root,'redo',token,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),changed);
  const reopened=resolve();assert.ok(kind==='react'?writer.describeElement(reopened).mixedText:adapter.describe(reopened).canSetChildren);
  // Refusal must leave the original source and history untouched.
  assert.equal(history.apply(root,'undo',token,adapter).ok,true);
  const duplicate=apply.applyOp(resolve(),{type:'setChildren',children:[block('p',[{t:'keep',id:linkId},{t:'keep',id:linkId}])]});assert.equal(duplicate.refused,true);assert.equal(fs.readFileSync(file,'utf8'),original);
  const bad=apply.applyOp(resolve(),{type:'setChildren',children:[block('p',[block('ul',[block('li',[text('Bad')])])])]});assert.equal(bad.refused,true);assert.equal(fs.readFileSync(file,'utf8'),original);
 }finally{cleanup(root);}
});
