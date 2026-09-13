'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),adapter=require('../src/adapters/liquid.cjs');
function resolve(source,tag){const relPath='sections/main.liquid',elements=adapter.collect(source,relPath).elements;return {source,relPath,file:'/tmp/sections/main.liquid',elements,element:elements.find(e=>e.tag===tag),hash:adapter.contentHash(source)};}
function insert(r,op){return adapter.planOp(r,{type:'insertSVG',fileHash:r.hash,...op});}
test('Liquid shapes create selectable SVG canvases and preserve Liquid bindings and sibling identities',()=>{
 for(const tag of ['main','svg','g'])for(const preset of ['rectangle','circle','ellipse','line']){
  const source='<main>{{ title }}<svg viewBox="50 100 20 10"><g>{% if visible %}<circle r="{{ radius }}"/>{% endif %}</g></svg></main><aside>Keep</aside>',r=resolve(source,tag),result=insert(r,{preset});
  assert.equal(result.ok,true,result.reason);const after=result.edits[0].after,next=adapter.collect(after,r.relPath).elements,created=next.find(e=>e.id===result.createdId);
  assert.equal(created.parent.tag,tag==='main'?'svg':tag);assert.equal(next.length,r.elements.length+(tag==='main'?2:1));
  for(const old of r.elements)assert.ok(next.some(e=>e.id===old.id&&e.tag===old.tag));
  assert.ok(after.includes('{{ title }}'));assert.ok(after.includes('{% if visible %}<circle r="{{ radius }}"/>{% endif %}'));assert.ok(after.endsWith('<aside>Keep</aside>'));
  if(tag!=='main'&&preset==='rectangle')assert.match(after,/<rect x="52" y="101" width="16" height="6"/);
  const stamped=adapter.stamp(after,r.file,'/tmp').code;assert.ok(stamped.includes('<svg data-rt="'));assert.ok(stamped.includes('data-rt="'+created.id+'"'));
 }
});
test('Liquid drawn vectors and curved paths retain their coordinates and editable geometry',()=>{
 const r=resolve('<svg><g transform="translate(20 30) scale(2)"></g></svg>','g');
 for(const op of [{preset:'rectangle',points:[70,60,10,20]},{preset:'polygon',points:[0,0,20,10,5,30]},{preset:'polyline',points:[0,0,20,10]},{preset:'path',nodes:[{x:0,y:0,out:{x:10,y:0}},{x:20,y:20,in:{x:20,y:10}}],closed:false}]){
  const result=insert(r,op);assert.equal(result.ok,true,result.reason);const after=result.edits[0].after,next=resolve(after,'g'),element=next.elements.find(e=>e.id===result.createdId);
  assert.ok(adapter.describe({...next,element}).svgGeometry);assert.ok(after.includes('transform="translate(20 30) scale(2)"'));assert.equal(result.edits[0].before,r.source);
 }
});
test('Liquid SVG insertion refuses ambiguous branches, client children bindings, stale writes and invalid geometry',()=>{
 for(const [source,tag]of [['<svg/>','svg'],['<svg>{% if visible %}</svg>{% endif %}','svg'],['{% if visible %}<svg>{% endif %}</svg>','svg'],['<svg><g>{% else %}</g></svg>','g'],['<svg><g x-html="value"></g></svg>','g'],['<svg v-for="item in items"><g></g></svg>','g'],['<svg><foreignObject><g></g></foreignObject></svg>','g'],['<main><svg><rect/></svg></main>','rect']]){
  const r=resolve(source,tag);assert.equal(adapter.describe(r).svgInsertion,null,source);assert.equal(insert(r,{preset:'circle'}).refused,true,source);
 }
 const r=resolve('<svg><g></g></svg>','g');for(const op of [{preset:'circle',fileHash:'stale'},{preset:'rectangle',points:[0,0,0,0]},{preset:'polygon',points:[0,0,1,1]},{preset:'path',nodes:[]},{preset:'script'},{preset:'line',points:[0,0,'" onload="x',10]}]){const result=insert(r,op);assert.equal(result.refused,true);assert.equal(result.edits,undefined);}
});
