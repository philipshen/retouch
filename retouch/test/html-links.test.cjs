'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),adapter=require('../src/adapters/html.cjs');
function resolve(source,tag='a'){return {source,relPath:'index.html',file:'/tmp/index.html',hash:adapter.contentHash(source),element:adapter.collect(source,'index.html').elements.find(e=>e.tag===tag)};}
test('HTML link destinations preserve children, attributes and source identities with escaped URLs',()=>{
 const source='<a HREF="/old" target="_blank" onclick="click()"><strong>Docs</strong> now</a><p>Other</p>',r=resolve(source),href='/docs?x="a"&q={literal}',result=adapter.planOp(r,{type:'setHref',fileHash:r.hash,href});
 assert.equal(result.ok,true,result.reason);const next=result.edits[0].after;assert.ok(next.includes('href="/docs?x=&quot;a&quot;&amp;q={literal}"'));assert.ok(next.endsWith(source.slice(source.indexOf(' target='))));assert.equal(adapter.describe(resolve(next)).href,href);
 assert.deepEqual(adapter.collect(next,'index.html').elements.map(e=>e.id),adapter.collect(source,'index.html').elements.map(e=>e.id));
 const changed=resolve(next),removed=adapter.planOp(changed,{type:'setHref',fileHash:changed.hash,href:null});assert.equal(removed.ok,true,removed.reason);assert.equal(adapter.describe(resolve(removed.edits[0].after)).href,null);assert.ok(removed.edits[0].after.includes('<strong>Docs</strong>'));
});
test('HTML links refuse unsafe URLs, wrong elements and stale writes',()=>{
 const r=resolve('<a>Docs</a>');for(const href of ['javascript:alert(1)','data:text/html,hello','\nhttps://example.com'])assert.equal(adapter.planOp(r,{type:'setHref',fileHash:r.hash,href}).refused,true);
 assert.equal(adapter.planOp(r,{type:'setHref',fileHash:'stale',href:'/new'}).refused,true);
 const p=resolve('<p>Text</p>','p');assert.equal(adapter.planOp(p,{type:'setHref',fileHash:p.hash,href:'/new'}).refused,true);
 assert.equal(adapter.collect('<a href="/one" HREF="/two">Docs</a>','index.html').elements.filter(e=>e.tag==='a').length,0);
});
