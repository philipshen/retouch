'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {makeApp,cleanup,Index}=require('./helpers.cjs'),props=require('../src/component-props.cjs'),adapter=require('../src/adapters/react.cjs');
function fixture(attrs,params='title,count,enabled'){const source='function Page(){return <main><Card '+attrs+'/></main>} function Card({'+params+'}){return <h1>{title}</h1>}',root=fs.realpathSync(makeApp({'page.jsx':source})),index=new Index(root);index.scanAll();const resolved=[...index.idToFile.keys()].map(id=>index.resolve(id)).find(r=>r.element.kind==='instance');return {source,root,index,resolved,close(){index.close();cleanup(root);}};}
test('literal instance props preserve types, escaped text, siblings and the shared definition',()=>{
 const f=fixture('title="A &amp; B" count={-2.5} enabled');try{
  assert.deepEqual(props.describe(f.resolved,'title'),{editable:true,type:'string',value:'A & B'});
  for(const [name,value] of [['title','Quotes " & <tags>\nNext'],['count',3.75],['enabled',false]]){
   const plan=props.plan(f.resolved,{name,value,fileHash:f.resolved.hash});assert.ok(plan.ok,plan.reason);assert.ok(plan.componentProp.parentId);assert.equal(plan.edits[0].after.split('function Card')[1],f.source.split('function Card')[1]);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),f.source);
   assert.ok(require('../src/transactions.cjs').applyPlan(f.root,plan).ok);f.index.scanAll();assert.equal(props.describe(f.index.resolve(f.resolved.element.id),name).value,value);fs.writeFileSync(f.resolved.file,f.source);f.index.scanAll();
  }
 }finally{f.close();}
});
test('instance property editing refuses bindings, spreads, special props, duplicate attrs, invalid values and stale source',()=>{
 for(const [attrs,name,value] of [['title={label}','title','x'],['title="a" {...other}','title','x'],['key="a"','key','x'],['children="a"','children','x'],['title="a" title="b"','title','x'],['title="a"','title',true],['count={1}','count',Infinity],['','title','x']]){const f=fixture(attrs);try{assert.equal(props.plan(f.resolved,{name,value,fileHash:f.resolved.hash}).ok,false);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),f.source);}finally{f.close();}}
 const f=fixture('title="a"');try{assert.equal(props.plan(f.resolved,{name:'title',value:'x',fileHash:'stale'}).ok,false);const plan=props.plan(f.resolved,{name:'title',value:'x',fileHash:f.resolved.hash});fs.appendFileSync(f.resolved.file,'// external');assert.equal(require('../src/transactions.cjs').applyPlan(f.root,plan).ok,false);}finally{f.close();}
});
test('component descriptors expose literal editors while retaining expression source',()=>{
 const f=fixture('title="a" count={value} enabled');try{const result=adapter.describeComponent(f.resolved);assert.ok(result.ok,result.reason);assert.equal(result.props.find(p=>p.name==='title').editor.type,'string');assert.equal(result.props.find(p=>p.name==='count').value,'{value}');assert.match(result.props.find(p=>p.name==='count').editor.reason,/expression/);}finally{f.close();}
});


test('literal default props can be overridden and reset without copying the definition',()=>{
 const f=fixture('', 'title="Default",count=2,enabled=false');try{
  const info=props.describe(f.resolved,'title');assert.equal(info.inherited,true);assert.equal(info.value,'Default');
  const op={name:'title',value:'Override',fileHash:f.resolved.hash,definitionHash:info.definitionHash};assert.equal(props.plan(f.resolved,{...op,definitionHash:'stale'}).ok,false);
  const plan=props.plan(f.resolved,op);assert.ok(plan.ok,plan.reason);assert.ok(require('../src/transactions.cjs').applyPlan(f.root,plan).ok);f.index.scanAll();const usage=f.index.resolve(f.resolved.element.id),edited=props.describe(usage,'title');assert.equal(edited.canReset,true);assert.equal(edited.value,'Override');
  const reset=props.plan(usage,{name:'title',reset:true,fileHash:usage.hash,definitionHash:edited.definitionHash});assert.ok(reset.ok,reset.reason);assert.ok(!reset.edits[0].after.includes('title={"Override"}'));assert.equal(reset.edits[0].after.split('function Card')[1],f.source.split('function Card')[1]);assert.ok(require('../src/transactions.cjs').applyPlan(f.root,reset).ok);f.index.scanAll();assert.equal(props.describe(f.index.resolve(usage.element.id),'title').inherited,true);
 }finally{f.close();}
});
test('explicit reset can remove an expression override only when a literal default exists',()=>{
 const f=fixture('title={label}','title="Default"');try{const info=props.describe(f.resolved,'title');assert.equal(info.editable,undefined);assert.equal(info.canReset,true);assert.ok(props.plan(f.resolved,{name:'title',reset:true,fileHash:f.resolved.hash,definitionHash:info.definitionHash}).ok);}finally{f.close();}
 const g=fixture('title="Override"','title=compute()');try{assert.equal(props.plan(g.resolved,{name:'title',reset:true,fileHash:g.resolved.hash}).ok,false);}finally{g.close();}
});
test('default-dependent plans check an imported definition again at transaction commit',()=>{
 const root=fs.realpathSync(makeApp({'page.jsx':'import Card from "./Card";function Page(){return <main><Card/></main>}','Card.jsx':'export default function Card({title="Default"}){return <h1>{title}</h1>}'})),index=new Index(root);index.scanAll();try{
  const usage=[...index.idToFile.keys()].map(id=>index.resolve(id)).find(r=>r.element.kind==='instance'),info=props.describe(usage,'title'),plan=props.plan(usage,{name:'title',value:'Override',fileHash:usage.hash,definitionHash:info.definitionHash});assert.ok(plan.ok,plan.reason);assert.equal(plan.edits.length,2);const guard=plan.edits.find(e=>e.file.endsWith('Card.jsx'));assert.equal(guard.before,guard.after);fs.appendFileSync(guard.file,'\n// changed');assert.equal(require('../src/transactions.cjs').applyPlan(root,plan).ok,false);assert.equal(fs.readFileSync(usage.file,'utf8'),usage.source);
 }finally{index.close();cleanup(root);}
});
