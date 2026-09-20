'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{makeApp,cleanup,Index}=require('./helpers.cjs'),reset=require('../src/component-reset.cjs'),transactions=require('../src/transactions.cjs');
const definition='export function Card({label="Default",count=2,note,onClick}:{label?:string;count?:number;note?:string;onClick:()=>void}){return <output onClick={onClick}>{label}{count}{note}</output>}';
function fixture(usage,extra={}){const root=fs.realpathSync(makeApp({'page.tsx':'import {Card} from "./Card";const action=()=>{};export default function Page(){return <main>'+usage+'</main>}','Card.tsx':definition,...extra})),index=new Index(root);index.scanAll();const resolved=[...index.idToFile.keys()].map(id=>index.resolve(id)).find(item=>item.element.kind==='instance');return {root,resolved,close(){index.close();cleanup(root);}};}
test('reset properties is one source plan preserving callbacks, children and sibling instances',()=>{
 const f=fixture('<Card label={getLabel()} count={9} note="Note" onClick={action} key="stable">Child</Card><Card label="Other"/>');try{
  const meta=reset.describe(f.resolved);assert.deepEqual(meta.names,['label','count','note']);const plan=reset.plan(f.resolved,{fileHash:f.resolved.hash,revision:meta.revision});assert.equal(plan.ok,true,plan.reason);assert.ok(plan.componentProp.parentId);assert.equal(plan.edits.filter(e=>e.before!==e.after).length,1);
  const after=f.resolved.source.replace('label={getLabel()}','').replace('count={9}','').replace('note="Note"','');assert.equal(plan.edits[0].after,after);assert.equal(transactions.applyPlan(f.root,plan).ok,true);assert.equal(fs.readFileSync(path.join(f.root,'Card.tsx'),'utf8'),definition);
 }finally{f.close();}
});
test('reset refuses changed source/defaults and dependency changes before commit',()=>{
 const f=fixture('<Card label="Override" count={7} note="Note" onClick={action}/>');try{
  const meta=reset.describe(f.resolved),op={fileHash:f.resolved.hash,revision:meta.revision};assert.equal(reset.plan(f.resolved,{...op,fileHash:'stale'}).ok,false);assert.equal(reset.plan(f.resolved,{...op,revision:'stale'}).ok,false);const plan=reset.plan(f.resolved,op);assert.equal(plan.ok,true,plan.reason);fs.appendFileSync(path.join(f.root,'Card.tsx'),'\n// changed');assert.equal(reset.plan(f.resolved,op).ok,false);assert.equal(transactions.applyPlan(f.root,plan).ok,false);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),f.resolved.source);
 }finally{f.close();}
});
test('reset does not offer spread-controlled, special or already inherited properties',()=>{
 for(const usage of ['<Card {...props} label="Override"/>','<Card onClick={action} key="stable"/>','<Card/>']){const f=fixture(usage);try{assert.equal(reset.describe(f.resolved),null);assert.equal(reset.plan(f.resolved,{fileHash:f.resolved.hash,revision:'x'}).ok,false);}finally{f.close();}}
});
test('untyped defaults also guard barrel resolution until reset commits',()=>{
 const f=fixture('<Card label="Override"/>',{'Card.tsx':'export {Card} from "./Actual"','Actual.tsx':'export function Card({label="Default"}){return <p>{label}</p>}' });try{
  const meta=reset.describe(f.resolved),plan=reset.plan(f.resolved,{fileHash:f.resolved.hash,revision:meta.revision});assert.equal(plan.ok,true,plan.reason);fs.writeFileSync(path.join(f.root,'Card.tsx'),'export {Card} from "./Other"');assert.equal(transactions.applyPlan(f.root,plan).ok,false);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),f.resolved.source);
 }finally{f.close();}
});
function selectionOp(resolved){const elements=require('../src/id.cjs').collectElements(resolved.source,resolved.relPath).elements.filter(e=>e.kind==='instance'),ids=elements.map(e=>e.id);return {fileHash:resolved.hash,ids,revisions:Object.fromEntries(elements.map(element=>[element.id,reset.describe({...resolved,element})?.revision||null]))};}
test('selection reset applies each component default and preserves already inherited usages',()=>{
 const f=fixture('<Card label="First" count={7}/><Card/><Other amount={9} note="Optional"/>',{'page.tsx':'import {Card} from "./Card";function Other({amount=4,note}:{amount?:number;note?:string}){return <p>{amount}{note}</p>}export default function Page(){return <main><Card label="First" count={7}/><Card/><Other amount={9} note="Optional"/></main>}'});try{
  const op=selectionOp(f.resolved),plan=reset.planSelection(f.resolved,op);assert.equal(plan.ok,true,plan.reason);assert.equal(plan.selection.length,3);assert.deepEqual(plan.selection.map(e=>e.id),op.ids);assert.equal(plan.edits[0].after,f.resolved.source.replace('label="First"','').replace('count={7}','').replace('amount={9}','').replace('note="Optional"',''));assert.equal(plan.componentReset.refreshIds.length,1);assert.equal(transactions.applyPlan(f.root,plan).ok,true);
 }finally{f.close();}
});
test('selection reset rejects stale members, duplicate ids and host ids atomically',()=>{
 const f=fixture('<Card label="First"/><Card count={7}/>');try{
  const op=selectionOp(f.resolved);for(const bad of [{...op,ids:[op.ids[0],op.ids[0]]},{...op,revisions:{...op.revisions,[op.ids[1]]:'stale'}},{...op,revisions:{...op.revisions,[op.ids[1]]:null}},{...op,ids:[...op.ids,'0000000000'],revisions:{...op.revisions,'0000000000':null}},{...op,fileHash:'stale'}])assert.equal(reset.planSelection(f.resolved,bad).ok,false);
  assert.equal(fs.readFileSync(f.resolved.file,'utf8'),f.resolved.source);
 }finally{f.close();}
});
test('selection reset guards shared external dependencies until commit',()=>{
 const f=fixture('<Card label="First"/><Card count={7}/>');try{const plan=reset.planSelection(f.resolved,selectionOp(f.resolved));assert.equal(plan.ok,true,plan.reason);assert.equal(plan.edits.filter(edit=>edit.file.endsWith('Card.tsx')).length,1);fs.appendFileSync(path.join(f.root,'Card.tsx'),'\n// changed');assert.equal(transactions.applyPlan(f.root,plan).ok,false);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),f.resolved.source);}finally{f.close();}
});
