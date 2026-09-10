'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{collectElements,contentHash}=require('../src/id.cjs'),move=require('../src/move-component.cjs');
function resolved(source){const relPath='Page.tsx',elements=collectElements(source,relPath).elements;return {source,relPath,file:'/project/Page.tsx',elements,element:elements.find(el=>el.kind==='instance'&&el.node.openingElement.name.name==='Card'),hash:contentHash(source)};}
for(const [before,target]of [[false,'<section/>'],[true,'<section><p>Kept</p></section>'],[false,'<section><p>Kept</p></section>']])test('component reparenting maps all source layers and retains exact instance content: '+before+target,()=>{
 const chunk='<Card /* @retouch-layer "Summary" */ key="stable" label={label}><span>Child</span></Card>',source='import {Card} from "./Card";function Page({label}){return <main>'+(before?target+chunk:chunk+target)+'</main>}',r=resolved(source),destination=r.elements.find(el=>el.node.openingElement.name.name==='section');assert.ok(move.describe(r).containers.includes(destination.id));const plan=move.plan(r,{fileHash:r.hash,direction:'inside',destinationId:destination.id});assert.equal(plan.ok,true,plan.reason);const after=plan.edits[0].after,all=collectElements(after,r.relPath).elements,moved=all.find(el=>el.id===plan.movedComponent.instanceId),frame=all.find(el=>el.node.openingElement.name.name==='section');assert.equal(after.slice(moved.node.start,moved.node.end),chunk);assert.ok(moved.node.start>frame.node.openingElement.end&&moved.node.end<frame.node.closingElement.start);assert.ok(!after.includes('{null}'));assert.ok(!target.includes('<p>')||after.includes('<p>Kept</p>'));const mapping=new Map(plan.movedComponent.sourceIdMap);assert.deepEqual(r.elements.map(el=>mapping.get(el.id)||el.id).sort(),all.map(el=>el.id).sort());
});
test('reparenting refuses capture changes, early initialization and moving across functions',()=>{
 for(const source of [
  'function Page(){let dest;{type Label=number;dest=<section/>}type Label=string;return <main><Card value={"a" as Label}/>{dest}</main>}',
  'import {Card} from "./Card";function Page(){let dest;if(true){const Card=Other;dest=<section/>}return <main><Card/>{dest}</main>}',
  'function Page({label}){const dest=(()=>{const label="shadow";return <section/>})();return <main><Card label={label}/>{dest}</main>}',
  'function Page(){const dest=<section/>;const label="late";return <main><Card label={label}/>{dest}</main>}',
  'function Page(){return <Card/>}function Card(){return <section/>}',
  'function Page({label}){let dest;if(true){const label="shadow";dest=<section/>}return <main><Card label={label}/>{dest}</main>}',
 ]){const r=resolved(source),destination=r.elements.find(el=>el.node.openingElement.name.name==='section'),plan=move.plan(r,{fileHash:r.hash,direction:'inside',destinationId:destination.id});assert.equal(plan.ok,false,source);assert.equal(move.describe(r).containers.includes(destination.id),false);}
});
test('reparenting rejects descendant containers, prop-controlled children and stale source',()=>{
 const r=resolved('function Page(){return <main><Card><section/></Card><aside children={other}/><div {...props}/></main>}');for(const destination of r.elements.filter(el=>['section','aside','div'].includes(el.node.openingElement.name.name)))assert.equal(move.plan(r,{fileHash:r.hash,direction:'inside',destinationId:destination.id}).ok,false);assert.equal(move.plan(r,{fileHash:'stale',direction:'inside',destinationId:r.elements[0].id}).ok,false);
});
test('same-render-function moves retain module and named-function references',()=>{
 for(const source of ['function Page(){return <main><Card label={label}/><section/></main>}const label="ready";','const Page=function Named(){return <main><Card callback={Named}/><section/></main>}']){const r=resolved(source),destination=r.elements.find(el=>el.node.openingElement.name.name==='section');const plan=move.plan(r,{fileHash:r.hash,direction:'inside',destinationId:destination.id});assert.equal(plan.ok,true,plan.reason);}
});
