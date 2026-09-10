'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const react=require('../src/adapters/react.cjs');
const liquid=require('../src/adapters/liquid.cjs');
const html=require('../src/adapters/html.cjs');
function target(adapter,source,tag='b') {
  const relPath=adapter===react?'view.tsx':'sections/view.liquid';
  const elements=adapter.collect(source,relPath).elements;
  const element=elements.find(e=>(e.node?.openingElement?.name.name||e.tag)===tag);
  return {source,relPath,file:'/project/'+relPath,hash:adapter.contentHash(source),elements,element};
}
for(const adapter of [react,liquid,html]) {
  const wrap=html=>adapter===react?'export default function View(){return ('+html+');}':html;
  test(adapter.name+' structural actions preserve exact unrelated source and sibling spacing',()=>{
    const source=wrap('<div>\n  <a>A</a>\n  <b>B</b>\n  <i>I</i>\n</div>');
    const resolved=target(adapter,source);
    assert.equal(adapter.describe(resolved).structure.canDuplicate,true);
    const parentId=adapter.describe(resolved).structure.parentId;
    assert.ok(parentId);
    const copied=target(adapter,source,'a').element;
    const paste=adapter.planOp(resolved,{type:'pasteElement',copiedId:copied.id,copiedHash:resolved.hash});
    assert.equal(paste.parentId,parentId);
    assert.equal(paste.edits[0].after,source.replace('<b>B</b>','<b>B</b>\n  <a>A</a>'));
    assert.equal(adapter.planOp(resolved,{type:'pasteElement',copiedId:copied.id,copiedHash:'stale'}).refused,true);
    assert.equal(adapter.planOp(resolved,{type:'pasteElement',copiedId:parentId,copiedHash:resolved.hash}).refused,true);
    const plan=op=>adapter.planOp(resolved,op);
    assert.equal(plan({type:'duplicateElement'}).edits[0].after,source.replace('<b>B</b>','<b>B</b>\n  <b>B</b>'));
    assert.equal(plan({type:'deleteElement'}).edits[0].after,source.replace('<b>B</b>',''));
    assert.equal(plan({type:'moveElement',direction:'before'}).edits[0].after,source.replace('<a>A</a>\n  <b>B</b>','<b>B</b>\n  <a>A</a>'));
    assert.equal(plan({type:'moveElement',direction:'last'}).edits[0].after,source.replace('<b>B</b>\n  <i>I</i>','<i>I</i>\n  <b>B</b>'));
    assert.equal(plan({type:'deleteElement',fileHash:'stale'}).refused,true);
  });
  test(adapter.name+' rejects mixed text and duplicate identity',()=>{
    assert.equal(adapter.planOp(target(adapter,wrap('<div>hello<b>B</b></div>')),{type:'deleteElement'}).refused,true);
    assert.equal(adapter.planOp(target(adapter,wrap('<div><b id="x">B</b></div>')),{type:'duplicateElement'}).refused,true);
  });
}
test('React refuses repeated elements, components, expressions, and return roots',()=>{
  for(const source of ['const x=<div>{items.map(x=><section><b>B</b></section>)}</div>', 'const x=<div><Button/><b>B</b></div>','const x=<div><b>{value}</b></div>','const x=<b>B</b>']) {
    assert.equal(react.planOp(target(react,source),{type:'deleteElement'}).refused,true,source);
  }
});
test('Liquid refuses control scopes and expression siblings',()=>{
  for(const source of ['{% for x in xs %}<div><b>B</b></div>{% endfor %}','<div>{% if x %}<b>B</b>{% endif %}</div>','<div><b>{{ value }}</b></div>']) {
    assert.equal(liquid.planOp(target(liquid,source),{type:'deleteElement'}).refused,true,source);
  }
});

test('HTML structural ranges reject implicit markup and remap linked style identities when cloning',()=>{
 for(const source of ['<div>text<b>B</b></div>','<div><b>B</b><!--comment--></div>','<ul><li>One<li>Two</ul>']){
  const resolved=target(html,source,source.includes('<li>')?'li':'b');assert.equal(html.planOp(resolved,{type:'deleteElement'}).refused,true);
 }
 assert.equal(html.planOp(target(html,'<div><b class="a" class="b">B</b><i>I</i></div>','i'),{type:'duplicateElement'}).refused,true);
 const source='<div><b data-rt-style="1234567890">B</b><i>I</i></div>',resolved=target(html,source);
 assert.equal(html.describe(resolved).structure.canDuplicate,true);
 assert.equal(html.planOp(resolved,{type:'moveElement',direction:'after'}).ok,true);
 assert.equal(html.planOp(resolved,{type:'deleteElement'}).ok,true);
});
for(const adapter of [react,liquid,html])test(adapter.name+' identifies duplicated and pasted roots for selection',()=>{
 const markup='<div><a>A</a><b>B</b><i>I</i></div>',source=adapter===react?'function View(){return '+markup+'}':markup,resolved=target(adapter,source);
 for(const type of ['duplicateElement','pasteElement']){
  const copied=resolved.elements.find(element=>(element.node?.openingElement?.name.name||element.tag)==='a'),plan=adapter.planOp(resolved,{type,fileHash:resolved.hash,...(type==='pasteElement'?{copiedId:copied.id,copiedHash:resolved.hash}:{})});assert.equal(plan.ok,true,plan.reason);
  const elements=adapter.collect(plan.edits[0].after,resolved.relPath).elements,created=elements.find(element=>element.id===plan.createdId);assert.ok(created);assert.notEqual(created.id,resolved.element.id);assert.notEqual(created.id,copied.id);assert.equal(created.node?.openingElement?.name.name||created.tag,type==='pasteElement'?'a':'b');
  const siblings=elements.filter(element=>['a','b','i'].includes(element.node?.openingElement?.name.name||element.tag));assert.equal(siblings[2].id,created.id);
 }
});
for(const adapter of [react,liquid,html])test(adapter.name+' maps every reordered layer including descendants',()=>{
 const markup='<div><a>A</a><b><span>Longer content</span></b><i>I</i></div>',source=adapter===react?'function View(){return '+markup+'}':markup,resolved=target(adapter,source);
 for(const direction of ['before','after','first','last']){const plan=adapter.planOp(resolved,{type:'moveElement',direction,fileHash:resolved.hash});assert.equal(plan.ok,true,plan.reason);const elements=adapter.collect(plan.edits[0].after,resolved.relPath).elements,mapping=new Map(plan.sourceIdMap);assert.equal(mapping.get(resolved.element.id),plan.movedId);assert.deepEqual(resolved.elements.map(element=>mapping.get(element.id)||element.id).sort(),elements.map(element=>element.id).sort());for(const element of resolved.elements){const next=elements.find(item=>item.id===(mapping.get(element.id)||element.id));assert.equal(next.node?.openingElement?.name.name||next.tag,element.node?.openingElement?.name.name||element.tag);}}
});

for(const adapter of [react,liquid,html])test(adapter.name+' preserves original layer identities when copies shift later siblings',()=>{
 const markup='<div><a>A</a><b><span>Copy</span></b><i><em>Locked</em></i></div>',source=adapter===react?'function View(){return '+markup+'}':markup,resolved=target(adapter,source);
 for(const type of ['duplicateElement','pasteElement']){
  const copied=target(adapter,source,'a').element,plan=adapter.planOp(resolved,{type,copiedId:copied.id,copiedHash:resolved.hash});assert.equal(plan.ok,true,plan.reason);
  const elements=adapter.collect(plan.edits[0].after,resolved.relPath).elements,mapping=new Map(plan.sourceIdMap),ids=resolved.elements.map(element=>mapping.get(element.id)||element.id);assert.equal(new Set(ids).size,ids.length);assert.ok(!ids.includes(plan.createdId));
  for(const element of resolved.elements){const next=elements.find(item=>item.id===(mapping.get(element.id)||element.id));assert.ok(next);assert.equal(next.node?.openingElement?.name.name||next.tag,element.node?.openingElement?.name.name||element.tag);}
  assert.ok(mapping.has(target(adapter,source,'i').element.id));assert.ok(mapping.has(target(adapter,source,'em').element.id));
 }
});
test('HTML copy identity mapping survives cloned responsive styles inserted in the head',()=>{
 const css=require('../src/html-css.cjs'),original='<html><head></head><body><b>Copy</b><i><em>Locked</em></i></body></html>',styled=css.plan(target(html,original),{width:768,property:'color',value:'red'});assert.equal(styled.ok,true);
 const resolved=target(html,styled.edits[0].after),plan=html.planOp(resolved,{type:'duplicateElement'});assert.equal(plan.ok,true,plan.reason);
 const elements=html.collect(plan.edits[0].after,resolved.relPath).elements,mapping=new Map(plan.sourceIdMap);
 for(const element of resolved.elements){const next=elements.find(item=>item.id===(mapping.get(element.id)||element.id));assert.ok(next);assert.equal(next.tag,element.tag);}
 const created=elements.find(element=>element.id===plan.createdId);assert.deepEqual(css.describe({...resolved,source:plan.edits[0].after,element:created}).cssRules,{768:{color:'red'}});
});
