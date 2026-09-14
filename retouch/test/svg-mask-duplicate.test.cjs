'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
for(const renderer of ['html','jsx']){
 const jsx=renderer==='jsx',adapter=require(jsx?'../src/id.cjs':'../src/adapters/html.cjs'),mask=require(jsx?'../src/jsx-svg-mask.cjs':'../src/html-svg-mask.cjs'),duplicate=require(jsx?'../src/jsx-svg-duplicate.cjs':'../src/svg-duplicate.cjs');
 const resolve=(source,predicate)=>{const elements=(jsx?adapter.collectElements:adapter.collect)(source,'art.'+renderer).elements;return {source,elements,element:elements.find(predicate),file:'/tmp/art.'+renderer,relPath:'art.'+renderer,hash:adapter.contentHash(source)};};
 const tag=e=>jsx?adapter.jsxElementName(e.node):e.tag;
 function fixture(){const source=jsx?'export default function Art(){return <main><svg><circle r="10"/><rect width="40" height="40"/></svg></main>}':'<main><svg><circle r="10"/><rect width="40" height="40"/></svg></main>';const r=resolve(source,e=>tag(e)==='circle'),created=mask.plan(r,{type:'createSVGMask',fileHash:r.hash,ids:r.elements.filter(e=>['circle','rect'].includes(tag(e))).map(e=>e.id),maskId:r.element.id});assert.equal(created.ok,true,created.reason);return resolve(created.edits[0].after,e=>e.id===created.selectionIds[0]);}
 test(renderer+' mask copies own independent references and can edit and release independently',()=>{
  for(const wholeCanvas of [false,true]){
   let r=fixture();if(wholeCanvas)r=resolve(r.source,e=>tag(e)==='svg');
   const copied=duplicate.plan(r,{fileHash:r.hash});assert.equal(copied.ok,true,copied.reason);
   const source=copied.edits[0].after,identities=[...source.matchAll(/id="(rt-mask-[a-f0-9]{16})"/g)].map(m=>m[1]);assert.equal(new Set(identities).size,2);for(const id of identities)assert.equal(source.split(id).length,3);
   const parsed=resolve(source,e=>e.id===copied.createdId),groups=parsed.elements.filter(e=>mask.describe({...parsed,element:e})?.canRelease);assert.equal(groups.length,2);
   const edited=mask.plan({...parsed,element:groups[1]},{type:'setSVGMaskType',fileHash:parsed.hash,mode:'luminance'});assert.equal(edited.ok,true,edited.reason);
   const updated=resolve(edited.edits[0].after,e=>e.id===groups[1].id);assert.equal(mask.describe({...updated,element:updated.elements.find(e=>e.id===groups[0].id)}).mode,'alpha');
   const released=mask.plan(updated,{type:'releaseSVGMask',fileHash:updated.hash});assert.equal(released.ok,true,released.reason);assert.ok(released.edits[0].after.includes(identities[0]));assert.ok(!released.edits[0].after.includes(identities[1]));
   assert.equal(copied.edits[0].before,r.source);assert.equal(duplicate.plan(r,{fileHash:'stale'}).refused,true);
  }
 });
 test(renderer+' mask duplication refuses externally referenced or modified definitions',()=>{
  const r=fixture(),id=r.source.match(/id="(rt-mask-[a-f0-9]{16})"/)[1];
  for(const source of [r.source.replace('</svg>','<g mask="url(#'+id+')"></g></svg>'),r.source.replace('<mask ','<mask class="custom" ')]){const invalid=resolve(source,e=>e.id===r.element.id);assert.equal(duplicate.describe(invalid),null);}
 });
}
