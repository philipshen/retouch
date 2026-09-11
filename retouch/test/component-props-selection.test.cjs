'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {makeApp,cleanup,Index}=require('./helpers.cjs'),props=require('../src/component-props.cjs'),react=require('../src/adapters/react.cjs'),{applyPlan}=require('../src/transactions.cjs');
function fixture(source,extra={},name='page.jsx'){
 const root=fs.realpathSync(makeApp({[name]:source,...extra})),index=new Index(root);index.scanAll();
 const usages=[...index.idToFile.keys()].map(id=>index.resolve(id)).filter(r=>r.file===path.join(root,name)&&r.element.kind==='instance');
 const resolved=usages[0],ids=usages.map(r=>r.element.id);
 return {root,index,resolved,ids,op:{type:'setComponentPropSelection',id:ids[0],ids,fileHash:resolved.hash,name:'title',value:'Shared'},close(){index.close();cleanup(root);}};
}
const definition='function Card({title}){return <h1>{title}</h1>}';
const source='function Page(){return <main><Card title="First"/><Card title="Second"/><p>Unselected</p></main>}'+definition;
function hashes(f,name='title'){return Object.fromEntries(f.ids.map(id=>[id,props.describe(f.index.resolve(id),name).definitionHash]).filter(([,hash])=>hash!==undefined));}
test('component property selection changes distinct usages atomically with stable IDs and exact reversible snapshots',()=>{
 const f=fixture(source);try{
  const plan=react.planOp(f.resolved,f.op);assert.ok(plan.ok,plan.reason);assert.equal(plan.edits.length,1);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),source);
  assert.deepEqual(plan.selection.map(info=>info.id),f.ids);assert.ok(plan.selection.every(info=>info.kind==='instance'&&info.hash===plan.hash));
  const after=source.replace('title="First"','title={"Shared"}').replace('title="Second"','title={"Shared"}');assert.equal(plan.edits[0].after,after);
  const result=applyPlan(f.root,plan);assert.ok(result.ok,result.reason);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),after);
  assert.ok(applyPlan(f.root,{ok:true,edits:result.edits.map(edit=>({...edit,before:edit.after,after:edit.before}))}).ok);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),source);
 }finally{f.close();}
});
test('component batch validates every member before writing and rejects invalid selections',()=>{
 for(const second of ['title={binding}','title="Second" {...other}','title="Second" title="Duplicate"','title={2}']){
  const f=fixture(source.replace('title="Second"',second));try{const result=react.planOp(f.resolved,f.op);assert.equal(result.refused,true,second);assert.equal(result.edits,undefined);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),f.resolved.source);}finally{f.close();}
 }
 const f=fixture(source);try{
  const host=f.resolved.elements.find(e=>e.kind==='host').id;
  for(const extra of [{fileHash:'stale'},{ids:[f.ids[0]]},{ids:[f.ids[0],f.ids[0]]},{ids:[f.ids[0],host]},{ids:[f.ids[0],'0000000000']},{definitionHashes:[]},{definitionHashes:null},{definitionHashes:false},{definitionHashes:{other:'hash'}},{name:'key'}]){const result=react.planOp(f.resolved,{...f.op,...extra});assert.equal(result.refused,true,JSON.stringify(extra));assert.equal(result.edits,undefined);}
  const plan=react.planOp(f.resolved,f.op);fs.appendFileSync(f.resolved.file,'// external');assert.equal(applyPlan(f.root,plan).ok,false);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),source+'// external');
 }finally{f.close();}
});
test('same-file typed defaults share their original revision for all usage overrides and resets',()=>{
 const original='function Page(){return <main><Card/><Card/></main>} function Card({title="small"}:{title?:"small"|"large"}){return <h1>{title}</h1>}';
 const f=fixture(original,{},'page.tsx');try{
  const op={...f.op,value:'large',definitionHashes:hashes(f)},plan=react.planOp(f.resolved,op);assert.ok(plan.ok,plan.reason);assert.equal((plan.edits[0].after.match(/title=\{"large"\}/g)||[]).length,2);assert.ok(plan.edits[0].after.endsWith(original.slice(original.indexOf(' function Card'))));
  assert.ok(applyPlan(f.root,plan).ok);f.index.scanAll();
  const reset=react.planOp(f.index.resolve(f.ids[0]),{...op,fileHash:f.index.resolve(f.ids[0]).hash,reset:true,definitionHashes:hashes(f)});assert.ok(reset.ok,reset.reason);assert.equal((reset.edits[0].after.match(/title=\{"large"\}/g)||[]).length,0);
  assert.equal(react.planOp(f.index.resolve(f.ids[0]),{...op,fileHash:f.index.resolve(f.ids[0]).hash,definitionHashes:op.definitionHashes}).ok,false,'old same-file contract revision is refused');
 }finally{f.close();}
});
test('component batch preserves shared dependency guards through commit, including no-op members',()=>{
 const main='import Card from "./Card";function Page(){return <main><Card title="small"/><Card title="large"/></main>}',def='export default function Card({title}:{title:"small"|"large"}){return <h1>{title}</h1>}';
 const f=fixture(main,{'Card.tsx':def},'page.tsx');try{
  const plan=react.planOp(f.resolved,{...f.op,value:'large',definitionHashes:hashes(f)});assert.ok(plan.ok,plan.reason);assert.equal(plan.edits.length,2);assert.equal(plan.edits[1].before,plan.edits[1].after);assert.equal(plan.edits[0].after,main.replace('title="small"','title={"large"}'));
  fs.appendFileSync(path.join(f.root,'Card.tsx'),'// contract changed');assert.equal(applyPlan(f.root,plan).ok,false);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),main);
 }finally{f.close();}
});
test('nested usages edit non-overlapping attributes and equivalent literals keep original spelling',()=>{
 const nested='function Page(){return <Card title="Outer" accessory={<Card title="Inner"/>}/>}'+definition;
 const f=fixture(nested);try{const result=react.planOp(f.resolved,f.op);assert.ok(result.ok,result.reason);assert.equal(result.edits[0].after,nested.replace('title="Outer"','title={"Shared"}').replace('title="Inner"','title={"Shared"}'));}finally{f.close();}
 const g=fixture(source.replace('First','Shared').replace('Second','Shared'));try{const result=react.applyOp(g.resolved,g.op);assert.ok(result.ok,result.reason);assert.deepEqual(result.edits,[]);assert.equal(fs.readFileSync(g.resolved.file,'utf8'),g.resolved.source);}finally{g.close();}
});

test('optional properties clear together and incompatible declared values refuse the whole batch',()=>{
 const original='function Page(){return <main><Card title="First"/><Card title="Second"/></main>} function Card({title}:{title?:string}){return <h1>{title}</h1>}';
 const f=fixture(original,{},'page.tsx');try{
  const plan=react.planOp(f.resolved,{...f.op,clear:true,definitionHashes:hashes(f)});assert.ok(plan.ok,plan.reason);assert.equal(plan.edits[0].after,original.replace('title="First"','').replace('title="Second"',''));
  const refused=react.planOp(f.resolved,{...f.op,value:42,definitionHashes:hashes(f)});assert.equal(refused.refused,true);assert.equal(refused.edits,undefined);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),original);
 }finally{f.close();}
});
