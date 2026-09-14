'use strict';
const MagicString=require('magic-string');

// Delete across retained boolean trees, then derive all surviving groups from
// their final operands. Intermediate source snapshots never leave this planner.
function plan(r,op,kind){
 const group=require('./svg-boolean-group.cjs'),v=group.view(r,kind),refuse=reason=>({ok:false,refused:true,reason});
 if(!Array.isArray(op.ids)||!op.ids.length||op.ids.length>100||new Set(op.ids).size!==op.ids.length||!op.ids.includes(r.element.id))return refuse('Select distinct boolean originals in one source file.');
 const selected=op.ids.map(id=>v.elements.find(e=>e.id===id));if(selected.some(e=>!e))return refuse('Every selected original must resolve.');
 const contains=(a,b)=>v.start(a)<=v.start(b)&&v.end(a)>=v.end(b),contexts=new Map();
 for(const element of selected){
  const ancestor=group.ancestor({...r,element},kind);
  if(!ancestor){if(!group.context({...r,element},kind))return refuse('Select boolean originals or retained boolean groups.');continue;}
  const parent=v.elements.find(e=>e.id===ancestor),context=group.context({...r,element:parent},kind);
  if(!context?.roots.some(e=>e.id===element.id))return refuse('Select direct originals, not generated boolean wrappers or results.');
  let child=element;
  for(let id=ancestor;id;id=group.ancestor({...r,element:child},kind)){
   child=v.elements.find(e=>e.id===id);const c=group.context({...r,element:child},kind);if(!c)return refuse('A containing boolean group no longer resolves.');contexts.set(id,c);
  }
 }
 const roots=selected.filter(e=>!selected.some(other=>other!==e&&contains(other,e))),removed=new Set();
 const removeTree=element=>{for(const child of v.elements)if(contains(element,child))removed.add(child.id);};for(const root of roots)removeTree(root);
 const depth=e=>{let n=0;for(let id=v.parents.get(e.id);id;id=v.parents.get(id))n++;return n;};
 const ordered=[...contexts.values()].sort((a,b)=>depth(b.group)-depth(a.group)||v.start(a.group)-v.start(b.group));
 for(const c of ordered)if(c.roots.every(e=>removed.has(e.id)))removeTree(c.group);
 const surviving=ordered.filter(c=>!removed.has(c.group.id));
 if(!Array.isArray(op.results)||op.results.length!==surviving.length||op.results.some((result,i)=>result?.id!==surviving[i].group.id))return refuse('Provide every surviving affected boolean result, deepest first and in source order.');
 const coverage=[...roots,...ordered.map(c=>c.group)];let common=r.element;
 while(common&&(removed.has(common.id)||v.attr(common,'data-rt-boolean-operands')!==undefined||!coverage.every(e=>contains(common,e))))common=v.elements.find(e=>e.id===v.parents.get(common.id));
 if(!common)return refuse('The affected groups need a shared source-connected parent.');
 const cuts=v.elements.filter(e=>removed.has(e.id)&&!removed.has(v.parents.get(e.id))),mapping=new Map(v.elements.map(e=>[e.id,e.id]));let after=r.source;
 for(const root of cuts){
  const elements=v.adapter.collect(after,r.relPath).elements,hash=v.adapter.contentHash(after),element=elements.find(e=>e.id===mapping.get(root.id));
  const edit=v.adapter.planOp({...r,source:after,elements,hash,element,booleanOperandEdit:true},{type:'deleteElement',fileHash:hash});if(!edit.ok)return edit;if(edit.edits?.length!==1)return refuse('The deletion must remain in one source document.');
  const deleted=new Set(edit.removedSourceIds||[]),step=new Map(edit.sourceIdMap||[]);for(const [old,current]of mapping){if(deleted.has(current))mapping.delete(old);else mapping.set(old,step.get(current)||current);}after=edit.edits[0].after;
 }
 const mapped=id=>mapping.get(id)||id,fresh=group.view({...r,source:after,elements:null},kind),basePatch=new MagicString(after);
 for(const c of surviving){
  const element=fresh.elements.find(e=>e.id===mapped(c.group.id)),remaining=c.roots.filter(e=>!removed.has(e.id)),base=remaining.findIndex(e=>e.id===c.roots[c.base].id),attr=fresh.attrs(element).find(a=>a.name==='data-rt-boolean-base');
  basePatch.overwrite(attr.start,attr.end,'data-rt-boolean-base="'+Math.max(0,base)+'"');
 }
 after=basePatch.toString();
 for(const supplied of op.results){
  let elements=v.adapter.collect(after,r.relPath).elements,hash=v.adapter.contentHash(after),working={...r,source:after,elements,hash,element:elements.find(e=>e.id===mapped(supplied.id)),booleanOperandEdit:true,booleanCascadeEdit:true},c=group.context(working,kind);
  if(!c)return refuse('A surviving boolean group no longer resolves.');
  const affine=require('../shell/svg-affine.js'),base=c.roots[c.base],inner=group.context({...working,element:base},kind),matrix=affine.parse(c.attr(base,'transform')),innerMatrix=inner?affine.parse(c.attr(inner.result,'transform')):affine.identity();if(!matrix||!innerMatrix)return refuse('A surviving base transform is not literal.');
  const transformed=v.adapter.planOp({...working,element:c.result},{type:'setSVGTransform',fileHash:hash,matrix:affine.multiply(matrix,innerMatrix)});if(!transformed.ok)return transformed;if(transformed.edits?.length)after=transformed.edits[0].after;
  elements=v.adapter.collect(after,r.relPath).elements;hash=v.adapter.contentHash(after);working={...working,source:after,elements,hash,element:elements.find(e=>e.id===mapped(supplied.id))};const result=group.plan(working,{type:'setSVGBooleanOperation',fileHash:hash,operation:c.operation,path:supplied.path},kind);if(!result.ok)return result;if(result.edits?.length)after=result.edits[0].after;
 }
 const final=v.adapter.collect(after,r.relPath).elements,retained=v.elements.filter(e=>!removed.has(e.id));if(final.length!==retained.length||final.some((e,i)=>e.id!==mapped(retained[i].id)))return refuse('The deletion would change unrelated layer identities.');
 const outermost=surviving.filter(c=>!surviving.some(other=>other!==c&&contains(other.group,c.group)));
 return {ok:true,structural:true,hash:v.adapter.contentHash(after),parentId:mapped(common.id),selectionIds:outermost.length?outermost.map(c=>mapped(c.group.id)):[mapped(common.id)],sourceIdMap:[...mapping].filter(([a,b])=>a!==b),removedSourceIds:[...removed],edits:[{file:r.file,before:r.source,after}]};
}
module.exports={plan};
