'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs');
const original='<html><body><!--keep--><picture><source media="(min-width:600px)" type="image/webp" srcset="wide.webp 1x,  wide2.webp 2x"><source media="(max-width:599px)" srcset="phone.webp 1x, phone2.webp 2x"><img alt="Photo" src="fallback.png" sizes="100vw" srcset="small.png 320w, large.png 640w"></picture><p>Keep</p></body></html>';
function resolve(source=original){const elements=html.collect(source,'index.html').elements;return {source,elements,element:elements.find(el=>el.tag==='img'),hash:html.contentHash(source),file:'/site/index.html',relPath:'index.html'};}
test('responsive image editing changes one source URL and preserves descriptors, conditions and surrounding HTML',()=>{
 const resolved=resolve(),info=html.describe(resolved);assert.equal(info.canSetSrc,false);assert.equal(info.responsiveImage.candidates.length,7);
 const result=html.planOp(resolved,{type:'setResponsiveImage',candidate:'1:1',src:'new.webp',fileHash:resolved.hash});assert.equal(result.ok,true,result.reason);assert.equal(result.edits[0].after,original.replace('phone2.webp','new.webp'));
 const primary=html.planOp(resolved,{type:'setResponsiveImage',candidate:'-1:0',src:'other.png',fileHash:resolved.hash});assert.equal(primary.edits[0].after,original.replace('small.png','other.png'));
 assert.deepEqual(html.planOp(resolved,{type:'setResponsiveImage',candidate:'fallback',src:'fallback.png',fileHash:resolved.hash}).edits,[]);
});
test('responsive image editing rejects stale, ambiguous and unsafe targets',()=>{
 const resolved=resolve();for(const changes of [{fileHash:'stale'},{fileHash:undefined},{candidate:'9:0'},{src:'javascript:bad'},{src:'file:///secret'},{src:'unencoded image.png'},{src:'a,'}])assert.equal(html.planOp(resolved,{type:'setResponsiveImage',candidate:'1:1',src:'new.png',fileHash:resolved.hash,...changes}).ok,false);
 for(const source of [original.replace('type="image/webp"','type="image/webp" srcset="duplicate.webp"'),original.replace('</picture>','<img src="extra.png"></picture>')])assert.ok(html.describe(resolve(source)).responsiveImage.reason);
});
test('responsive images without src can acquire a fallback without changing their candidate list',()=>{
 const source='<img srcset="data:image/png;base64,AAAA 1x, high.png 2x">',resolved=resolve(source),result=html.planOp(resolved,{type:'setResponsiveImage',candidate:'fallback',src:'/fallback.png',fileHash:resolved.hash});assert.equal(result.ok,true,result.reason);assert.equal(result.edits[0].after,'<img src="/fallback.png" srcset="data:image/png;base64,AAAA 1x, high.png 2x">');
});
