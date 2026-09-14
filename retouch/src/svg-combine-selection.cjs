'use strict';
// Commit a browser-computed boolean result in the base operand's local space.
// Geometry computation and source replacement are separate: callers must use
// the base inverse CTM for operands and preserve the base paint/transform.
const MagicString=require('magic-string'),ids=require('./id.cjs'),paths=require('../shell/svg-path.js');
const tags=new Set(['path','rect','circle','ellipse','polygon','polyline']);
function context(r,kind){
 const react=kind==='react',node=r.element.node,tag=react?ids.jsxElementName(node):r.element.tag;
 if(!tags.has(tag))return null;
 const deletion=require(react?'./jsx-svg-delete.cjs':'./svg-delete.cjs').describe(r);
 const geometry=react?require('./jsx-svg-geometry.cjs').describe(r):require('./svg-geometry.cjs').describe(r.element);
 if(!deletion||!geometry||geometry.fields.some(f=>f.editable===false))return null;
 // Animated geometry and nested drawable content cannot be flattened silently.
 const children=node.children||node.childNodes||[];
 if(children.some(child=>react?!(child.type==='JSXText'&&!child.value.trim()||child.type==='JSXExpressionContainer'&&child.expression.type==='JSXEmptyExpression'||child.type==='JSXElement'&&['title','desc'].includes(ids.jsxElementName(child))):!(child.nodeName==='#comment'||child.nodeName==='#text'&&!child.value.trim()||['title','desc'].includes(child.tagName))))return null;
 return {tag,node,parentId:deletion.parentId,properties:[...geometry.fields.map(f=>f.name),'data-rt-shape'],start:react?node.start:r.element.location.startOffset,end:react?node.end:r.element.location.endOffset};
}
function plan(r,op,kind){
 const refuse=reason=>({ok:false,refused:true,reason});
 if(!['html','react'].includes(kind))return refuse('This source adapter does not yet support combining SVG layers.');
 if(op.fileHash!==r.hash)return refuse('The file changed. Re-select the shapes.');
 if(!Array.isArray(op.ids)||op.ids.length<2||op.ids.length>100||new Set(op.ids).size!==op.ids.length||!op.ids.includes(r.element.id)||op.ids.some(id=>typeof id!=='string'))return refuse('Select two to 100 distinct shapes in one source file.');
 const document=op.path===''?{subpaths:[]}:paths.parseCompound(op.path);
 if(!document||document.subpaths.some(p=>!p.closed))return refuse('Provide a closed compound boolean path, or an empty result.');
 const path=document.subpaths.length?paths.serializeCompound(document):'';if(path===null)return refuse('The result exceeds editable geometry limits.');
 const adapter=require('./adapters/'+kind+'.cjs'),elements=r.elements||adapter.collect(r.source,r.relPath).elements;
 const selected=op.ids.map(id=>elements.find(e=>e.id===id));if(selected.some(e=>!e))return refuse('Every shape must resolve in the same source document.');
 const contexts=selected.map(element=>context({...r,elements,element},kind));if(contexts.some(c=>!c)||contexts.some(c=>c.parentId!==contexts[0].parentId))return refuse('Combine editable sibling SVG shapes without dynamic geometry or drawable children.');
 const base=selected[0],baseContext=contexts[0],react=kind==='react',name=e=>react?ids.jsxElementName(e.node):e.tag,start=e=>react?e.node.start:e.location.startOffset;
 const out=new MagicString(r.source),removedRanges=contexts.filter((c,i)=>!path||i>0);
 for(const c of removedRanges)out.remove(c.start,c.end);
 if(path){
  const node=base.node,location=base.location,attrs=react?node.openingElement.attributes:node.attrs;
  const openingStart=react?node.openingElement.name.start:location.startTag.startOffset+1,openingEnd=react?node.openingElement.name.end:openingStart+baseContext.tag.length;
  out.overwrite(openingStart,openingEnd,'path');
  const closing=react?node.closingElement?.name:location.endTag;
  if(closing)out.overwrite(react?closing.start:closing.startOffset+2,react?closing.end:closing.startOffset+2+baseContext.tag.length,'path');
  for(const attr of attrs){const property=react?attr.name?.name:attr.name;if(!baseContext.properties.includes(property))continue;const loc=react?attr:location.attrs?.[property];if(loc)out.remove(react?loc.start:loc.startOffset,react?loc.end:loc.endOffset);}
  out.appendLeft(openingEnd,' d="'+path+'"');
 }
 const after=out.toString(),next=adapter.collect(after,r.relPath).elements;
 const removed=elements.filter(e=>removedRanges.some(c=>start(e)>=c.start&&start(e)<c.end)),retained=elements.filter(e=>!removed.includes(e));
 if(next.length!==retained.length)return refuse('Combining shapes would change surrounding source structure.');
 // Edits only rename the base and remove selected sibling subtrees. Preserve
 // every survivor's order and parent relationship, including base metadata.
 const mapping=new Map(retained.map((e,i)=>[e.id,next[i].id]));
 if(retained.some((e,i)=>name(next[i])!==(e===base&&path?'path':name(e))))return refuse('A surrounding layer changed its parsed identity.');
 const parents=list=>react?require('./jsx-svg-delete.cjs').parents(list):new Map(list.map(e=>[e.id,list.find(p=>p.node===e.node.parentNode)?.id??null]));
 const oldParents=parents(elements),newParents=parents(next);
 if(retained.some(e=>newParents.get(mapping.get(e.id))!==(mapping.get(oldParents.get(e.id))??null)))return refuse('Combining shapes would move an unrelated layer.');
 const parentId=mapping.get(baseContext.parentId);
 return {ok:true,hash:adapter.contentHash(after),structural:true,sourceIdMap:[...mapping].filter(([a,b])=>a!==b),removedSourceIds:removed.map(e=>e.id),parentId,selectionIds:path?[mapping.get(base.id)]:[parentId],edits:[{file:r.file,before:r.source,after}]};
}
module.exports={plan,describe:(r,kind)=>{const c=context(r,kind);return c?{parentId:c.parentId}:null;}};
