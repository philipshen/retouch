'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),html=require('../src/adapters/html.cjs'),move=require('../src/svg-move.cjs');
const original='<html><head></head><body><svg><rect width="40"/>\n<!--keep-->\n<g><circle r="20"/><ellipse rx="10"/></g><line x2="30"/></svg><p>After</p></body></html>';
function resolve(source=original,tag='rect'){const elements=html.collect(source,'index.html').elements;return {source,elements,element:elements.find(e=>e.tag===tag),file:'/tmp/index.html',relPath:'index.html',hash:html.contentHash(source)};}
test('SVG reorder swaps source chunks, retains comments and remaps selected groups and descendants',()=>{
 const r=resolve(),result=move.plan(r,{direction:'after',fileHash:r.hash});assert.equal(result.ok,true,result.reason);
 assert.equal(result.edits[0].after,original.replace('<rect width="40"/>\n<!--keep-->\n<g><circle r="20"/><ellipse rx="10"/></g>','<g><circle r="20"/><ellipse rx="10"/></g>\n<!--keep-->\n<rect width="40"/>'));
 const fresh=resolve(result.edits[0].after);assert.equal(fresh.element.id,result.movedId);assert.notEqual(fresh.element.id,r.element.id);
 const back=move.plan(fresh,{direction:'before',fileHash:fresh.hash});assert.equal(back.edits[0].after,original);
 const group=resolve(original,'g'),moved=move.plan(group,{direction:'after',fileHash:group.hash});assert.equal(moved.ok,true);assert.match(moved.edits[0].after,/<line x2="30"\/><g><circle r="20"\/><ellipse rx="10"\/><\/g>/);
});
test('SVG reorder refuses unavailable directions, unsupported neighbors, templates and stale files',()=>{
 const r=resolve();assert.deepEqual(move.describe(r),{canMoveBefore:false,canMoveAfter:true});
 for(const op of [{direction:'before',fileHash:r.hash},{direction:'first',fileHash:r.hash},{direction:'after',fileHash:'stale'},{direction:'after'}])assert.equal(move.plan(r,op).refused,true);
 const defs=resolve(original.replace('<g>','<defs></defs><g>'));assert.equal(move.describe(defs).canMoveAfter,false);
 const template=resolve(original.replace('<svg>','<svg v-if="shown">'));assert.equal(move.describe(template),null);
 assert.equal(move.describe(resolve(original,'svg')),null);
});
