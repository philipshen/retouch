'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const react=require('../src/adapters/react.cjs');
const liquid=require('../src/adapters/liquid.cjs');
function target(adapter,source,tag='b') {
  const relPath=adapter===react?'view.tsx':'sections/view.liquid';
  const elements=adapter.collect(source,relPath).elements;
  const element=elements.find(e=>(e.node?.openingElement?.name.name||e.tag)===tag);
  return {source,relPath,file:'/project/'+relPath,hash:adapter.contentHash(source),elements,element};
}
for(const adapter of [react,liquid]) {
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
