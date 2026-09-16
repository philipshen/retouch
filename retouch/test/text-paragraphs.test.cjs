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
 assert.match(inline('<p data-retouch-paragraph="">Text</p>'),/^<span /);
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

test('paragraph spacing validates bounds and preserves unrelated authored style',()=>{
 const paragraphs=require('../src/text-paragraphs.cjs');
 for(const value of [-1,NaN,Infinity,10001,'12',null]){assert.equal(paragraphs.validSpacing(value),false);assert.ok(rich.validateChildrenTree([{t:'paragraph',spacing:value,children:[]}],0));}
 for(const value of [0,12.5,10000])assert.equal(paragraphs.validSpacing(value),true);
 const raw='<p class="copy" title="Keep > this" style="color: red; margin: 4px !important">Text</p>',patched=paragraphs.patchSpacing(raw,12.5);
 assert.ok(patched.includes('class="copy" title="Keep > this"'));assert.ok(patched.includes('color: red; margin: 4px !important'));assert.ok(patched.includes('margin-block-end: 12.5px !important;'));
 const again=paragraphs.patchSpacing(patched,24);assert.equal((again.match(/margin-block-end:/g)||[]).length,1);assert.equal((again.match(/margin-block-start:/g)||[]).length,1);
 const jsxRepeated=paragraphs.patchSpacing(paragraphs.patchSpacing('<p>Text</p>',12,true),24,true);assert.equal((jsxRepeated.match(/marginBlockEnd:/g)||[]).length,1);assert.equal((jsxRepeated.match(/marginBlockStart:/g)||[]).length,1);
 assert.ok(paragraphs.patchSpacing('<p style="list-style-type: disc;">Text</p>',8).includes('list-style-type: disc;'));
 assert.throws(()=>paragraphs.patchSpacing('<span>Inline</span>',12),/paragraph/);
 assert.throws(()=>paragraphs.patchSpacing('<p style="{{ style }}">Text</p>',12),/template/);
 assert.throws(()=>paragraphs.patchSpacing('<p {...props}>Text</p>',12,true),/explicit source style/);
 const jsx=paragraphs.patchSpacing('<p style={{color:"red",...theme}}>Text</p>',12.5,true);assert.equal((jsx.match(/theme/g)||[]).length,1);assert.ok(jsx.includes('marginBlockEnd:"12.5px"'));
});
for(const kind of ['react','html','liquid'])test(kind+' paragraph spacing updates kept native paragraphs without rewriting their content',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),name=kind==='react'?'Text.tsx':kind==='html'?'index.html':'text.liquid';
 const inner='<p title="One"><strong>First</strong></p><p title="Two">Second</p>',original=(kind==='react'?'export const Text = () => ':'')+'<div>'+inner+'</div>'+(kind==='react'?';':'');
 const root=makeApp({[name]:original}),file=path.join(root,name);
 try{
  const index=new Index(root,adapter);index.scanAll();const elements=kind==='react'?id.collectElements(original,name).elements:adapter.collect(original,name).elements,tag=e=>kind==='react'?e.node.openingElement.name.name:e.tag,resolved=index.resolve(elements.find(e=>tag(e)==='div').id);
  const items=kind==='html'?source.describe(inner,resolved.element.id).descriptor.children:elements.filter(e=>tag(e)==='p');
  const result=(kind==='react'?writer:adapter).applyOp(resolved,{type:'setChildren',children:items.map((item,i)=>({t:'keep',id:item.id,spacing:i===0?12.5:0}))});assert.equal(result.ok,true,JSON.stringify(result));
  const saved=fs.readFileSync(file,'utf8');assert.ok(saved.includes('<strong>First</strong>'));assert.ok(saved.includes('title="One"'));assert.ok(saved.includes('title="Two"'));assert.ok(saved.includes(kind==='react'?'marginBlockEnd:"12.5px"':'margin-block-end: 12.5px;'));assert.ok(saved.includes(kind==='react'?'marginBlockEnd:"0px"':'margin-block-end: 0px;'));
 }finally{cleanup(root);}
});

for(const kind of ['react','html','liquid'])test(kind+' native paragraph joins preserve p/div appearance and refuse nested block contents',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),name=kind==='react'?'Text.tsx':kind==='html'?'index.html':'text.liquid';
 const inner='<p title="first"><strong>First</strong></p><p title="second"><a href="/kept">Second</a></p><div title="third">Third</div><div title="nested"><p>Nested</p></div>',original=(kind==='react'?'export const Text = () => ':'')+'<div>'+inner+'</div>'+(kind==='react'?';':'');
 const root=makeApp({[name]:original}),file=path.join(root,name);
 try{
  const index=new Index(root,adapter);index.scanAll();const elements=kind==='react'?id.collectElements(original,name).elements:adapter.collect(original,name).elements,tag=e=>kind==='react'?e.node.openingElement.name.name:e.tag,selected=index.resolve(elements.find(e=>tag(e)==='div').id),tree=kind==='html'?source.describe(inner,selected.element.id).descriptor.children:null;
  const paragraphs=tree?tree.slice(0,2):elements.filter(e=>tag(e)==='p').slice(0,2),divs=tree?tree.slice(2):elements.filter(e=>tag(e)==='div').slice(1),strong=tree?tree[0].children[0]:elements.find(e=>tag(e)==='strong');
  let resolved=selected;
  const apply=children=>(kind==='react'?writer:adapter).applyOp(resolved,{type:'setChildren',children});
  const rejected=apply([{t:'keep',id:paragraphs[0].id,children:[{t:'keep',id:divs[1].id,paragraph:'inline'}]}]);assert.equal(rejected.ok,false);assert.equal(fs.readFileSync(file,'utf8'),original);
  fs.writeFileSync(file,original.replace('<div title="nested"><p>Nested</p></div>',''));index.indexFile(file);resolved=index.resolve(selected.element.id);
  const result=apply([{t:'keep',id:paragraphs[0].id,children:[{t:'keep',id:strong.id},{t:'keep',id:paragraphs[1].id,paragraph:'inline'},{t:'keep',id:divs[0].id,paragraph:'inline'}]}]);assert.equal(result.ok,true,JSON.stringify(result));
  const saved=fs.readFileSync(file,'utf8');assert.ok(saved.includes('<p title="first"><strong>First</strong>'));assert.ok(saved.includes('<span title="second"'));assert.ok(saved.includes('<a href="/kept">Second</a>'));assert.ok(saved.includes('<span title="third"'));assert.equal((saved.match(kind==='react'?/display:"inline"/g:/display: inline;/g)||[]).length,2);
 }finally{cleanup(root);}
});
