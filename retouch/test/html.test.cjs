'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const html=require('../src/adapters/html.cjs'),{Index}=require('../src/indexer.cjs'),{SourceHistory}=require('../src/history.cjs');
const source='<!doctype html>\n<html><head><style>.title { color: red }</style><script>const x="<p>not markup</p>";</script></head><body>\n<!-- Keep -->\n<h1 class=title>A &amp; B</h1>\n<img src="old.png"><p>Keep <b>nested</b> text.</p>\n</body></html>';
function withDocument(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'retouch-html-'));try{const file=path.join(root,'index.html');fs.writeFileSync(file,source);const index=new Index(root,html);index.scanAll();return fn({root,file,index,resolve:tag=>{index.indexFile(file);const el=html.collect(fs.readFileSync(file,'utf8'),'index.html').elements.find(e=>e.tag===tag);return index.resolve(el.id);}});}finally{fs.rmSync(root,{recursive:true,force:true});}}
test('HTML parser stamps authored HTML only and leaves script, comments and source untouched',()=>{
 const elements=html.collect(source,'index.html').elements;
 assert.ok(!elements.some(e=>['script','style','b-not-markup'].includes(e.tag)));
 const stamped=html.stamp(source,'/site/index.html','/site');
 for(const el of elements)assert.ok(stamped.code.includes('data-rt="'+el.id+'"'));
 assert.ok(stamped.code.includes('<script>const x="<p>not markup</p>";</script>'));
 assert.ok(stamped.code.includes('<!-- Keep -->'));
 assert.equal(html.describe({element:elements.find(e=>e.tag==='h1'),source}).text,'A & B');
 assert.equal(require('../src/adapter.cjs').getAdapter('html'),html);
});
test('HTML edits preserve surrounding source and share exact transaction undo/redo',()=>withDocument(({root,file,resolve})=>{
 const history=new SourceHistory();const original=fs.readFileSync(file,'utf8');
 const h1=resolve('h1'),id=h1.element.id;
 const result=html.applyOp(h1,{type:'setText',text:'<new> & "quoted"',fileHash:h1.hash});assert.equal(result.ok,true);
 const token=history.record(result.edits),changed=fs.readFileSync(file,'utf8');
 assert.equal(changed,original.replace('A &amp; B','&lt;new&gt; &amp; "quoted"'));
 assert.equal(resolve('h1').element.id,id);
 assert.equal(history.apply(root,'undo',token,html).ok,true);assert.equal(fs.readFileSync(file,'utf8'),original);
 assert.equal(history.apply(root,'redo',token,html).ok,true);assert.equal(fs.readFileSync(file,'utf8'),changed);
}));
test('HTML class and image attribute writes escape markup and keep author CSS',()=>withDocument(({file,resolve})=>{
 assert.equal(html.applyOp(resolve('h1'),{type:'setClasses',classes:'title w-[240px] a"b'}).ok,true);
 assert.ok(fs.readFileSync(file,'utf8').includes('class="title w-[240px] a&quot;b"'));
 assert.ok(fs.readFileSync(file,'utf8').includes('.title { color: red }'));
 assert.equal(html.applyOp(resolve('img'),{type:'setSrc',src:'/photo.png?x=1&y=2'}).ok,true);
 assert.equal(html.describe(resolve('img')).src,'/photo.png?x=1&y=2');
 assert.equal(html.applyOp(resolve('img'),{type:'setSrc',src:'javascript:alert(1)'}).refused,true);
}));
test('HTML refuses nested text replacement, stale snapshots and parser-altering tag changes',()=>withDocument(({file,resolve})=>{
 assert.equal(html.applyOp(resolve('p'),{type:'setText',text:'replacement'}).refused,true);
 const old=resolve('h1');fs.appendFileSync(file,'\n<!-- external -->');
 assert.equal(html.applyOp(old,{type:'setText',text:'stale'}).refused,true);
 assert.equal(html.applyOp(resolve('h1'),{type:'setClasses',classes:'x',fileHash:'stale'}).refused,true);
 assert.equal(html.applyOp(resolve('h1'),{type:'setTag',tag:'h2'}).ok,true);
 assert.ok(fs.readFileSync(file,'utf8').includes('<h2 class=title>A &amp; B</h2>'));
 fs.writeFileSync(file,'<div><div>nested</div></div>');
 assert.equal(html.applyOp(resolve('div'),{type:'setTag',tag:'p'}).refused,true);
}));
test('HTML responsive images, SVG roots, unsupported SVG text, implicit tags and reserved stamps are handled explicitly',()=>{
 assert.equal(html.collect('<p class=first class=second>ambiguous</p>','page.html').elements.length,0);
 const text='<p>implicit<p>next</p><picture><img src="a.png"></picture><svg><text>x</text></svg><div data-rt="old">yes</div>';
 const els=html.collect(text,'page.html').elements;
 assert.equal(html.describe({element:els.find(e=>e.tag==='p'),source:text}).text,null);
 assert.equal(html.describe({element:els.find(e=>e.tag==='img'),source:text}).canSetSrc,false);
 assert.ok(els.some(e=>e.tag==='svg'));assert.ok(!els.some(e=>e.tag==='text'));
 const stamped=html.stamp(text,'page.html').code;assert.ok(!stamped.includes('data-rt="old"'));
});

// Layer names are design metadata; page text and accessibility remain authored.
test('HTML layer names preserve semantics and escape source markup',()=>{
 const source='<html><body><h1 aria-label="Heading">Visible title</h1></body></html>',elements=html.collect(source,'index.html').elements;
 const resolved={source,file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(source),elements,element:elements.find(e=>e.tag==='h1')};
 const result=html.planOp(resolved,{type:'renameElement',name:'Hero & "title"'});assert.equal(result.ok,true);
 assert.ok(result.edits[0].after.includes('data-rt-name="Hero &amp; &quot;title&quot;"'));
 assert.ok(result.edits[0].after.includes('aria-label="Heading">Visible title</h1>'));
 assert.equal(html.planOp(resolved,{type:'renameElement',name:'Bad\nname'}).refused,true);
});
