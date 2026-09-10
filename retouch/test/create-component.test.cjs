'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {makeApp,cleanup,Index}=require('./helpers.cjs'),create=require('../src/create-component.cjs'),adapter=require('../src/adapters/react.cjs');
function fixture(source,file='page.jsx'){
 const root=fs.realpathSync(makeApp({[file]:source})),index=new Index(root);index.scanAll();
 const selected=[...index.idToFile.keys()].map(id=>index.resolve(id)).find(r=>r.element.node.openingElement.name.name==='article');
 return {root,index,selected,close(){index.close();cleanup(root);}};
}
test('component creation preserves module imports, JSX descendants, sibling IDs, and call-site keys',()=>{
 const source=`import {Icon} from './icons';\nconst tone='p-4';\nexport default function Page({id}) { return <main><article key={id} className={tone}><Icon/><h2>Card</h2></article><footer>After</footer></main>; }`;
 const f=fixture(source);try{
  const footer=f.index.resolve([...f.index.idToFile.keys()].find(id=>f.index.resolve(id).element.node.openingElement.name.name==='footer'));
  const plan=create.plan(f.selected,{name:'ProductCard',fileHash:f.selected.hash});assert.ok(plan.ok,plan.reason);assert.equal(fs.readFileSync(f.selected.file,'utf8'),source,'planning never writes');
  const after=plan.edits[0].after;assert.match(after,/<ProductCard key=\{id\} \/>/);assert.match(after,/function ProductCard\(\)/);assert.ok(!after.includes('export function ProductCard'));assert.match(after,/<article\s+className=\{tone\}><Icon\/><h2>Card<\/h2><\/article>/);
  assert.equal((after.match(/key=\{id\}/g)||[]).length,1);assert.equal(plan.createdComponent.instanceId,f.selected.element.id);
  assert.ok(adapter.applyOp(f.selected,{type:'createComponent',name:'ProductCard',fileHash:f.selected.hash}).ok);f.index.scanAll();assert.equal(f.index.resolve(footer.element.id).element.node.openingElement.name.name,'footer');
  const component=adapter.describeComponent(f.index.resolve(plan.createdComponent.instanceId));assert.ok(component.ok,component.reason);assert.equal(component.name,'ProductCard');assert.equal(component.explicitComponent,true);assert.equal(require('../src/component-usage.cjs').usage(f.index,plan.createdComponent.instanceId).inlineComponent,false);assert.equal(component.definitionId,plan.createdComponent.definitionId);
 }finally{f.close();}
});
test('component creation refuses unsafe captures and context changes without partial edits',()=>{
 const cases=[
  [`function Page(){let label="a";label="b";return <article>{label}</article>}`,/reassigned/],
  [`function Page(){return <article>{eval("label")}</article>}`,/eval/],
  [`export default function Page({props}){return <article {...props}/>}`,/spread attributes/],
  [`export default function Page(){return <article ref="card"/>}`,/String refs/],
  [`import {useId as id} from 'react'; export default function Page(){return <article>{id()}</article>}`,/hook calls/],
  [`export default function Page(){return <main><article>Hello</article><style jsx>{'article{color:red}'}</style></main>}`,/scoped JSX/],
  [`'use server'; export async function Page(){return <article/>}`,/server-action/],
  [`export default function Page(){type T=string;return <article>{'hi' as T}</article>}`,/TypeScript/],
  [`let n=0; export default function Page(){return <article>{n++}</article>}`,/mutates/],
 ];
 for(const [source,reason]of cases){const f=fixture(source);try{const result=create.plan(f.selected,{name:'Card',fileHash:f.selected.hash});assert.equal(result.ok,false,source);assert.match(result.reason,reason);assert.equal(fs.readFileSync(f.selected.file,'utf8'),source);}finally{f.close();}}
});
test('component extraction accepts subtree-local callback bindings and checks names and revisions',()=>{
 const source=`'use client'; export default function Page(){return <article>{[1,2].map(n=><span key={n}>{n}</span>)}</article>}`;
 const f=fixture(source,'page.tsx');try{
  assert.ok(create.plan(f.selected,{name:'Card',fileHash:f.selected.hash}).ok);
  for(const name of ['card','Page','A;alert(1)',''])assert.equal(create.plan(f.selected,{name,fileHash:f.selected.hash}).ok,false);
  assert.equal(create.plan(f.selected,{name:'Card',fileHash:'stale'}).ok,false);
  const plan=create.plan(f.selected,{name:'Card',fileHash:f.selected.hash});fs.appendFileSync(f.selected.file,'\n// external');assert.equal(require('../src/transactions.cjs').applyPlan(f.root,plan).ok,false);assert.ok(fs.readFileSync(f.selected.file,'utf8').endsWith('// external'));
 }finally{f.close();}
});
test('component creation API integrates inspection and exact Undo/Redo with source CAS',async()=>{
 const source=`export default function Page(){return <main><article className="p-4"><h2>Card</h2></article></main>}`;
 const f=fixture(source),server=require('../src/server.cjs').startServer({appRoot:f.root,port:0,quiet:true});await require('node:events').once(server,'listening');
 const base='http://127.0.0.1:'+server.address().port,shell=await(await fetch(base+'/rt')).text(),headers={'x-retouch-token':/__RT_TOKEN = "([a-f0-9]+)"/.exec(shell)[1],'content-type':'application/json'},post=async body=>(await fetch(base+'/rt/__api/op',{method:'POST',headers,body:JSON.stringify(body)})).json();
 try{
  const op={type:'createComponent',name:'Card',id:f.selected.element.id,fileHash:f.selected.hash};assert.equal((await post({...op,fileHash:'stale'})).ok,false);
  const result=await post(op);assert.ok(result.ok,result.reason||result.error);assert.ok(result.undoId);assert.equal(result.element.kind,'instance');const after=fs.readFileSync(f.selected.file,'utf8');
  const info=await(await fetch(base+'/rt/__api/component?id='+result.createdComponent.instanceId,{headers})).json();assert.ok(info.ok,info.reason);assert.equal(info.definitionId,result.createdComponent.definitionId);assert.equal(info.inlineComponent,false);
  assert.ok((await post({type:'undo',undoId:result.undoId})).ok);assert.equal(fs.readFileSync(f.selected.file,'utf8'),source);
  assert.ok((await post({type:'redo',undoId:result.undoId})).ok);assert.equal(fs.readFileSync(f.selected.file,'utf8'),after);
 }finally{server.retouchIndex.close();await new Promise(resolve=>server.close(resolve));f.close();}
});


test('created components retain explicit identity when their declaration becomes a named or default export',()=>{
 for(const prefix of ['export','export default']){
  const f=fixture('function Page(){return <article>Hello</article>}','Cards.jsx');try{
   const plan=create.plan(f.selected,{name:'Card',fileHash:f.selected.hash});assert.ok(plan.ok,plan.reason);
   const after=plan.edits[0].after.replace('function Card()',prefix+' function Card()');fs.writeFileSync(f.selected.file,after);f.index.scanAll();
   const info=adapter.describeComponent(f.index.resolve(plan.createdComponent.instanceId));assert.ok(info.ok,info.reason);assert.equal(info.explicitComponent,true);assert.equal(require('../src/component-usage.cjs').usage(f.index,plan.createdComponent.instanceId).inlineComponent,false);
   const stamped=adapter.stamp(after,f.selected.file,f.root).code;assert.ok(stamped.includes('data-rt-i={arguments[0]?.["data-rt-i"]}'));
  }finally{f.close();}
 }
});


test('component duplication keeps a shared definition and gives the copy a distinct key',()=>{
 const source='function Page({label}){return <main><Card key={label} title={label}/><footer>After</footer></main>}\n/** @retouch-component */\nfunction Card(){return <article>Hi</article>}';
 const f=fixture(source,'Cards.jsx');try{
  const usage=[...f.index.idToFile.keys()].map(id=>f.index.resolve(id)).find(r=>r.element.kind==='instance');
  const plan=require('../src/duplicate-component.cjs').plan(usage,{fileHash:usage.hash});assert.ok(plan.ok,plan.reason);const after=plan.edits[0].after;assert.match(after,/<Card key="retouch-copy-[a-f0-9]+" title=\{label\}\/>/);assert.equal((after.match(/function Card/g)||[]).length,1);assert.equal(fs.readFileSync(usage.file,'utf8'),source);
  assert.ok(require('../src/transactions.cjs').applyPlan(f.root,plan).ok);f.index.scanAll();const original=adapter.describeComponent(f.index.resolve(usage.element.id)),copy=adapter.describeComponent(f.index.resolve(plan.duplicatedComponent.instanceId));assert.ok(copy.ok,copy.reason);assert.equal(original.definitionId,copy.definitionId);assert.equal(require('../src/component-usage.cjs').usage(f.index,usage.element.id).usageCount,2);
 }finally{f.close();}
});
test('component duplication refuses ambiguous identities without writing',()=>{
 for(const jsx of ['<main><Card ref={ref}/></main>','<main><Card {...props}/></main>','<main><Card><span id="unique"/></Card></main>']){
  const source='function Page(){return '+jsx+'} function Card(){return <article/>}',f=fixture(source);try{const usage=[...f.index.idToFile.keys()].map(id=>f.index.resolve(id)).find(r=>r.element.kind==='instance');assert.equal(require('../src/duplicate-component.cjs').plan(usage,{fileHash:usage.hash}).ok,false);assert.equal(fs.readFileSync(usage.file,'utf8'),source);}finally{f.close();}
 }
});


test('component duplication refuses a fixed DOM identity in its shared definition',()=>{
 const f=fixture('function Page(){return <main><Card/></main>} function Card(){return <article id="fixed"/>}');try{const usage=[...f.index.idToFile.keys()].map(id=>f.index.resolve(id)).find(r=>r.element.kind==='instance');const result=require('../src/duplicate-component.cjs').plan(usage,{fileHash:usage.hash});assert.equal(result.ok,false);assert.match(result.reason,/fixed DOM id/);assert.equal(adapter.describeComponent(usage).canDuplicate,false);}finally{f.close();}
});


test('component creation turns local values, callbacks, and JSX component bindings into explicit props',()=>{
 const source='function Page({label, onClick}){const Local=()=>null;return <article onClick={onClick}>{label}<Local/>{[1].map(label=><span>{label}</span>)}</article>}';
 const f=fixture(source);try{
  const plan=create.plan(f.selected,{name:'Card',fileHash:f.selected.hash});assert.ok(plan.ok,plan.reason);
  assert.ok(plan.edits[0].after.includes('<Card onClick={onClick} label={label} Local={Local} />'));
  assert.ok(plan.edits[0].after.includes('function Card({ onClick, label, Local })'));
  assert.deepEqual(plan.createdComponent.props,[{name:'onClick',local:'onClick'},{name:'label',local:'label'},{name:'Local',local:'Local'}]);
  assert.equal(fs.readFileSync(f.selected.file,'utf8'),source);
 }finally{f.close();}
});
test('captured React reserved names are passed through ordinary aliased props',()=>{
 const f=fixture('function Page({key,ref,retouchValue0}){return <article key={key} ref={ref}>{key}{retouchValue0}</article>}');try{
  const plan=create.plan(f.selected,{name:'Card',fileHash:f.selected.hash});assert.ok(plan.ok,plan.reason);
  assert.ok(plan.edits[0].after.includes('<Card key={key} retouchValue0x={ref} retouchValue1={key} retouchValue0={retouchValue0} />'));
  assert.ok(plan.edits[0].after.includes('function Card({ retouchValue0x: ref, retouchValue1: key, retouchValue0 })'));
 }finally{f.close();}
});
test('extraction refuses untyped TS props and deferred reads before local initialization',()=>{
 for(const [source,file,reason] of [
  ['function Page({label}){return <article>{label}</article>}','page.tsx',/explicit type/],
  ['function Page(){const layer=<article onClick={()=>label}/>;const label="later";return layer}','page.jsx',/initialized after/],
 ]){const f=fixture(source,file);try{const plan=create.plan(f.selected,{name:'Card',fileHash:f.selected.hash});assert.equal(plan.ok,false);assert.match(plan.reason,reason);assert.equal(fs.readFileSync(f.selected.file,'utf8'),source);}finally{f.close();}}
});

test('prototype-named captures use safe JSX prop names',()=>{
 const f=fixture('function Page({__proto__}){return <article>{__proto__}</article>}');try{const plan=create.plan(f.selected,{name:'Card',fileHash:f.selected.hash});assert.ok(plan.ok,plan.reason);assert.ok(plan.edits[0].after.includes('<Card retouchValue0={__proto__} />'));assert.ok(plan.edits[0].after.includes('function Card({ retouchValue0: __proto__ })'));}finally{f.close();}
});


test('root and expression duplication uses a transparent fragment and maps both linked usages',()=>{
 for(const jsx of ['<Card/>','<Card key="original"/>','enabled ? <Card key="original"/> : null','<main>{enabled && <Card key="original"/>}</main>']){
  const source='export function Page({enabled}){return '+jsx+'} export function Card(){return <article/>}',f=fixture(source);try{
   const usage=[...f.index.idToFile.keys()].map(id=>f.index.resolve(id)).find(r=>r.element.kind==='instance'),plan=require('../src/duplicate-component.cjs').plan(usage,{fileHash:usage.hash});assert.equal(plan.ok,true,plan.reason);assert.equal(plan.duplicatedComponent.wrapped,true);if(jsx.includes('key='))assert.match(plan.edits[0].after,/<RetouchFragment key="original"><Card \/>/);else assert.match(plan.edits[0].after,/<><Card\/>/);assert.ok(require('../src/transactions.cjs').applyPlan(f.root,plan).ok);f.index.scanAll();const original=f.index.resolve(plan.duplicatedComponent.retainedInstanceId),copy=f.index.resolve(plan.duplicatedComponent.instanceId);assert.ok(original&&copy);assert.notEqual(original.element.id,copy.element.id);assert.equal(adapter.describeComponent(original).definitionId,adapter.describeComponent(copy).definitionId);assert.equal((plan.edits[0].after.match(/function Card/g)||[]).length,1);const undo={ok:true,edits:plan.edits.map(edit=>({file:edit.file,before:edit.after,after:edit.before}))};assert.equal(require('../src/transactions.cjs').applyPlan(f.root,undo).ok,true);assert.equal(fs.readFileSync(usage.file,'utf8'),source);
  }finally{f.close();}
 }
});


test('duplicated keyed callback results retain the list key without reevaluating its expression',()=>{
 const source='export function Page({items}){const RetouchFragment=1;return <main>{items.map(item=><Card key={item.key()} title={item.title}/>)}</main>}export function Card(){return <article/>}',f=fixture(source);try{
  const usage=[...f.index.idToFile.keys()].map(id=>f.index.resolve(id)).find(r=>r.element.kind==='instance'),plan=require('../src/duplicate-component.cjs').plan(usage,{fileHash:usage.hash});assert.equal(plan.ok,true,plan.reason);const after=plan.edits[0].after;assert.match(after,/<RetouchFragment1 key=\{item.key\(\)\}>/);assert.equal((after.match(/item.key\(\)/g)||[]).length,1);assert.match(after,/import \{ Fragment as RetouchFragment1 \} from "react"/);assert.equal(require('../src/id.cjs').collectElements(after,'page.jsx').elements.filter(el=>el.kind==='instance').length,2);assert.equal(fs.readFileSync(usage.file,'utf8'),source);
 }finally{f.close();}
});
test('component duplication maps original usages and descendants across wrapping and sibling shifts',()=>{
 for(const jsx of ['<main><Card><span>Child</span></Card><Card/><aside/></main>','<Card><span>Child</span></Card>','<Card key="original"><span>Child</span></Card>']){
  const source='function Page(){return '+jsx+'} function Card({children}){return <article>{children}</article>}',f=fixture(source);
  try{const usage=[...f.index.idToFile.keys()].map(id=>f.index.resolve(id)).find(r=>r.element.kind==='instance'),plan=require('../src/duplicate-component.cjs').plan(usage,{fileHash:usage.hash});assert.equal(plan.ok,true,plan.reason);
   const next=require('../src/id.cjs').collectElements(plan.edits[0].after,usage.relPath).elements,mapping=new Map(plan.duplicatedComponent.sourceIdMap),mapped=usage.elements.map(e=>mapping.get(e.id)||e.id);assert.equal(new Set(mapped).size,mapped.length);assert.ok(!mapped.includes(plan.duplicatedComponent.instanceId));
   for(const element of usage.elements){const fresh=next.find(e=>e.id===(mapping.get(element.id)||element.id));assert.ok(fresh);assert.equal(fresh.kind,element.kind);assert.equal(fresh.node.openingElement.name.name,element.node.openingElement.name.name);}
  }finally{f.close();}
 }
});

test('creation maps extracted descendants and retained key JSX to their corresponding layers',()=>{
 for(const key of ['', ' key={<i>Identity</i>}']){
  const source=`export default function Page(){return <main><article${key}><section><h2>Title</h2></section><aside>Detail</aside></article><footer>After</footer></main>}`;
  const f=fixture(source);try{
   const before=require('../src/id.cjs').collectElements(source,'page.jsx').elements;
   const result=create.plan(f.selected,{name:'ProductCard',fileHash:f.selected.hash});assert.ok(result.ok,result.reason);
   const after=require('../src/id.cjs').collectElements(result.edits[0].after,'page.jsx').elements,map=new Map(result.createdComponent.sourceIdMap);
   assert.equal(map.size,before.length);assert.equal(new Set(map.values()).size,before.length);
   for(const old of before){
    const next=after.find(e=>e.id===map.get(old.id));assert.ok(next,old.id);
    if(old.id===f.selected.element.id){assert.equal(next.id,result.createdComponent.instanceId);assert.equal(next.kind,'instance');continue;}
    assert.equal(next.kind,old.kind);assert.equal(next.node.openingElement.name.name,old.node.openingElement.name.name);
    if(['section','h2','aside'].includes(old.node.openingElement.name.name)){assert.notEqual(next.id,old.id);assert.ok(next.node.start>result.edits[0].after.indexOf('function ProductCard'));}
    if(old.node.openingElement.name.name==='i')assert.ok(next.node.start<result.edits[0].after.indexOf('function ProductCard'));
   }
  }finally{f.close();}
 }
});


test('TypeScript extraction carries explicit structural capture types into component props',()=>{
 const source='function Page({heading:label,count,onClick}:{heading:string;count:number;onClick:()=>void}){const tags:string[]=[];return <article onClick={onClick} title={label}>{count}{tags.join(",")}</article>}';
 const f=fixture(source,'page.tsx');try{
  const result=create.plan(f.selected,{name:'Card',fileHash:f.selected.hash});assert.ok(result.ok,result.reason);
  const after=result.edits[0].after;assert.match(after,/"label": \(string\)/);assert.match(after,/"count": \(number\)/);assert.match(after,/"onClick": \(\(\)=>void\)/);assert.match(after,/"tags": \(string\[\]\)/);
  assert.doesNotThrow(()=>require('../src/id.cjs').parseSource(after));
 }finally{f.close();}
});
test('TypeScript extraction refuses capture types requiring scope or narrowing analysis',()=>{
 for(const source of ['function Page<T>({value}:{value:T}){return <article>{value}</article>}', 'function Page({value}:{value?:string}){return <article>{value}</article>}', 'function Page({value}:{value:string|number}){return <article>{value}</article>}', 'function Page({value="x"}:{value?:string}){return <article>{value}</article>}']){
  const f=fixture(source,'page.tsx');try{const result=create.plan(f.selected,{name:'Card',fileHash:f.selected.hash});assert.equal(result.ok,false);assert.match(result.reason,/explicit type/);assert.equal(fs.readFileSync(f.selected.file,'utf8'),source);}finally{f.close();}
 }
});

test('typed extraction retains guards that narrow captured values outside the subtree',()=>{
 const f=fixture('function Page(value:unknown){if(typeof value==="string")return <article>{value.toUpperCase()}</article>}','page.tsx');try{const result=create.plan(f.selected,{name:'Card',fileHash:f.selected.hash});assert.equal(result.ok,false);assert.match(result.reason,/narrowing/);}finally{f.close();}
});

test('typed extraction reads object locals and positional tuple contracts',()=>{
 for(const source of [
  'function Page(){const {text:label,count}:{text:string;count:number}={text:"Hello",count:2};return <article title={label}>{count+1}</article>}',
  'function Page(){const [label,count]:[string,number]=["Hello",2];return <article title={label}>{count+1}</article>}',
  'function Page(){const [label,,count]:[text:string,unused:boolean,total:number]=["Hello",true,2];return <article title={label}>{count+1}</article>}'
 ]){const f=fixture(source,'page.tsx');try{const result=create.plan(f.selected,{name:'Card',fileHash:f.selected.hash});assert.ok(result.ok,result.reason);assert.ok(result.edits[0].after.includes('"label": (string)'));assert.ok(result.edits[0].after.includes('"count": (number)'));}finally{f.close();}}
});
test('typed tuple extraction refuses optional, rest, and defaulted positions',()=>{
 for(const source of [
  'function Page(){const [label]:[string?]=[];return <article>{label}</article>}',
  'function Page(){const [label]:[...string[]]=[];return <article>{label}</article>}',
  'function Page(){const [label="Hello"]:[string?]=[];return <article>{label}</article>}'
 ]){const f=fixture(source,'page.tsx');try{const result=create.plan(f.selected,{name:'Card',fileHash:f.selected.hash});assert.equal(result.ok,false);assert.match(result.reason,/explicit type/);}finally{f.close();}}
});

test('typed extraction follows nested object and tuple destructuring contracts',()=>{
 for(const declaration of [
  'const {data:{text:label,count}}:{data:{text:string;count:number}}={data:{text:"Hi",count:2}};',
  'const {data:[label,count]}:{data:[string,number]}={data:["Hi",2]};',
  'const [{text:label},[count]]:[{text:string},[number]]=[{text:"Hi"},[2]];'
 ]){const f=fixture('function Page(){'+declaration+'return <article title={label}>{count+1}</article>}','page.tsx');try{const result=create.plan(f.selected,{name:'Card',fileHash:f.selected.hash});assert.ok(result.ok,result.reason);assert.ok(result.edits[0].after.includes('"label": (string)'));assert.ok(result.edits[0].after.includes('"count": (number)'));}finally{f.close();}}
});
test('typed extraction does not lose optional or defaulted ancestor contracts',()=>{
 for(const pattern of ['{data:{label}={label:"Hi"}}:{data?:{label:string}}','{data:[label="Hi"]}:{data:[string?]}']){
  const f=fixture('function Page('+pattern+'){return <article>{label}</article>}','page.tsx');try{const result=create.plan(f.selected,{name:'Card',fileHash:f.selected.hash});assert.equal(result.ok,false);assert.match(result.reason,/explicit type/);}finally{f.close();}
 }
});

test('typed extraction resolves module interfaces and alias chains for capture contracts',()=>{
 for(const contract of ['interface Props {title:string;count:number}', 'type Label=string;type Base={title:Label;count:number};type Props=Base;', 'export interface Props {title:string;count:number}']){
  const f=fixture(contract+' function Page({title,count}:Props){return <article title={title}>{count+1}</article>}','page.tsx');try{const result=create.plan(f.selected,{name:'Card',fileHash:f.selected.hash});assert.ok(result.ok,result.reason);assert.ok(result.edits[0].after.includes('"title": (string)'));assert.ok(result.edits[0].after.includes('"count": (number)'));}finally{f.close();}
 }
});
test('typed extraction refuses ambiguous, generic and cyclic module contracts',()=>{
 for(const source of ['type Props=Props;function Page({title}:Props){return <article>{title}</article>}', 'interface Props<T>{title:T} function Page({title}:Props<string>){return <article>{title}</article>}', 'interface Props{title:string} function Page(){type Props={title:number};const {title}:Props={title:2};return <article>{title}</article>}']){
  const f=fixture(source,'page.tsx');try{const result=create.plan(f.selected,{name:'Card',fileHash:f.selected.hash});assert.equal(result.ok,false);assert.match(result.reason,/explicit type/);}finally{f.close();}
 }
});
