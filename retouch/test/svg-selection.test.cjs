'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),A=require('../shell/svg-affine.js'),S=require('../shell/svg-selection.js');
test('Selection transforms conjugate through different parent coordinate systems',()=>{
 const global=A.parse('translate(20 10) rotate(30 100 100)'),own=A.parse('rotate(10) translate(4 6)');
 for(const parent of [A.identity(),A.parse('translate(15 20) scale(2 3) rotate(30)'),A.parse('scale(-1 1) skewX(10)')]){const next=S.transform(parent,global,own);assert.ok(A.equivalent(A.multiply(parent,next),A.multiply(global,A.multiply(parent,own))));}
 assert.equal(S.inverse([0,0,0,0,0,0]),null);
});
for(const kind of ['html','react','liquid'])test(kind+' vector selections form one atomic source edit',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),collect=(source,relPath)=>kind==='react'?require('../src/id.cjs').collectElements(source,relPath).elements:adapter.collect(source,relPath).elements,source=(kind==='react'?'export default()=>':'')+'<svg><rect width="20"/><circle transform="translate(2 3)" r="10"/><path d="M0 0L10 20"/></svg>',relPath=kind==='react'?'app/page.jsx':kind==='liquid'?'sections/main.liquid':'index.html',elements=collect(source,relPath),chosen=elements.slice(1,3),ids=chosen.map(el=>el.id),resolved={source,relPath,elements,element:chosen[0],hash:adapter.contentHash(source),file:'/tmp/'+relPath},matrices=Object.fromEntries(ids.map(id=>[id,[1,0,0,1,20,30]])),op={type:'setSVGTransforms',ids,matrices,fileHash:resolved.hash};
 const result=adapter.planOp(resolved,op);assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);assert.equal(result.edits[0].before,source);assert.equal(result.selection.length,2);assert.equal((result.edits[0].after.match(/matrix\(1 0 0 1 20 30\)/g)||[]).length,2);assert.ok(result.edits[0].after.includes('d="M0 0L10 20"'));
 for(const bad of [{fileHash:'stale'},{ids:[ids[0],ids[0]]},{matrices:{[ids[0]]:matrices[ids[0]]}},{matrices:{...matrices,[ids[1]]:[NaN,0,0,1,0,0]}}]){const refused=adapter.planOp(resolved,{...op,...bad});assert.equal(refused.ok,false);assert.equal(refused.edits,undefined);}
 const badId=elements[0].id,refused=adapter.planOp(resolved,{...op,ids:[ids[0],badId],matrices:{[ids[0]]:matrices[ids[0]],[badId]:A.identity()}});assert.equal(refused.ok,false,'an invalid final member refuses the whole batch');assert.equal(refused.edits,undefined);
});
