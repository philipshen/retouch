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
test('component creation refuses captures and context changes without partial edits',()=>{
 const cases=[
  [`export default function Page({label}){return <article>{label}</article>}`,/local value "label"/],
  [`export default function Page(){const Local=()=>null;return <article><Local/></article>}`,/local value "Local"/],
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
