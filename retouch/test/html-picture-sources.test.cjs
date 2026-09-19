'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs');
function resolve(source,id){const elements=html.collect(source,'index.html').elements;return {source,elements,element:elements.find(element=>id?element.id===id:element.tag==='img'),hash:html.contentHash(source),file:'/site/index.html',relPath:'index.html'};}
function edit(source,changes){const resolved=resolve(source);return html.planOp(resolved,{type:'setPictureSources',action:'add',src:'phone.svg',media:'(max-width: 600px)',fileHash:resolved.hash,...changes});}
test('picture creation wraps only the image, remaps it and preserves surrounding nodes and source bytes',()=>{
 for(const source of ['<main><input value="Keep"><img src="fallback.svg" style="width:50%"><p>Keep</p></main>','<img src="fallback.svg">']){
  const before=resolve(source),result=edit(source,{});assert.equal(result.ok,true,result.reason);const after=result.edits[0].after,next=resolve(after,result.imageId);assert.equal(next.element.tag,'img');assert.equal(next.element.node.parentNode.tagName,'picture');assert.equal(html.describe(next).responsiveImage.sources[1].media,'(max-width: 600px)');assert.equal(after.replace('<picture data-rt-picture="" style="display: contents"><source style="display: none" srcset="phone.svg 1x" media="(max-width: 600px)">','').replace('</picture>',''),source);assert.ok(result.sourceIdMap.some(([old,id])=>old===before.element.id&&id===result.imageId));
  const removed=edit(after,{action:'remove',sourceIndex:0});assert.equal(removed.ok,true,removed.reason);assert.equal(removed.edits[0].after,source);assert.equal(removed.imageId,before.element.id);assert.equal(removed.removedSourceIds.length,2);
 }
});
test('source insertion, priority changes and deletion preserve existing pictures and every unrelated node',()=>{
 const source='<main><picture class="art"><!-- Keep --><source srcset="one.svg 1x"><source srcset="two.svg 1x"><img src="fallback.svg"><!-- tail --></picture><p>Keep</p></main>',added=edit(source,{index:1,src:'middle.svg',media:'(min-width:700px)',sourceType:'image/webp',sizes:'50vw',descriptor:'640w'});assert.equal(added.ok,true,added.reason);const after=added.edits[0].after;assert.match(after,/one.svg 1x"><source style="display: none" srcset="middle.svg 640w" media="\(min-width:700px\)" type="image\/webp" sizes="50vw"><source srcset="two.svg/);
 const moved=edit(after,{action:'move',sourceIndex:1,destinationIndex:0});assert.equal(moved.ok,true,moved.reason);const info=html.describe(resolve(moved.edits[0].after,moved.imageId)).responsiveImage;assert.deepEqual(info.sources.slice(1).map(s=>s.srcset),['middle.svg 640w','one.svg 1x','two.svg 1x']);assert.ok(moved.edits[0].after.includes('<!-- Keep -->'));assert.ok(moved.edits[0].after.includes('<!-- tail -->'));
 const back=edit(moved.edits[0].after,{action:'move',sourceIndex:0,destinationIndex:1});assert.equal(back.ok,true,back.reason);assert.equal(back.edits[0].after,after);
 const removed=edit(after,{action:'remove',sourceIndex:1});assert.equal(removed.ok,true,removed.reason);assert.equal(removed.edits[0].after,source);
 const last='<picture class="art"><source srcset="one.svg 1x"><img src="fallback.svg"></picture>',empty=edit(last,{action:'remove',sourceIndex:0});assert.equal(empty.ok,true,empty.reason);assert.equal(empty.edits[0].after,'<picture class="art"><img src="fallback.svg"></picture>');
});
test('picture source authoring refuses stale, ambiguous and templated markup and unsafe fields',()=>{
 const source='<img src="fallback.svg">';for(const change of [{fileHash:'stale'},{fileHash:null},{src:'javascript:bad'},{src:'unencoded image.svg'},{descriptor:'1x 2x'},{descriptor:'1x, evil 2x'},{media:42},{media:'a'.repeat(4097)},{action:'remove',sourceIndex:0},{index:1},{index:'0'}])assert.equal(edit(source,change).ok,false,JSON.stringify(change));
 for(const value of ['<picture><source srcset="a.svg" srcset="b.svg"><img></picture>','<picture><img><img></picture>','<div v-if="visible"><img></div>','<picture><div><img></div></picture>'])assert.equal(edit(value,{}).ok,false,value);
 const injected=edit(source,{media:'screen" onload="bad<&'});assert.equal(injected.ok,true,injected.reason);const info=html.describe(resolve(injected.edits[0].after,injected.imageId));assert.equal(info.responsiveImage.sources[1].media,'screen" onload="bad<&');assert.doesNotMatch(injected.edits[0].after,/ onload="/);
});

test('last-source removal retains author changes on generated picture wrappers',()=>{
 const initial=edit('<img src="fallback.svg">',{}).edits[0].after,authored=initial.replace('data-rt-picture=""','data-rt-picture="" class="custom"'),removed=edit(authored,{action:'remove',sourceIndex:0});assert.equal(removed.ok,true,removed.reason);assert.ok(removed.edits[0].after.includes('<picture data-rt-picture="" class="custom"'));assert.equal(removed.removedSourceIds.length,1);assert.deepEqual(removed.createdSourceIds,[]);
});
