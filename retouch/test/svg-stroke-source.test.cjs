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
  for(const type of ['createSVGStrokeSource','setSVGStrokeSourcePosition','setSVGStrokeSourceWidth','setSVGStrokeSourceTransform','restoreSVGStrokeSource']){
   const r={...resolve(kind,fs.readFileSync(file,'utf8'),selected),file},plan=S.plan(r,{type,fileHash:r.hash,model,position:'outside',width:12.5,matrix:[.8,.2,-.2,.8,15,20]},kind);assert.ok(plan.ok,plan.reason);
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
 const description=adapter.describe(r);assert.equal(description.svgStrokeSource.position,'inside');assert.equal(description.svgStrokeOwner,r.element.id);assert.equal(description.svgTransform.editable,true);assert.equal(description.svgGeometry,null);assert.equal(description.structure.canDuplicate,false);
 const change=adapter.planOp(r,{type:'setSVGStrokeSourcePosition',fileHash:r.hash,position:'outside'});assert.ok(change.ok,change.reason);
 assert.equal(adapter.planOp(r,{type:'restoreSVGStrokeSource',fileHash:r.hash}).edits[0].after,initial.source);
 assert.equal(adapter.capabilities.ops.includes('createSVGStrokeSource'),true);
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
 const adapter=require('../src/adapters/'+kind+'.cjs'),initial=resolve(kind),values={fill:['none','#12ab34','rgb(10 20 30 / .4)','color(display-p3 1 0.2 0.1 / 0.8)'],stroke:['none','blue','#12345678'],linecap:['butt','round','square'],linejoin:['miter','round','bevel'],miterlimit:[1,2.5,1000],dasharray:['none','4 8','1, 2, 3','0 0','2px 4px'],dashoffset:[-100000,-.25,0,100000]};
 for(const position of ['inside','center','outside']){
  const made=create(initial,kind,{model:{...model,position}}),r=resolve(kind,made.edits[0].after,made.selectionIds[0]),before=S.context(r,kind);assert.ok(adapter.capabilities.ops.includes('setSVGStrokeSourceStyle'));
  for(const [property,list]of Object.entries(values))for(const value of list){
   const op={type:'setSVGStrokeSourceStyle',fileHash:r.hash,property,value},changed=adapter.planOp(r,op);assert.ok(changed.ok,changed.reason);if(value===before.model[property]){assert.equal(changed.unchanged,true);continue;}
   const next=resolve(kind,changed.edits[0].after,changed.selectionIds[0]),after=S.context(next,kind);assert.equal(after.source,before.source);assert.equal(after.id,before.id);assert.equal(after.model[property],value);for(const key of Object.keys(before.model))if(![property,'bounds'].includes(key))assert.deepEqual(after.model[key],before.model[key]);assert.equal(adapter.planOp(next,{type:'restoreSVGStrokeSource',fileHash:next.hash}).edits[0].after,initial.source);
   assert.equal(S.validatePlan(r,op,kind,changed),changed);
  }
  for(const [property,value]of [['stroke','Canvas'],['fill','currentColor'],['fill','var(--paint)'],['stroke','url(#paint)'],['fill','inherit'],['stroke','light-dark(red, blue)'],['background','green'],['position','outside'],['path','M0 0L1 1'],['__proto__',{}],['linecap','triangle'],['linejoin','arcs'],['miterlimit',0],['miterlimit','2'],['miterlimit',1001],['dasharray','1% 2%'],['dasharray','-1 2'],['dasharray','var(--dash)'],['dasharray','1,,2'],['dashoffset','1'],['dashoffset',100001],['dashoffset',NaN],['dashoffset',Infinity],['linecap',null],['dasharray',undefined]])assert.equal(adapter.planOp(r,{type:'setSVGStrokeSourceStyle',fileHash:r.hash,property,value}).refused,true,property+'='+value);
  assert.equal(adapter.planOp(r,{type:'setSVGStrokeSourceStyle',fileHash:'stale',property:'linecap',value:'round'}).refused,true);
 }
});

for(const kind of ['html','react','liquid'])test(kind+' stroke creation snapshot identifies literal source for the editor',()=>{
 const initial=resolve(kind),candidate=S.creation(initial,kind);assert.equal(candidate.id,initial.element.id);assert.equal(candidate.tag,'rect');assert.equal(candidate.path,G.serializeCompound(model.document));assert.deepEqual(candidate.matrix,[1,0,0,1,0,0]);assert.ok(candidate.fields.some(field=>field.name==='width'&&field.value==='60'));
 assert.equal(require('../src/adapters/'+kind+'.cjs').capabilities.ops.includes('createSVGStrokeSource'),true);
 const made=create(initial,kind),retained=resolve(kind,made.edits[0].after,made.selectionIds[0]),c=S.context(retained,kind);assert.equal(S.creation({...retained,element:c.original},kind),null);assert.equal(S.creation(retained,kind),null);
 for(const attribute of ['class="styled"','id="referenced"','onclick="changed()"'])assert.equal(S.creation(resolve(kind,initial.source.replace('<rect ','<rect '+attribute+' ')),kind),null);
});

for(const kind of ['html','react','liquid'])test(kind+' stroke creation accepts one stable unused probe identity',()=>{
 const initial=resolve(kind),definitionId='rt-stroke-0123456789abcdef',op={type:'createSVGStrokeSource',fileHash:initial.hash,model,definitionId};
 const adapter=require('../src/adapters/'+kind+'.cjs');assert.deepEqual(adapter.describe(initial).svgStrokeCreation,S.creation(initial,kind));const publicPlan=adapter.planOp(initial,op);assert.ok(publicPlan.ok,publicPlan.reason);assert.equal(adapter.planOp(initial,{...op,fileHash:'stale'}).refused,true);assert.equal(S.validatePlan(initial,op,kind,{...publicPlan,edits:[{...publicPlan.edits[0],after:publicPlan.edits[0].after+'<!--tampered-->'}]}).refused,true);
 const first=S.plan(initial,op,kind),second=S.plan(initial,op,kind);assert.ok(first.ok,first.reason);assert.deepEqual(first.edits,second.edits);assert.equal(S.context(resolve(kind,first.edits[0].after,first.selectionIds[0]),kind).id,definitionId);
 for(const id of [null,'bad',definitionId.toUpperCase()])assert.equal(S.plan(initial,{...op,definitionId:id},kind).refused,true);
 const collided=resolve(kind,initial.source.replace('Untouched',definitionId));assert.equal(S.plan(collided,{...op,fileHash:collided.hash},kind).refused,true);
});

for(const kind of ['html','react','liquid'])test(kind+' retained paint edits use effective alpha and preserve original source opacity',()=>{
 const initial=resolve(kind),made=create(initial,kind,{model:{...model,opacity:.3,fillOpacity:.4,strokeOpacity:.6}}),r=resolve(kind,made.edits[0].after,made.selectionIds[0]),before=S.context(r,kind),adapter=require('../src/adapters/'+kind+'.cjs');
 for(const property of ['fill','stroke']){
  const changed=adapter.planOp(r,{type:'setSVGStrokeSourceStyle',fileHash:r.hash,property,value:'#11223380'});assert.ok(changed.ok,changed.reason);const next=resolve(kind,changed.edits[0].after,changed.selectionIds[0]),after=S.context(next,kind);assert.equal(after.model[property],'#11223380');assert.equal(after.model[property+'Opacity'],1);assert.equal(after.model.opacity,.3);assert.equal(after.model[property==='fill'?'strokeOpacity':'fillOpacity'],property==='fill'?.6:.4);assert.equal(after.id,before.id);assert.equal(after.source,before.source);assert.equal(adapter.planOp(next,{type:'restoreSVGStrokeSource',fileHash:next.hash}).edits[0].after,initial.source);
 }
});

for(const kind of ['html','react','liquid'])test(kind+' retained placement preserves original geometry, identity, paint and restoration',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),initial=resolve(kind),made=create(initial,kind),r=resolve(kind,made.edits[0].after,made.selectionIds[0]),before=S.context(r,kind);
 for(const matrix of [[1,0,0,1,15,-8],[.8,.2,-.2,.8,15,20],[-1,0,.2,1,100,0]]){
  const op={type:'setSVGStrokeSourceTransform',fileHash:r.hash,matrix},change=adapter.planOp(r,op);assert.ok(change.ok,change.reason);assert.equal(S.validatePlan(r,op,kind,change),change);
  const next=resolve(kind,change.edits[0].after,change.selectionIds[0]),after=S.context(next,kind);
  assert.deepEqual(after.model,{...before.model,placement:matrix});assert.equal(after.source,before.source);assert.equal(after.id,before.id);assert.deepEqual(adapter.describe(next).svgTransform.matrix,matrix);
  const width=adapter.planOp(next,{type:'setSVGStrokeSourceWidth',fileHash:next.hash,width:14}),wide=resolve(kind,width.edits[0].after,width.selectionIds[0]);assert.deepEqual(S.context(wide,kind).model.placement,matrix);
  assert.equal(adapter.planOp(next,{type:'restoreSVGStrokeSource',fileHash:next.hash}).edits[0].after,initial.source);
  assert.equal(adapter.planOp(next,{...op,fileHash:next.hash}).unchanged,true);
  assert.equal(S.validatePlan(r,op,kind,{...change,edits:[{...change.edits[0],after:change.edits[0].after.replace('stroke="blue"','stroke="green"')}]}).refused,true);
 }
 for(const matrix of [undefined,null,[],[1,0,0,0,0,0],[Infinity,0,0,1,0,0],[1,0,0,1,'2',0]])assert.equal(adapter.planOp(r,{type:'setSVGStrokeSourceTransform',fileHash:r.hash,matrix}).refused,true);
 assert.equal(create(initial,kind,{model:{...model,placement:[1,0,0,1,1,0]}}).refused,true);
});
for(const kind of ['html','react','liquid'])test(kind+' mixed vector batch transforms are atomic and preserve retained ownership',t=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),initial=resolve(kind),source=initial.source.replace('<rect','<g data-rt-name="Outer"><rect').replace('<circle','<rect x="20" y="20" width="60" height="60" fill="red" stroke="blue" transform="translate(70 0)"/><circle').replace('</svg>','</g></svg>');
 let state=resolve(kind,source);
 for(const matrix of [[1,0,0,1,0,0],[1,0,0,1,70,0]]){
  const v=view(state,kind);state.element=state.elements.find(e=>v.tag(e)==='rect'&&S.creation({...state,element:e},kind));
  const made=create(state,kind,{model:{...model,matrix}});assert.ok(made.ok,made.reason);state=resolve(kind,made.edits[0].after,made.selectionIds[0]);
 }
 const v=view(state,kind),groups=state.elements.filter(e=>S.context({...state,element:e},kind)),peer=state.elements.find(e=>v.tag(e)==='circle'),parent=state.elements.find(e=>v.attr(e,'data-rt-name')==='Outer'),originals=groups.map(element=>S.context({...state,element},kind));
 assert.equal(groups.length,2);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-stroke-batch-')),file=path.join(root,state.relPath);t.after(()=>fs.rmSync(root,{recursive:true,force:true}));state.file=file;fs.writeFileSync(file,state.source);
 for(const selected of [[...groups,peer],[peer,...groups]]){
  const matrices=Object.fromEntries(selected.map((element,i)=>[element.id,[1,.1,.2,1,10+i*4,8]])),r={...state,element:selected[0]},op={type:'setSVGTransforms',fileHash:r.hash,ids:selected.map(e=>e.id),matrices},change=adapter.planOp(r,op);
  assert.ok(change.ok,change.reason);assert.equal(change.edits.length,1);assert.deepEqual(change.selection.map(e=>e.id),op.ids);assert.deepEqual(adapter.collect(change.edits[0].after,state.relPath).elements.map(e=>e.id),state.elements.map(e=>e.id));
  for(const [i,group]of groups.entries()){const next=resolve(kind,change.edits[0].after,group.id),retained=S.context(next,kind);assert.deepEqual(retained.model,{...originals[i].model,placement:matrices[group.id]});assert.equal(retained.source,originals[i].source);assert.equal(retained.id,originals[i].id);}
  assert.equal(S.validatePlan(r,op,kind,change),change);
  const history=new(require('../src/history.cjs').SourceHistory)(),applied=require('../src/transactions.cjs').applyPlan(root,change);assert.ok(applied.ok,applied.reason);const entry=history.record(applied.edits);assert.ok(history.apply(root,'undo',entry,{}).ok);assert.equal(fs.readFileSync(file,'utf8'),state.source);assert.ok(history.apply(root,'redo',entry,{}).ok);assert.equal(fs.readFileSync(file,'utf8'),change.edits[0].after);assert.ok(history.apply(root,'undo',entry,{}).ok);
  const next=resolve(kind,change.edits[0].after,selected[0].id);assert.deepEqual(adapter.planOp(next,{...op,fileHash:next.hash}).edits,[]);
  const corrupt={...change,edits:[{...change.edits[0],after:change.edits[0].after.replace('stroke="blue"','stroke="green"')}]};assert.equal(S.validatePlan(r,op,kind,corrupt).refused,true);
  for(const matrix of [[0,0,0,0,0,0],[1,0,0,1,Infinity,0]]){const bad=adapter.planOp(r,{...op,matrices:{...matrices,[groups[1].id]:matrix}});assert.equal(bad.refused,true);assert.equal(bad.edits,undefined);assert.equal(fs.readFileSync(file,'utf8'),state.source);}
  assert.equal(adapter.planOp(r,{...op,fileHash:'stale'}).refused,true);
 }
 const covered={type:'setSVGTransforms',fileHash:state.hash,ids:[parent.id,groups[0].id],matrices:{[parent.id]:[1,0,0,1,12,9],[groups[0].id]:[1,0,0,1,0,0]}},moved=adapter.planOp({...state,element:parent},covered);assert.ok(moved.ok,moved.reason);for(const [i,group]of groups.entries())assert.deepEqual(S.context(resolve(kind,moved.edits[0].after,group.id),kind).model,originals[i].model);
 const damaged=resolve(kind,state.source.replace('width="60"','width="90"'),peer.id),bad=adapter.planOp(damaged,{type:'setSVGTransforms',fileHash:damaged.hash,ids:[peer.id,groups[0].id],matrices:{[peer.id]:[1,0,0,1,1,1],[groups[0].id]:[1,0,0,1,1,1]}});assert.equal(bad.refused,true);
});
for(const kind of ['html','react','liquid'])test(kind+' shared stroke properties stage every vector atomically with composed source identities',t=>{
 const adapter=require('../src/adapters/'+kind+'.cjs');let r=resolve(kind),source=r.source.replace('<circle','<g><rect x="20" y="20" width="60" height="60" fill="red" stroke="blue"/></g><circle');r=resolve(kind,source);
 for(const position of ['inside','center']){
  const v=view(r,kind);r.element=r.elements.find(e=>v.tag(e)==='rect'&&S.creation({...r,element:e},kind));const made=create(r,kind,{model:{...model,position,width:position==='inside'?8:3}});assert.ok(made.ok,made.reason);r=resolve(kind,made.edits[0].after,made.selectionIds[0]);
 }
 const groups=r.elements.filter(element=>S.context({...r,element},kind)),contexts=groups.map(element=>S.context({...r,element},kind)),selected=groups.map(e=>e.id);r.element=groups[0];
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-stroke-properties-')),file=path.join(root,r.relPath);t.after(()=>fs.rmSync(root,{recursive:true,force:true}));r.file=file;fs.writeFileSync(file,r.source);
 for(const [property,value]of [['position','outside'],['position','center'],['width',12.5],['linecap','round'],['linejoin','bevel'],['miterlimit',7],['dasharray','4 2'],['dashoffset',3],['fill','#11223380'],['stroke','none']]){
  const op={type:'setSVGStrokeSelection',ids:selected,fileHash:r.hash,property,value},changed=adapter.planOp(r,op);assert.ok(changed.ok,changed.reason);assert.equal(changed.edits.length,1);assert.equal(S.validatePlan(r,op,kind,changed),changed);
  const after=changed.edits[0].after,next=resolve(kind,after,changed.selectionIds[0]),mapping=new Map(changed.sourceIdMap);assert.equal(new Set(changed.selectionIds).size,2);
  changed.selectionIds.forEach((id,i)=>{const c=S.context({...next,element:next.elements.find(e=>e.id===id)},kind);assert.equal(c.model[property],value);assert.equal(c.source,contexts[i].source);assert.equal(c.id,contexts[i].id);assert.equal(id,mapping.get(selected[i])||selected[i]);});
  for(const e of r.elements)if(!changed.removedSourceIds.includes(e.id))assert.ok(next.elements.some(n=>n.id===(mapping.get(e.id)||e.id)),e.id);
  assert.ok(next.elements.some(e=>e.id===changed.parentId));assert.equal(adapter.planOp(next,{...op,ids:changed.selectionIds,fileHash:next.hash}).unchanged,true);
  const history=new(require('../src/history.cjs').SourceHistory)(),applied=require('../src/transactions.cjs').applyPlan(root,changed);assert.ok(applied.ok,applied.reason);const entry=history.record(applied.edits);assert.ok(history.apply(root,'undo',entry,{}).ok);assert.equal(fs.readFileSync(file,'utf8'),r.source);assert.ok(history.apply(root,'redo',entry,{}).ok);assert.equal(fs.readFileSync(file,'utf8'),after);assert.ok(history.apply(root,'undo',entry,{}).ok);
  assert.equal(S.validatePlan(r,op,kind,{...changed,edits:[{...changed.edits[0],after:after+' '}]}).refused,true);
 }
 const op={type:'setSVGStrokeSelection',ids:selected,fileHash:r.hash,property:'width',value:12};
 for(const extra of [{fileHash:'stale'},{ids:[selected[0],selected[0]]},{ids:[selected[0],'0000000000']},{ids:[selected[0],contexts[1].original.id]},{property:'path',value:'M0 0L1 1'},{value:-1},{value:Infinity},{value:'12'}]){const bad=adapter.planOp(r,{...op,...extra});assert.equal(bad.refused,true);assert.equal(bad.edits,undefined);assert.equal(fs.readFileSync(file,'utf8'),r.source);}
 // The first member is valid; damage in a later member must still refuse all edits.
 const damagedSource=r.source.replace(contexts[1].source,contexts[1].source.replace('width="60"','width="61"')),damaged=resolve(kind,damagedSource,selected[0]);const bad=adapter.planOp(damaged,{...op,fileHash:damaged.hash});assert.equal(bad.refused,true);assert.equal(bad.edits,undefined);
});
for(const kind of ['html','react','liquid'])test(kind+' shared alignment refuses unsupported open contours without a partial edit',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),initial=resolve(kind);let state=resolve(kind,initial.source.replace('<circle cx="10" cy="10" r="2"/>','<path d="M0 0L10 10" fill="none" stroke="blue"/>'));
 const made=create(state,kind);assert.ok(made.ok,made.reason);state=resolve(kind,made.edits[0].after,made.selectionIds[0]);
 const v=view(state,kind),element=state.elements.find(e=>v.tag(e)==='path'&&S.creation({...state,element:e},kind));state.element=element;
 const open=create(state,kind,{model:{...model,document:G.parseCompound('M0 0L10 10'),fill:'none',position:'center'}});assert.ok(open.ok,open.reason);state=resolve(kind,open.edits[0].after,open.selectionIds[0]);
 const groups=state.elements.filter(element=>S.context({...state,element},kind));state.element=groups[0];
 for(const position of ['inside','outside']){const bad=adapter.planOp(state,{type:'setSVGStrokeSelection',fileHash:state.hash,ids:groups.map(e=>e.id),property:'position',value:position});assert.equal(bad.refused,true);assert.equal(bad.edits,undefined);}
 const center=adapter.planOp(state,{type:'setSVGStrokeSelection',fileHash:state.hash,ids:groups.map(e=>e.id),property:'position',value:'center'});assert.ok(center.ok,center.reason);
});
for(const kind of ['html','react','liquid'])test(kind+' selected stroke paints preserve distinct colors and effective opacity atomically',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs');let r=resolve(kind),source=r.source.replace('<circle','<rect x="20" y="20" width="60" height="60" fill="red" stroke="blue"/><circle');r=resolve(kind,source);
 for(const alpha of [.4,.7]){const v=view(r,kind);r.element=r.elements.find(e=>v.tag(e)==='rect'&&S.creation({...r,element:e},kind));const made=create(r,kind,{model:{...model,fillOpacity:alpha,strokeOpacity:alpha,opacity:.3}});assert.ok(made.ok,made.reason);r=resolve(kind,made.edits[0].after,made.selectionIds[0]);}
 const groups=r.elements.filter(element=>S.context({...r,element},kind)),ids=groups.map(e=>e.id),originals=groups.map(element=>S.context({...r,element},kind));r.element=groups[0];
 for(const property of ['fill','stroke']){
  const values={[ids[0]]:'#11223380',[ids[1]]:'color(display-p3 0.2 0.6 0.8 / 0.5)'},op={type:'setSVGStrokeSelection',fileHash:r.hash,ids,property,values},change=adapter.planOp(r,op);assert.ok(change.ok,change.reason);assert.equal(change.edits.length,1);
  const next=resolve(kind,change.edits[0].after,change.selectionIds[0]);change.selectionIds.forEach((id,i)=>{const c=S.context({...next,element:next.elements.find(e=>e.id===id)},kind);assert.equal(c.model[property],values[ids[i]]);assert.equal(c.model[property+'Opacity'],1);assert.equal(c.model.opacity,.3);assert.equal(c.model[property==='fill'?'strokeOpacity':'fillOpacity'],originals[i].model[property==='fill'?'strokeOpacity':'fillOpacity']);assert.equal(c.source,originals[i].source);assert.equal(c.id,originals[i].id);});
  assert.equal(S.validatePlan(r,op,kind,change),change);
  for(const extra of [{value:'red'},{values:null},{values:['red','blue']},{values:{[ids[0]]:'red'}},{values:{...values,extra:'green'}},{values:{...values,[ids[1]]:'var(--paint)'}},{values:{...values,[ids[1]]:null}},{property:'width'}]){const refused=adapter.planOp(r,{...op,...extra});assert.equal(refused.refused,true);assert.equal(refused.edits,undefined);}
 }
});
for(const kind of ['html','react','liquid'])test(kind+' per-vector numeric stroke edits preserve mixed values with atomic bounds and history',t=>{
 const adapter=require('../src/adapters/'+kind+'.cjs');let r=resolve(kind);r=resolve(kind,r.source.replace('<circle','<rect x="20" y="20" width="60" height="60" fill="red" stroke="blue"/><circle'));
 for(const width of [8,1]){const v=view(r,kind);r.element=r.elements.find(e=>v.tag(e)==='rect'&&S.creation({...r,element:e},kind));const made=create(r,kind,{model:{...model,width,miterlimit:width===8?4:2,dashoffset:width===8?0:-10}});assert.ok(made.ok,made.reason);r=resolve(kind,made.edits[0].after,made.selectionIds[0]);}
 const groups=r.elements.filter(element=>S.context({...r,element},kind)),ids=groups.map(e=>e.id),originals=groups.map(element=>S.context({...r,element},kind));r.element=groups[0];
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-mixed-stroke-')),file=path.join(root,r.relPath);t.after(()=>fs.rmSync(root,{recursive:true,force:true}));r.file=file;fs.writeFileSync(file,r.source);
 for(const [property,numbers]of [['width',[10,3]],['width',[10.123456789,3]],['width',[7,0]],['miterlimit',[7,5]],['dashoffset',[5,-5]]]){
  const values=Object.fromEntries(ids.map((id,i)=>[id,numbers[i]])),op={type:'setSVGStrokeSelection',fileHash:r.hash,ids,property,values},change=adapter.planOp(r,op);assert.ok(change.ok,change.reason);assert.equal(change.edits.length,1);assert.equal(S.validatePlan(r,op,kind,change),change);
  const after=change.edits[0].after,next=resolve(kind,after,change.selectionIds[0]);change.selectionIds.forEach((id,i)=>{const c=S.context({...next,element:next.elements.find(e=>e.id===id)},kind);assert.equal(c.model[property],numbers[i]);assert.equal(c.source,originals[i].source);assert.equal(c.id,originals[i].id);for(const other of ['width','miterlimit','dashoffset','fill','stroke','opacity','fillOpacity','strokeOpacity','matrix'])if(other!==property)assert.deepEqual(c.model[other],originals[i].model[other]);});
  const history=new(require('../src/history.cjs').SourceHistory)(),applied=require('../src/transactions.cjs').applyPlan(root,change);assert.ok(applied.ok,applied.reason);const entry=history.record(applied.edits);assert.ok(history.apply(root,'undo',entry,{}).ok);assert.equal(fs.readFileSync(file,'utf8'),r.source);assert.ok(history.apply(root,'redo',entry,{}).ok);assert.equal(fs.readFileSync(file,'utf8'),after);assert.ok(history.apply(root,'undo',entry,{}).ok);
  for(const bad of [undefined,null,'12',NaN,Infinity,property==='width'?-1:property==='miterlimit'?0:100001,property==='width'?10001:property==='miterlimit'?1001:-100001]){const result=adapter.planOp(r,{...op,values:{...values,[ids[1]]:bad}});assert.equal(result.refused,true);assert.equal(result.edits,undefined);assert.equal(fs.readFileSync(file,'utf8'),r.source);}
  assert.equal(adapter.planOp(r,{...op,value:numbers[0]}).refused,true);assert.equal(adapter.planOp(r,{...op,fileHash:'stale'}).refused,true);
 }
});
for(const kind of ['html','react','liquid'])test(kind+' retained path editing preserves archived geometry, paint and placement with exact history',t=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),initial=resolve(kind),root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-stroke-path-')),file=path.join(root,initial.relPath);t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const position of ['inside','center','outside']){
  const made=create(initial,kind,{model:{...model,position}});let r=resolve(kind,made.edits[0].after,made.selectionIds[0]);const placed=adapter.planOp(r,{type:'setSVGStrokeSourceTransform',fileHash:r.hash,matrix:[1,.2,0,1,5,7]});r={...resolve(kind,placed.edits[0].after,placed.selectionIds[0]),file};fs.writeFileSync(file,r.source);const original=S.context(r,kind),pathData='M10 20 L80 20 L80 80 L20 80 Z',op={type:'setSVGStrokeSourcePath',fileHash:r.hash,path:pathData},change=adapter.planOp(r,op);assert.ok(change.ok,change.reason);assert.equal(S.validatePlan(r,op,kind,change),change);
  const next=resolve(kind,change.edits[0].after,change.selectionIds[0]),edited=S.context(next,kind);assert.equal(edited.model.path,G.serializeCompound(G.parseCompound(pathData)));assert.equal(edited.model.originalPath,original.model.path);assert.equal(edited.source,original.source);assert.equal(edited.id,original.id);for(const key of ['position','width','fill','stroke','matrix','placement'])assert.deepEqual(edited.model[key],original.model[key]);
  const recolor=adapter.planOp(next,{type:'setSVGStrokeSourceStyle',fileHash:next.hash,property:'stroke',value:'green'});assert.ok(recolor.ok,recolor.reason);const colored=resolve(kind,recolor.edits[0].after,recolor.selectionIds[0]);assert.equal(S.context(colored,kind).model.originalPath,original.model.path);assert.equal(adapter.planOp(colored,{type:'restoreSVGStrokeSource',fileHash:colored.hash}).edits[0].after,initial.source);
  const again=adapter.planOp(next,{type:'setSVGStrokeSourcePath',fileHash:next.hash,path:'M15 20 L80 20 L80 80 L20 80 Z'});assert.ok(again.ok,again.reason);const twice=resolve(kind,again.edits[0].after,again.selectionIds[0]);assert.equal(S.context(twice,kind).model.originalPath,original.model.path);assert.equal(adapter.planOp(twice,{type:'restoreSVGStrokeSource',fileHash:twice.hash}).edits[0].after,initial.source);
  const reset=adapter.planOp(next,{type:'setSVGStrokeSourcePath',fileHash:next.hash,path:original.model.path});assert.ok(reset.ok,reset.reason);assert.equal(reset.edits[0].after,r.source);
  const history=new(require('../src/history.cjs').SourceHistory)(),applied=require('../src/transactions.cjs').applyPlan(root,change);assert.ok(applied.ok,applied.reason);const entry=history.record(applied.edits);assert.ok(history.apply(root,'undo',entry,{}).ok);assert.equal(fs.readFileSync(file,'utf8'),r.source);assert.ok(history.apply(root,'redo',entry,{}).ok);assert.equal(fs.readFileSync(file,'utf8'),change.edits[0].after);
  for(const path of [null,'','bad path',...(position==='center'?[]:['M0 0L10 10','M0 0L10 10L0 10L10 0Z'])]){const bad=adapter.planOp(r,{...op,path});assert.equal(bad.refused,true);assert.equal(bad.edits,undefined);}
  assert.equal(adapter.planOp(r,{...op,fileHash:'stale'}).refused,true);
  const damaged=resolve(kind,change.edits[0].after.replace('width="60"','width="61"'),change.selectionIds[0]);assert.equal(S.context(damaged,kind),null);
 }
});
for(const kind of ['html','react','liquid'])test(kind+' retained gradients preserve stroke geometry, original bytes and independent paint identities',()=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),initial=resolve(kind),made=create(initial,kind);let r=resolve(kind,made.edits[0].after,made.selectionIds[0]);const before=S.context(r,kind),archive=before.source;
 const apply=extra=>{const op={type:'setSVGStrokeSourceGradient',fileHash:r.hash,...extra},result=adapter.planOp(r,op);assert.ok(result.ok,result.reason);assert.equal(S.validatePlan(r,op,kind,result),result);r=resolve(kind,result.edits[0]?.after||r.source,result.selectionIds?.[0]||r.element.id);return S.context(r,kind);};
 for(const paint of ['fill','stroke']){
  let c=apply({paint,action:'create',value:{type:'linearGradient',color:'#12345680'}});assert.equal(c.source,archive);assert.equal(c.id,before.id);assert.equal(c.model.gradients[paint].stops[0].color,'#12345680');assert.ok(r.source.includes(c.id+'-'+paint));
  c=apply({paint,action:'opacity',value:.35});assert.equal(c.model[paint+'Opacity'],.35);
  c=apply({paint,changes:{x1:'10%',x2:'90%',spreadMethod:'reflect'}});assert.equal(c.model.gradients[paint].fields.x1,'10%');
  c=apply({paint,stop:1,changes:{'stop-color':'color(display-p3 0.2 0.6 0.8)','stop-opacity':'.75'}});assert.equal(c.model.gradients[paint].stops[1].opacity,'0.75');
  c=apply({paint,action:'insertStop',stop:1,value:{offset:'.5',color:'red',opacity:'1'}});assert.equal(c.model.gradients[paint].stops.length,3);
  c=apply({paint,action:'moveStop',stop:1,value:'.8'});assert.equal(c.model.gradients[paint].stops[1].offset,'0.8');
  c=apply({paint,action:'reverse'});assert.equal(c.model.gradients[paint].stops[1].color,'red');
  c=apply({paint,action:'setType',value:'radialGradient'});assert.equal(c.model.gradients[paint].fields.x1,'10%');
  c=apply({paint,changes:{cx:'45%',r:'40%',fr:'10%'}});assert.equal(c.model.gradients[paint].fields.r,'40%');
  c=apply({paint,action:'removeStop',stop:1});assert.equal(c.model.gradients[paint].stops.length,2);
  for(const bad of [{paint:'other',action:'reverse'},{paint,stop:4,changes:{'stop-color':'red'}},{paint,stop:0,changes:{'stop-color':'currentColor'}},{paint,changes:{href:'#foreign'}},{paint,action:'removeStop',stop:0},{paint,action:'create',value:{type:'linearGradient',color:'red'}}]){const result=adapter.planOp(r,{type:'setSVGStrokeSourceGradient',fileHash:r.hash,...bad});assert.equal(result.refused,true);assert.equal(result.edits,undefined);}
 }
 const gradients=S.context(r,kind).model.gradients;for(const [type,extra]of [['setSVGStrokeSourceWidth',{width:11}],['setSVGStrokeSourceTransform',{matrix:[1,0,0,1,4,5]}],['setSVGStrokeSourcePath',{path:'M10 20 L80 20 L80 80 L20 80 Z'}],['setSVGStrokeSourcePosition',{position:'outside'}]]){const result=adapter.planOp(r,{type,fileHash:r.hash,...extra});assert.ok(result.ok,result.reason);r=resolve(kind,result.edits[0].after,result.selectionIds[0]);assert.deepEqual(S.context(r,kind).model.gradients,gradients);}
 const c=apply({paint:'fill',action:'solid',value:'#abcdef'});assert.equal(c.model.gradients.fill,undefined);assert.deepEqual(c.model.gradients.stroke,gradients.stroke);assert.equal(c.source,archive);
 assert.equal(adapter.planOp(r,{type:'restoreSVGStrokeSource',fileHash:r.hash}).edits[0].after,initial.source);
 assert.equal(adapter.planOp(r,{type:'setSVGStrokeSourceGradient',paint:'stroke',action:'reverse',fileHash:'stale'}).refused,true);
});
for(const kind of ['html','react','liquid'])test(kind+' shared paint opacity preserves gradients and intrinsic color alpha with atomic exact history',t=>{
 const adapter=require('../src/adapters/'+kind+'.cjs'),gradient={type:'linearGradient',fields:{gradientTransform:'rotate(20 .5 .5)'},stops:[{offset:'0',color:'#ff000080',opacity:'.6'},{offset:'1',color:'blue',opacity:'0'}]};
 let r=resolve(kind);r=resolve(kind,r.source.replace('<circle','<rect x="20" y="20" width="60" height="60" fill="red" stroke="blue"/><circle'));
 for(const opacity of [.3,.8]){const v=view(r,kind);r.element=r.elements.find(element=>v.tag(element)==='rect'&&S.creation({...r,element},kind));const change=create(r,kind,{model:{...model,fill:'#12345680',fillOpacity:opacity,strokeOpacity:opacity,gradients:opacity===.3?{fill:gradient,stroke:gradient}:undefined}});assert.ok(change.ok,change.reason);r=resolve(kind,change.edits[0].after,change.selectionIds[0]);}
 const groups=r.elements.filter(element=>S.context({...r,element},kind)),ids=groups.map(e=>e.id),before=groups.map(element=>S.context({...r,element},kind));r.element=groups[0];
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-gradient-opacity-')),file=path.join(root,r.relPath);t.after(()=>fs.rmSync(root,{recursive:true,force:true}));r.file=file;fs.writeFileSync(file,r.source);
 for(const property of ['fillOpacity','strokeOpacity'])for(const values of [[.4,.4],[.2,.7],[0,1]]){
  const op={type:'setSVGStrokeSelection',fileHash:r.hash,ids,property,values:Object.fromEntries(ids.map((id,i)=>[id,values[i]]))},change=adapter.planOp(r,op);assert.ok(change.ok,change.reason);assert.equal(S.validatePlan(r,op,kind,change),change);
  const after=change.edits[0].after,next=resolve(kind,after,change.selectionIds[0]);change.selectionIds.forEach((id,i)=>{const c=S.context({...next,element:next.elements.find(e=>e.id===id)},kind);assert.equal(c.model[property],values[i]);assert.deepEqual({...c.model,[property]:before[i].model[property]},before[i].model);assert.equal(c.source,before[i].source);assert.equal(c.id,before[i].id);});
  const history=new(require('../src/history.cjs').SourceHistory)(),applied=require('../src/transactions.cjs').applyPlan(root,change);assert.ok(applied.ok,applied.reason);const entry=history.record(applied.edits);assert.ok(history.apply(root,'undo',entry,{}).ok);assert.equal(fs.readFileSync(file,'utf8'),r.source);assert.ok(history.apply(root,'redo',entry,{}).ok);assert.equal(fs.readFileSync(file,'utf8'),after);assert.ok(history.apply(root,'undo',entry,{}).ok);
  for(const bad of [-.1,1.1,NaN,Infinity,null,'0.4',undefined]){const refused=adapter.planOp(r,{...op,values:{...op.values,[ids[1]]:bad}});assert.equal(refused.refused,true);assert.equal(refused.edits,undefined);assert.equal(fs.readFileSync(file,'utf8'),r.source);}
 }
});
