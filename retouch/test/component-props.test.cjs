'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {makeApp,cleanup,Index}=require('./helpers.cjs'),props=require('../src/component-props.cjs'),adapter=require('../src/adapters/react.cjs');
function fixture(attrs){const source='function Page(){return <main><Card '+attrs+'/></main>} function Card({title,count,enabled}){return <h1>{title}</h1>}',root=fs.realpathSync(makeApp({'page.jsx':source})),index=new Index(root);index.scanAll();const resolved=[...index.idToFile.keys()].map(id=>index.resolve(id)).find(r=>r.element.kind==='instance');return {source,root,index,resolved,close(){index.close();cleanup(root);}};}
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
