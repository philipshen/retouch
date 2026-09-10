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
  const usage=[...index.idToFile.keys()].map(id=>index.resolve(id)).find(r=>r.element.kind==='instance'),component=adapter.describeComponent(usage);assert.ok(component.ok,component.reason);assert.deepEqual(component.props.map(p=>p.name),['tone','label']);const tone=component.props.find(p=>p.name==='tone');assert.deepEqual(tone.editor.choices,['calm','bold']);assert.equal(tone.editor.unset,true);assert.equal(component.props.find(p=>p.name==='label').editor.type,'string');assert.equal(component.props.find(p=>p.name==='label').editor.unset,true);
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
  ['', 'Pick<Base,string>'],
 ]){const source=prefix+'interface Base {size:"small"|"large"}function Card(props:'+type+'){return <h1/>}',ast=require('../src/id.cjs').parseSource(source),definition={source,fn:ast.program.body.find(n=>n.type==='FunctionDeclaration')};assert.equal(inspect.choices({},'size',definition),null);}
});


test('boolean keyword contracts expose both boolean values and preserve optional state',()=>{
 for(const optional of [true,false]){const source='interface Props {emphasized'+(optional?'?':'')+':boolean}function Page(){return <main><Card/></main>}function Card(props:Props){return <h1/>}',root=fs.realpathSync(makeApp({'page.tsx':source})),index=new Index(root);index.scanAll();try{
  const usage=[...index.idToFile.keys()].map(id=>index.resolve(id)).find(r=>r.element.kind==='instance'),info=props.describe(usage,'emphasized');assert.deepEqual(info.choices,[true,false]);assert.equal(info.unset,true);assert.equal(info.allowUnset,optional);
  const op={name:'emphasized',fileHash:usage.hash,definitionHash:info.definitionHash};assert.equal(props.plan(usage,{...op,value:'true'}).ok,false);for(const value of [true,false]){const plan=props.plan(usage,{...op,value});assert.ok(plan.ok,plan.reason);assert.ok(plan.edits[0].after.includes('emphasized={'+value+'}'));}
 }finally{index.close();cleanup(root);}}
});


test('finite keyof contracts expose supported Pick and Omit variants',()=>{
 const inspect=require('../src/component-prop-choices.cjs');
 for(const type of ['Pick<Base,keyof Selected>','Omit<Base,keyof Excluded>','Pick<Base,Keys>']){
  const source='interface Base {size:"small"|"large";tone:"calm"|"bold"}interface Selected {size:string}interface Excluded {tone:string}type Keys=keyof Selected;function Card(props:'+type+'){return <h1/>}',ast=require('../src/id.cjs').parseSource(source),definition={source,fn:ast.program.body.find(n=>n.type==='FunctionDeclaration')};assert.deepEqual(inspect.names({},definition),['size']);assert.deepEqual(inspect.choices({},'size',definition).choices,['small','large']);
 }
});
test('keyof expansion refuses unbounded keys, computed keys and recursive selections',()=>{
 const inspect=require('../src/component-prop-choices.cjs');
 for(const prefix of [
  'interface Keys {[key:string]:string}type Props=Pick<Base,keyof Keys>;',
  'interface Keys {[Symbol.iterator]():void}type Props=Pick<Base,keyof Keys>;',
  'type Props=Pick<Base,keyof Props>;',
 ]){const source='interface Base {size:"small"|"large"}'+prefix+'function Card(props:Props){return <h1/>}',ast=require('../src/id.cjs').parseSource(source),definition={source,fn:ast.program.body.find(n=>n.type==='FunctionDeclaration')};assert.equal(inspect.choices({},'size',definition),null);}
});


test('finite variant utilities filter literals by declared type membership',()=>{
 const discover=require('../src/component-prop-choices.cjs').choices;
 for(const [type,expected] of [
  ['Exclude<All,"medium">',['small','large']],
  ['Extract<All,"small"|"large">',['small','large']],
  ['Exclude<Extract<All,string>,"medium">',['small','large']],
  ['Extract<"small"|1|string[],string> ',null],
  ['Extract<"small"|1,string>',['small']],
  ['Exclude<boolean,false>',[true]],
  ['Extract<-1|2,number>',[-1,2]],
  ['Exclude<All,never>',['small','medium','large']],
 ]){const source='type All="small"|"medium"|"large";function Card(props:{size:'+type+'}){return <h1/>}',ast=require('../src/id.cjs').parseSource(source),definition={source,fn:ast.program.body.find(n=>n.type==='FunctionDeclaration')};assert.deepEqual(discover({},'size',definition)?.choices||null,expected);}
});
test('variant filtering rejects recursive, shadowed, empty and unknown filter contracts',()=>{
 const discover=require('../src/component-prop-choices.cjs').choices;
 for(const [prefix,type] of [
  ['type Size=Exclude<Size,"small">;', 'Size'],
  ['import type {Exclude} from "./custom";', 'Exclude<"small"|"large","large">'],
  ['', 'Extract<"small",never>'],
  ['', 'Exclude<"small",unknown>'],
  ['', 'Exclude<"small",Missing>'],
  ['', 'Extract<"small">'],
 ]){const source=prefix+'function Card(props:{size:'+type+'}){return <h1/>}',ast=require('../src/id.cjs').parseSource(source),definition={source,fn:ast.program.body.find(n=>n.type==='FunctionDeclaration')};assert.equal(discover({},'size',definition),null);}
});

test('omitted declared text and number props preserve empty, zero and unset states',()=>{
 for(const [type,value,invalid] of [['string','',0],['number',0,'0']]){const source='interface Props {value?:'+type+'}function Page(){return <main><Card/></main>}function Card(props:Props){return <h1/>}',root=fs.realpathSync(makeApp({'page.tsx':source})),index=new Index(root);index.scanAll();try{
  const usage=[...index.idToFile.keys()].map(id=>index.resolve(id)).find(r=>r.element.kind==='instance'),info=props.describe(usage,'value');assert.equal(info.type,type);assert.equal(info.unset,true);assert.equal(info.contractDefined,true);assert.equal(info.choices,undefined);const op={name:'value',fileHash:usage.hash,definitionHash:info.definitionHash};assert.equal(props.plan(usage,{...op,value:invalid}).ok,false);assert.equal(props.plan(usage,{...op,value,definitionHash:'stale'}).ok,false);
  const plan=props.plan(usage,{...op,value});assert.ok(plan.ok,plan.reason);assert.ok(require('../src/transactions.cjs').applyPlan(root,plan).ok);index.scanAll();const fresh=index.resolve(usage.element.id),current=props.describe(fresh,'value');assert.equal(current.value,value);assert.equal(current.canClear,true);const clear=props.plan(fresh,{name:'value',clear:true,fileHash:fresh.hash,definitionHash:current.definitionHash});assert.ok(clear.ok,clear.reason);assert.ok(!clear.edits[0].after.includes('value={'));
 }finally{index.close();cleanup(root);}}
});
test('declared primitive props reject incompatible literals and guard imported type changes',()=>{
 const root=fs.realpathSync(makeApp({'page.tsx':'import Card from "./Card";function Page(){return <main><Card value="wrong"/></main>}','Card.tsx':'export default function Card(props:{value:number}){return <h1/>}'})),index=new Index(root);index.scanAll();try{
  const usage=[...index.idToFile.keys()].map(id=>index.resolve(id)).find(r=>r.element.kind==='instance');assert.equal(props.describe(usage,'value').editable,undefined);assert.equal(props.plan(usage,{name:'value',value:2,fileHash:usage.hash}).ok,false);
  fs.writeFileSync(usage.file,usage.source.replace(' value="wrong"',''));index.scanAll();const fresh=index.resolve(usage.element.id),info=props.describe(fresh,'value'),plan=props.plan(fresh,{name:'value',value:2,fileHash:fresh.hash,definitionHash:info.definitionHash});assert.ok(plan.ok,plan.reason);assert.equal(plan.edits.length,2);const guard=plan.edits.find(e=>e.file.endsWith('Card.tsx'));fs.appendFileSync(guard.file,'\n// type changed');assert.equal(require('../src/transactions.cjs').applyPlan(root,plan).ok,false);assert.equal(fs.readFileSync(fresh.file,'utf8'),fresh.source);
 }finally{index.close();cleanup(root);}
});

function importedTypes(files){
 const root=fs.realpathSync(makeApp({'page.tsx':'import Card from "./Card";export default function Page(){return <main><Card/></main>}','Card.tsx':'import type {Props} from "./contracts";export default function Card({title="small"}:Props){return <h1>{title}</h1>}',...files})),index=new Index(root);index.scanAll();
 const resolved=[...index.idToFile.keys()].map(id=>index.resolve(id)).find(r=>r.element.kind==='instance');return {root,index,resolved,close(){index.close();cleanup(root);}};
}
test('relative imported contracts preserve module scope through aliases, barrels and inheritance',()=>{
 const f=importedTypes({'contracts.ts':'export type {PublicProps as Props} from "./types";','types.ts':'import type {Base} from "./base";type Size="small"|"large";export interface PublicProps extends Base {title?:Size}','base.ts':'type Size=1|2;export interface Base {count?:Size}'});try{
  const title=props.describe(f.resolved,'title'),count=props.describe(f.resolved,'count');assert.deepEqual(title.choices,['small','large']);assert.deepEqual(count.choices,[1,2]);
  assert.ok(adapter.describeComponent(f.resolved).props.some(p=>p.name==='count'));
  const op={name:'title',value:'large',fileHash:f.resolved.hash,definitionHash:title.definitionHash},plan=props.plan(f.resolved,op);assert.ok(plan.ok,plan.reason);assert.equal(plan.edits.length,5);
  const applied=require('../src/transactions.cjs').applyPlan(f.root,plan);assert.ok(applied.ok);assert.equal(applied.edits.length,1);assert.match(fs.readFileSync(f.resolved.file,'utf8'),/title=\{"large"\}/);
 }finally{f.close();}
});
test('imported contract revisions reject stale editors and commit races without writing source',()=>{
 for(const changed of ['export interface Props {title?:"small"|"medium"}','export interface Props {title?:Missing}','// contract removed']){
  const f=importedTypes({'contracts.ts':'export interface Props {title?:"small"|"large"}'});try{
   const info=props.describe(f.resolved,'title'),op={name:'title',value:'large',fileHash:f.resolved.hash,definitionHash:info.definitionHash},plan=props.plan(f.resolved,op);assert.ok(plan.ok,plan.reason);
   fs.writeFileSync(require('node:path').join(f.root,'contracts.ts'),changed);
   assert.equal(props.plan(f.resolved,op).ok,false);assert.equal(require('../src/transactions.cjs').applyPlan(f.root,plan).ok,false);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),f.resolved.source);
  }finally{f.close();}
 }
});
test('imported contracts refuse export cycles, private exports, external packages and escaping symlinks',()=>{
 for(const files of [
  {'contracts.ts':'export type {Props} from "./again";','again.ts':'export type {Props} from "./contracts";'},
  {'contracts.ts':'interface Props {title?:"small"|"large"}'},
  {'contracts.ts':'export type {Props} from "some-package";'},
  {'contracts.ts':'import type {Props as Other} from "./again";export type Props=Other;','again.ts':'import type {Props} from "./contracts";export type Other=Props;export {Other as Props};'}
 ]){const f=importedTypes(files);try{assert.equal(props.describe(f.resolved,'title').choices,undefined);}finally{f.close();}}
 const outside=makeApp({'secret.ts':'export interface Props {title?:"small"|"large"}'}),f=importedTypes({});try{fs.symlinkSync(require('node:path').join(outside,'secret.ts'),require('node:path').join(f.root,'contracts.ts'));assert.equal(props.describe(f.resolved,'title').choices,undefined);}finally{f.close();cleanup(outside);}
});
test('imported default types, utility types and private utility shadows resolve in their owning module',()=>{
 const f=importedTypes({'contracts.ts':'import type Base from "./base";export type Props=Partial<Base>;','base.ts':'type Extract="small"|"large";export default interface Base {title:Extract;count:number}'});try{assert.deepEqual(props.describe(f.resolved,'title').choices,['small','large']);assert.equal(props.describe(f.resolved,'count').type,'number');}finally{f.close();}
});
test('resetting an expression override guards the imported default contract',()=>{
 const f=importedTypes({'page.tsx':'import Card from "./Card";const title="small";function Page(){return <main><Card title={title}/></main>}','contracts.ts':'export interface Props {title?:"small"|"large"}'});try{
  const info=props.describe(f.resolved,'title');assert.equal(info.editable,undefined);assert.equal(info.canReset,true);
  const op={name:'title',reset:true,fileHash:f.resolved.hash,definitionHash:info.definitionHash},plan=props.plan(f.resolved,op);assert.ok(plan.ok,plan.reason);assert.equal(plan.edits.length,3);
  fs.appendFileSync(require('node:path').join(f.root,'contracts.ts'),'\n// external revision');assert.equal(props.plan(f.resolved,op).ok,false);assert.equal(require('../src/transactions.cjs').applyPlan(f.root,plan).ok,false);
 }finally{f.close();}
});

test('namespace imports resolve contracts, inherited fields and scalar choices through wildcard barrels',()=>{
 const f=importedTypes({
  'Card.tsx':'import type * as Types from "./contracts";export default function Card({title="small"}:Types.Props){return <h1>{title}</h1>}',
  'contracts.ts':'export * from "./types";export * from "./unrelated";',
  'types.ts':'import type * as Base from "./base";export interface Props extends Base.Fields {title?:Base.Size}',
  'base.ts':'export interface Fields {count?:number} export type Size="small"|"large";',
  'unrelated.ts':'export interface Other {title:boolean}'
 });try{
  const info=props.describe(f.resolved,'title');assert.deepEqual(info.choices,['small','large']);assert.equal(props.describe(f.resolved,'count').type,'number');
  const op={name:'title',value:'large',fileHash:f.resolved.hash,definitionHash:info.definitionHash},plan=props.plan(f.resolved,op);assert.ok(plan.ok,plan.reason);assert.equal(plan.edits.length,6);
  fs.appendFileSync(require('node:path').join(f.root,'unrelated.ts'),'\nexport interface Props {title?:"small"|"other"}');
  assert.equal(props.plan(f.resolved,op).ok,false);assert.equal(require('../src/transactions.cjs').applyPlan(f.root,plan).ok,false);assert.equal(fs.readFileSync(f.resolved.file,'utf8'),f.resolved.source);
 }finally{f.close();}
});
test('wildcard export diamonds preserve declaration identity and explicit exports win over ambiguity',()=>{
 for(const contracts of ['export * from "./left";export * from "./right";', 'export * from "./left";export * from "./other";export type {Props} from "./base";']){
  const f=importedTypes({'contracts.ts':contracts,'left.ts':'export * from "./base";','right.ts':'export type {Props} from "./base";','base.ts':'export interface Props {title?:"small"|"large"}','other.ts':'export interface Props {title?:boolean}'});try{assert.deepEqual(props.describe(f.resolved,'title').choices,['small','large']);}finally{f.close();}
 }
});
test('wildcard graphs handle cycles but refuse ambiguous, default and unresolved explicit exports',()=>{
 const f=importedTypes({'contracts.ts':'export * from "./cycle";export * from "./base";','cycle.ts':'export * from "./contracts";','base.ts':'export interface Props {title?:"small"|"large"}'});try{assert.deepEqual(props.describe(f.resolved,'title').choices,['small','large']);}finally{f.close();}
 for(const files of [
  {'contracts.ts':'export * from "./base";export * from "./other";','base.ts':'export interface Props {title?:"small"|"large"}','other.ts':'export interface Props {title?:"small"|"other"}'},
  {'Card.tsx':'import type Props from "./contracts";export default function Card({title="small"}:Props){return <h1/>}','contracts.ts':'export * from "./base";','base.ts':'export default interface Props {title?:"small"|"large"}'},
  {'contracts.ts':'export * from "./base";export * from "./other";','base.ts':'export interface Props {title?:"small"|"large"}','other.ts':'export type {Missing as Props} from "./base";'}
 ]){const g=importedTypes(files);try{assert.equal(props.describe(g.resolved,'title').choices,undefined);}finally{g.close();}}
});
test('an explicit namespace export is not mistaken for a wildcard type with the same name',()=>{
 const f=importedTypes({'contracts.ts':'export * from "./base";export * as Props from "./other";','base.ts':'export interface Props {title?:"small"|"large"}','other.ts':'export type Title="other";'});try{assert.equal(props.describe(f.resolved,'title').choices,undefined);}finally{f.close();}
});
