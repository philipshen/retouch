'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{collectElements,contentHash}=require('../src/id.cjs'),move=require('../src/move-component.cjs');
function resolved(source){const relPath='Page.tsx',elements=collectElements(source,relPath).elements;return {source,relPath,file:'/project/Page.tsx',elements,element:elements.find(el=>el.kind==='instance'&&el.node.openingElement.name.name==='Card'),hash:contentHash(source)};}
for(const [before,target]of [[false,'<section/>'],[true,'<section><p>Kept</p></section>'],[false,'<section><p>Kept</p></section>']])test('component reparenting maps all source layers and retains exact instance content: '+before+target,()=>{
 const chunk='<Card /* @retouch-layer "Summary" */ key="stable" label={label}><span>Child</span></Card>',source='import {Card} from "./Card";function Page({label}){return <main>'+(before?target+chunk:chunk+target)+'</main>}',r=resolved(source),destination=r.elements.find(el=>el.node.openingElement.name.name==='section');assert.ok(move.describe(r).containers.includes(destination.id));const plan=move.plan(r,{fileHash:r.hash,direction:'inside',destinationId:destination.id});assert.equal(plan.ok,true,plan.reason);const after=plan.edits[0].after,all=collectElements(after,r.relPath).elements,moved=all.find(el=>el.id===plan.movedComponent.instanceId),frame=all.find(el=>el.node.openingElement.name.name==='section');assert.equal(after.slice(moved.node.start,moved.node.end),chunk);assert.ok(moved.node.start>frame.node.openingElement.end&&moved.node.end<frame.node.closingElement.start);assert.ok(!after.includes('{null}'));assert.ok(!target.includes('<p>')||after.includes('<p>Kept</p>'));const mapping=new Map(plan.movedComponent.sourceIdMap);assert.deepEqual(r.elements.map(el=>mapping.get(el.id)||el.id).sort(),all.map(el=>el.id).sort());
});
test('reparenting refuses capture changes, early initialization and self-recursion',()=>{
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
test('components move across callbacks and render functions when bindings remain accessible',()=>{
 for(const source of [
  'import {Card} from "./Card";function Page({label}){return <main><Card label={label}/>{[1].map(()=> <section/>)}</main>}',
  'import {Card} from "./Card";function Page({label}){return <main>{[1].map(()=> <Card label={label}/>)}<section/></main>}',
  'import {Card} from "./Card";function Page(){return <Card label="Kept"/>}function Other(){return <section/>}',
  'import {Card} from "./Card";function Page(){const label="ready";return <main><Card label={label}/>{[1].map(()=> <section/>)}</main>}',
 ]){const r=resolved(source),destination=r.elements.find(el=>el.node.openingElement.name.name==='section');assert.ok(move.describe(r).containers.includes(destination.id));const plan=move.plan(r,{fileHash:r.hash,direction:'inside',destinationId:destination.id});assert.equal(plan.ok,true,plan.reason);const elements=collectElements(plan.edits[0].after,r.relPath).elements,component=elements.find(el=>el.id===plan.movedComponent.instanceId),container=elements.find(el=>el.node.openingElement.name.name==='section');assert.ok(component.node.start>container.node.start&&component.node.end<container.node.end);assert.deepEqual(r.elements.map(el=>new Map(plan.movedComponent.sourceIdMap).get(el.id)||el.id).sort(),elements.map(el=>el.id).sort());}
});
test('cross-function moves reject lost loop values, shadowing, execution context and recursion',()=>{
 for(const source of [
  'function Page(){return <main>{items.map(item=><Card label={item}/>)}<section/></main>}',
  'function Page({label}){return <main><Card label={label}/>{items.map(label=><section/>)}</main>}',
  'function Page(){return <main><Card value={this.label}/>{items.map(()=> <section/>)}</main>}',
  'function Page(){return <main><Card value={arguments[0]}/>{items.map(()=> <section/>)}</main>}',
  'async function Page(){return <main><Card value={await label}/>{items.map(()=> <section/>)}</main>}',
  'function Page(){return <main><Card value={new.target}/>{items.map(()=> <section/>)}</main>}',
  'function Page(){return <main><Card value={eval("label")}/>{items.map(()=> <section/>)}</main>}',
  'function Page(){return <Card/>}const Card=()=> <section/>',
  'function Page(){const dest=()=> <section/>;const label="late";return <main><Card label={label}/>{dest()}</main>}',
 ]){const r=resolved(source),destination=r.elements.find(el=>el.node.openingElement.name.name==='section');assert.equal(move.plan(r,{fileHash:r.hash,direction:'inside',destinationId:destination.id}).ok,false,source);assert.equal(move.describe(r).containers.includes(destination.id),false,source);}
});
test('reparenting rejects local render cycles introduced through other components or helpers',()=>{
 for(const source of [
  'function Page(){return <main><Card/><Other/></main>}function Card(){return <Other/>}function Other(){return <section/>}',
  'function Page(){return <main><Card/><Other/></main>}function Card(){return [1].map(()=> <Other/>)}function Other(){return <section/>}',
  'function Page(){return <main><Card/><Other/></main>}function Card(){return renderOther()}function renderOther(){return <Other/>}function Other(){return <section/>}',
  'function Page(){return <main><Card/><Other/></main>}const Card=()=> <Alias/>;const Alias=Other;function Other(){return <section/>}',
  'function Page(){return <main><Card><Other/></Card><Other/></main>}function Card({children}){return children}function Other(){return <section/>}',
 ]){const r=resolved(source),destination=r.elements.find(el=>el.node.openingElement.name.name==='section');const plan=move.plan(r,{fileHash:r.hash,direction:'inside',destinationId:destination.id});assert.equal(plan.ok,false,source);assert.match(plan.reason,/recurs|cycle/i);assert.equal(move.describe(r).containers.includes(destination.id),false);}
});

test('member component usages cannot move into their object definition',()=>{
 const r=resolved('function Page(){return <Parts.Card/>}const Parts={Card:()=> <section/>}');r.element=r.elements.find(el=>el.kind==='instance');const destination=r.elements.find(el=>el.node.openingElement.name.name==='section');assert.equal(move.plan(r,{fileHash:r.hash,direction:'inside',destinationId:destination.id}).ok,false);assert.equal(move.describe(r).containers.includes(destination.id),false);
});
test('unrelated existing function cycles do not prevent a valid component move',()=>{
 const r=resolved('function A(){return B()}function B(){return A()}import {Card} from "./Card";function Page(){return <Card/>}function Other(){return <section/>}');const destination=r.elements.find(el=>el.node.openingElement.name.name==='section');assert.equal(move.plan(r,{fileHash:r.hash,direction:'inside',destinationId:destination.id}).ok,true);
});
