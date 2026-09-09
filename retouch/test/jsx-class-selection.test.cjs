'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),react=require('../src/adapters/react.cjs');
const original=`export function Page(){return <main><div className='left-[20px] md:left-[40px]'>A</div><div className="top-[30px]">B</div><p>Unselected</p></main>}`;
function resolve(source=original){const elements=react.collect(source,'app/page.tsx').elements;return {source,hash:react.contentHash(source),file:'/tmp/app/page.tsx',relPath:'app/page.tsx',elements,element:elements[1]};}
function op(r,extra={}){const ids=r.elements.slice(1,3).map(e=>e.id);return {type:'setClassesSelection',id:ids[0],ids,fileHash:r.hash,classesById:{[ids[0]]:'left-[20px] md:left-[65px]',[ids[1]]:'top-[30px] md:top-[55px]'},...extra};}
test('React selection classes plan one atomic edit with stable IDs and fresh complete descriptors',()=>{
 const r=resolve(),operation=op(r),result=react.planOp(r,operation);assert.equal(result.ok,true);assert.equal(result.edits.length,1);assert.equal(result.edits[0].before,original);assert.deepEqual(result.selection.map(e=>e.id),operation.ids);assert.deepEqual(result.selection.map(e=>e.className),Object.values(operation.classesById));assert.ok(result.selection.every(e=>e.hash===result.hash&&e.structure&&e.renderRevisionAttribute==='data-rt-revision'));assert.match(result.edits[0].after,/<p>Unselected<\/p>/);
 const fresh=resolve(result.edits[0].after);assert.deepEqual(react.planOp(fresh,{...operation,fileHash:fresh.hash}).edits,[]);
});
test('React batch class changes preserve null reference markup and semantic no-ops verbatim',()=>{
 const r=resolve(),operation=op(r),ids=operation.ids;
 const saved=react.planOp(r,{...operation,classesById:{[ids[0]]:null,[ids[1]]:'top-[50px]'}});assert.equal(saved.ok,true);assert.match(saved.edits[0].after,/<div className='left-\[20px\] md:left-\[40px\]'>A<\/div>/);
 assert.deepEqual(react.planOp(r,{...operation,classesById:{[ids[0]]:'left-[20px] md:left-[40px]',[ids[1]]:null}}).edits,[]);
 assert.deepEqual(react.planOp(r,{...operation,classesById:Object.fromEntries(ids.map(id=>[id,null]))}).edits,[]);
 const removed=react.planOp(r,{...operation,classesById:Object.fromEntries(ids.map(id=>[id,'']))});assert.equal(removed.ok,true);assert.deepEqual(removed.selection.map(e=>e.className),[null,null]);
});
test('React selection refuses all changes when a later member has dynamic or spread classes',()=>{
 for(const source of [original.replace('className="top-[30px]"','className={classes}'),original.replace('className="top-[30px]"','className="top-[30px]" {...props}')]){
  const r=resolve(source),operation=op(r),result=react.planOp(r,operation);assert.equal(result.refused,true);assert.equal(result.edits,undefined);assert.equal(r.source,source);
  const reference=react.planOp(r,{...operation,classesById:{...operation.classesById,[operation.ids[1]]:null}});assert.equal(reference.ok,true);
 }
});
test('React batch classes validate membership, complete maps, source version and every token',()=>{
 const r=resolve(),operation=op(r),ids=operation.ids;
 for(const extra of [{fileHash:undefined},{fileHash:'stale'},{ids:[ids[0]]},{ids:[ids[0],ids[0]]},{ids:[ids[0],'0000000000']},{ids:[r.elements[0].id,ids[1]]},{classes:'text-xl'},{classesById:null},{classesById:[]},{classesById:{[ids[0]]:'left-0'}},{classesById:{...operation.classesById,extra:'left-0'}},{classesById:{[ids[0]]:'left-0',[ids[1]]:false}},{classesById:{[ids[0]]:'left-0',[ids[1]]:'x" onClick={bad}'}}]){const result=react.planOp(r,{...operation,...extra});assert.equal(result.refused,true,JSON.stringify(extra));assert.equal(result.edits,undefined);}
 const component=resolve(original.replace('<div className="top-[30px]">B</div>','<Button />'));assert.equal(react.planOp(component,op(component)).refused,true);
});
