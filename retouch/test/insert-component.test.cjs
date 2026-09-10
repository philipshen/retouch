'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {makeApp,cleanup,Index,pick}=require('./helpers.cjs'),planner=require('../src/insert-component.cjs'),definitions=require('../src/component-definitions.cjs'),tx=require('../src/transactions.cjs');
function fixture(page='"use client";export default function Page(){const Card=1;return <main><h1>Existing</h1></main>}',component='export const Card=({label="Ready"})=><article>{label}</article>'){
 const root=fs.realpathSync(makeApp({'page.tsx':page,'parts/Card.tsx':component})),index=new Index(root);index.scanAll();const resolved=pick(index,root,'page.tsx','main').resolved,def=definitions.definitions(component,'parts/Card.tsx')[0],op={fileHash:resolved.hash,definitionFile:'parts/Card.tsx',definitionId:def.definitionId,definitionHash:require('../src/id.cjs').contentHash(component)};
 return {root,index,resolved,op,page,component,close(){index.close();cleanup(root);}};
}
test('insertion adds a collision-free import and child, preserves directives and maps new source IDs',()=>{
 const f=fixture();try{const plan=planner.plan(f.resolved,f.op);assert.ok(plan.ok,plan.reason);assert.match(plan.edits[0].after,/^"use client";\nimport \{ Card as Card2 \} from "\.\/parts\/Card";/);assert.match(plan.edits[0].after,/<h1>Existing<\/h1>\n<Card2\/>/);const applied=tx.applyPlan(f.root,plan);assert.ok(applied.ok,applied.reason);assert.equal(applied.edits.length,1);f.index.scanAll();assert.equal(f.index.resolve(plan.insertedComponent.instanceId).element.node.openingElement.name.name,'Card2');assert.equal(f.index.resolve(plan.insertedComponent.parentId).element.node.openingElement.name.name,'main');assert.equal(fs.readFileSync(path.join(f.root,'parts/Card.tsx'),'utf8'),f.component);assert.ok(tx.applyPlan(f.root,{ok:true,edits:applied.edits.map(edit=>({...edit,before:edit.after,after:edit.before}))}).ok);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),f.page);}finally{f.close();}
});
test('insertion expands self-closing frames and supports default exports',()=>{
 const f=fixture('export default function Page(){return <main/>}','export default ()=> <article/>');try{const plan=planner.plan(f.resolved,f.op);assert.ok(plan.ok,plan.reason);assert.match(plan.edits[0].after,/import InsertedComponent from/);assert.match(plan.edits[0].after,/<main>\n<InsertedComponent\/>\n<\/main>/);assert.ok(tx.applyPlan(f.root,plan).ok);f.index.scanAll();assert.ok(f.index.resolve(plan.insertedComponent.instanceId));}finally{f.close();}
});
test('same-file insertion uses a visible component binding without an import and refuses recursive placement',()=>{
 const f=fixture();try{const source='/** @retouch-component */\nfunction Card(){return <article/>} export default function Page(){return <main/>}';fs.writeFileSync(f.resolved.file,source);f.index.scanAll();const def=definitions.definitions(source,'page.tsx').find(d=>d.name==='Card'),resolved=pick(f.index,f.root,'page.tsx','main').resolved,op={...f.op,fileHash:resolved.hash,definitionFile:'page.tsx',definitionId:def.definitionId,definitionHash:resolved.hash};const plan=planner.plan(resolved,op);assert.ok(plan.ok,plan.reason);assert.ok(!plan.edits[0].after.includes('import '));const recursive=pick(f.index,f.root,'page.tsx','article').resolved;assert.match(planner.plan(recursive,{...op,fileHash:recursive.hash}).reason,/own definition/);}finally{f.close();}
});
test('required primitive props and finite choices are validated, escaped and guarded with imported types',()=>{
 const f=fixture(undefined,'import type {Props} from "./types";export function Card({label,tone}:Props){return <article>{label}</article>}');try{fs.writeFileSync(path.join(f.root,'parts/types.ts'),'export interface Props {label:string;tone?:"calm"|"bold"}');assert.match(planner.plan(f.resolved,f.op).reason,/required.*label/);assert.equal(planner.plan(f.resolved,{...f.op,props:{label:'x',tone:'invalid'}}).ok,false);const plan=planner.plan(f.resolved,{...f.op,props:{label:'" & <tag>\nline',tone:'calm'}});assert.ok(plan.ok,plan.reason);assert.match(plan.edits[0].after,/label=\{/);fs.appendFileSync(path.join(f.root,'parts/types.ts'),'\n// changed');assert.equal(tx.applyPlan(f.root,plan).ok,false);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),f.page);}finally{f.close();}
});
test('insertion refuses stale definitions, changed import resolution and escaped paths without writes',()=>{
 const f=fixture();try{assert.equal(planner.plan(f.resolved,{...f.op,definitionHash:'stale'}).ok,false);assert.equal(planner.plan(f.resolved,{...f.op,definitionFile:'../elsewhere.tsx'}).ok,false);const plan=planner.plan(f.resolved,f.op);assert.ok(plan.ok,plan.reason);fs.writeFileSync(path.join(f.root,'parts/Card.ts'),'export const Card=1;');assert.equal(tx.applyPlan(f.root,plan).ok,false);assert.equal(planner.plan(f.resolved,f.op).ok,false);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),f.page);}finally{f.close();}
});
test('insertion rejects a contract changing between property reads rather than combining snapshots',()=>{
 const f=fixture(undefined,'import type {Props} from "./types";export function Card({label,tone}:Props){return <article>{label}</article>}'),types=require('../src/component-prop-choices.cjs'),original=types.property;try{
  const file=path.join(f.root,'parts/types.ts');fs.writeFileSync(file,'export interface Props {label:string;tone?:"calm"|"bold"}');
  types.property=(resolved,name,definition)=>{const result=original(resolved,name,definition);if(name==='label')fs.appendFileSync(file,'\n// external edit');return result;};
  const result=planner.plan(f.resolved,{...f.op,props:{label:'Hello',tone:'calm'}});assert.equal(result.ok,false);assert.match(result.reason,/contract changed/);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),f.page);
 }finally{types.property=original;f.close();}
});
test('insertion descriptors expose required controls and reject stale form contracts',()=>{
 const f=fixture(undefined,'import type {Props} from "./types";export function Card({label,count,enabled,tone,note="Default"}:Props){return <article>{label}</article>}');try{
  const file=path.join(f.root,'parts/types.ts');fs.writeFileSync(file,'export interface Props {label:string;count:number;enabled:boolean;tone:"calm"|"bold";note?:string}');f.index.scanAll();const descriptor=definitions.describe(f.index.resolve(f.op.definitionId));assert.ok(descriptor.insertion.ok);assert.deepEqual(descriptor.insertion.properties.filter(prop=>prop.required).map(prop=>[prop.name,prop.type,prop.supported]),[['label','string',true],['count','number',true],['enabled','boolean',true],['tone','string',true]]);assert.equal(descriptor.insertion.properties.find(prop=>prop.name==='note').required,false);const op={...f.op,contractHash:descriptor.insertion.revision,props:{label:'',count:0,enabled:false,tone:'bold'}};assert.ok(planner.plan(f.resolved,op).ok);fs.appendFileSync(file,'\n// changed');assert.match(planner.plan(f.resolved,op).reason,/properties changed/);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),f.page);
 }finally{f.close();}
});
test('insertion reuses visible named, aliased, default and namespace value imports',()=>{
 for(const [header,component,tag] of [
  ['import {Card} from "./parts/Card";','export function Card(){return <article/>}','Card'],
  ['import {PublicCard as Existing} from "./parts/Card";','function Card(){return <article/>}export {Card as PublicCard};','Existing'],
  ['import Existing from "./parts/Card";','export default function Card(){return <article/>}','Existing'],
  ['import * as cards from "./parts/Card";','export function Card(){return <article/>}','cards.Card'],
  ['import * as cards from "./parts/Card";','export default function Card(){return <article/>}','cards.default'],
 ]){
  const f=fixture(header+'export default function Page(){return <main/>}',component);try{const plan=planner.plan(f.resolved,f.op);assert.ok(plan.ok,plan.reason);assert.equal((plan.edits[0].after.match(/import /g)||[]).length,1);assert.ok(plan.edits[0].after.includes('<'+tag+'/>'));assert.equal(plan.insertedComponent.parentId,f.resolved.element.id);assert.ok(tx.applyPlan(f.root,plan).ok);f.index.scanAll();const inserted=f.index.resolve(plan.insertedComponent.instanceId),def=require('../src/components.cjs').definition(inserted);assert.equal(def.file,path.join(f.root,'parts/Card.tsx'));assert.equal(def.fn.start,definitions.definitions(component,'parts/Card.tsx')[0].fn.start);}finally{f.close();}
 }
});
test('shadowed, type-only and lowercase host-like imports are not reused as component bindings',()=>{
 for(const [header,body] of [
  ['import {Card} from "./parts/Card";','const Card=()=>null;'],
  ['import * as cards from "./parts/Card";','const cards={};'],
  ['import type {Card} from "./parts/Card";',''],
  ['import {type Card} from "./parts/Card";',''],
  ['import {Card as card} from "./parts/Card";',''],
 ]){const f=fixture(header+'export default function Page(){'+body+'return <main/>}');try{const plan=planner.plan(f.resolved,f.op);assert.ok(plan.ok,plan.reason);assert.equal((plan.edits[0].after.match(/import /g)||[]).length,2);assert.ok(!plan.edits[0].after.includes('<card/>'));}finally{f.close();}}
});
test('explicit-extension imports can be reused despite sibling stems, while reuse guards later path changes',()=>{
 const f=fixture('import {Card as Existing} from "./parts/Card.tsx";export default function Page(){return <main/>}');try{fs.writeFileSync(path.join(f.root,'parts/Card.ts'),'export const Card=0;');const plan=planner.plan(f.resolved,f.op);assert.ok(plan.ok,plan.reason);assert.ok(plan.edits[0].after.includes('<Existing/>'));assert.equal((plan.edits[0].after.match(/import /g)||[]).length,1);}finally{f.close();}
 const g=fixture('import {Card} from "./parts/Card";export default function Page(){return <main/>}');try{const plan=planner.plan(g.resolved,g.op);assert.ok(plan.ok,plan.reason);fs.writeFileSync(path.join(g.root,'parts/Card.js'),'export const Card=0;');assert.equal(tx.applyPlan(g.root,plan).ok,false);assert.equal(fs.readFileSync(g.resolved.file,'utf8'),g.page);}finally{g.close();}
});
test('component insertion maps every existing source identity with imports and self-closing frames',()=>{
 for(const source of ['"use client";export default function Page(){return <main><h1>Existing</h1></main>}','export default function Page(){return <><main/><aside>Sibling</aside></>}']){
  const f=fixture(source);try{const plan=planner.plan(f.resolved,f.op);assert.equal(plan.ok,true,plan.reason);const after=require('../src/id.cjs').collectElements(plan.edits[0].after,f.resolved.relPath).elements,mapping=new Map(plan.insertedComponent.sourceIdMap);for(const element of f.resolved.elements){const next=after.find(e=>e.id===(mapping.get(element.id)||element.id));assert.ok(next);assert.equal(next.kind,element.kind);}assert.ok(!f.resolved.elements.some(e=>e.id===plan.insertedComponent.instanceId));}finally{f.close();}
 }
});
