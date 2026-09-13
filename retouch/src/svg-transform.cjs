'use strict';
const MagicString=require('magic-string'),A=require('../shell/svg-affine.js'),ids=require('./id.cjs');
const tags=new Set(['g','rect','circle','ellipse','line','path','polygon','polyline','text','image','use']);
function detail(r,kind){
 if(kind==='react'){
  const node=r.element.node,tag=ids.jsxElementName(node);if(!tags.has(tag))return null;
  const ancestors=(r.elements||ids.collectElements(r.source,r.relPath).elements).filter(e=>e.node.start<node.start&&e.node.end>node.end).reverse(),boundary=ancestors.find(e=>['svg','foreignObject'].includes(ids.jsxElementName(e.node)));if(ids.jsxElementName(boundary?.node||node)!=='svg')return null;
  const attrs=node.openingElement.attributes,matches=attrs.filter(a=>a.type==='JSXAttribute'&&a.name.name==='transform'),attr=matches[0],value=require('./jsx-svg-geometry.cjs').literal(attr),editable=!attrs.some(a=>a.type==='JSXSpreadAttribute')&&matches.length<2&&value!==undefined;
  return {value:value??null,editable,attr,start:attr?.start,end:attr?.end,insert:node.openingElement.name.end};
 }
 if(kind==='liquid'){
  const node=r.element;if(node.kind!=='host'||node.dynamicTag||!tags.has(node.tag))return null;let boundary=node.parent;while(boundary&&!['svg','foreignobject'].includes(boundary.tag)){if(boundary.dynamicTag)return null;boundary=boundary.parent;}if(boundary?.tag!=='svg')return null;
  const attrs=node.attributes.filter(a=>a.name==='transform'),attr=attrs[0],value=attr?.value??null;return {value,editable:!node.attributeExpressions&&attrs.length<2&&!/\{[%{]/.test(value||''),attr,start:attr?.attrStart,end:attr?.attrEnd,insert:node.nameEnd};
 }
 const el=r.element;if(el.node.namespaceURI!=='http://www.w3.org/2000/svg'||!tags.has(el.tag))return null;const attr=el.location.attrs?.transform;
 let editable=true;for(let node=el.node;node;node=node.parentNode)if(node.attrs?.some(a=>/^(?:v-for|v-if|x-for|x-if)$/.test(a.name)))editable=false;
 return {value:el.node.attrs.find(a=>a.name==='transform')?.value??null,editable,attr,start:attr?.startOffset,end:attr?.endOffset,insert:el.location.startTag.startOffset+1+el.tag.length};
}
function describe(r,kind){const d=detail(r,kind);if(!d)return null;const matrix=A.parse(d.value),editable=d.editable&&!!matrix;return {value:d.value,matrix,editable,reason:editable?null:!d.editable?'A dynamic or duplicated attribute controls this SVG transform.':'This SVG transform cannot be represented as a bounded 2D matrix.'};}
function plan(r,op,kind){
 const refuse=reason=>({ok:false,refused:true,reason}),d=detail(r,kind),shape=describe(r,kind);if(!shape?.editable||!A.valid(op.matrix))return refuse(shape?.reason||'Choose an editable SVG transform and a finite 2D matrix.');if(op.fileHash!==r.hash)return refuse('The file changed. Re-select the vector.');
 const out=new MagicString(r.source),token='transform="'+A.format(op.matrix)+'"';if(d.attr)out.overwrite(d.start,d.end,token);else out.appendLeft(d.insert,' '+token);
 const after=out.toString(),adapter=kind==='react'?ids:require('./adapters/'+kind+'.cjs'),collect=source=>kind==='react'?ids.collectElements(source,r.relPath).elements:adapter.collect(source,r.relPath).elements,before=r.elements||collect(r.source),next=collect(after),name=el=>kind==='react'?ids.jsxElementName(el.node):el.tag;
 if(before.length!==next.length||before.some((el,i)=>el.id!==next[i].id||name(el)!==name(next[i])))return refuse('The transform changes the parsed document structure.');
 return {ok:true,hash:adapter.contentHash(after),edits:after===r.source?[]:[{file:r.file,before:r.source,after}]};
}
function planSelection(r,op,kind){
 const refuse=reason=>({ok:false,refused:true,reason}),selected=op.ids,matrices=op.matrices;
 if(op.fileHash!==r.hash)return refuse('The file changed. Re-select the vectors.');
 if(!Array.isArray(selected)||selected.length<2||selected.length>100||new Set(selected).size!==selected.length||!selected.includes(r.element.id)||selected.some(id=>typeof id!=='string'||!/^[a-f0-9]{10}$/.test(id)))return refuse('Select 2 to 100 distinct vectors from one source file.');
 if(!matrices||typeof matrices!=='object'||Array.isArray(matrices)||Object.keys(matrices).length!==selected.length||selected.some(id=>!Object.hasOwn(matrices,id)||!A.valid(matrices[id])))return refuse('Provide one finite transform for every selected vector.');
 const adapter=require('./adapters/'+kind+'.cjs'),collect=source=>kind==='react'?ids.collectElements(source,r.relPath).elements:adapter.collect(source,r.relPath).elements;let source=r.source;
 for(const id of selected){const elements=collect(source),element=elements.find(el=>el.id===id);if(!element)return refuse('Every selected vector must resolve in the same source file.');const hash=adapter.contentHash(source),member={...r,source,elements,element,hash},shape=describe(member,kind);if(shape?.editable&&shape.matrix.every((value,index)=>value===matrices[id][index]))continue;const result=plan(member,{matrix:matrices[id],fileHash:hash},kind);if(!result.ok)return result;source=result.edits[0]?.after||source;}
 const hash=adapter.contentHash(source),elements=collect(source),selection=selected.map(id=>adapter.describe({...r,source,hash,elements,element:elements.find(el=>el.id===id)}));
 return {ok:true,hash,selection,edits:source===r.source?[]:[{file:r.file,before:r.source,after:source}]};
}
module.exports={describe,plan,planSelection};
