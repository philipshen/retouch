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
  assert.ok(S.context({...fresh,elements:null},kind));
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
  for(const type of ['createSVGStrokeSource','setSVGStrokeSourcePosition','setSVGStrokeSourceWidth','restoreSVGStrokeSource']){
   const r={...resolve(kind,fs.readFileSync(file,'utf8'),selected),file},plan=S.plan(r,{type,fileHash:r.hash,model,position:'outside',width:12.5},kind);assert.ok(plan.ok,plan.reason);
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
  const fresh=resolve(kind,made.edits[0].after,made.selectionIds[0]);assert.deepEqual(S.describe(fresh,kind).positions,position==='center'?['center']:['inside','center','outside']);assert.equal(S.plan(fresh,{type:'restoreSVGStrokeSource',fileHash:fresh.hash},kind).edits[0].after,source);
  if(position==='center')assert.equal(S.plan(fresh,{type:'setSVGStrokeSourcePosition',fileHash:fresh.hash,position:'inside'},kind).refused,true);
 }
 const initial=resolve(kind),duplicate=resolve(kind,initial.source.replace('width="60"','width="60" width="90"'));assert.equal(create(duplicate,kind).refused,true);
 if(kind==='react'){
  const numeric=resolve(kind,initial.source.replace('width="60"','width={60}'));assert.ok(create(numeric,kind).ok);
  for(const value of ['width={size}','width="60" {...props}'])assert.equal(create(resolve(kind,initial.source.replace('width="60"',value)),kind).refused,true);
 }
 if(kind==='liquid')assert.equal(create(resolve(kind,initial.source.replace('width="60"','width="{{ size }}"')),kind).refused,true);
});
for(const kind of ['html','react','liquid'])test(kind+' adapter guards retain stroke originals across direct, selection, destination and ancestor edits',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),initial=resolve(kind),made=create(initial,kind),r=resolve(kind,made.edits[0].after,made.selectionIds[0]),v=view(r,kind),c=S.context(r,kind);
 const description=adapter.describe(r);assert.equal(description.svgStrokeSource.position,'inside');assert.equal(description.svgStrokeOwner,r.element.id);assert.equal(description.svgTransform.editable,false);assert.equal(description.svgGeometry,null);assert.equal(description.structure.canDuplicate,false);
 const change=adapter.planOp(r,{type:'setSVGStrokeSourcePosition',fileHash:r.hash,position:'outside'});assert.ok(change.ok,change.reason);
 assert.equal(adapter.planOp(r,{type:'restoreSVGStrokeSource',fileHash:r.hash}).edits[0].after,initial.source);
 assert.equal(adapter.capabilities.ops.includes('createSVGStrokeSource'),false);
 assert.equal(adapter.planOp(initial,{type:'createSVGStrokeSource',fileHash:initial.hash,model}).refused,true);
 const inside=v.elements.filter(e=>v.start(e)>v.start(r.element)&&v.end(e)<=v.end(r.element));
 for(const element of [r.element,...inside])for(const type of ['setSVGGeometry','setSVGTransform','renameElement','duplicateElement','setClasses','setChildren']){
  const child={...r,element},op={type,fileHash:r.hash,property:'d',value:'M0 0H10V10H0Z',matrix:[1,0,0,1,2,0],name:'Changed',classes:['x'],children:[]};
  assert.equal(adapter.describe(child).svgStrokeOwner,r.element.id);
  assert.equal(adapter.planOp(child,op).refused,true,type+' '+v.tag(element));
 }
 const peer=v.elements.find(e=>v.tag(e)==='circle'),ancestor=v.elements.find(e=>v.tag(e)==='svg'),child={...r,element:c.original};
 for(const op of [{type:'deleteSelection',ids:[peer.id,c.original.id]},{type:'setSVGTransforms',ids:[peer.id,c.original.id],matrices:[]},{type:'reparentElement',destinationId:c.original.id},{type:'createSVGMask',ids:[peer.id,c.original.id],maskId:peer.id}])assert.equal(adapter.planOp({...r,element:peer},{...op,fileHash:r.hash}).refused,true);
 for(const type of ['duplicateElement','scaleGroup','setChildren'])assert.equal(adapter.planOp({...r,element:ancestor},{type,fileHash:r.hash}).refused,true);
 const renamed=adapter.planOp({...r,element:ancestor},{type:'renameElement',fileHash:r.hash,name:'Art'});assert.ok(renamed.ok,renamed.reason);
 const independent=adapter.planOp({...r,element:peer},{type:'setSVGGeometry',fileHash:r.hash,property:'r',value:'3'});assert.ok(independent.ok,independent.reason);
 assert.ok(S.context(resolve(kind,independent.edits[0].after,r.element.id),kind));
 assert.equal(adapter.planOp(child,{type:'deleteElement',fileHash:r.hash}).refused,true);
 const deleted=adapter.planOp(r,{type:'deleteElement',fileHash:r.hash});assert.ok(deleted.ok,deleted.reason);assert.ok(!deleted.edits[0].after.includes('data-rt-stroke-alignment'));
});
for(const kind of ['html','react','liquid'])test(kind+' transaction guard catches indirect changes and duplicates without blocking unrelated source',()=>{
 const initial=resolve(kind),made=create(initial,kind),r=resolve(kind,made.edits[0].after,made.selectionIds[0]),c=S.context(r,kind);
 const proposal=(after,file=r.file)=>({ok:true,edits:[{file,before:r.source,after}]});
 const op={type:'indirectStyleUpdate',fileHash:r.hash};
 for(const after of [r.source.replace('stroke="blue"','stroke="green"'),r.source.replace('width="60"','width="90"'),r.source.replace('data-rt-stroke-alignment','data-rt-lost-stroke'),r.source.replace('</svg>',r.source.slice(c.v.start(c.group),c.v.end(c.group))+'</svg>'),r.source.replace('</svg>','<path id="'+c.id+'" d="M0 0L1 1"/></svg>')]){
  const refused=S.validatePlan(r,op,kind,proposal(after));assert.equal(refused.refused,true,after);assert.equal(refused.edits,undefined);
 }
 const sibling=proposal(r.source.replace('Untouched','Edited'));assert.equal(S.validatePlan(r,op,kind,sibling),sibling);
 // A global style operation can plan changes in another source file.
 const multi={ok:true,edits:[sibling.edits[0],{file:r.file.replace('art.','other.'),before:r.source,after:r.source.replace('width="60"','width="90"')}]};assert.equal(S.validatePlan(r,op,kind,multi).refused,true);
 const malformed=resolve(kind,r.source.replace('data-rt-stroke-model="','data-rt-stroke-model="bad'),r.element.id);assert.equal(S.context(malformed,kind),null);assert.equal(S.guard(malformed,{type:'renameElement'},kind).refused,true);
 const unrelated={ok:true,edits:[{file:r.file,before:malformed.source,after:malformed.source.replace('Untouched','Edited')}]};assert.equal(S.validatePlan(malformed,op,kind,unrelated),unrelated);
 const sourceOp={type:'setSVGStrokeSourcePosition',fileHash:r.hash,position:'outside'},valid=S.plan(r,sourceOp,kind);assert.equal(S.validatePlan(r,sourceOp,kind,valid),valid);
 assert.equal(S.validatePlan(r,sourceOp,kind,proposal(valid.edits[0].after.replace('Untouched','Changed'))).refused,true);
});
for(const kind of ['html','react','liquid'])test(kind+' direct adapter application enforces the same retained-source guard as planning',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-stroke-apply-')),adapter=require('../src/adapters/'+kind+'.cjs'),initial=resolve(kind),file=path.join(root,initial.relPath),made=create(initial,kind);
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.writeFileSync(file,made.edits[0].after);
 const r={...resolve(kind,made.edits[0].after,made.selectionIds[0]),file,appRoot:root},c=S.context(r,kind);
 const refused=adapter.applyOp({...r,element:c.original},{type:'setSVGGeometry',fileHash:r.hash,property:'width',value:'90'});assert.equal(refused.refused,true);assert.equal(fs.readFileSync(file,'utf8'),r.source);
 const changed=adapter.applyOp(r,{type:'setSVGStrokeSourcePosition',fileHash:r.hash,position:'outside'});assert.ok(changed.ok,changed.reason);assert.equal(fs.readFileSync(file,'utf8'),changed.edits[0].after);
 const next={...resolve(kind,fs.readFileSync(file,'utf8'),changed.selectionIds[0]),file,appRoot:root};
 const restored=adapter.applyOp(next,{type:'restoreSVGStrokeSource',fileHash:next.hash});assert.ok(restored.ok,restored.reason);assert.equal(fs.readFileSync(file,'utf8'),initial.source);
});

for(const kind of ['html','react','liquid'])test(kind+' retained stroke weight changes preserve geometry, paint, original bytes and identities',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),initial=resolve(kind);
 for(const position of ['inside','center','outside']){
  const made=create(initial,kind,{model:{...model,position}}),r=resolve(kind,made.edits[0].after,made.selectionIds[0]),before=S.context(r,kind);
  assert.ok(adapter.capabilities.ops.includes('setSVGStrokeSourceWidth'));
  for(const width of [0,.125,12.5,10000]){
   const op={type:'setSVGStrokeSourceWidth',fileHash:r.hash,width},changed=adapter.planOp(r,op);assert.ok(changed.ok,changed.reason);assert.equal(S.validatePlan(r,op,kind,changed),changed);
   const next=resolve(kind,changed.edits[0].after,changed.selectionIds[0]),after=S.context(next,kind);assert.equal(after.source,before.source);assert.equal(after.id,before.id);assert.equal(after.model.width,width);
   const {width:oldWidth,bounds:oldBounds,...oldModel}=before.model,{width:newWidth,bounds:newBounds,...newModel}=after.model;assert.deepEqual(newModel,oldModel);assert.equal(after.model.bounds.width,before.model.bounds.width+2*(width-before.model.width)*Math.max(1,before.model.miterlimit));
   assert.equal(adapter.planOp(next,{type:'restoreSVGStrokeSource',fileHash:next.hash}).edits[0].after,initial.source);
  }
  assert.equal(adapter.planOp(r,{type:'setSVGStrokeSourceWidth',fileHash:r.hash,width:8}).unchanged,true);
  for(const width of [undefined,null,'12',NaN,Infinity,-1,10001])assert.equal(adapter.planOp(r,{type:'setSVGStrokeSourceWidth',fileHash:r.hash,width}).refused,true);
  assert.equal(adapter.planOp(r,{type:'setSVGStrokeSourceWidth',fileHash:'stale',width:12}).refused,true);
 }
});

for(const kind of ['html','react','liquid'])test(kind+' retained stroke settings isolate changes, validate values and restore original bytes',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),initial=resolve(kind),values={linecap:['butt','round','square'],linejoin:['miter','round','bevel'],miterlimit:[1,2.5,1000],dasharray:['none','4 8','1, 2, 3','0 0','2px 4px'],dashoffset:[-100000,-.25,0,100000]};
 for(const position of ['inside','center','outside']){
  const made=create(initial,kind,{model:{...model,position}}),r=resolve(kind,made.edits[0].after,made.selectionIds[0]),before=S.context(r,kind);assert.ok(adapter.capabilities.ops.includes('setSVGStrokeSourceStyle'));
  for(const [property,list]of Object.entries(values))for(const value of list){
   const op={type:'setSVGStrokeSourceStyle',fileHash:r.hash,property,value},changed=adapter.planOp(r,op);assert.ok(changed.ok,changed.reason);if(value===before.model[property]){assert.equal(changed.unchanged,true);continue;}
   const next=resolve(kind,changed.edits[0].after,changed.selectionIds[0]),after=S.context(next,kind);assert.equal(after.source,before.source);assert.equal(after.id,before.id);assert.equal(after.model[property],value);for(const key of Object.keys(before.model))if(![property,'bounds'].includes(key))assert.deepEqual(after.model[key],before.model[key]);assert.equal(adapter.planOp(next,{type:'restoreSVGStrokeSource',fileHash:next.hash}).edits[0].after,initial.source);
   assert.equal(S.validatePlan(r,op,kind,changed),changed);
  }
  for(const [property,value]of [['fill','green'],['position','outside'],['path','M0 0L1 1'],['__proto__',{}],['linecap','triangle'],['linejoin','arcs'],['miterlimit',0],['miterlimit','2'],['miterlimit',1001],['dasharray','1% 2%'],['dasharray','-1 2'],['dasharray','var(--dash)'],['dasharray','1,,2'],['dashoffset','1'],['dashoffset',100001],['dashoffset',NaN],['dashoffset',Infinity],['linecap',null],['dasharray',undefined]])assert.equal(adapter.planOp(r,{type:'setSVGStrokeSourceStyle',fileHash:r.hash,property,value}).refused,true,property+'='+value);
  assert.equal(adapter.planOp(r,{type:'setSVGStrokeSourceStyle',fileHash:'stale',property:'linecap',value:'round'}).refused,true);
 }
});
