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
  index.indexFile(file);const records=kind==='react'?id.collectElements(saved,name).elements:adapter.collect(saved,name).elements,current=index.resolve(records.find(e=>tag(e)==='h1').id);
  const contents=saved.slice(saved.indexOf('>',saved.indexOf('<h1'))+1,saved.lastIndexOf('</h1>'));
  const spans=kind==='html'?source.describe(contents,current.element.id).descriptor.children:records.filter(e=>tag(e)==='span'),firstStrong=kind==='html'?spans[0].children[0]:records.find(e=>tag(e)==='strong');
  const joined=(kind==='react'?writer:adapter).applyOp(current,{type:'setChildren',children:[{t:'keep',id:spans[0].id,children:[{t:'keep',id:firstStrong.id},{t:'keep',id:spans[1].id,paragraph:'inline'}]}]});assert.equal(joined.ok,true,JSON.stringify(joined));
  const output=fs.readFileSync(file,'utf8');assert.equal((output.match(/data-retouch-paragraph/g)||[]).length,1);assert.equal((output.match(/title="Keep > this"/g)||[]).length,2);assert.ok(output.includes(kind==='react'?'display:"inline"':'display: inline;'));
 }finally{cleanup(root);}
});

test('paragraph joining preserves authored attributes and rejects unmarked source',()=>{
 const {inline}=require('../src/text-paragraphs.cjs');
 const html=inline('<span id="right" class="copy" data-retouch-paragraph="" style="display:block;color:red">Text</span>');
 assert.ok(html.includes('id="right" class="copy"'));assert.ok(html.includes('color:red'));assert.ok(html.includes('display: inline;'));assert.ok(!html.includes('data-retouch-paragraph'));
 const jsx=inline('<span data-retouch-paragraph="" className={styles.copy} style={{display:"block",...appearance}}>Text</span>',true);assert.ok(jsx.includes('className={styles.copy}'));assert.equal((jsx.match(/appearance/g)||[]).length,1);assert.ok(jsx.includes('display:"inline"'));
 assert.throws(()=>inline('<span style="display:block">Text</span>'),/explicit text paragraphs/);
 assert.throws(()=>inline('<p data-retouch-paragraph="">Text</p>'),/explicit text paragraphs/);
});

for(const kind of ['react','html','liquid'])test(kind+' list joins retain source appearance and links in inline runs',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),name=kind==='react'?'Text.tsx':kind==='html'?'index.html':'text.liquid';
 const inner='<ol><li>Head</li><li id="tail" '+(kind==='react'?'className="tail" style={{color:"red"}}':'class="tail" style="color:red"')+'><a href="/kept">line</a></li></ol>',original=(kind==='react'?'export const Text = () => ':'')+'<div>'+inner+'</div>'+(kind==='react'?';':'');
 const root=makeApp({[name]:original}),file=path.join(root,name);
 try{
  const index=new Index(root,adapter);index.scanAll();const elements=kind==='react'?id.collectElements(original,name).elements:adapter.collect(original,name).elements,tag=e=>kind==='react'?e.node.openingElement.name.name:e.tag,resolved=index.resolve(elements.find(e=>tag(e)==='div').id);
  const tree=kind==='html'?source.describe(inner,resolved.element.id).descriptor.children:null,list=tree?tree[0]:elements.find(e=>tag(e)==='ol'),items=tree?list.children:elements.filter(e=>tag(e)==='li'),link=tree?items[1].children[0]:elements.find(e=>tag(e)==='a');
  const result=(kind==='react'?writer:adapter).applyOp(resolved,{type:'setChildren',children:[{t:'keep',id:list.id,children:[{t:'keep',id:items[0].id,children:[text('Head'),{t:'keep',id:items[1].id,paragraph:'inline',children:[{t:'keep',id:link.id}]}]}]}]});assert.equal(result.ok,true,JSON.stringify(result));
  const saved=fs.readFileSync(file,'utf8');assert.equal((saved.match(/<li[ >]/g)||[]).length,1);assert.match(saved,/<span id="tail"/);assert.ok(saved.includes('href="/kept"'));assert.ok(saved.includes('color'));assert.ok(saved.includes(kind==='react'?'display:"inline"':'display: inline;'));
 }finally{cleanup(root);}
});
test('list join patches use actual source tags and enforce inline content',()=>{
 const jsx=require('../src/text-paragraphs.cjs').inline('<li {...attrs} style={theme}>Text</li>',true);assert.equal((jsx.match(/attrs/g)||[]).length,1);assert.equal((jsx.match(/theme/g)||[]).length,1);assert.match(jsx,/^<span /);assert.throws(()=>require('../src/text-paragraphs.cjs').inline('<li style={theme} {...attrs}>Text</li>',true),/explicit source style/);assert.throws(()=>require('../src/text-paragraphs.cjs').inline('<li {...attrs}>Text</li>',true),/explicit source style/);
 const raw='<li class="copy" style="color: red"><strong>Text</strong></li>';
 const {descriptor}=source.describe(raw,'join');const item=descriptor.children[0];
 assert.match(source.rewrite(raw,'join',[{t:'keep',id:item.id,paragraph:'inline'}],{parentTag:'li'}),/^<span /);
 assert.match(source.rewrite(raw,'join',[{t:'copy',id:item.id,paragraph:'inline',children:[text('Copy')]}],{parentTag:'li'}),/^<span /);
 const nested='<li>Text<ul><li>Nested</li></ul></li>',nestedItem=source.describe(nested,'join').descriptor.children[0];
 assert.throws(()=>source.rewrite(nested,'join',[{t:'keep',id:nestedItem.id,paragraph:'inline'}],{parentTag:'li'}),/inline text/);
 assert.throws(()=>source.rewrite(raw,'join',[{t:'keep',id:item.id,paragraph:'inline'}],{parentTag:'ol'}),/Lists must/);
 assert.throws(()=>source.rewrite(raw,'join',[{t:'copy',id:item.id,paragraph:'inline',children:[{t:'block',tag:'ul',children:[]}]}],{parentTag:'li'}),/cannot contain/);
});
