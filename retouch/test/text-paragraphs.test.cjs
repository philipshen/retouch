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
