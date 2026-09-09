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
 const r=resolve();assert.deepEqual(move.describe(r),{canMoveBefore:false,canMoveAfter:true,canMoveFirst:false,canMoveLast:true});
 for(const op of [{direction:'before',fileHash:r.hash},{direction:'first',fileHash:r.hash},{direction:'after',fileHash:'stale'},{direction:'after'}])assert.equal(move.plan(r,op).refused,true);
 const defs=resolve(original.replace('<g>','<defs></defs><g>'));assert.equal(move.describe(defs).canMoveAfter,false);
 const template=resolve(original.replace('<svg>','<svg v-if="shown">'));assert.equal(move.describe(template),null);
 assert.equal(move.describe(resolve(original,'svg')),null);
});
test('SVG first/last moves cross all supported siblings atomically and preserve gap slots',()=>{
 const a='<rect width="40"/>',b='<g><circle r="20"/></g>',c='<ellipse rx="10"/>',d='<line x2="30"/>',gap='\n<!--keep-->\n',source='<svg>'+a+gap+b+'\n'+c+' '+d+'</svg><p>After</p>';
 for(const [tag,direction,expected]of [['rect','last',b+gap+c+'\n'+d+' '+a],['line','first',d+gap+a+'\n'+b+' '+c]]){const r=resolve(source,tag),result=move.plan(r,{direction,fileHash:r.hash});assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);assert.equal(result.edits[0].after,'<svg>'+expected+'</svg><p>After</p>');assert.equal(html.collect(result.edits[0].after,r.relPath).elements.find(e=>e.id===result.movedId).tag,tag);}
 const barrier=resolve('<svg><rect/><circle/><defs/><line/></svg>');assert.equal(move.describe(barrier).canMoveAfter,true);assert.equal(move.describe(barrier).canMoveLast,false);assert.equal(move.plan(barrier,{direction:'last',fileHash:barrier.hash}).refused,true);
});
