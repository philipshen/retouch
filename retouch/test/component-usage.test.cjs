'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {Index}=require('../src/indexer.cjs');
const {usage,describe}=require('../src/component-usage.cjs');
for(const kind of ['liquid','react'])test(kind+': count source usages, inline one, retain shared two, and invalidate after edits',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-usage-'));
 try{
  const adapter=require('../src/adapters/'+kind+'.cjs');
  const files=kind==='liquid'?{'snippets/card.liquid':'<div class="p-2">Card</div>','sections/main.liquid':"{% for item in items %}{% render 'card' %}{% endfor %}"}:{'Card.tsx':'export default function Card(){return <div className="p-2">Card</div>}','App.tsx':"import Card from './Card';export default function App(){return <>{items.map(item=><Card/>)}</>}"};
  for(const [name,source] of Object.entries(files)){fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});fs.writeFileSync(path.join(root,name),source);}
  const index=new Index(root,adapter);index.scanAll();
  const caller=path.join(root,kind==='liquid'?'sections/main.liquid':'App.tsx');
  const id=[...index.fileIds.get(caller)].find(id=>index.resolve(id).element.kind==='instance');
  assert.equal(usage(index,id).usageCount,1);assert.equal(describe(index,index.resolve(id)).inlineComponent,true);
  const definition=index.resolve(usage(index,id).definitionId);assert.ok(definition);assert.notEqual(definition.file,caller);
  const callSource=fs.readFileSync(caller,'utf8');
  const edit=adapter.applyOp(definition,{type:'setText',text:'Updated',fileHash:definition.hash});
  assert.equal(edit.ok,true);assert.match(fs.readFileSync(definition.file,'utf8'),/Updated/);assert.equal(fs.readFileSync(caller,'utf8'),callSource);
  const second=path.join(root,kind==='liquid'?'sections/other.liquid':'Other.tsx');
  fs.writeFileSync(second,kind==='liquid'?"{% render 'card' %}":"import Renamed from './Card';export const Other=()=> <Renamed/>;");
  index.indexFile(second);assert.equal(usage(index,id).usageCount,2);assert.equal(usage(index,id).inlineComponent,false);
  fs.unlinkSync(second);index.indexFile(second);assert.equal(usage(index,id).inlineComponent,true);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('React counts definitions separately within one module and follows re-export aliases',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-usage-alias-'));
 try{
  fs.writeFileSync(path.join(root,'Cards.tsx'),'export const A=()=> <div>A</div>; export const B=()=> <div>B</div>');
  fs.writeFileSync(path.join(root,'barrel.ts'),"export {A as Renamed} from './Cards'");
  fs.writeFileSync(path.join(root,'App.tsx'),"import {A,B} from './Cards';export const App=()=> <><A/><B/></>");
  const i=new Index(root,require('../src/adapters/react.cjs'));i.scanAll();
  const ids=[...i.fileIds.get(path.join(root,'App.tsx'))].filter(id=>i.resolve(id).element.kind==='instance');
  assert.ok(ids.every(id=>usage(i,id).inlineComponent));
  const file=path.join(root,'Other.tsx');fs.writeFileSync(file,"import {Renamed} from './barrel';export const Other=()=> <Renamed/>");i.indexFile(file);
  assert.deepEqual(ids.map(id=>usage(i,id).usageCount),[2,1]);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
