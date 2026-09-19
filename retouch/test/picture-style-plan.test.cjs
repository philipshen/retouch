'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {plan}=require('../src/picture-style-plan.cjs'),{applyPlan}=require('../src/transactions.cjs');
function fixture(t,source,files={}){
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'retouch-picture-styles-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const [name,text]of Object.entries({'pages/index.html':source,...files})){const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
 return {appRoot:root,file:path.join(root,'pages/index.html'),relPath:'pages/index.html',source};
}
test('collects inline, base-relative, root-relative and recursively imported CSS without reading ordinary assets',t=>{
 const source='<base href="/assets/"><link rel="alternate stylesheet" href="main.css?v=2#theme"><style media="print">@import "extra.css" print; .frame > img {width:50%}</style><main><img></main>',resolved=fixture(t,source,{'assets/main.css':'@import url("nested/child.css") layer(theme) screen; img + button {color:red; background:url(missing.png)}','assets/nested/child.css':'@import "../main.css"; img:last-child {opacity:.8}','assets/extra.css':'@media print { .frame > img {width:10cm} }'});
 const result=plan(resolved);assert.equal(result.linked,3);assert.equal(result.inlineChanged,true);assert.equal(result.edits.length,4);assert.ok(result.source.includes('data-rt-picture'));assert.deepEqual(result.edits.slice(1).map(edit=>path.relative(resolved.appRoot,edit.file)),['assets/main.css','assets/extra.css','assets/nested/child.css']);
 for(const edit of result.edits){assert.equal(fs.readFileSync(edit.file,'utf8'),edit.before);assert.notEqual(edit.after,edit.before);}
 assert.ok(result.edits[1].after.includes('background:url(missing.png)'));assert.ok(result.edits[1].after.includes('layer(theme) screen'));
});
test('combines a structural HTML edit and stylesheet snapshots in one transaction with exact undo',t=>{
 const source='<link rel="stylesheet" href="/theme.css"><style>main > img{height:40px}</style><main><img></main>',resolved=fixture(t,source,{'theme.css':'main > img{width:50%}'}),html=require('../src/adapters/html.cjs'),elements=html.collect(source,resolved.relPath).elements,result=html.planOp({...resolved,elements,element:elements.find(element=>element.tag==='img'),hash:html.contentHash(source)},{type:'setPictureSources',action:'add',src:'phone.svg',fileHash:html.contentHash(source)}),applied=applyPlan(resolved.appRoot,result);
 assert.equal(applied.ok,true,applied.reason);assert.equal(applied.edits.length,2);assert.equal(result.authorStyles,true);assert.equal(result.revalidateStyles,true);assert.ok(fs.readFileSync(resolved.file,'utf8').includes('<picture'));
 const undone=applyPlan(resolved.appRoot,{ok:true,edits:applied.edits.map(edit=>({...edit,before:edit.after,after:edit.before}))});assert.equal(undone.ok,true,undone.reason);assert.equal(fs.readFileSync(resolved.file,'utf8'),source);assert.equal(fs.readFileSync(path.join(resolved.appRoot,'theme.css'),'utf8'),'main > img{width:50%}');
});
test('stale changed and unchanged dependencies prevent all writes',t=>{
 for(const css of ['main > img{width:50%}','[data-rt-picture] > img{width:50%}']){
  const resolved=fixture(t,'<link rel="stylesheet" href="/theme.css"><img>',{'theme.css':css}),result=plan(resolved,{source:resolved.source.replace('<img>','<picture><img></picture>')});fs.writeFileSync(path.join(resolved.appRoot,'theme.css'),css+'/* external */');
  const applied=applyPlan(resolved.appRoot,result);assert.equal(applied.ok,false);assert.equal(fs.readFileSync(resolved.file,'utf8'),resolved.source);
 }
});
test('supports escaped import paths, cyclic imports, queries, fragments and UTF-8 BOMs',t=>{
 const resolved=fixture(t,'<link rel="stylesheet" href="/a.css">',{'a.css':'\ufeff@charset "UTF-8"; @import "b\\20 c.css?x=1#part"; img{width:20px}','b c.css':'@import url(a.css); img{height:20px}'}),result=plan(resolved);assert.equal(result.linked,2);assert.ok(result.edits[1].after.startsWith('\ufeff'));assert.equal(result.edits[2].file,path.join(resolved.appRoot,'b c.css'));
});
test('skips template and non-CSS content and Retouch-owned styles',t=>{
 const source='<template><link rel="stylesheet" href="https://example.com/a.css"></template><style type="text/plain">not css</style><style data-rt-css="x">img{width:20px}</style><img>',resolved=fixture(t,source),result=plan(resolved);assert.equal(result.source,source);assert.equal(result.linked,0);assert.equal(result.inlineChanged,false);
});
test('missing, remote, integrity-bound, malformed and unsupported styles refuse planning without writes',t=>{
 for(const source of ['<link rel="stylesheet" href="missing.css">','<base href="https://example.com/"><link rel="stylesheet" href="a.css">','<style>@import "https://example.com/a.css";</style>','<link rel="stylesheet" integrity="sha256-x" href="/a.css">','<style>.frame:has(img + button){color:red}</style>','<style>img{','<style>@import bad;</style>','<style>@charset "latin1";</style>']){
  const resolved=fixture(t,source,{'a.css':'img{color:red}'});assert.throws(()=>plan(resolved));assert.equal(fs.readFileSync(resolved.file,'utf8'),source);assert.equal(fs.readFileSync(path.join(resolved.appRoot,'a.css'),'utf8'),'img{color:red}');
 }
});
test('rejects symlinks, encoded traversal, package files and invalid UTF-8',t=>{
 const resolved=fixture(t,'<link rel="stylesheet" href="/alias.css">',{'a.css':'img{color:red}'});fs.symlinkSync(path.join(resolved.appRoot,'a.css'),path.join(resolved.appRoot,'alias.css'));assert.throws(()=>plan(resolved),/symbolic link/);
 for(const href of ['/%2e%2e%2foutside.css','/node_modules/a.css','/bad%00.css'])assert.throws(()=>plan({...resolved,source:'<link rel="stylesheet" href="'+href+'">'}));
 fs.writeFileSync(path.join(resolved.appRoot,'a.css'),Buffer.from([0xff,0xfe]));assert.throws(()=>plan({...resolved,source:'<link rel="stylesheet" href="/a.css">'}));
});
test('bounds linked and inline stylesheet inputs',t=>{
 const resolved=fixture(t,'<link rel="stylesheet" href="/a.css">',{'a.css':' '.repeat(2*1024*1024+1)});assert.throws(()=>plan(resolved),/bounded/);assert.throws(()=>plan({...resolved,source:'<style>'+ ' '.repeat(2*1024*1024+1)+'</style>'}),/too large/);
});

test('an unchanged inline import requests preview refresh when its dependency changes',t=>{
 const resolved=fixture(t,'<style>@import \"/a.css\";</style><img>',{'a.css':'main > img{width:50%}'}),result=plan(resolved);assert.equal(result.inlineChanged,false);assert.equal(result.inlineRefresh,true);
});
