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

test('TypeScript literal choices constrain existing props and inherited defaults',()=>{
 const sources=[
 'function Card({title="small"}:{title:"small"|"large"}){return <h1/>}',
 'type Size="small"|"large";type Props={title:Size};function Card({title="small"}:Props){return <h1/>}',
 'interface Props {title?:"small"|"large"} function Card({title="small"}:Props){return <h1/>}',
 ];
 for(const definition of sources){const root=fs.realpathSync(makeApp({'page.tsx':'function Page(){return <main><Card title="small"/></main>}'+definition})),index=new Index(root);index.scanAll();try{
  const usage=[...index.idToFile.keys()].map(id=>index.resolve(id)).find(r=>r.element.kind==='instance'),info=props.describe(usage,'title');assert.deepEqual(info.choices,['small','large']);
  assert.equal(props.plan(usage,{name:'title',value:'medium',fileHash:usage.hash,definitionHash:info.definitionHash}).ok,false);
  assert.equal(props.plan(usage,{name:'title',value:'large',fileHash:usage.hash,definitionHash:'stale'}).ok,false);
  assert.ok(props.plan(usage,{name:'title',value:'large',fileHash:usage.hash,definitionHash:info.definitionHash}).ok);
  const reset=props.plan(usage,{name:'title',reset:true,fileHash:usage.hash,definitionHash:info.definitionHash});assert.ok(reset.ok,reset.reason);assert.ok(require('../src/transactions.cjs').applyPlan(root,reset).ok);index.scanAll();const inherited=props.describe(index.resolve(usage.element.id),'title');assert.equal(inherited.inherited,true);assert.deepEqual(inherited.choices,['small','large']);
 }finally{index.close();cleanup(root);}}
});
test('choice discovery preserves primitive types and refuses unresolved or unbounded contracts',()=>{
 const choice=require('../src/component-prop-choices.cjs').choices;
 for(const [type,expected] of [['-1|2',[-1,2]],['true|false',[true,false]],['string|null',null],['"a"|string',null],['Missing',null]]){
  const source='function Card({title}:{title:'+type+'}){return <h1/>}',ast=require('../src/id.cjs').parseSource(source),result=choice({},'title',{source,fn:ast.program.body[0]});assert.deepEqual(result?.choices||null,expected);
 }
});

test('choice-only writes guard an imported definition without adding it to history',()=>{
 const root=fs.realpathSync(makeApp({'page.tsx':'import Card from "./Card";function Page(){return <main><Card title="small"/></main>}','Card.tsx':'export default function Card({title}:{title:"small"|"large"}){return <h1>{title}</h1>}'})),index=new Index(root);index.scanAll();try{
  const usage=[...index.idToFile.keys()].map(id=>index.resolve(id)).find(r=>r.element.kind==='instance'),info=props.describe(usage,'title'),plan=props.plan(usage,{name:'title',value:'large',fileHash:usage.hash,definitionHash:info.definitionHash});assert.ok(plan.ok,plan.reason);assert.equal(plan.edits.length,2);const guard=plan.edits.find(e=>e.file.endsWith('Card.tsx'));assert.equal(guard.before,guard.after);
  fs.writeFileSync(guard.file,guard.before.replace('"large"','"medium"'));assert.equal(require('../src/transactions.cjs').applyPlan(root,plan).ok,false);assert.equal(fs.readFileSync(usage.file,'utf8'),usage.source);
  fs.writeFileSync(guard.file,guard.before);const applied=require('../src/transactions.cjs').applyPlan(root,plan);assert.ok(applied.ok,applied.reason);assert.equal(applied.edits.length,1);assert.equal(applied.edits[0].file,usage.file);
 }finally{index.close();cleanup(root);}
});


test('variant choices follow inherited and intersected module-local prop contracts',()=>{
 const discover=require('../src/component-prop-choices.cjs').choices;
 for(const declarations of [
  'interface Base {size?: "small"|"large"} interface Props extends Base {title:string}',
  'type Base={size:"small"|"large"};type Props=Base & {title:string}',
  'interface Base {size:"small"|"large"} interface Left extends Base {} interface Right extends Base {} interface Props extends Left,Right {}',
  'type Size="small"|"large";type Variant={size:Size};interface Base {title:string} type Props=Base & Variant',
 ]){const source=declarations+';function Card({size}:Props){return <h1/>}',ast=require('../src/id.cjs').parseSource(source),fn=ast.program.body.find(n=>n.type==='FunctionDeclaration');assert.deepEqual(discover({},'size',{source,fn}).choices,['small','large']);}
});
test('contract composition refuses cycles, missing bases and ambiguous property declarations',()=>{
 const discover=require('../src/component-prop-choices.cjs').choices;
 for(const declarations of [
  'interface Props extends Missing {size:"small"|"large"}',
  'interface Base extends Props {} interface Props extends Base {size:"small"|"large"}',
  'type Base=Props;type Props=Base & {size:"small"|"large"}',
  'interface Base {size:"small"|"large"} interface Props extends Base {size:"small"}',
  'type Props={size:"small"|"large"} & {size:"small"}',
  'interface Base<T> {size:T} interface Props extends Base<"small"|"large"> {}',
 ]){const source=declarations+';function Card({size}:Props){return <h1/>}',ast=require('../src/id.cjs').parseSource(source),fn=ast.program.body.find(n=>n.type==='FunctionDeclaration');assert.equal(discover({},'size',{source,fn}),null,declarations);}
});

test('omitted choices can be set and only optional choices can be unset',()=>{
 for(const optional of [true,false]){
  const source='function Page(){return <main><Card/></main>}function Card({size}:{size'+(optional?'?':'')+':"small"|"large"}){return <h1/>}',root=fs.realpathSync(makeApp({'page.tsx':source})),index=new Index(root);index.scanAll();try{
   const usage=[...index.idToFile.keys()].map(id=>index.resolve(id)).find(r=>r.element.kind==='instance'),info=props.describe(usage,'size');assert.equal(info.unset,true);assert.equal(info.editable,true);assert.equal(info.allowUnset,optional);
   assert.equal(props.plan(usage,{name:'size',value:'large',fileHash:usage.hash,definitionHash:'stale'}).ok,false);
   const set=props.plan(usage,{name:'size',value:'large',fileHash:usage.hash,definitionHash:info.definitionHash});assert.ok(set.ok,set.reason);assert.ok(require('../src/transactions.cjs').applyPlan(root,set).ok);index.scanAll();const fresh=index.resolve(usage.element.id),current=props.describe(fresh,'size');assert.equal(current.value,'large');assert.equal(current.canClear,optional);
   assert.equal(props.plan(fresh,{name:'size',clear:true,fileHash:fresh.hash,definitionHash:'stale'}).ok,false);
   const clear=props.plan(fresh,{name:'size',clear:true,fileHash:fresh.hash,definitionHash:current.definitionHash});assert.equal(clear.ok,optional);if(optional){assert.ok(require('../src/transactions.cjs').applyPlan(root,clear).ok);index.scanAll();assert.equal(props.describe(index.resolve(usage.element.id),'size').unset,true);assert.equal(clear.edits[0].after.split('function Card')[1],source.split('function Card')[1]);}
  }finally{index.close();cleanup(root);}
 }
});


test('variant choices expand nested literal union aliases in source order',()=>{
 const declarations='type Compact="small"|"medium";type Expanded="large"|"huge";type Size=Compact|Expanded|"small";';
 const source=declarations+'function Card({size}:{size:Size}){return <h1/>}',ast=require('../src/id.cjs').parseSource(source),fn=ast.program.body.find(n=>n.type==='FunctionDeclaration'),result=require('../src/component-prop-choices.cjs').choices({},'size',{source,fn});assert.deepEqual(result.choices,['small','medium','large','huge']);
});
test('nested choice expansion rejects recursive, mixed, unbounded and oversized unions',()=>{
 const declarations=[
  'type Size="small"|Size;',
  'type First="small"|Second;type Second="large"|First;type Size=First;',
  'type Extra=string;type Size="small"|Extra;',
  'type Extra=1|2;type Size="small"|Extra;',
  'type Size='+Array.from({length:101},(_,i)=>JSON.stringify('choice'+i)).join('|')+';',
 ];
 for(const prefix of declarations){const source=prefix+'function Card({size}:{size:Size}){return <h1/>}',ast=require('../src/id.cjs').parseSource(source),fn=ast.program.body.find(n=>n.type==='FunctionDeclaration');assert.equal(require('../src/component-prop-choices.cjs').choices({},'size',{source,fn}),null);}
});


test('component descriptors expose omitted declared choices from a typed props object',()=>{
 const source='type Tone="calm"|"bold";interface Base {tone?:Tone}type Props=Base & {label?:string};function Page(){return <main><Card/></main>}function Card(props:Props){return <h1>{props.label}</h1>}',root=fs.realpathSync(makeApp({'page.tsx':source})),index=new Index(root);index.scanAll();try{
  const usage=[...index.idToFile.keys()].map(id=>index.resolve(id)).find(r=>r.element.kind==='instance'),component=adapter.describeComponent(usage);assert.ok(component.ok,component.reason);assert.deepEqual(component.props.map(p=>p.name),['tone','label']);const tone=component.props.find(p=>p.name==='tone');assert.deepEqual(tone.editor.choices,['calm','bold']);assert.equal(tone.editor.unset,true);assert.equal(component.props.find(p=>p.name==='label').editor.editable,undefined);
  const plan=props.plan(usage,{name:'tone',value:'bold',fileHash:usage.hash,definitionHash:tone.editor.definitionHash});assert.ok(plan.ok,plan.reason);assert.ok(plan.edits[0].after.includes('<Card tone={"bold"}/>'));assert.equal(plan.edits[0].after.split('function Card')[1],source.split('function Card')[1]);
 }finally{index.close();cleanup(root);}
});


test('built-in utility contracts preserve choices and optionality',()=>{
 const inspect=require('../src/component-prop-choices.cjs');
 for(const [type,optional,names] of [
  ['Partial<Base>',true,['size','tone']],
  ['Required<Partial<Base>>',false,['size','tone']],
  ['Readonly<Partial<Base>>',true,['size','tone']],
  ['Pick<Partial<Base>,Keys>',true,['size']],
  ['Omit<Partial<Base>,"tone">',true,['size']],
 ]){const source='type Keys="size";interface Base {size:"small"|"large";tone:"calm"|"bold"}function Card(props:'+type+'){return <h1/>}',ast=require('../src/id.cjs').parseSource(source),definition={source,fn:ast.program.body.find(n=>n.type==='FunctionDeclaration')};assert.deepEqual(inspect.names({},definition),names);const choice=inspect.choices({},'size',definition);assert.deepEqual(choice.choices,['small','large']);assert.equal(choice.optional,optional);}
});
test('utility discovery refuses shadowed names, invalid arity, and unsupported keys',()=>{
 const inspect=require('../src/component-prop-choices.cjs');
 for(const [prefix,type] of [
  ['import type {Partial} from "./custom";','Partial<Base>'],
  ['type Partial<T>={size:"custom"};','Partial<Base>'],
  ['class Partial<T> { custom!:T }','Partial<Base>'],
  ['', 'Partial<Base,Base>'],
  ['', 'Pick<Base,"missing">'],
  ['', 'Pick<Base,keyof Base>'],
 ]){const source=prefix+'interface Base {size:"small"|"large"}function Card(props:'+type+'){return <h1/>}',ast=require('../src/id.cjs').parseSource(source),definition={source,fn:ast.program.body.find(n=>n.type==='FunctionDeclaration')};assert.equal(inspect.choices({},'size',definition),null);}
});
