'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs');
const original='<html><head><style>.title{color:red}</style></head><body><h1 class="title">First</h1><h1 class="title">Second</h1></body></html>';
function resolve(source){return {source,file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(source),element:html.collect(source,'index.html').elements.find(e=>e.tag==='h1')};}
function edit(source,width,value,property='width'){return css.plan(resolve(source),{width,value,property});}
test('HTML CSS stores isolated rules in ascending breakpoint order and resets individual properties',()=>{
 let source=edit(original,768,'320px').edits[0].after;
 source=edit(source,0,'240px').edits[0].after;
 assert.ok(source.indexOf('data-rt-width="0"')<source.indexOf('data-rt-width="768"'));
 assert.ok(source.includes('<style>.title{color:red}</style>'));
 assert.ok(source.includes('<h1 class="title">Second</h1>'));
 assert.equal((source.match(/data-rt-style="[a-f0-9]+" class=/g)||[]).length,1);
 assert.deepEqual(css.describe(resolve(source)).cssRules,{0:{width:'240px'},768:{width:'320px'}});
 source=edit(source,768,'red','color').edits[0].after;
 source=edit(source,768,null).edits[0].after;
 assert.deepEqual(css.describe(resolve(source)).cssRules,{0:{width:'240px'},768:{color:'red'}});
 source=edit(source,768,null,'color').edits[0].after;
 assert.ok(!source.includes('data-rt-width="768"'));
 assert.deepEqual(html.collect(source,'index.html').elements.map(e=>e.id),html.collect(original,'index.html').elements.map(e=>e.id));
});
test('HTML CSS refuses injection, stale writes, conflicting identities and modified managed CSS',()=>{
 for(const value of ['2px;color:red','</style>','url(https://example.com)','var(--x)'])assert.equal(edit(original,0,value).refused,true);
 assert.equal(css.plan(resolve(original),{width:0,value:'2px',property:'width',fileHash:'stale'}).refused,true);
 assert.equal(edit(original.replace('class="title"','style="width: 3px !important"'),0,'4px').refused,true);
 const source=edit(original,0,'240px').edits[0].after;
 assert.equal(edit(source.replace('width:240px','width:250px'),0,'260px').refused,true);
 const marker=/data-rt-style="[a-f0-9]+"/.exec(source)[0];
 assert.equal(edit(source.replace('<h1 class=',`<h1 ${marker} class=`),0,'260px').refused,true);
});

test('HTML CSS reset without an override is inert and refuses an identity owned elsewhere',()=>{
 assert.deepEqual(edit(original,0,null).edits,[]);
 const id=resolve(original).element.id;
 assert.equal(edit(original.replace('<h1 class="title">Second',`<h1 data-rt-style="${id}" class="title">Second`),0,'200px').refused,true);
});
