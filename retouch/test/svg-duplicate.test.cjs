'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs'),duplicate=require('../src/svg-duplicate.cjs'),css=require('../src/html-css.cjs');
const original='<html><head></head><body><svg><g><rect width="40" height="20"/><!--keep--><circle r="10"/></g><line x2="40"/></svg><p>After</p></body></html>';
function resolve(source=original,tag='rect'){const elements=html.collect(source,'index.html').elements;return {source,elements,element:elements.find(e=>e.tag===tag),file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(source)};}
test('SVG duplication copies primitive, group and canvas source while preserving existing content',()=>{
 for(const tag of ['rect','g','svg']){const r=resolve(original,tag),result=duplicate.plan(r,{fileHash:r.hash});assert.equal(result.ok,true,result.reason);const {startOffset:start,endOffset:end}=r.element.location;assert.equal(result.edits[0].after,original.slice(0,end)+original.slice(start,end)+original.slice(end));const fresh=resolve(result.edits[0].after);assert.ok(fresh.elements.some(e=>e.id===result.createdId&&e.tag===tag));}
});
test('SVG duplicate remaps independent managed paint identities and copies every breakpoint',()=>{
 let r=resolve();for(const [width,fill]of [[0,'red'],[768,'blue']])r=resolve(css.plan(r,{width,property:'fill',value:fill}).edits[0].after);
 const group=resolve(r.source,'g'),result=duplicate.plan(group,{fileHash:group.hash});assert.equal(result.ok,true,result.reason);
 const fresh=resolve(result.edits[0].after),rects=fresh.elements.filter(e=>e.tag==='rect'),one={...fresh,element:rects[0]},two={...fresh,element:rects[1]};
 assert.notEqual(rects[0].node.attrs.find(a=>a.name==='data-rt-style').value,rects[1].node.attrs.find(a=>a.name==='data-rt-style').value);assert.deepEqual(css.describe(one).cssRules,css.describe(two).cssRules);
 const edited=css.plan(two,{width:768,property:'fill',value:'green'});assert.equal(edited.ok,true);const changed=resolve(edited.edits[0].after);assert.deepEqual(css.describe(changed).cssRules,{0:{fill:'red'},768:{fill:'blue'}});
});
test('SVG duplicate refuses identity collisions, templates, unsupported descendants and stale writes',()=>{
 for(const [source,tag]of [[original.replace('<rect ','<rect id="box" '),'g'],[original.replace('<g>','<g v-if="shown">'),'rect'],[original.replace('<g>','<g><text>Hello</text>'),'g']]){const r=resolve(source,tag);assert.equal(duplicate.describe(r),null);assert.equal(duplicate.plan(r,{fileHash:r.hash}).refused,true);}
 const r=resolve();assert.equal(duplicate.plan(r,{fileHash:'stale'}).refused,true);assert.equal(duplicate.plan(r,{}).refused,true);
});

test('SVG duplication maps originals without assigning their identities to copies',()=>{
 const markup='<main><svg><rect/><g><circle/><ellipse/></g><line/></svg><p>After</p></main>',source=markup;
 for(const tag of ['rect','g','svg']){
  const r=resolve(source,tag),result=duplicate.plan(r,{fileHash:r.hash});assert.equal(result.ok,true,result.reason);
  const fresh=html.collect(result.edits[0].after,r.relPath).elements,mapping=new Map(result.sourceIdMap),originalIds=r.elements.map(e=>mapping.get(e.id)||e.id);assert.equal(new Set(originalIds).size,r.elements.length);assert.ok(!originalIds.includes(result.createdId));
  for(const element of r.elements){const next=fresh.find(e=>e.id===(mapping.get(element.id)||element.id));assert.ok(next);assert.equal(next.tag,element.tag);}
 }
});
