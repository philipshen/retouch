'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {makeApp,cleanup,Index,pick,id}=require('./helpers.cjs'),planner=require('../src/insert-component.cjs'),definitions=require('../src/component-definitions.cjs'),tx=require('../src/transactions.cjs');
function fixture(attrs='label="Keep" tone="old" key={itemKey}',children=''){
 const source='import {Old} from "./Old";const itemKey="stable";export default function Page(){return <main><Old '+attrs+'>'+children+'</Old><aside>Sibling</aside></main>}',target='export function Next({label,width,tone="bold"}:{label:string;width:number;tone?:"calm"|"bold"}){return <section>{label}</section>}',root=fs.realpathSync(makeApp({'Page.tsx':source,'Old.tsx':'export function Old(){return <article/>}','Next.tsx':target})),index=new Index(root);index.scanAll();const resolved=pick(index,root,'Page.tsx','Old').resolved,def=definitions.definitions(target,'Next.tsx')[0],op={type:'swapComponent',fileHash:resolved.hash,definitionFile:'Next.tsx',definitionId:def.definitionId,definitionHash:id.contentHash(target),props:{width:200},dropProps:['tone']};return {root,index,resolved,op,source,target,close(){index.close();cleanup(root);}};
}
test('swap preserves compatible overrides and key, requires review of removed overrides and keeps definitions unchanged',()=>{
 const f=fixture();try{assert.match(planner.plan(f.resolved,{...f.op,dropProps:[]}).reason,/Review/);const plan=planner.plan(f.resolved,f.op);assert.ok(plan.ok,plan.reason);assert.match(plan.edits[0].after,/<Next key=\{itemKey\} label=\{"Keep"\} width=\{200\}\/>/);assert.ok(plan.edits[0].after.includes('<aside>Sibling</aside>'));assert.equal(plan.insertedComponent.previousInstanceId,f.resolved.element.id);assert.ok(tx.applyPlan(f.root,plan).ok);f.index.scanAll();assert.equal(require('../src/components.cjs').describe(f.index.resolve(plan.insertedComponent.instanceId)).props.find(prop=>prop.name==='label').editor.value,'Keep');assert.equal(fs.readFileSync(path.join(f.root,'Next.tsx'),'utf8'),f.target);assert.ok(tx.applyPlan(f.root,{ok:true,edits:[{file:f.resolved.file,before:plan.edits[0].after,after:f.source}]}).ok);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),f.source);}finally{f.close();}
});
test('swap refuses expressions, spreads, refs, nested children and duplicate overrides without writing',()=>{
 for(const [attrs,children] of [['label={itemKey}',''],['{...props}',''],['ref={ref}',''],['label="x" label="y"',''],['label="x"','<b>Keep content</b>']]){const f=fixture(attrs,children);try{assert.equal(planner.plan(f.resolved,f.op).ok,false);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),f.source);}finally{f.close();}}
});
test('swap validates newly supplied required props and rejects a stale usage',()=>{
 const f=fixture();try{assert.match(planner.plan(f.resolved,{...f.op,props:{}}).reason,/required.*width/);assert.equal(planner.plan(f.resolved,{...f.op,props:{width:'wide'}}).ok,false);assert.equal(planner.plan(f.resolved,{...f.op,fileHash:'stale'}).ok,false);}finally{f.close();}
});
test('swapping the last imported usage retains a side-effect import and maps shifted source positions',()=>{
 const f=fixture();try{const plan=planner.plan(f.resolved,f.op);assert.ok(plan.ok,plan.reason);assert.match(plan.edits[0].after,/import "\.\/Old";/);assert.doesNotMatch(plan.edits[0].after,/import \{Old\}/);assert.ok(tx.applyPlan(f.root,plan).ok);f.index.scanAll();assert.equal(f.index.resolve(plan.insertedComponent.parentId).element.node.openingElement.name.name,'main');assert.equal(f.index.resolve(plan.insertedComponent.instanceId).element.node.openingElement.name.name,'Next');}finally{f.close();}
});
test('swap cleanup preserves bindings used outside the replaced JSX or by the retained key',()=>{
 for(const [attrs,suffix] of [['label="Keep" tone="old" key={Old.name}',''],['label="Keep" tone="old"',';export const StillUsed=Old;'],['label="Keep" tone="old"',';type OldType=typeof Old;']]){
  const f=fixture(attrs);try{if(suffix){fs.appendFileSync(f.resolved.file,suffix);f.index.scanAll();f.resolved=f.index.resolve(f.resolved.element.id);f.op.fileHash=f.resolved.hash;}const plan=planner.plan(f.resolved,f.op);assert.ok(plan.ok,plan.reason);assert.ok(plan.edits[0].after.includes('import {Old} from "./Old";'));}finally{f.close();}
 }
});
test('cleanup preserves sibling imports and comments, and retains evaluation when only types remain',()=>{
 const parse=require('../src/id.cjs').parseSource,traverse=require('@babel/traverse').default,cleanupImport=require('../src/component-import-cleanup.cjs');
 for(const [source,expected] of [
  ['import Default, {Old, Other} from "./Old";const C=()=> <Old/>;','import Default, { Other } from "./Old";'],
  ['import Old, {Other} from "./Old";const C=()=> <Old/>;','import { Other } from "./Old";'],
  ['import Default, * as Old from "./Old";const C=()=> <Old.Card/>;','import Default from "./Old";'],
  ['import { /* note */ Old, type Props} from "./Old";const C=()=> <Old/>;','/* note */\nimport { type Props } from "./Old";\nimport "./Old";'],
  ['const C=()=> <Old/>;import {Old} from "./Old";','import "./Old";'],
 ]){const ast=parse(source);let selected;traverse(ast,{JSXElement(p){selected=p;p.stop();}});const edit=cleanupImport(ast,selected,source,'New');assert.ok(edit);assert.equal(edit.after,expected);assert.doesNotThrow(()=>parse(source.slice(0,edit.start)+edit.after+source.slice(edit.end)));}
});
test('retained side-effect import still evaluates the old module after removing its unused binding',async()=>{
 const {pathToFileURL}=require('node:url'),parse=require('../src/id.cjs').parseSource,traverse=require('@babel/traverse').default,cleanupImport=require('../src/component-import-cleanup.cjs');
 const key='retouchSwap'+Date.now()+Math.random(),root=makeApp({'Old.mjs':'globalThis['+JSON.stringify(key)+']=(globalThis['+JSON.stringify(key)+']||0)+1;export const Old=()=>null;'});
 try{const source='import {Old} from "./Old.mjs";const C=()=> <Old/>;',ast=parse(source);let selected;traverse(ast,{JSXElement(p){selected=p;p.stop();}});const edit=cleanupImport(ast,selected,source,'New'),after=(source.slice(0,edit.start)+edit.after+source.slice(edit.end)).replace('const C=()=> <Old/>;','export const C=()=>null;');const file=path.join(root,'After.mjs');fs.writeFileSync(file,after);await import(pathToFileURL(file).href);assert.equal(globalThis[key],1);}finally{delete globalThis[key];cleanup(root);}
});
test('swap supports direct function roots and conditional roots without inventing a containing frame',()=>{
 for(const conditional of [false,true]){const f=fixture();try{
  const source=f.source.replace('<main>','').replace('<aside>Sibling</aside></main>','').replace('return <Old',conditional?'return true ? <Old':'return <Old').replace('</Old>}','</Old>'+(conditional?' : null':'')+'}');
  fs.writeFileSync(f.resolved.file,source);f.index.scanAll();const resolved=pick(f.index,f.root,'Page.tsx','Old').resolved,plan=planner.plan(resolved,{...f.op,fileHash:resolved.hash});assert.ok(plan.ok,plan.reason);assert.equal(plan.insertedComponent.parentId,null);assert.equal(plan.insertedComponent.previousParentId,null);assert.ok(tx.applyPlan(f.root,plan).ok);f.index.scanAll();assert.equal(require('../src/components.cjs').describe(f.index.resolve(plan.insertedComponent.instanceId)).props.find(prop=>prop.name==='label').editor.value,'Keep');assert.ok(tx.applyPlan(f.root,{ok:true,edits:[{file:f.resolved.file,before:plan.edits[0].after,after:source}]}).ok);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),source);
 }finally{f.close();}}
});
test('swap retains the instance layer name without turning it into a component prop',()=>{
 const f=fixture();try{
  const names=require('../src/jsx-layer-name.cjs'),named=names.plan(f.resolved,{fileHash:f.resolved.hash,name:'Hero */ summary'});assert.ok(tx.applyPlan(f.root,named).ok);f.index.scanAll();const resolved=f.index.resolve(f.resolved.element.id),plan=planner.plan(resolved,{...f.op,fileHash:resolved.hash});assert.ok(plan.ok,plan.reason);assert.ok(tx.applyPlan(f.root,plan).ok);f.index.scanAll();const swapped=f.index.resolve(plan.insertedComponent.instanceId);assert.equal(names.describe(swapped).layerName,'Hero */ summary');assert.deepEqual(swapped.element.node.openingElement.attributes.map(attr=>attr.name.name),['key','label','width']);
 }finally{f.close();}
});
test('component swapping maps its replacement usage and preserves sibling identities through import changes',()=>{
 const f=fixture();try{const plan=planner.plan(f.resolved,f.op);assert.equal(plan.ok,true,plan.reason);const mapping=new Map(plan.insertedComponent.sourceIdMap);assert.equal(mapping.get(f.resolved.element.id),plan.insertedComponent.instanceId);const next=id.collectElements(plan.edits[0].after,f.resolved.relPath).elements;assert.deepEqual(next.map(e=>e.id).sort(),f.resolved.elements.map(e=>mapping.get(e.id)||e.id).sort());}finally{f.close();}
});
