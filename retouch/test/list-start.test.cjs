'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{patch}=require('../src/list-start.cjs'),{validateChildrenTree}=require('../src/rich-text.cjs');
test('ordered list start edits preserve unrelated attributes and children',()=>{
 for(const jsx of [false,true]){
  const raw='<ol id="kept" title="a > b" start="3"><li>A <strong>B</strong></li></ol>',next=patch(raw,7,jsx);assert.equal(next,raw.replace('start="3"','start="7"'));assert.equal(patch(next,7,jsx),next);assert.equal(patch(next,null,jsx),raw.replace('start="3"',''));
  assert.equal(patch('<ol><li>A</li></ol>',4,jsx),'<ol start="4"><li>A</li></ol>');
 }
 assert.equal(patch('<ol/>',4,true),'<ol start="4"/>');
 assert.equal(patch('<ol start={3}><li>A</li></ol>',7,true),'<ol start="7"><li>A</li></ol>');
 for(const raw of ['<ol start="{{ value }}"></ol>','<ol start="2" start="4"></ol>','<ul></ul>'])assert.throws(()=>patch(raw,3));
 for(const raw of ['<ol start={count}></ol>','<ol {...props}></ol>','<ol start="2" start="4"></ol>'])assert.throws(()=>patch(raw,3,true));
 for(const value of [0,-1,1.5,1000001,'3'])assert.throws(()=>patch('<ol></ol>',value));
});
test('ordered list start protocol only accepts bounded values on ordered lists',()=>{
 const keep={t:'keep',id:'0123456789',start:7};assert.equal(validateChildrenTree([keep],0,false,0,()=> 'ol'),null);assert.match(validateChildrenTree([keep],0,false,0,()=> 'ul'),/list start/);assert.match(validateChildrenTree([{...keep,start:Infinity}],0,false,0,()=> 'ol'),/list start/);assert.equal(validateChildrenTree([{...keep,start:null}],0,false,0,()=> 'ol'),null);
 const source=require('../src/rich-text-source.cjs'),inner='<ol id="kept" start="3"><li>A</li></ol>',described=source.describe(inner,'0123456789');assert.equal(source.rewrite(inner,'0123456789',[{t:'keep',id:described.descriptor.children[0].id,start:8}],{parentTag:'div'}),inner.replace('start="3"','start="8"'));
});

for(const kind of ['react','html','liquid'])test(kind+' saves a kept ordered list start without rewriting its children',()=>{
 const fs=require('node:fs'),path=require('node:path'),{Index,writer,makeApp,cleanup,id}=require('./helpers.cjs'),source=require('../src/rich-text-source.cjs'),adapter=require('../src/adapters/'+kind+'.cjs'),name=kind==='react'?'Text.tsx':kind==='html'?'index.html':'text.liquid';
 const inner='<ol id="kept" start="3"><li><strong>Item</strong></li></ol>',original=(kind==='react'?'export const Text = () => ':'')+'<div>'+inner+'</div>'+(kind==='react'?';':''),root=makeApp({[name]:original}),file=path.join(root,name);
 try{const index=new Index(root,adapter);index.scanAll();const elements=kind==='react'?id.collectElements(original,name).elements:adapter.collect(original,name).elements,tag=e=>kind==='react'?e.node.openingElement.name.name:e.tag,resolved=index.resolve(elements.find(e=>tag(e)==='div').id),list=kind==='html'?source.describe(inner,resolved.element.id).descriptor.children[0]:elements.find(e=>tag(e)==='ol');const result=(kind==='react'?writer:adapter).applyOp(resolved,{type:'setChildren',children:[{t:'keep',id:list.id,start:9}]});assert.equal(result.ok,true,JSON.stringify(result));assert.equal(fs.readFileSync(file,'utf8'),original.replace('start="3"','start="9"'));}finally{cleanup(root);}
});

test('implicit reversed list numbering starts with the number of direct items',()=>{
 const {startNumber}=require('../shell/list-editing.js'),list={getAttribute:()=>null,hasAttribute:()=>true,children:[{tagName:'LI'},{tagName:'LI'},{tagName:'SCRIPT'}]};assert.equal(startNumber(list),'2');assert.equal(startNumber({...list,hasAttribute:()=>false}),'1');assert.equal(startNumber({...list,getAttribute:()=> '7'}),'7');
});
