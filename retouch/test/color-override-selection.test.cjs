'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),react=require('../src/adapters/react.cjs'),planner=require('../src/color-override-selection.cjs');
const source='export default function Page(){return <main><p className="bg-red-500 md:!bg-red-500 text-lg">One</p><p className="bg-blue-500 md:!bg-blue-500 border-2">Two</p></main>}';
function resolve(source){const elements=react.collect(source,'Page.jsx').elements;return {file:'/tmp/Page.jsx',relPath:'Page.jsx',source,hash:react.contentHash(source),elements,element:elements.find(e=>e.node.openingElement.name.name==='p')};}
const ids=r=>r.elements.filter(e=>e.node.openingElement.name.name==='p').map(e=>e.id);
const op=r=>({ids:ids(r),fileHash:r.hash,scope:'md:',property:'background-color',value:'#00ff0080'});
test('shared local paint composes differing React classes in one transaction with scope isolation',()=>{
 const r=resolve(source),result=planner.plan(r,op(r));assert.equal(result.ok,true,result.reason);assert.equal(result.edits.length,1);assert.equal(result.edits[0].before,source);assert.equal(result.selection.length,2);
 for(const info of result.selection)assert.ok(info.className.includes('md:![background-color:#00ff0080]'));
 assert.ok(result.selection[0].className.includes('bg-red-500'));assert.ok(result.selection[0].className.includes('text-lg'));assert.ok(result.selection[1].className.includes('bg-blue-500'));assert.ok(result.selection[1].className.includes('border-2'));
 const next=resolve(result.edits[0].after);assert.deepEqual(planner.plan(next,op(next)).edits,[]);
});
test('shared local paint refuses every edit when a selected layer or value cannot be authored',()=>{
 const r=resolve(source);for(const patch of [{fileHash:'stale'},{ids:[r.element.id,r.element.id]},{property:'opacity'},{value:'url(evil)'},{ids:[r.element.id,'aaaaaaaaaa']}]){const result=planner.plan(r,{...op(r),...patch});assert.equal(result.ok,false);assert.equal(result.edits,undefined);}
 for(const modified of [source.replace('className="bg-blue-500 md:!bg-blue-500 border-2"','className={dynamic}'),source.replace('bg-blue-500 md:!bg-blue-500 border-2','bg-blue-500 md:![background:red] border-2')]){const state=resolve(modified),result=planner.plan(state,op(state));assert.equal(result.ok,false);assert.equal(result.edits,undefined);}
});

test('clearing shared paint removes only the chosen scope and property',()=>{
 const r=resolve(source),result=planner.plan(r,{...op(r),value:null});assert.equal(result.ok,true,result.reason);
 assert.deepEqual(result.selection.map(info=>info.className),['bg-red-500 text-lg','bg-blue-500 border-2']);
 const next=resolve(result.edits[0].after);assert.deepEqual(planner.plan(next,{...op(next),value:null}).edits,[]);
});
