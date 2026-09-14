'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const copy=require('../src/rich-text-copy.cjs'),source=require('../src/rich-text-source.cjs'),rich=require('../src/rich-text.cjs');
const {Index,writer,makeApp,cleanup,id}=require('./helpers.cjs');
const text=value=>({t:'text',value});
test('split wrappers retain source appearance and link attributes without identity or behavior',()=>{
 assert.equal(copy.markup('<a id="unique" href="/docs" title="a > b" onclick="track()">Original</a>','Tail'),'<a href="/docs" title="a > b">Tail</a>');
 assert.equal(copy.markup('<span id="unique" className={styles.label} style={{color:color}} onClick={track}>Original</span>','Tail',true),'<span className={styles.label} style={{color:color}}>Tail</span>');
 for(const raw of ['<span style="color:red" style="color:blue">x</span>','<input value="x">','<span aria-labelledby="unique">x</span>'])assert.throws(()=>copy.markup(raw,'Tail'));
 assert.equal(copy.markup('<a href="/before" title="Keep">x</a>','Tail',false,{href:'/after'}),'<a title="Keep" href="/after">Tail</a>');
 assert.throws(()=>copy.markup('<span {...props}>x</span>','Tail',true));
 assert.match(rich.validateChildrenTree([{t:'copy',id:'0123456789',children:[]}],0,false,0,()=> 'script'),/split/);
});
for(const kind of ['react','html','liquid'])test(kind+' saves split styled list items and keeps source identity once',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),name=kind==='react'?'Text.tsx':kind==='html'?'index.html':'text.liquid';
 const inner='<ol><li id="first"><span '+(kind==='react'?'className':'class')+'="emphasis" title="Keep > this">Headline</span></li></ol>';
 const original=(kind==='react'?'export const Text = () => ':'')+'<div>'+inner+'</div>'+(kind==='react'?';':'');
 const root=makeApp({[name]:original}),file=path.join(root,name);
 try{
  const index=new Index(root,adapter);index.scanAll();const elements=kind==='react'?id.collectElements(original,name).elements:adapter.collect(original,name).elements;
  const tag=e=>kind==='react'?e.node.openingElement.name.name:e.tag,resolved=index.resolve(elements.find(e=>tag(e)==='div').id);
  const descriptors=kind==='html'?source.describe(inner,resolved.element.id).descriptor.children:null;
  const ol=kind==='html'?descriptors[0]:elements.find(e=>tag(e)==='ol'),li=kind==='html'?ol.children[0]:elements.find(e=>tag(e)==='li'),span=kind==='html'?li.children[0]:elements.find(e=>tag(e)==='span');
  const children=[{t:'keep',id:ol.id,children:[{t:'keep',id:li.id,marker:'none',children:[{t:'keep',id:span.id,children:[text('Head')]}]},{t:'copy',id:li.id,marker:'inherit',children:[{t:'copy',id:span.id,children:[text('line')]}]}]}];
  const result=(kind==='react'?writer:adapter).applyOp(resolved,{type:'setChildren',children});assert.equal(result.ok,true,JSON.stringify(result));
  const saved=fs.readFileSync(file,'utf8');assert.equal((saved.match(/id="first"/g)||[]).length,1);assert.equal((saved.match(/title="Keep > this"/g)||[]).length,2);assert.equal((saved.match(/="emphasis"/g)||[]).length,2);assert.ok(saved.includes('>Head</span></li><li'));assert.ok(saved.includes(kind==='react'?'listStyleType:"none"':'list-style-type: none;'));assert.ok(saved.includes(kind==='react'?'listStyleType:"inherit"':'list-style-type: inherit;'));
 }finally{cleanup(root);}
});
