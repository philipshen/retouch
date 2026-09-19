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
 const result=plan(resolved);assert.equal(result.linked,3);assert.equal(result.inlineChanged,true);assert.equal(result.edits.length,7);assert.ok(result.source.includes('data-rt-picture'));assert.deepEqual(result.edits.slice(1,4).map(edit=>path.relative(resolved.appRoot,edit.file)),['assets/main.css','assets/extra.css','assets/nested/child.css']);
 for(const edit of result.edits){if(edit.before===null){assert.equal(fs.existsSync(edit.file),false);assert.ok(edit.after.includes('data-rt-picture'));}else assert.equal(fs.readFileSync(edit.file,'utf8'),edit.before);}for(const edit of result.edits.slice(1,4))assert.equal(edit.after,edit.before);
 assert.ok(result.edits[4].after.includes('background:url(missing.png)'));assert.ok(result.edits[4].after.includes('layer(theme) screen'));
});
test('combines a structural HTML edit and stylesheet snapshots in one transaction with exact undo',t=>{
 const source='<link rel="stylesheet" href="/theme.css"><style>main > img{height:40px}</style><main><img></main>',resolved=fixture(t,source,{'theme.css':'main > img{width:50%}'}),html=require('../src/adapters/html.cjs'),elements=html.collect(source,resolved.relPath).elements,result=html.planOp({...resolved,elements,element:elements.find(element=>element.tag==='img'),hash:html.contentHash(source)},{type:'setPictureSources',action:'add',src:'phone.svg',fileHash:html.contentHash(source)}),applied=applyPlan(resolved.appRoot,result);
 assert.equal(applied.ok,true,applied.reason);assert.equal(applied.edits.length,2);assert.equal(result.authorStyles,true);assert.equal(result.revalidateStyles,true);assert.ok(fs.readFileSync(resolved.file,'utf8').includes('<picture'));
 const undone=applyPlan(resolved.appRoot,{ok:true,edits:applied.edits.map(edit=>({...edit,before:edit.after,after:edit.before}))});assert.equal(undone.ok,true,undone.reason);for(const edit of applied.edits.filter(edit=>edit.before===null))assert.equal(fs.existsSync(edit.file),false);assert.equal(fs.readFileSync(resolved.file,'utf8'),source);assert.equal(fs.readFileSync(path.join(resolved.appRoot,'theme.css'),'utf8'),'main > img{width:50%}');
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
test('missing, remote, integrity-mismatched, malformed and unsupported styles refuse planning without writes',t=>{
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

test('inline imports redirect to isolated dependencies and request preview refresh',t=>{
 const resolved=fixture(t,'<style>@import \"/a.css\";</style><img>',{'a.css':'main > img{width:50%}'}),result=plan(resolved);assert.equal(result.inlineChanged,true);assert.equal(result.inlineRefresh,true);assert.match(result.source,/a\.css\.retouch-[a-f0-9]+\.css/);
});

test('isolates a cyclic graph and leaves shared originals and other pages byte-identical',t=>{
 const resolved=fixture(t,'<link rel="stylesheet" href="/a.css">',{'a.css':'@import "b.css"; img{color:red}','b.css':'@import "a.css"; main > img{width:50%}','other.html':'<link rel="stylesheet" href="a.css">'}),result=plan(resolved),copies=result.edits.filter(edit=>edit.before===null);assert.equal(copies.length,2);assert.ok(copies.every(edit=>edit.after.includes('.retouch-')));assert.equal(applyPlan(resolved.appRoot,result).ok,true);assert.equal(fs.readFileSync(path.join(resolved.appRoot,'a.css'),'utf8'),'@import "b.css"; img{color:red}');assert.equal(fs.readFileSync(path.join(resolved.appRoot,'other.html'),'utf8'),'<link rel="stylesheet" href="a.css">');
});
test('updates stylesheet and preload integrity using verified originals and isolated final bytes',t=>{
 const hash=text=>require('node:crypto').createHash('sha384').update(text).digest('base64'),css='main > img{width:50%}',source='<link rel="preload" as="style" href="/a.css?v=1" integrity="sha384-'+hash(css)+'"><link rel="stylesheet" href="/a.css?v=1" integrity="sha384-'+hash(css)+'" crossorigin="anonymous">',resolved=fixture(t,source,{'a.css':css}),result=plan(resolved),copy=result.edits.find(edit=>edit.before===null);assert.ok(copy);assert.equal(result.source.split('sha384-'+hash(copy.after)).length,3);assert.equal(result.source.split(path.basename(copy.file)+'?v=1').length,3);assert.ok(result.source.includes('crossorigin="anonymous"'));assert.equal(fs.readFileSync(path.join(resolved.appRoot,'a.css'),'utf8'),css);
 const mismatch=fixture(t,source,{'a.css':css+'/* external */'});assert.throws(()=>plan(mismatch),/strongest integrity/);assert.equal(fs.readFileSync(mismatch.file,'utf8'),source);
});
test('generated stylesheet collisions and duplicate link attributes refuse without overwriting files',t=>{
 const resolved=fixture(t,'<link rel="stylesheet" href="/a.css">',{'a.css':'main > img{width:50%}'}),result=plan(resolved),copy=result.edits.find(edit=>edit.before===null);fs.writeFileSync(copy.file,'unrelated');assert.throws(()=>plan(resolved),/different content/);assert.equal(fs.readFileSync(copy.file,'utf8'),'unrelated');assert.throws(()=>plan({...resolved,source:'<link rel="stylesheet" href="/a.css" href="/b.css">'}),/ambiguous/);
});

test('reuse preserves preexisting generated files and stale creation paths refuse all writes',t=>{
 const resolved=fixture(t,'<link rel="stylesheet" href="/a.css">',{'a.css':'main > img{width:50%}'}),initial=plan(resolved),copy=initial.edits.find(edit=>edit.before===null);fs.writeFileSync(copy.file,copy.after);assert.equal(applyPlan(resolved.appRoot,initial).ok,false);assert.equal(fs.readFileSync(resolved.file,'utf8'),resolved.source);
 const next=plan(resolved),applied=applyPlan(resolved.appRoot,next);assert.equal(applied.ok,true,applied.reason);assert.equal(applied.edits.length,1);assert.equal(applyPlan(resolved.appRoot,{ok:true,edits:applied.edits.map(edit=>({...edit,before:edit.after,after:edit.before}))}).ok,true);assert.equal(fs.readFileSync(copy.file,'utf8'),copy.after);
});
test('distinct filenames sharing a stem produce distinct isolated stylesheets',t=>{
 const resolved=fixture(t,'<link rel="stylesheet" href="/a.css"><link rel="stylesheet" href="/a.other">',{'a.css':'main > img{width:50%}','a.other':'main > img{height:40px}'}),result=plan(resolved),copies=result.edits.filter(edit=>edit.before===null);assert.equal(copies.length,2);assert.notEqual(copies[0].file,copies[1].file);assert.equal(applyPlan(resolved.appRoot,result).ok,true);
});
