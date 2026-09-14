'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),group=require('../src/svg-boolean-group.cjs'),ids=require('../src/id.cjs');
const markup='<main><svg><rect width="100" height="80" fill="red" transform="translate(3 4)"/>\n<!--keep--><circle cx="50" cy="40" r="30"/><ellipse rx="2" ry="3"/></svg><p>After</p></main>',path='M0 0H100V80H0Z';
const tag=(kind,e)=>kind==='react'?ids.jsxElementName(e.node):e.tag;
function resolve(kind,source,id){const adapter=require('../src/adapters/'+kind+'.cjs'),relPath='art.'+(kind==='react'?'jsx':kind==='liquid'?'liquid':'html');if(source===undefined)source=kind==='react'?'export default function Art(){return '+markup.replace('<!--keep-->','{/*keep*/}')+'}':kind==='liquid'?markup.replace('<!--keep-->',''):markup;const elements=adapter.collect(source,relPath).elements;return {source,elements,element:id?elements.find(e=>e.id===id):elements.find(e=>tag(kind,e)==='rect'),hash:adapter.contentHash(source),file:'/tmp/'+relPath,relPath};}
function create(kind,r,extra={}){return group.plan(r,{type:'createSVGBooleanGroup',fileHash:r.hash,ids:['rect','circle'].map(t=>r.elements.find(e=>tag(kind,e)===t).id),path,operation:'union',...extra},kind);}
for(const kind of ['html','react','liquid']){
 test(kind+' boolean groups retain every original layer, base selection and exact release bytes',()=>{
  const r=resolve(kind),made=create(kind,r);assert.equal(made.ok,true,made.reason);assert.deepEqual(made.removedSourceIds,[]);
  const after=made.edits[0].after,fresh=resolve(kind,after,made.selectionIds[0]),info=group.describe(fresh,kind);assert.equal(info.operation,'union');assert.equal(info.operandIds.length,2);
  const mapping=new Map(made.sourceIdMap);for(const e of r.elements){const preserved=fresh.elements.find(n=>n.id===(mapping.get(e.id)||e.id));assert.ok(preserved);assert.equal(tag(kind,preserved),tag(kind,e));}assert.equal(info.baseId,mapping.get(r.element.id)||r.element.id);
  assert.ok(after.includes('display="none"'));assert.ok(after.includes('data-rt-boolean-result=""'));assert.ok(after.includes('transform="translate(3 4)"'));
  const released=group.plan(fresh,{type:'releaseSVGBooleanGroup',fileHash:fresh.hash},kind);assert.equal(released.ok,true,released.reason);assert.equal(released.edits[0].after,r.source);assert.equal(released.selectionIds.length,2);assert.equal(released.removedSourceIds.length,3);
 });
 test(kind+' changing boolean operation preserves operands and supports empty then nonempty results',()=>{
  const r=resolve(kind),made=create(kind,r,{path:''}),fresh=resolve(kind,made.edits?.[0].after,made.selectionIds?.[0]);assert.equal(made.ok,true,made.reason);assert.ok(fresh.source.includes('d=""'));const originalOperands=group.context(fresh,kind);const before=fresh.source.slice(originalOperands.opening(originalOperands.operands),originalOperands.closing(originalOperands.operands));
  for(const operation of ['subtract','intersect','exclude','union']){const changed=group.plan(fresh,{type:'setSVGBooleanOperation',fileHash:fresh.hash,operation,path},kind);assert.equal(changed.ok,true,changed.reason);const next=resolve(kind,changed.edits[0].after,made.selectionIds[0]),c=group.context(next,kind);assert.equal(c.operation,operation);assert.equal(next.source.slice(c.opening(c.operands),c.closing(c.operands)),before);assert.equal(group.plan(next,{type:'releaseSVGBooleanGroup',fileHash:next.hash},kind).edits[0].after,r.source);}
 });
 test(kind+' reversed selection remembers the first selected base without reordering source',()=>{
  const r=resolve(kind),selection=['circle','rect'].map(t=>r.elements.find(e=>tag(kind,e)===t).id),made=create(kind,r,{ids:selection});assert.equal(made.ok,true,made.reason);const fresh=resolve(kind,made.edits[0].after,made.selectionIds[0]),info=group.describe(fresh,kind);assert.equal(tag(kind,fresh.elements.find(e=>e.id===info.baseId)),'circle');assert.equal(group.plan(fresh,{type:'releaseSVGBooleanGroup',fileHash:fresh.hash},kind).edits[0].after,r.source);
 });
 test(kind+' group operations reject stale, nonconsecutive, invalid and altered wrappers without edits',()=>{
  const r=resolve(kind);for(const changes of [{fileHash:'old'},{operation:'bad'},{path:'M0 0L1 1'},{ids:[r.element.id,r.elements.find(e=>tag(kind,e)==='ellipse').id]}])assert.equal(create(kind,r,changes).refused,true);
  const made=create(kind,r);for(const replacement of ['data-rt-boolean="union" transform="translate(2)"','data-rt-boolean="union" class="custom"']){const fresh=resolve(kind,made.edits[0].after.replace('data-rt-boolean="union"',replacement),made.selectionIds[0]);assert.equal(group.plan(fresh,{type:'releaseSVGBooleanGroup',fileHash:fresh.hash},kind).refused,true);}
  const identified=resolve(kind,r.source.replace('<rect ','<rect id="authored" '));assert.equal(create(kind,identified).refused,true);
 });
}
for(const kind of ['html','react','liquid'])test(kind+' operand geometry and derived result update atomically and release retains the edit',()=>{
 const r=resolve(kind),made=create(kind,r),fresh=resolve(kind,made.edits[0].after,made.selectionIds[0]),info=group.describe(fresh,kind);
 const changed=group.plan(fresh,{type:'setSVGBooleanOperand',fileHash:fresh.hash,operandId:info.baseId,operandOp:{type:'setSVGGeometry',property:'width',value:'120'},path:'M0 0H120V80H0Z'},kind);
 assert.equal(changed.ok,true,changed.reason);assert.equal(changed.edits.length,1);assert.equal(changed.edits[0].before,fresh.source);assert.ok(changed.edits[0].after.includes('width="120"'));assert.ok(changed.edits[0].after.includes('120'));
 const edited=resolve(kind,changed.edits[0].after,made.selectionIds[0]),released=group.plan(edited,{type:'releaseSVGBooleanGroup',fileHash:edited.hash},kind);assert.equal(released.ok,true,released.reason);assert.equal(released.edits[0].after,r.source.replace('width="100"','width="120"'));
 for(const extra of [{path:'M0 0L1 1'},{operandId:'missing'},{operandOp:{type:'deleteElement'}},{operandOp:{type:'setSVGGeometry',property:'width',value:'invalid'}}])assert.equal(group.plan(fresh,{type:'setSVGBooleanOperand',fileHash:fresh.hash,operandId:info.baseId,operandOp:{type:'setSVGGeometry',property:'width',value:'120'},path,...extra},kind).refused,true);
});
