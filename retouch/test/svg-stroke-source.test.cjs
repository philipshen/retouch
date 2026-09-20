'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const S=require('../src/svg-stroke-source.cjs'),G=require('../shell/svg-path.js'),{view}=require('../src/svg-boolean-group.cjs');
const markup='<main><svg viewBox="0 0 100 100"><rect x="20" y="20" width="60" height="60" fill="red" stroke="blue"/><circle cx="10" cy="10" r="2"/></svg><p>Untouched</p></main>';
function resolve(kind,source,id){
 const adapter=require('../src/adapters/'+kind+'.cjs'),relPath='art.'+(kind==='react'?'jsx':kind==='liquid'?'liquid':'html');
 source??=kind==='react'?'export default function Art(){return '+markup+'}':markup;
 const elements=adapter.collect(source,relPath).elements,r={source,elements,hash:adapter.contentHash(source),relPath,file:'/tmp/'+relPath};
 const v=view(r,kind);r.element=id?elements.find(e=>e.id===id):elements.find(e=>v.tag(e)==='rect');return r;
}
const model={document:G.parseCompound('M20 20H80V80H20Z'),fill:'red',stroke:'blue',width:8,position:'inside'};
const create=(r,kind,change={})=>S.plan(r,{type:'createSVGStrokeSource',fileHash:r.hash,model,...change},kind);
for(const kind of ['html','react','liquid']){
 test(kind+' retained stroke creation, alignment changes and restore preserve original bytes and source identities',()=>{
  const r=resolve(kind),made=create(r,kind);assert.equal(made.ok,true,made.reason);assert.deepEqual(made.removedSourceIds,[]);
  let fresh=resolve(kind,made.edits[0].after,made.selectionIds[0]),c=S.context(fresh,kind);assert.ok(c);assert.equal(c.model.position,'inside');
  const original=c.source,mapping=new Map(made.sourceIdMap);assert.equal(c.original.id,mapping.get(r.element.id)||r.element.id);
  for(const e of r.elements)assert.ok(fresh.elements.find(n=>n.id===(mapping.get(e.id)||e.id)));
  for(const position of ['outside','center','inside']){
   const changed=S.plan(fresh,{type:'setSVGStrokeSourcePosition',fileHash:fresh.hash,position},kind);assert.equal(changed.ok,true,changed.reason);
   const old=S.context(fresh,kind),next=resolve(kind,changed.edits[0].after,changed.selectionIds[0]),info=S.context(next,kind);assert.equal(info.source,original);assert.equal(info.model.position,position);assert.equal(info.id,c.id);
   const ids=new Map(changed.sourceIdMap);assert.equal(info.original.id,ids.get(old.original.id)||old.original.id);
   assert.ok(!changed.removedSourceIds.includes(fresh.element.id));fresh=next;
  }
  assert.equal(S.plan(fresh,{type:'setSVGStrokeSourcePosition',fileHash:fresh.hash,position:'inside'},kind).unchanged,true);
  const restored=S.plan(fresh,{type:'restoreSVGStrokeSource',fileHash:fresh.hash},kind);assert.equal(restored.ok,true,restored.reason);assert.equal(restored.edits[0].after,r.source);assert.equal(restored.selectionIds[0],r.element.id);
  if(kind==='react'){assert.match(made.edits[0].after,/clipPath="url/);assert.doesNotMatch(made.edits[0].after,/ clip-path=/);}
 });
 test(kind+' retained stroke refuses stale snapshots, dynamic attributes and altered generated source',()=>{
  const r=resolve(kind);for(const change of [{fileHash:'stale'},{model:{...model,document:G.parseCompound('M0 0H80V80H0Z')}},{model:{...model,matrix:[1,0,0,1,2,0]}},{model:{...model,stroke:'url(#paint)'}}])assert.equal(create(r,kind,change).refused,true);
  for(const attr of ['id="referenced"','class="paint"','style="fill:red"','onclick="run()"'])assert.equal(create(resolve(kind,r.source.replace('<rect ','<rect '+attr+' ')),kind).refused,true);
  const made=create(r,kind);assert.ok(made.ok,made.reason);
  const canonical=resolve(kind,made.edits[0].after,made.selectionIds[0]);
  for(const position of [null,undefined,'invalid'])assert.equal(S.plan(canonical,{type:'setSVGStrokeSourcePosition',fileHash:canonical.hash,position},kind).refused,true);
  for(const after of [made.edits[0].after.replace('display="none"','display="block"'),made.edits[0].after.replace('stroke="blue" stroke','stroke="green" stroke'),made.edits[0].after.replace('</g></g>',(kind==='react'?'{/*custom*/}':'<!--custom-->')+'</g></g>'),made.edits[0].after.replace('width="60"','width="61"')]){
   const fresh=resolve(kind,after,made.selectionIds[0]);assert.equal(S.context(fresh,kind),null);
   const refused=S.plan(fresh,{type:'restoreSVGStrokeSource',fileHash:fresh.hash},kind);assert.equal(refused.refused,true);assert.equal(refused.edits,undefined);
  }
 });
 test(kind+' retained source uses atomic transactions and exact history for create, change, restore',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-stroke-source-')),initial=resolve(kind),file=path.join(root,initial.relPath),history=new(require('../src/history.cjs').SourceHistory)(),states=[initial.source],entries=[];
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.writeFileSync(file,initial.source);let selected=initial.element.id;
  for(const type of ['createSVGStrokeSource','setSVGStrokeSourcePosition','restoreSVGStrokeSource']){
   const r={...resolve(kind,fs.readFileSync(file,'utf8'),selected),file},plan=S.plan(r,{type,fileHash:r.hash,model,position:'outside'},kind);assert.ok(plan.ok,plan.reason);
   const result=require('../src/transactions.cjs').applyPlan(root,plan);assert.ok(result.ok,result.reason);selected=result.selectionIds[0];entries.push(history.record(result.edits));states.push(fs.readFileSync(file,'utf8'));
  }
  assert.equal(states.at(-1),states[0]);
  for(let i=entries.length-1;i>=0;i--){assert.equal(history.apply(root,'undo',entries[i],{}).ok,true);assert.equal(fs.readFileSync(file,'utf8'),states[i]);}
  for(let i=0;i<entries.length;i++){assert.equal(history.apply(root,'redo',entries[i],{}).ok,true);assert.equal(fs.readFileSync(file,'utf8'),states[i+1]);}
  const stale={...resolve(kind,states[0]),file},plan=create(stale,kind);fs.writeFileSync(file,states[0]+'\n');assert.equal(require('../src/transactions.cjs').applyPlan(root,plan).refused,true);assert.equal(fs.readFileSync(file,'utf8'),states[0]+'\n');
 });
}
for(const kind of ['html','react','liquid'])test(kind+' retained source covers primitive geometry, open paths, transforms and authored literals',()=>{
 const cases=[
  ['<circle cx="50" cy="50" r="30"/>','M80 50A30 30 0 0 1 50 80A30 30 0 0 1 20 50A30 30 0 0 1 50 20A30 30 0 0 1 80 50Z','inside'],
  ['<ellipse cx="50" cy="50" rx="30" ry="20"/>','M80 50A30 20 0 0 1 50 70A30 20 0 0 1 20 50A30 20 0 0 1 50 30A30 20 0 0 1 80 50Z','outside'],
  ['<polygon points="20,20 80,20 80,80 20,80"/>','M20 20L80 20L80 80L20 80Z','inside'],
  ['<polyline points="20,20 80,20 80,80"/>','M20 20L80 20L80 80','center'],
  ['<line x1="20" y1="20" x2="80" y2="80"/>','M20 20L80 80','center'],
  ['<path d="M20 20H80V80H20Z"/>','M20 20H80V80H20Z','outside']
 ];
 for(const [element,data,position]of cases){
  const initial=resolve(kind),source=initial.source.replace(/<rect[^>]*\/>/,element.replace('/>',' transform="translate(3 4)"/>')),r=resolve(kind,source);r.element=view(r,kind).elements.find(e=>view(r,kind).start(e)===source.indexOf(element.slice(0,element.indexOf(' '))+' '));
  const made=create(r,kind,{model:{...model,document:G.parseCompound(data),matrix:[1,0,0,1,3,4],position}});assert.ok(made.ok,made.reason);
  const fresh=resolve(kind,made.edits[0].after,made.selectionIds[0]);assert.equal(S.plan(fresh,{type:'restoreSVGStrokeSource',fileHash:fresh.hash},kind).edits[0].after,source);
  if(position==='center')assert.equal(S.plan(fresh,{type:'setSVGStrokeSourcePosition',fileHash:fresh.hash,position:'inside'},kind).refused,true);
 }
 const initial=resolve(kind),duplicate=resolve(kind,initial.source.replace('width="60"','width="60" width="90"'));assert.equal(create(duplicate,kind).refused,true);
 if(kind==='react'){
  const numeric=resolve(kind,initial.source.replace('width="60"','width={60}'));assert.ok(create(numeric,kind).ok);
  for(const value of ['width={size}','width="60" {...props}'])assert.equal(create(resolve(kind,initial.source.replace('width="60"',value)),kind).refused,true);
 }
 if(kind==='liquid')assert.equal(create(resolve(kind,initial.source.replace('width="60"','width="{{ size }}"')),kind).refused,true);
});
