'use strict';
// A boolean group retains operand source verbatim. The visible result is a
// derived path supplied by the browser's geometry engine, in base-local space.
const MagicString=require('magic-string'),combine=require('./svg-combine-selection.cjs'),ids=require('./id.cjs'),geometry=require('../shell/svg-path.js');
const paintNames={fill:'fill',stroke:'stroke','stroke-width':'strokeWidth','stroke-linecap':'strokeLinecap','stroke-linejoin':'strokeLinejoin','stroke-dasharray':'strokeDasharray','stroke-dashoffset':'strokeDashoffset','stroke-miterlimit':'strokeMiterlimit','vector-effect':'vectorEffect'};
const operationNames={union:'Union',subtract:'Subtract',intersect:'Intersect',exclude:'Exclude overlap'},operations=new Set(Object.keys(operationNames));
function view(r,kind){
 const adapter=require('./adapters/'+kind+'.cjs'),elements=r.elements||adapter.collect(r.source,r.relPath).elements;
 const tag=e=>kind==='react'?ids.jsxElementName(e.node):e.tag;
 const start=e=>kind==='react'?e.node.start:kind==='liquid'?e.node.tagStart:e.location.startOffset;
 const end=e=>kind==='react'?e.node.end:kind==='liquid'?e.node.closeEnd:e.location.endOffset;
 const opening=e=>kind==='react'?e.node.openingElement.end:kind==='liquid'?e.node.openEnd:e.location.startTag.endOffset;
 const closing=e=>kind==='react'?e.node.closingElement?.start:kind==='liquid'?e.node.closeStart:e.location.endTag?.startOffset;
 const attrs=e=>kind==='react'?e.node.openingElement.attributes.map(a=>({name:a.type==='JSXAttribute'?a.name.name:'__spread__',value:require('./jsx-svg-geometry.cjs').literal(a),start:a.start,end:a.end})):kind==='liquid'?e.node.attributes.map(a=>({name:a.name,value:a.value,start:a.attrStart,end:a.attrEnd})):e.node.attrs.map(a=>({name:a.name,value:a.value,start:e.location.attrs?.[a.name]?.startOffset,end:e.location.attrs?.[a.name]?.endOffset}));
 const parents=kind==='react'?require('./jsx-svg-delete.cjs').parents(elements):new Map(elements.map(e=>[e.id,kind==='liquid'?e.parent?.id:elements.find(p=>p.node===e.node.parentNode)?.id]));
 return {adapter,elements,tag,start,end,opening,closing,attrs,parents,attr:(e,name)=>attrs(e).find(a=>a.name===name)?.value};
}
function context(r,kind){
 if(!r.source?.includes('data-rt-boolean'))return null;
 const v=view(r,kind),group=r.element;if(v.tag(group)!=='g'||!operations.has(v.attr(group,'data-rt-boolean')))return null;
 if(v.attrs(group).some(a=>!['data-rt-boolean','data-rt-boolean-base','data-rt-name','transform'].includes(a.name)))return null;
 if(v.attr(group,'transform')!==undefined&&!require('../shell/svg-affine.js').parse(v.attr(group,'transform')))return null;
 const children=v.elements.filter(e=>v.parents.get(e.id)===group.id),[operands,result]=children;
 if(children.length!==2||v.tag(operands)!=='g'||v.attr(operands,'data-rt-boolean-operands')!==''||v.attr(operands,'display')!=='none'||v.attrs(operands).some(a=>!['display','data-rt-boolean-operands','data-rt-name'].includes(a.name))||v.tag(result)!=='path'||v.attr(result,'data-rt-boolean-result')!=='')return null;
 const roots=v.elements.filter(e=>v.parents.get(e.id)===operands.id),base=Number(v.attr(group,'data-rt-boolean-base'));
 if(roots.length<1||!Number.isInteger(base)||base<0||base>=roots.length||[group,operands].some(e=>!Number.isInteger(v.closing(e))))return null;
 // No authored content may be discarded on release, including comments.
 if(r.source.slice(v.opening(group),v.start(operands)).trim()||r.source.slice(v.end(operands),v.start(result)).trim()||r.source.slice(v.end(result),v.closing(group)).trim())return null;
 return {...v,group,operands,result,roots,base,operation:v.attr(group,'data-rt-boolean'),parentId:v.parents.get(group.id)};
}
// A retained group can act as a single operand without discarding its tree.
// Temporary source proxies are used only to validate/derive the new result's
// literal appearance; the committed edit wraps the original bytes verbatim.
function groupProxy(r,c){
 const affine=require('../shell/svg-affine.js'),source=r.source.slice(c.start(c.result),c.end(c.result)),out=new MagicString(source);
 const groupMatrix=affine.parse(c.attr(c.group,'transform')),resultMatrix=affine.parse(c.attr(c.result,'transform'));
 if(!groupMatrix||!resultMatrix)throw Error('The nested boolean transform is not literal.');
 const matrix=affine.multiply(groupMatrix,resultMatrix);if(!affine.valid(matrix))throw Error('The nested boolean transform exceeds supported geometry.');
 for(const attr of c.attrs(c.result))if(['data-rt-boolean-result','transform'].includes(attr.name))out.remove(attr.start-c.start(c.result),attr.end-c.start(c.result));
 if(c.attr(c.group,'transform')!==undefined||c.attr(c.result,'transform')!==undefined){
  const offset=c.opening(c.result)-c.start(c.result)-(source.slice(0,c.opening(c.result)-c.start(c.result)).endsWith('/>')?2:1);
  out.appendLeft(offset,' transform="'+affine.format(matrix)+'"');
 }
 return out.toString();
}
function ancestor(r,kind){
 const v=view(r,kind);for(let id=v.parents.get(r.element.id);id;id=v.parents.get(id)){
  const el=v.elements.find(e=>e.id===id);if(el&&v.attr(el,'data-rt-boolean')!==undefined)return id;
 }return null;
}
function combinedResult(r,op,kind,v,selected){
 const replacements=[];
 for(const element of selected){
  if(v.tag(element)!=='g')continue;
  const c=context({...r,element},kind);if(!c)return {ok:false,refused:true,reason:'Select an unchanged retained boolean group.'};
  try{replacements.push({element,start:v.start(element),end:v.end(element),text:groupProxy(r,c)});}catch(error){return {ok:false,refused:true,reason:error.message};}
 }
 if(!replacements.length)return combine.plan(r,op,kind);
 const out=new MagicString(r.source);for(const item of replacements)out.overwrite(item.start,item.end,item.text);
 const source=out.toString(),fresh=view({...r,source,elements:null},kind);
 const proxyElements=selected.map(element=>{const start=v.start(element)+replacements.filter(item=>item.end<=v.start(element)).reduce((sum,item)=>sum+item.text.length-(item.end-item.start),0);return fresh.elements.find(item=>fresh.start(item)===start);});
 if(proxyElements.some(item=>!item))return {ok:false,refused:true,reason:'A nested boolean operand could not be resolved.'};
 const hash=v.adapter.contentHash(source),resolved={...r,source,hash,elements:fresh.elements,element:proxyElements[0]};
 return combine.plan(resolved,{...op,fileHash:hash,ids:proxyElements.map(item=>item.id)},kind);
}
function plan(r,op,kind){
 const refuse=reason=>({ok:false,refused:true,reason});
 if(!['html','react','liquid'].includes(kind))return refuse('Choose a source-connected SVG document.');
 if(op.fileHash!==r.hash)return refuse('The file changed. Re-select the boolean group.');
 if(['createSVGBooleanGroup','setSVGBooleanOperation'].includes(op.type)&&!operations.has(op.operation))return refuse('Choose Union, Subtract, Intersect or Exclude.');
 if(op.type==='setSVGBooleanNested'){
  const original=view(r,kind),target=original.elements.find(e=>e.id===op.targetId),regrouping=op.edit?.type==='createSVGBooleanGroup';
  if(!target||!context({...r,element:target},kind)||!['setSVGBooleanOperation','setSVGBooleanOperand','setSVGBooleanPaint','setSVGTransform','releaseSVGBooleanGroup','createSVGBooleanGroup'].includes(op.edit?.type))return refuse('Choose a nested boolean operation, paint or geometry edit.');
  const chain=[];let child=target;
  for(let id=ancestor({...r,element:child},kind);id;id=ancestor({...r,element:child},kind)){child=original.elements.find(e=>e.id===id);if(!child||!context({...r,element:child},kind))return refuse('A containing boolean group no longer resolves.');chain.push(child);}
  if(![target,...chain].some(element=>element.id===r.element.id))return refuse('Select the nested boolean or one of its containing groups.');
  if(regrouping)chain.unshift(target);
  if(!chain.length||!Array.isArray(op.results)||op.results.length!==chain.length||op.results.some((item,i)=>item?.id!==chain[i].id))return refuse('Provide every containing boolean result in nesting order.');
  let working={...r,element:target,booleanCascadeEdit:true,booleanOperandEdit:true};
  const releasing=op.edit.type==='releaseSVGBooleanGroup',targetContext=context(working,kind),parentContext=context({...r,element:chain[0]},kind);
  if(releasing&&targetContext.attr(target,'transform')!==undefined){
   const affine=require('../shell/svg-affine.js'),matrix=affine.parse(targetContext.attr(target,'transform'));let source=r.source;
   for(const root of targetContext.roots){const elements=original.adapter.collect(source,r.relPath).elements,element=elements.find(e=>e.id===root.id),hash=original.adapter.contentHash(source),v=view({...r,source,elements},kind),own=affine.parse(v.attr(element,'transform'));
    if(!own)return refuse('An original transform is not literal.');
    const transformed=original.adapter.planOp({...r,source,elements,element,hash,booleanOperandEdit:true,booleanCascadeEdit:true},{type:'setSVGTransform',fileHash:hash,matrix:affine.multiply(matrix,own)});if(!transformed.ok)return transformed;if(transformed.edits?.length)source=transformed.edits[0].after;
   }
   const v=view({...r,source,elements:null},kind),element=v.elements.find(e=>e.id===target.id),attr=v.attrs(element).find(a=>a.name==='transform'),out=new MagicString(source);out.remove(attr.start,attr.end);source=out.toString();working={...working,source,hash:original.adapter.contentHash(source),elements:original.adapter.collect(source,r.relPath).elements};working.element=working.elements.find(e=>e.id===target.id);
  }
  if(regrouping){
   if(!Array.isArray(op.edit.ids)||op.edit.ids.some(id=>!targetContext.roots.some(e=>e.id===id))||op.edit.ids.length>targetContext.roots.length)return refuse('Regroup two or more direct originals.');
   working={...working,element:original.elements.find(e=>e.id===op.edit.ids[0]),booleanRegroupOwner:target.id};
   if(!working.element)return refuse('Select original shapes to regroup.');
  }
  const edit=original.adapter.planOp(working,{...op.edit,id:working.element.id,fileHash:working.hash});if(!edit.ok)return edit;
  const mapping=new Map(edit.sourceIdMap||[]),mapped=id=>mapping.get(id)||id;
  let after=edit.unchanged||!edit.edits?.length?r.source:edit.edits.length===1?edit.edits[0].after:null;
  if(typeof after!=='string')return refuse('Nested boolean edits must stay in one source document.');
  if(releasing||regrouping){
   const v=view({...r,source:after,elements:null},kind),parent=v.elements.find(e=>e.id===mapped(chain[0].id)),container=v.elements.find(e=>e.id===mapped(parentContext.operands.id)),roots=v.elements.filter(e=>v.parents.get(e.id)===container.id),baseId=regrouping&&op.edit.ids.includes(parentContext.roots[parentContext.base].id)?edit.selectionIds[0]:mapped(parentContext.roots[parentContext.base].id===target.id?targetContext.roots[targetContext.base].id:parentContext.roots[parentContext.base].id),base=roots.findIndex(e=>e.id===baseId);
   if(base<0)return refuse('The containing boolean base could not be preserved.');const attr=v.attrs(parent).find(a=>a.name==='data-rt-boolean-base'),out=new MagicString(after);out.overwrite(attr.start,attr.end,'data-rt-boolean-base="'+base+'"');after=out.toString();
  }
  for(const supplied of op.results){const item={...supplied,id:mapped(supplied.id)};
   let elements=original.adapter.collect(after,r.relPath).elements,hash=original.adapter.contentHash(after);working={...r,source:after,hash,elements,element:elements.find(e=>e.id===item.id),booleanCascadeEdit:true,booleanOperandEdit:true};
   const c=context(working,kind);if(!c)return refuse('A containing boolean group changed during the edit.');
   const base=c.roots[c.base],nested=context({...working,element:base},kind),affine=require('../shell/svg-affine.js');
   const baseMatrix=affine.parse(c.attr(base,'transform')),innerMatrix=nested?affine.parse(c.attr(nested.result,'transform')):affine.identity();
   if(!baseMatrix||!innerMatrix)return refuse('A containing boolean coordinate space is not literal.');
   const transform=original.adapter.planOp({...working,element:c.result},{type:'setSVGTransform',fileHash:hash,matrix:affine.multiply(baseMatrix,innerMatrix)});if(!transform.ok)return transform;
   if(transform.edits?.length){after=transform.edits[0].after;elements=original.adapter.collect(after,r.relPath).elements;hash=original.adapter.contentHash(after);working={...working,source:after,hash,elements,element:elements.find(e=>e.id===item.id)};}
   const result=plan(working,{type:'setSVGBooleanOperation',fileHash:hash,operation:c.operation,path:item.path},kind);if(!result.ok)return result;if(result.edits?.length)after=result.edits[0].after;
  }
  if(after===r.source)return {ok:true,unchanged:true,hash:r.hash,edits:[]};
  const next=original.adapter.collect(after,r.relPath).elements,removed=new Set(edit.removedSourceIds||[]),retained=original.elements.filter(e=>!removed.has(e.id));const preserved=regrouping?next.filter(e=>retained.some(old=>mapped(old.id)===e.id)):next;if(next.length!==retained.length+(regrouping?3:0)||preserved.length!==retained.length||preserved.some((e,i)=>e.id!==mapped(retained[i].id)))return refuse('The nested edit would change unrelated layer identities.');
  return {ok:true,...(releasing||regrouping?{structural:true}:{}),hash:original.adapter.contentHash(after),parentId:mapped(original.parents.get(chain.at(-1).id)),selectionIds:[regrouping?edit.selectionIds[0]:releasing?mapped(chain[0].id):target.id],sourceIdMap:edit.sourceIdMap||[],removedSourceIds:[...removed],edits:[{file:r.file,before:r.source,after}]};
 }
 const v=view(r,kind),out=new MagicString(r.source);let insertions=[],cuts=[],selected=[],removed=[],parentId,created=false,retainedGroup=null;
 if(op.type==='createSVGBooleanGroup'){
  if(!Array.isArray(op.ids)||op.ids.length<2||op.ids.length>100||new Set(op.ids).size!==op.ids.length||!op.ids.includes(r.element.id))return refuse('Select two to 100 distinct SVG operands.');
  selected=op.ids.map(id=>v.elements.find(e=>e.id===id));if(selected.some(e=>!e))return refuse('Every boolean operand must resolve in this source file.');
  if(selected.some(element=>{const owner=ancestor({...r,element},kind);return owner&&(!r.booleanCascadeEdit||owner!==r.booleanRegroupOwner);}))return refuse('Edit nested original shapes through their containing boolean group.');
  const path=op.path===''?'M0 0L1 0L0 1Z':op.path,flattened=combinedResult(r,{...op,path},kind,v,selected);if(!flattened.ok)return flattened;
  const base=selected[0];selected.sort((a,b)=>v.start(a)-v.start(b));parentId=v.parents.get(base.id);
  const siblings=v.elements.filter(e=>v.parents.get(e.id)===parentId),positions=selected.map(e=>siblings.indexOf(e));
  if(positions.some((n,i)=>n!==positions[0]+i))return refuse('Select consecutive SVG shapes to preserve stacking order.');
  // Duplicating IDs or executable JSX attributes into the rendered result
  // would alter document semantics rather than just retain editable geometry.
  if(selected.some(e=>/\bid\s*=|\{[{%]/.test(r.source.slice(v.start(e),v.end(e)))||v.elements.filter(n=>v.start(n)>=v.start(e)&&v.end(n)<=v.end(e)).some(n=>v.attrs(n).some(a=>a.name==='id'||a.name==='__spread__'||a.name==='key'||a.value===undefined))))return refuse('Boolean groups require literal shapes without authored IDs or dynamic attributes.');
  const flatSource=flattened.edits[0].after,flat=view({...r,source:flatSource,elements:null},kind),result=flat.elements.find(e=>e.id===flattened.selectionIds[0]);
  if(!result)return refuse('The boolean result could not be retained.');
  let resultSource=flatSource.slice(flat.start(result),flat.end(result));
  if(op.path==='')resultSource=resultSource.replace(/ d="[^"]*"/,' d=""');
  resultSource=resultSource.replace('<path','<path data-rt-boolean-result=""'+(/\bdata-rt-name\s*=/.test(resultSource)?'':' data-rt-name="Result"'));
  insertions=[{at:v.start(selected[0]),text:'<g data-rt-boolean="'+op.operation+'" data-rt-name="'+operationNames[op.operation]+'" data-rt-boolean-base="'+selected.indexOf(base)+'"><g data-rt-boolean-operands="" data-rt-name="Original shapes" display="none">'},{at:v.end(selected.at(-1)),text:'</g>'+resultSource+'</g>'}];
  for(const e of insertions)out.appendLeft(e.at,e.text);created=true;
 }else{
  const c=context(r,kind);if(!c)return refuse('Select a boolean group with unchanged source wrappers.');
  if(!r.booleanCascadeEdit&&ancestor(r,kind))return refuse('Nested boolean edits must update the containing results in the same transaction.');
  parentId=c.parentId;selected=c.roots;
  if(op.type==='releaseSVGBooleanGroup'){
   retainedGroup=v.attr(c.group,'transform')!==undefined?c.group:null;
   removed=v.elements.filter(e=>!retainedGroup&&e===c.group||e===c.operands||v.start(e)>=v.start(c.result)&&v.end(e)<=v.end(c.result));
   cuts=retainedGroup?[...v.attrs(c.group).filter(a=>['data-rt-boolean','data-rt-boolean-base'].includes(a.name)).map(a=>({start:a.start,end:a.end})),{start:v.start(c.operands),end:v.opening(c.operands)},{start:v.closing(c.operands),end:v.end(c.result)}]:[{start:v.start(c.group),end:v.opening(c.operands)},{start:v.closing(c.operands),end:v.end(c.group)}];for(const cut of cuts)out.remove(cut.start,cut.end);
  }else if(op.type==='setSVGBooleanPaint'){
   const name=Object.hasOwn(paintNames,op.property)?(kind==='react'?paintNames[op.property]:op.property):null;
   if(!name||!require('../shell/html-css-values.js').valid(op.property,op.value))return refuse('Choose a supported combined SVG paint value.');
   if(op.value!==null&&(typeof op.value!=='string'||op.value.length>512||/[<>\n\r]/.test(op.value)))return refuse('Use a literal combined paint value.');
   const attributes=v.attrs(c.result).filter(a=>a.name===name||kind==='react'&&a.name===op.property);if(attributes.length>1)return refuse('Remove conflicting paint attributes before editing paint.');const attr=attributes[0],escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
   if(op.value===null){if(attr)out.remove(attr.start,attr.end);}else{const token=(attr?.name||name)+'="'+escape(op.value.trim())+'"';if(attr)out.overwrite(attr.start,attr.end,token);else out.appendLeft(v.opening(c.result)-(r.source.slice(v.start(c.result),v.opening(c.result)).endsWith('/>')?2:1),' '+token);}
   const after=out.toString();if(after===r.source)return {ok:true,unchanged:true,hash:r.hash,edits:[]};
   const next=v.adapter.collect(after,r.relPath).elements;if(next.length!==v.elements.length||next.some((e,i)=>e.id!==v.elements[i].id))return refuse('The paint edit would change layer identities.');
   return {ok:true,hash:v.adapter.contentHash(after),parentId,selectionIds:[c.group.id],sourceIdMap:[],removedSourceIds:[],edits:[{file:r.file,before:r.source,after}]};
  }else if(op.type==='setSVGBooleanOperand'){
   const operand=c.roots.find(e=>e.id===op.operandId);
   if(!operand||!['setSVGGeometry','setSVGTransform'].includes(op.operandOp?.type))return refuse('Choose an original shape geometry or transform edit.');
   const edit=v.adapter.planOp({...r,element:operand,booleanOperandEdit:true},{...op.operandOp,id:operand.id,fileHash:r.hash});
   if(!edit.ok)return edit;
   let intermediate=edit.unchanged||edit.edits?.length===0?r.source:edit.edits?.[0]?.after;
   if(typeof intermediate!=='string'||edit.edits?.length>1)return refuse('The operand edit must remain inside this source document.');
   let nextElements=v.adapter.collect(intermediate,r.relPath).elements;
   if(op.operandId===c.roots[c.base].id&&op.operandOp.type==='setSVGTransform'){
    const derivedResolved={...r,source:intermediate,hash:v.adapter.contentHash(intermediate),elements:nextElements,element:nextElements.find(e=>e.id===c.result.id),booleanOperandEdit:true};
    const nested=context({...r,element:operand},kind),innerMatrix=nested?require('../shell/svg-affine.js').parse(c.attr(nested.result,'transform')):null;if(nested&&!innerMatrix)return refuse('The nested boolean result transform is not literal.');
    const matrix=nested?require('../shell/svg-affine.js').multiply(op.operandOp.matrix,innerMatrix):op.operandOp.matrix;
    const derived=v.adapter.planOp(derivedResolved,{...op.operandOp,matrix,id:c.result.id,fileHash:derivedResolved.hash});if(!derived.ok)return derived;
    if(derived.edits?.length)intermediate=derived.edits[0].after;nextElements=v.adapter.collect(intermediate,r.relPath).elements;
   }
   if(nextElements.length!==v.elements.length||nextElements.some((e,i)=>e.id!==v.elements[i].id))return refuse('The operand edit would change layer identities.');
   const nextResolved={...r,source:intermediate,hash:v.adapter.contentHash(intermediate),elements:nextElements,element:nextElements.find(e=>e.id===c.group.id)};
   const result=plan(nextResolved,{type:'setSVGBooleanOperation',fileHash:nextResolved.hash,operation:c.operation,path:op.path},kind);
   if(!result.ok)return result;
   const after=result.unchanged?intermediate:result.edits[0].after;
   if(after===r.source)return {ok:true,unchanged:true,hash:r.hash,edits:[]};
   return {ok:true,hash:v.adapter.contentHash(after),parentId,selectionIds:[operand.id],sourceIdMap:[],removedSourceIds:[],edits:[{file:r.file,before:r.source,after}]};
  }else if(op.type==='setSVGBooleanOperation'){
   const document=op.path===''?{subpaths:[]}:geometry.parseCompound(op.path);
   if(!document||document.subpaths.some(p=>!p.closed))return refuse('Provide a closed boolean path or an empty result.');
   const path=document.subpaths.length?geometry.serializeCompound(document):'';if(path===null)return refuse('The result exceeds editable geometry limits.');
   const mode=v.attrs(c.group).find(a=>a.name==='data-rt-boolean'),d=v.attrs(c.result).find(a=>a.name==='d');if(!d)return refuse('The result path is missing.');
   out.overwrite(mode.start,mode.end,'data-rt-boolean="'+op.operation+'"');const name=v.attrs(c.group).find(a=>a.name==='data-rt-name');if(name?.value===operationNames[c.operation])out.overwrite(name.start,name.end,'data-rt-name="'+operationNames[op.operation]+'"');out.overwrite(d.start,d.end,'d="'+path+'"');
   const after=out.toString();if(after===r.source)return {ok:true,unchanged:true,hash:r.hash,edits:[]};
   const next=v.adapter.collect(after,r.relPath).elements;if(next.length!==v.elements.length||next.some((e,i)=>e.id!==v.elements[i].id))return refuse('The operation would change layer identities.');
   return {ok:true,hash:v.adapter.contentHash(after),parentId,selectionIds:[c.group.id],sourceIdMap:[],removedSourceIds:[],edits:[{file:r.file,before:r.source,after}]};
  }else return refuse('Choose create, change operation or release boolean group.');
 }
 const after=out.toString(),next=view({...r,source:after,elements:null},kind),retained=v.elements.filter(e=>!removed.includes(e)),mapping=new Map();
 const shifted=offset=>offset+insertions.filter(e=>e.at<=offset).reduce((n,e)=>n+e.text.length,0)-cuts.filter(e=>e.end<=offset).reduce((n,e)=>n+e.end-e.start,0);
 for(const e of retained){const fresh=next.elements.find(n=>next.start(n)===shifted(v.start(e))&&next.tag(n)===v.tag(e));if(!fresh)return refuse('An original layer could not be preserved.');mapping.set(e.id,fresh.id);}
 const group=created?next.elements.find(e=>next.start(e)===insertions[0].at&&next.attr(e,'data-rt-boolean')===op.operation):null;
 const operands=group?next.elements.find(e=>next.parents.get(e.id)===group.id&&next.attr(e,'data-rt-boolean-operands')===''):null;
 if(created&&!operands)return refuse('The operand group could not be created.');
 for(const e of retained){const expected=selected.includes(e)?created?operands.id:mapping.get(retainedGroup?.id||parentId):mapping.get(v.parents.get(e.id));if(expected&&next.parents.get(mapping.get(e.id))!==expected)return refuse('An unrelated layer would move.');}
 if(!created&&next.elements.length!==retained.length)return refuse('Releasing the group would discard source structure.');
 return {ok:true,structural:true,hash:v.adapter.contentHash(after),parentId:mapping.get(parentId),selectionIds:created?[group.id]:retainedGroup?[mapping.get(retainedGroup.id)]:selected.map(e=>mapping.get(e.id)),sourceIdMap:[...mapping].filter(([a,b])=>a!==b),removedSourceIds:removed.map(e=>e.id),edits:[{file:r.file,before:r.source,after}]};
}
const types=new Set(['setSVGBooleanNested','createSVGBooleanGroup','releaseSVGBooleanGroup','setSVGBooleanOperation','setSVGBooleanOperand','setSVGBooleanPaint']);
function owner(r,kind){if(!r.source?.includes('data-rt-boolean'))return null;const v=view(r,kind);for(let id=r.element.id;id;id=v.parents.get(id)){const e=v.elements.find(e=>e.id===id);if(e&&v.attr(e,'data-rt-boolean')!==undefined)return e.id;}return null;}
function describe(r,kind){
 const c=context(r,kind);if(!c)return null;
 const resultResolved={...r,element:c.result},svgGeometry=kind==='react'?require('./jsx-svg-geometry.cjs').describe(resultResolved):kind==='liquid'?require('./liquid-svg-geometry.cjs').describe(resultResolved):require('./svg-geometry.cjs').describe(c.result);
 return {operation:c.operation,parentId:c.parentId,ancestorId:ancestor(r,kind),operandIds:c.roots.map(e=>e.id),baseId:c.roots[c.base].id,resultId:c.result.id,result:{id:c.result.id,tag:'path',file:r.relPath,hash:r.hash,svgGeometry,svgTransform:require('./svg-transform.cjs').describe(resultResolved,kind),booleanOperandPreview:true},paints:Object.fromEntries(Object.entries(paintNames).map(([property,name])=>[property,(kind==='react'?c.attr(c.result,name)??c.attr(c.result,property):c.attr(c.result,property))??null])),canRelease:true};
}
function guard(r,op,kind){if(r.booleanOperandEdit||types.has(op.type))return null;const id=owner(r,kind);return id&&!(id===r.element.id&&!ancestor(r,kind)&&(op.type==='deleteElement'||['setSVGTransform','setSVGTransforms'].includes(op.type)&&context(r,kind)))?{ok:false,refused:true,reason:'Edit the original shapes from the Boolean group section, or release the group first.'}:null;}
module.exports={plan,context,describe,owner,ancestor,guard,types};
