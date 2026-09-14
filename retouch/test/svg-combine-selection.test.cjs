'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),combine=require('../src/svg-combine-selection.cjs'),geometry=require('../shell/svg-path.js'),boolean=require('../shell/svg-boolean.js'),ids=require('../src/id.cjs');
function resolve(kind,markup){if(kind==='react')markup=markup.replace('<!--keep-->','{/*keep*/}');if(kind==='liquid')markup=markup.replace('<!--keep-->','');const source=kind==='react'?'export default function Artwork(){return ('+markup+');}':markup,adapter=require('../src/adapters/'+kind+'.cjs'),elements=adapter.collect(source,kind==='react'?'art.jsx':kind==='liquid'?'art.liquid':'art.html').elements;return {source,elements,element:elements.find(e=>(kind==='react'?ids.jsxElementName(e.node):e.tag)==='rect'),file:'/tmp/art.'+(kind==='react'?'jsx':kind==='liquid'?'liquid':'html'),relPath:kind==='react'?'art.jsx':kind==='liquid'?'art.liquid':'art.html',hash:adapter.contentHash(source)};}
const tag=(kind,e)=>kind==='react'?ids.jsxElementName(e.node):e.tag;
function selections(kind,r){return ['rect','circle'].map(t=>r.elements.find(e=>tag(kind,e)===t).id);}
for(const kind of ['html','react','liquid']){
 test(kind+' boolean source replacement retains base appearance, metadata and transform with exact survivor mapping',()=>{
  const markup='<main><svg><g><rect width="100" height="100" transform="translate(20 30)" fill="red" data-rt-name="Base" data-rt-shape="star"><title>Base shape</title></rect><!--keep--><circle cx="75" cy="50" r="30"/><ellipse rx="2" ry="3"/></g></svg><p>After</p></main>',r=resolve(kind,markup);
  const result=boolean.combineShapes([{document:geometry.parseCompound('M0 0H100V100H0Z')},{document:geometry.parseCompound('M105 50A30 30 0 1 1 45 50A30 30 0 1 1 105 50Z')}],'subtract');assert.ok(result.ok,result.reason);
  const path=geometry.serializeCompound(result.document),plan=combine.plan(r,{ids:selections(kind,r),fileHash:r.hash,path},kind);assert.ok(plan.ok,plan.reason);assert.equal(plan.edits.length,1);assert.equal(plan.edits[0].before,r.source);
  const expected=r.source.replace('<rect width="100" height="100"','<path d="'+path+'"  ').replace(' data-rt-shape="star"',' ').replace('</rect>','</path>').replace('<circle cx="75" cy="50" r="30"/>','');
  // Token removal deliberately retains the source's surrounding whitespace.
  assert.equal(plan.edits[0].after,expected);
  const next=require('../src/adapters/'+kind+'.cjs').collect(plan.edits[0].after,r.relPath).elements,mapping=new Map(plan.sourceIdMap),removed=new Set(plan.removedSourceIds);
  assert.deepEqual(r.elements.filter(e=>!removed.has(e.id)).map(e=>mapping.get(e.id)||e.id),next.map(e=>e.id));assert.equal(plan.removedSourceIds.length,1);assert.equal(plan.selectionIds[0],mapping.get(r.element.id)||r.element.id);assert.ok(next.some(e=>e.id===plan.parentId));
 });
 test(kind+' empty boolean result removes all operands atomically and selects retained parent',()=>{
  const r=resolve(kind,'<svg><rect width="10" height="10"/><circle r="5"/><path d="M0 0L1 1"/></svg>'),plan=combine.plan(r,{ids:selections(kind,r),fileHash:r.hash,path:''},kind);assert.ok(plan.ok,plan.reason);assert.equal(plan.edits[0].after,r.source.replace('<rect width="10" height="10"/>','').replace('<circle r="5"/>',''));assert.equal(plan.removedSourceIds.length,2);assert.deepEqual(plan.selectionIds,[plan.parentId]);
 });
 test(kind+' boolean source plan rejects stale selection, open paths, dynamic structure and nested operands without edits',()=>{
  const r=resolve(kind,'<svg><rect width="10" height="10"/><circle r="5"/></svg>'),op={ids:selections(kind,r),fileHash:r.hash,path:'M0 0L10 0L0 10Z'};
  for(const changes of [{fileHash:'old'},{ids:[op.ids[0],op.ids[0]]},{ids:[op.ids[0],'missing']},{path:'M0 0L10 10'},{path:'bad'},{ids:[]}]){const result=combine.plan(r,{...op,...changes},kind);assert.equal(result.refused,true);assert.equal(result.edits,undefined);}
  for(const markup of ['<svg><g><rect width="10" height="10"/></g><circle r="5"/></svg>','<svg><rect width="10" height="10"><animate attributeName="width"/></rect><circle r="5"/></svg>',kind==='react'?'<svg>{true && <rect width="10" height="10"/>}<circle r="5"/></svg>':'<svg><rect v-if="shown" width="10" height="10"/><circle r="5"/></svg>']){const other=resolve(kind,markup),result=combine.plan(other,{...op,fileHash:other.hash,ids:selections(kind,other)},kind);assert.equal(result.refused,true,markup);assert.equal(result.edits,undefined);}
 });
}

for(const kind of ['html','react','liquid'])test(kind+' adapter exposes atomic replacement through its ordinary operation planner',()=>{
 const r=resolve(kind,'<svg><rect width="10" height="10"/><circle r="5"/></svg>'),adapter=require('../src/adapters/'+kind+'.cjs'),op={type:'replaceSVGSelection',ids:selections(kind,r),fileHash:r.hash,path:'M0 0L10 0L0 10Z'};
 assert.ok(adapter.capabilities.ops.includes(op.type));assert.deepEqual(adapter.planOp(r,op),combine.plan(r,op,kind));
});
for(const kind of ['html','react','liquid'])test(kind+' replacement writes one history entry and restores exact source through Undo/Redo',t=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{SourceHistory}=require('../src/history.cjs'),root=fs.mkdtempSync(path.join(os.tmpdir(),'rt-svg-boolean-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const r=resolve(kind,'<svg><rect width="10" height="10"/><circle r="5"/><ellipse rx="2" ry="2"/></svg>');r.file=path.join(root,r.relPath);r.appRoot=root;fs.writeFileSync(r.file,r.source);
 const op={type:'replaceSVGSelection',ids:selections(kind,r).reverse(),fileHash:r.hash,path:'M0 0L10 0L0 10Z'},adapter=require('../src/adapters/'+kind+'.cjs'),result=adapter.applyOp(r,op);assert.ok(result.ok,result.reason);const after=fs.readFileSync(r.file,'utf8');assert.match(after,/<path d="/);assert.doesNotMatch(after,/<rect|<circle/);assert.match(after,/<ellipse/);
 const history=new SourceHistory(),entry=history.record(result.edits,'boolean-1');assert.equal(history.undo.length,1);
 assert.equal(history.apply(root,'undo',entry,{}).ok,true);assert.equal(fs.readFileSync(r.file,'utf8'),r.source);
 assert.equal(history.apply(root,'redo',entry,{}).ok,true);assert.equal(fs.readFileSync(r.file,'utf8'),after);
 // A saved plan must not overwrite an intervening external edit.
 const saved=adapter.planOp(r,op);fs.writeFileSync(r.file,r.source+'\n<!--external-->');assert.equal(require('../src/transactions.cjs').applyPlan(root,saved).refused,true);assert.equal(fs.readFileSync(r.file,'utf8'),r.source+'\n<!--external-->');
});

test('Liquid boolean replacement refuses enclosing controls, dynamic geometry and incomplete source',()=>{
 for(const markup of ['{% if visible %}{% comment %}{% endif %}{% endcomment %}<svg><rect width="10" height="10"/><circle r="5"/></svg>{% endif %}','{% if visible %}{% raw %}{% endif %}{% endraw %}<svg><rect width="10" height="10"/><circle r="5"/></svg>{% endif %}','{% liquid\nif visible\n%}<svg><rect width="10" height="10"/><circle r="5"/></svg>{% liquid\nendif\n%}','{% if visible %}<svg><rect width="10" height="10"/><circle r="5"/></svg>{% endif %}','<svg>{% for x in items %}<rect width="10" height="10"/><circle r="5"/>{% endfor %}</svg>','<svg><rect width="{{ width }}" height="10"/><circle r="5"/></svg>','<svg><rect width="10" height="10"/><circle r="5"/>']){
  const r=resolve('liquid',markup),result=combine.plan(r,{ids:selections('liquid',r),fileHash:r.hash,path:'M0 0L10 0L0 10Z'},'liquid');assert.equal(result.refused,true,markup);assert.equal(result.edits,undefined);
 }
});

test('Liquid boolean guards allow completed multiline scopes and assignments before the selected SVG',()=>{
 const r=resolve('liquid','{% liquid\nif visible\nassign color = "red"\nendif\n%}<svg><rect width="10" height="10"/><circle r="5"/></svg>'),op={ids:selections('liquid',r),fileHash:r.hash,path:'M0 0L10 0L0 10Z'},result=combine.plan(r,op,'liquid');assert.ok(result.ok,result.reason);assert.ok(result.edits[0].after.startsWith('{% liquid\nif visible\nassign color = "red"\nendif\n%}'));
});
