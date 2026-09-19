'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs'),{parse}=require('../src/capture-srcset.cjs');
function resolve(source){const elements=html.collect(source,'index.html').elements;return {source,elements,element:elements.find(el=>el.tag==='img'),hash:html.contentHash(source),file:'/site/index.html',relPath:'index.html'};}
function edit(source,change){const resolved=resolve(source);return html.planOp(resolved,{type:'setResponsiveImageCandidates',sourceIndex:0,fileHash:resolved.hash,...change});}
const original='<picture><source media="(max-width:600px)" srcset="a.svg 1x,  b.svg 2x"><source srcset="wide.svg 1x"><img src="fallback.svg"></picture>';
test('candidate add, resolution and removal retain source conditions, other candidates and exact snapshots',()=>{
 const add=edit(original,{action:'add',src:'c.svg',descriptor:'3x'});assert.equal(add.ok,true,add.reason);assert.equal(add.edits[0].after,original.replace('b.svg 2x','b.svg 2x, c.svg 3x'));assert.equal(add.edits[0].before,original);
 const changed=edit(original,{action:'descriptor',candidate:'0:1',descriptor:'3x'});assert.equal(changed.edits[0].after,original.replace('b.svg 2x','b.svg 3x'));
 assert.deepEqual(edit(original,{action:'descriptor',candidate:'0:1',descriptor:'2.0x'}).edits,[]);
 const first=edit(original,{action:'remove',candidate:'0:0'});assert.equal(first.edits[0].after,original.replace('a.svg 1x,',''));
 const last=edit(original,{action:'remove',candidate:'0:1'});assert.equal(last.edits[0].after,original.replace(',  b.svg 2x',''));
 const empty=edit(last.edits[0].after,{action:'remove',candidate:'0:0'});assert.equal(empty.ok,true,empty.reason);assert.equal(html.describe(resolve(empty.edits[0].after)).responsiveImage.sources[1].srcset,'');
 assert.equal(edit(empty.edits[0].after,{action:'add',src:'new.svg',descriptor:'640w'}).ok,true,'an empty source can switch descriptor kind');
});
test('candidate edits retain comma URLs, data images, malformed unrelated entries and descriptor whitespace',()=>{
 for(const value of ['a,b.svg 1x, data:image/png;base64,AAAA 2x','a,b.svg, data:image/png;base64,AAAA 2x','a.svg\t1x \n, invalid.svg nope, b.svg 2x']){
  const source='<img srcset="'+value+'">',before=parse(value),result=edit(source,{sourceIndex:-1,action:'descriptor',candidate:'-1:0',descriptor:'3x'});assert.equal(result.ok,true,result.reason);const after=html.describe(resolve(result.edits[0].after)).responsiveImage.sources[0].srcset,parsed=parse(after);assert.deepEqual(parsed.map(c=>c.url),before.map(c=>c.url));assert.deepEqual(parsed[0].descriptors,['3x']);assert.deepEqual(parsed[1],before[1]);
  if(value.includes('invalid'))assert.equal(after,value.replace('1x','3x'));
  const removed=edit(source,{sourceIndex:-1,action:'remove',candidate:'-1:0'});assert.equal(removed.ok,true,removed.reason);assert.deepEqual(parse(html.describe(resolve(removed.edits[0].after)).responsiveImage.sources[0].srcset),before.slice(1));
 }
 const height='<img srcset="a.svg 320w 240h, b.svg 640w">',changed=edit(height,{sourceIndex:-1,action:'descriptor',candidate:'-1:0',descriptor:'400w'});assert.equal(changed.edits[0].after,height.replace('320w','400w'));
});
test('candidate validation refuses ambiguous resolutions, stale revisions, foreign sources and malformed values',()=>{
 for(const descriptor of ['1x','2x','320w','-1x','0w','1.5w','Infinityx','1e999x','1x, evil 4x','1x 2x','2h',''])assert.equal(edit(original,{action:'add',src:'new.svg',descriptor}).ok,false,descriptor);
 for(const change of [{action:'descriptor',candidate:'0:1',descriptor:'1e0x'},{action:'descriptor',candidate:'fallback',descriptor:'3x'},{action:'remove',candidate:'1:0'},{action:'remove',candidate:'0:0',sourceIndex:2},{action:'add',src:'javascript:bad',descriptor:'3x'},{action:'add',src:'bad path.svg',descriptor:'3x'},{action:'add',src:'new.svg',descriptor:'3x',fileHash:'stale'},{action:'add',src:'new.svg',descriptor:'3x',sourceIndex:'0'}])assert.equal(edit(original,change).ok,false,JSON.stringify(change));
 const bare='<picture><source><img src="fallback.svg"></picture>',added=edit(bare,{action:'add',src:'a.svg?x=1&y=2',descriptor:'1x'});assert.equal(added.ok,true,added.reason);assert.match(added.edits[0].after,/srcset="a.svg\?x=1&amp;y=2 1x"/);
 assert.equal(edit('<img srcset="a.svg, b.svg 2x">',{sourceIndex:-1,action:'add',src:'c.svg',descriptor:'1x'}).ok,false,'implicit 1x conflicts with explicit 1x');
 assert.equal(edit('<img srcset="a.svg 320w, b.svg 2x">',{sourceIndex:-1,action:'remove',candidate:'-1:0'}).ok,true,'removal may repair a mixed set');
 const limit='<img srcset="'+Array.from({length:255},(_,i)=>'a'+i+'.svg '+(i+1)+'x').join(', ')+'">';assert.equal(edit(limit,{sourceIndex:-1,action:'add',src:'extra.svg',descriptor:'256x'}).ok,false);
});
test('srcset source spans stop before delimiters for bare URLs, whitespace and data images',()=>{
 for(const value of ['a.svg, b.svg 2x','a,b.svg 1x, data:image/png;base64,AAAA 2x','a.svg\t1x \n, b.svg 2x','a.svg'])for(const candidate of parse(value,{locations:true})){assert.equal(value.slice(candidate.start,candidate.end),candidate.url);assert.deepEqual(parse(value.slice(candidate.start,candidate.candidateEnd)),[{url:candidate.url,descriptors:candidate.descriptors}]);}
});
