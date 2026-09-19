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

test('responsive source settings change only the chosen source atomically',()=>{
 const resolved=resolve(),op={type:'setResponsiveImageSource',sourceIndex:1,fileHash:resolved.hash,changes:{media:'(min-width: 400px) and (max-width: 900px)',sizes:'(max-width: 500px) 100vw, 50vw',type:'image/webp'}};
 const result=html.planOp(resolved,op);assert.equal(result.ok,true,result.reason);
 const after=result.edits[0].after,parsed=resolve(after),info=html.describe(parsed).responsiveImage;
 assert.deepEqual(info.sources[2],{index:1,src:null,srcset:'phone.webp 1x, phone2.webp 2x',media:op.changes.media,sizes:op.changes.sizes,type:'image/webp'});
 assert.deepEqual(info.sources.slice(0,2),html.describe(resolved).responsiveImage.sources.slice(0,2));
 assert.ok(after.includes('<p>Keep</p>'));assert.ok(after.includes('<!--keep-->'));
 assert.deepEqual(html.planOp(parsed,{...op,fileHash:parsed.hash}).edits,[],'unchanged settings preserve bytes');
 const removed=html.planOp(parsed,{...op,fileHash:parsed.hash,changes:{media:null,sizes:null,type:null}});assert.equal(removed.ok,true,removed.reason);assert.equal(html.describe(resolve(removed.edits[0].after)).responsiveImage.sources[2].media,null);
 const fallback=html.planOp(resolved,{...op,sourceIndex:-1,changes:{sizes:'50vw'}});assert.equal(fallback.edits[0].after,original.replace('sizes="100vw"','sizes="50vw"'));
});
test('responsive source settings reject stale, foreign and ambiguous edits and escape literal attributes',()=>{
 const resolved=resolve(),op={type:'setResponsiveImageSource',sourceIndex:0,fileHash:resolved.hash,changes:{media:'(max-width: 900px)'}};
 for(const changes of [{fileHash:'old'},{fileHash:null},{sourceIndex:'0'},{sourceIndex:-2},{sourceIndex:2},{changes:{}},{changes:[]},{changes:{src:'other.png'}},{changes:{onload:'bad'}},{sourceIndex:-1},{changes:{media:42}},{changes:{media:'x'.repeat(4097)}},{changes:{media:'\u0000'}}])assert.equal(html.planOp(resolved,{...op,...changes}).ok,false,JSON.stringify(changes));
 for(const source of [original.replace('type="image/webp"','media="duplicate" type="image/webp"'),original.replace('</picture>','<img src="extra.png"></picture>')]){const r=resolve(source);assert.equal(html.planOp(r,{...op,fileHash:r.hash}).ok,false);}
 const injected='screen" onload="x<&',result=html.planOp(resolved,{...op,changes:{media:injected}});assert.equal(result.ok,true,result.reason);const node=resolve(result.edits[0].after).element.node.parentNode.childNodes[0];assert.equal(node.attrs.find(a=>a.name==='media').value,injected);assert.equal(node.attrs.some(a=>a.name==='onload'),false);
});
