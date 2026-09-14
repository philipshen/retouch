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
  const changed=fs.readFileSync(file,'utf8');assert.match(changed,/<ol[^>]+start="3"><li><strong>First<\/strong><ul[^>]*><li><a href=/);assert.ok(changed.includes((kind==='react'?'<p style={{margin:0}}>':'<p style="margin: 0;">')+inner+'</p>'));assert.ok(changed.includes(kind==='react'?'listStyle:"revert"':'list-style: revert'));assert.ok(changed.includes('Intro &amp; &lt;safe&gt;'));
  const token=history.record(result.edits);assert.equal(history.apply(root,'undo',token,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),original);assert.equal(history.apply(root,'redo',token,adapter).ok,true);assert.equal(fs.readFileSync(file,'utf8'),changed);
  const reopened=resolve();assert.ok(kind==='react'?writer.describeElement(reopened).mixedText:adapter.describe(reopened).canSetChildren);
  // Refusal must leave the original source and history untouched.
  assert.equal(history.apply(root,'undo',token,adapter).ok,true);
  const duplicate=apply.applyOp(resolve(),{type:'setChildren',children:[block('p',[{t:'keep',id:linkId},{t:'keep',id:linkId}])]});assert.equal(duplicate.refused,true);assert.equal(fs.readFileSync(file,'utf8'),original);
  const bad=apply.applyOp(resolve(),{type:'setChildren',children:[block('p',[block('ul',[block('li',[text('Bad')])])])]});assert.equal(bad.refused,true);assert.equal(fs.readFileSync(file,'utf8'),original);
  const attributed='<ul '+(kind==='react'?'className':'class')+'="items" id="source-list" '+(kind==='react'?'style={{color:"red"}}':'style="color: red;"')+' title="Keep > me"><li data-note="first">One</li><li>Two</li></ul>';
  fs.writeFileSync(file,original.replace(inner,attributed));
  const fresh=resolve();
  const listId=kind==='html'?source.describe(attributed,fresh.element.id).descriptor.children[0].id:fresh.elements.find(el=>kind==='react'?el.node.openingElement.name.name==='ul':el.tag==='ul').id;
  const converted=apply.applyOp(fresh,{type:'setChildren',children:[{t:'keep',id:listId,tag:'ol'}]});assert.equal(converted.ok,true,JSON.stringify(converted));
  assert.equal(fs.readFileSync(file,'utf8'),original.replace(inner,attributed.replace('<ul ','<ol ').replace('</ul>','</ol>')));
  const current=resolve(),convertedInner=attributed.replace('<ul ','<ol ').replace('</ul>','</ol>');
  const listNode=kind==='html'?source.describe(convertedInner,current.element.id).descriptor.children[0]:current.elements.find(el=>kind==='react'?el.node.openingElement.name.name==='ol':el.tag==='ol');
  const childrenIds=kind==='html'?listNode.children.map(child=>child.id):current.elements.filter(el=>kind==='react'?el.node.openingElement.name.name==='li':el.tag==='li').map(el=>el.id);
  const split=apply.applyOp(current,{type:'setChildren',children:[{t:'keep',id:listNode.id,children:[{t:'keep',id:childrenIds[0]}]},block('ol',[{t:'keep',id:childrenIds[1]}],{template:listNode.id})]});assert.equal(split.ok,true,JSON.stringify(split));
  const splitSource=fs.readFileSync(file,'utf8');assert.equal((splitSource.match(/id="source-list"/g)||[]).length,1);assert.equal((splitSource.match(/title="Keep > me"/g)||[]).length,1);assert.equal((splitSource.match(/="items"/g)||[]).length,2);assert.equal((splitSource.match(kind==='react'?/style=\{\{color:"red"\}\}/g:/style="color: red;"/g)||[]).length,2);
  const invalidTemplate=apply.applyOp(resolve(),{type:'setChildren',children:[block('ul',[block('li',[text('x')])],{template:'0000000000'})]});assert.equal(invalidTemplate.refused,true);assert.equal(fs.readFileSync(file,'utf8'),splitSource);
 }finally{cleanup(root);}
});

test('kept list tag conversion preserves original attribute syntax and nested content',()=>{
 const original='<UL class=items data-note="a > b"><li title=first>One</li><li class="last">Two</li></UL>',descriptor=source.describe(original,'id').descriptor.children[0];
 assert.throws(()=>source.rewrite(original,'id',[{t:'keep',id:descriptor.id,tag:'p'}]),/mapped children|inline/);
 assert.throws(()=>source.rewrite(original,'id',[{t:'keep',id:descriptor.id,tag:'div'}]),/mapped children/);
 const numbered=source.rewrite(original,'id',[{t:'keep',id:descriptor.id,tag:'ol'}]);
 assert.equal(numbered,original.replace('<UL','<ol').replace('</UL>','</ol>'));
 const paragraphs=source.rewrite(original,'id',[{t:'keep',id:descriptor.id,tag:'div',children:descriptor.children.map(item=>({t:'keep',id:item.id,tag:'p'}))}]);
 assert.equal(paragraphs,'<div class=items data-note="a > b"><p title=first>One</p><p class="last">Two</p></div>');
 assert.throws(()=>blocks.patchTag('<a href="/">Link</a>','a','p'),/Only paragraph/);
 assert.throws(()=>blocks.patchTag('<{{ tag }}>Text</{{ tag }}>','p','li'),/explicit static/);
 assert.ok(rich.validateChildrenTree([{t:'keep',id:descriptor.id,tag:'script'}],0));
 assert.ok(rich.validateChildrenTree([{t:'keep',id:descriptor.id,tag:'p',href:'/link'}],0));
});

test('list appearance templates are constrained to a unique source class/style',()=>{
 assert.ok(rich.validateChildrenTree([block('p',[],{template:'0123456789'})],0));
 assert.ok(rich.validateChildrenTree([block('ul',[],{template:'not-an-id'})],0));
 const original='<ul class="first" class="second"><li>A</li></ul>',listNode=source.describe(original,'id').descriptor.children[0];
 assert.throws(()=>source.rewrite(original,'id',[block('ul',[block('li',[text('A')])],{template:listNode.id})]),/appearance source/);
});

test('preserved source list containers use block depth without relaxing inline depth',()=>{
 const tree=descriptor=>descriptor.map(item=>item.t==='element'?{t:'keep',id:item.id,children:tree(item.children)}:text(item.value.replace('Leaf','Changed')));
 let nested='Leaf';for(let i=0;i<5;i++)nested='<ul><li>'+nested+'</li></ul>';
 assert.equal(source.rewrite(nested,'id',tree(source.describe(nested,'id').descriptor.children)),nested.replace('Leaf','Changed'));
 let inline='Leaf';for(let i=0;i<9;i++)inline='<span>'+inline+'</span>';
 assert.throws(()=>source.rewrite(inline,'id',tree(source.describe(inline,'id').descriptor.children)),/Nesting too deep/);
});
