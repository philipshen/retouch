'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const html=require('../src/adapters/html.cjs'),css=require('../src/html-css.cjs'),linked=require('../src/html-text-styles.cjs');
const original='<html><head></head><body><h1>Title</h1><p>Body</p></body></html>';
const style={id:'11111111-1111-4111-8111-111111111111',name:'Heading',properties:{'font-size':'32px','font-weight':'700','font-family':'"Geist", sans-serif'}};
const resolve=source=>({source,file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(source),element:html.collect(source,'index.html').elements.find(e=>e.tag==='h1')});
const apply=(source,width=0)=>linked.plan(resolve(source),{type:'applyTextStyle',width},style);
test('linked typography writes source declarations and durable per-screen references in one edit',()=>{
 const base=apply(original);assert.equal(base.ok,true);assert.equal(base.edits.length,1);assert.equal(base.edits[0].before,original);
 const after=apply(base.edits[0].after,768).edits[0].after,r=resolve(after);
 assert.deepEqual(css.describe(r).cssRules,{0:style.properties,768:style.properties});
 assert.deepEqual(linked.links(r),{0:{id:style.id,properties:style.properties},768:{id:style.id,properties:style.properties}});
 assert.ok(after.includes('<p>Body</p>'));assert.deepEqual(apply(after,768).edits,[]);
});
test('detaching a scope retains rendered declarations and other links',()=>{
 const after=apply(apply(original).edits[0].after,768).edits[0].after;
 const detached=linked.plan(resolve(after),{type:'detachTextStyle',width:768}).edits[0].after;
 assert.deepEqual(css.describe(resolve(detached)).cssRules,css.describe(resolve(after)).cssRules);assert.deepEqual(Object.keys(linked.links(resolve(detached))),['0']);
 const last=linked.plan(resolve(detached),{type:'detachTextStyle',width:0}).edits[0].after;assert.deepEqual(linked.links(resolve(last)),{});assert.ok(!last.includes('data-rt-text-styles'));
});
test('manual typography edits retain the applied baseline for future override-aware propagation',()=>{
 const after=apply(original).edits[0].after;
 const manual=css.plan(resolve(after),{width:0,property:'font-size',value:'40px'}).edits[0].after;
 assert.equal(css.describe(resolve(manual)).cssRules[0]['font-size'],'40px');assert.equal(linked.links(resolve(manual))[0].properties['font-size'],'32px');
});
test('invalid links, stale source, invalid widths and important inline conflicts refuse',()=>{
 assert.equal(linked.plan(resolve(original),{type:'applyTextStyle',width:0,fileHash:'stale'},style).ok,false);
 for(const width of [-1,1.5,8000])assert.equal(apply(original,width).ok,false);
 assert.equal(apply(original.replace('<h1>','<h1 data-rt-text-styles="garbage">')).ok,false);
 assert.equal(apply(original.replace('<h1>','<h1 style="font-size:20px!important">')).ok,false);
});
test('style refresh updates inherited values while retaining local edits and resets across scopes',()=>{
 let source=apply(apply(original).edits[0].after,768).edits[0].after;
 source=css.plan(resolve(source),{width:0,changes:{'font-size':'40px','font-family':null}}).edits[0].after;
 const next={...style,properties:{...style.properties,'font-size':'48px','font-weight':'500','letter-spacing':'2px'}};
 const result=linked.planFile('/tmp/index.html','index.html',source,next);assert.equal(result.ok,true);assert.equal(result.updated,2);assert.equal(result.edits.length,1);assert.equal(result.edits[0].before,source);
 const after=result.edits[0].after,r=resolve(after),rules=css.describe(r).cssRules;
 assert.equal(rules[0]['font-size'],'40px');assert.equal(rules[0]['font-family'],undefined);assert.equal(rules[0]['font-weight'],'500');assert.equal(rules[0]['letter-spacing'],'2px');assert.deepEqual(rules[768],next.properties);
 assert.deepEqual(linked.links(r)[0].properties,next.properties);assert.deepEqual(linked.planFile('/tmp/index.html','index.html',after,next).edits,[]);
 const again={...next,properties:{...next.properties,'font-size':'60px','font-weight':'600'}};
 const final=linked.planFile('/tmp/index.html','index.html',after,again).edits[0].after;assert.equal(css.describe(resolve(final)).cssRules[0]['font-size'],'40px');assert.equal(css.describe(resolve(final)).cssRules[768]['font-size'],'60px');
});
test('removed style properties clear matching values but preserve overrides and other style identities',()=>{
 let source=apply(original).edits[0].after;
 source=css.plan(resolve(source),{width:0,changes:{'font-weight':'900','letter-spacing':'3px'}}).edits[0].after;
 const next={...style,properties:{'font-size':'50px','letter-spacing':'1px'}};
 const after=linked.planFile('/tmp/index.html','index.html',source,next).edits[0].after,rules=css.describe(resolve(after)).cssRules[0];
 assert.equal(rules['font-family'],undefined);assert.equal(rules['font-weight'],'900');assert.equal(rules['letter-spacing'],'3px');assert.equal(rules['font-size'],'50px');
 const unrelated={...next,id:'22222222-2222-4222-8222-222222222222'};assert.deepEqual(linked.planFile('/tmp/index.html','index.html',after,unrelated),{ok:true,updated:0,edits:[]});
});
test('refresh refuses a modified managed rule before returning any file edits',()=>{
 const source=apply(original).edits[0].after.replace('font-size:32px','font-size:99px');
 const result=linked.planFile('/tmp/index.html','index.html',source,{...style,properties:{'font-size':'50px'}});assert.equal(result.ok,false);assert.equal(result.edits,undefined);
});
test('detected overrides remain local even when a later library value happens to match them',()=>{
 let source=apply(original).edits[0].after;
 source=css.plan(resolve(source),{width:0,property:'font-size',value:'40px'}).edits[0].after;
 const matching={...style,properties:{...style.properties,'font-size':'40px'}};
 source=linked.planFile('/tmp/index.html','index.html',source,matching).edits[0].after;
 assert.deepEqual(linked.links(resolve(source))[0].overrides,['font-size']);
 const next={...style,properties:{...style.properties,'font-size':'60px'}};
 source=linked.planFile('/tmp/index.html','index.html',source,next).edits[0].after;
 assert.equal(css.describe(resolve(source)).cssRules[0]['font-size'],'40px');
 const reapplied=linked.plan(resolve(source),{type:'applyTextStyle',width:0},next).edits[0].after;
 assert.equal(linked.links(resolve(reapplied))[0].overrides,undefined);assert.equal(css.describe(resolve(reapplied)).cssRules[0]['font-size'],'60px');
});
test('refresh refuses linked nodes omitted by the source index, including templates and duplicate attributes',()=>{
 const linkedSource=apply(original).edits[0].after;
 const variants=[
  linkedSource.replace('<h1 ','<h1 class="a" class="b" '),
  linkedSource.replace('<h1 ','<template><h1 ').replace('</h1>','</h1></template>'),
  linkedSource.replace('<h1 ','<svg><text ').replace('</h1>','</text></svg>')
 ];
 for(const source of variants){const plan=linked.planFile('/tmp/index.html','index.html',source,{...style,properties:{'font-size':'48px'}});assert.equal(plan.ok,false);assert.match(plan.reason,/unsupported or ambiguous markup/);assert.equal(plan.edits,undefined);}
});
test('coverage checks distinguish actual links from examples in comments and script text',()=>{
 const source=apply(original).edits[0].after.replace('</body>','<!-- <template data-rt-text-styles="bad"></template> --><script>const example=\'<span data-rt-text-styles="bad">\';</script></body>');
 const result=linked.planFile('/tmp/index.html','index.html',source,{...style,properties:{'font-size':'48px'}});assert.equal(result.ok,true);assert.equal(result.updated,1);
});
