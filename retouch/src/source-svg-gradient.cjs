'use strict';
// Canonical DOM attribute names at the inspector boundary; each language retains
// its own parser locations and attribute spelling when writing source.
const MagicString=require('magic-string'),base=require('./html-svg-gradient.cjs'),ids=require('./id.cjs');
const coordinates={linearGradient:['x1','y1','x2','y2'],radialGradient:['cx','cy','r','fx','fy','fr']};
const canonical=name=>({'stopColor':'stop-color','stopOpacity':'stop-opacity',gradientunits:'gradientUnits',spreadmethod:'spreadMethod'})[name]||name;
const jsxName=name=>({'stop-color':'stopColor','stop-opacity':'stopOpacity'})[name]||name;
const attr=(node,name)=>node.attrs.find(a=>a.name===name)?.value??null;
function records(resolved,kind){
 if(kind==='react'){
  const elements=resolved.elements||ids.collectElements(resolved.source,resolved.relPath).elements;
  const nodes=elements.map(el=>{const node=el.node;return {node,tag:ids.jsxElementName(node),start:node.start,end:node.end,nameEnd:node.openingElement.name.end,attrs:node.openingElement.attributes.filter(a=>a.type==='JSXAttribute').map(a=>({name:canonical(a.name.type==='JSXNamespacedName'?a.name.namespace.name+':'+a.name.name.name:a.name.name),value:require('./jsx-svg-geometry.cjs').literal(a),start:a.start,end:a.end})),unsafe:node.openingElement.attributes.some(a=>a.type==='JSXSpreadAttribute'),dynamicChildren:node.children.some(child=>!['JSXElement','JSXText'].includes(child.type)&&!(child.type==='JSXExpressionContainer'&&child.expression.type==='JSXEmptyExpression'))};});
  for(const node of nodes){node.parent=nodes.filter(other=>other.start<node.start&&other.end>node.end).at(-1);}
  // Parents must all be assigned before computing the direct child lists.
  for(const node of nodes)node.children=nodes.filter(other=>other.parent===node);
  return {nodes,selected:nodes.find(n=>n.start===resolved.element.node.start)};
 }
 const liquid=require('./adapters/liquid.cjs'),all=liquid._parse(resolved.source).all;
 const nodes=all.map(node=>({node,tag:({lineargradient:'linearGradient',radialgradient:'radialGradient',foreignobject:'foreignObject'})[node.tag]||node.tag,start:node.tagStart,end:node.closeEnd,nameEnd:node.nameEnd,attrs:(node.attributes||[]).map(a=>({...a,name:canonical(a.name),value:/\{[%{]/.test(a.value||'')?undefined:a.value,start:a.attrStart,end:a.attrEnd})),unsafe:node.attributeExpressions||node.dynamicTag||node.generatedImage,dynamicChildren:/\{[%{]/.test(resolved.source.slice(node.childrenStart,node.childrenEnd))}));
 for(const node of nodes)node.parent=nodes.find(other=>other.node===node.node.parent);
 for(const node of nodes)node.children=nodes.filter(other=>other.parent===node);
 return {nodes,selected:nodes.find(n=>n.start===resolved.element.tagStart)};
}
function svg(node){for(let n=node;n;n=n.parent){if(n.tag==='svg')return true;if(n.tag==='foreignObject')return false;}return false;}
function inspect(resolved,kind,paint){
 if(!['fill','stroke'].includes(paint))return null;
 const sourceAttrs=kind==='react'?resolved.element.node?.openingElement?.attributes:resolved.element.attributes;
 if(!sourceAttrs?.some(a=>kind==='react'?a.type==='JSXAttribute'&&a.name.name===paint&&/^url\(/.test(require('./jsx-svg-geometry.cjs').literal(a)||''):a.name===paint&&/^url\(/.test(a.value||'')))return null;
 const {nodes,selected}=records(resolved,kind);if(!selected||!svg(selected))return null;
 const reference=/^url\(\s*(['"]?)#([\w:.-]+)\1\s*\)$/.exec(attr(selected,paint)||'');if(!reference)return null;
 const matches=nodes.filter(n=>attr(n,'id')===reference[2]);if(matches.length!==1||!coordinates[matches[0].tag]||!svg(matches[0]))return null;
 const node=matches[0],stops=node.children.filter(child=>child.tag==='stop');let reason=null;
 if(selected.unsafe||selected.attrs.filter(a=>a.name===paint).length!==1)reason='Dynamic or duplicate attributes control this layer paint.';
 for(const n of [node,...stops]){
  if(n.unsafe||n.dynamicChildren||n.attrs.some((a,i)=>a.value===undefined||n.attrs.findIndex(other=>other.name===a.name)!==i))reason='Dynamic expressions or duplicate attributes control this gradient.';
  if(n.attrs.some(a=>['href','xlink:href','xlinkHref','style','class','className'].includes(a.name)))reason='Styles or inheritance control this gradient. Edit its source definition.';
  if(n.children.some(child=>!(n===node&&child.tag==='stop')))reason='This gradient contains animation or unsupported child elements.';
 }
 if(!stops.length||stops.length>64)reason='Choose a gradient with 1 to 64 color stops.';
 return {node,stops,selected,id:reference[2],paint,reason};
}
function describe(resolved,kind){return ['fill','stroke'].flatMap(paint=>{const state=inspect(resolved,kind,paint);if(!state)return [];const {node,stops,id,reason}=state;return [{paint,id,type:node.tag,reason,fields:[...coordinates[node.tag],'gradientUnits','spreadMethod'].map(name=>({name,value:attr(node,name)})),stops:stops.map(stop=>({offset:attr(stop,'offset'),color:attr(stop,'stop-color'),opacity:attr(stop,'stop-opacity')}))}];});}
function plan(resolved,op,kind){
 const refuse=reason=>({ok:false,refused:true,reason}),state=inspect(resolved,kind,op.paint);
 if(!state)return refuse('Select a layer with a local linear or radial gradient attribute.');if(state.reason)return refuse(state.reason);
 if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the gradient layer.');
 if(op.action==='reverse')return require('./svg-gradient-reverse.cjs').plan(resolved,op,state,kind);
 if(op.action==='setType')return require('./svg-gradient-type.cjs').plan(resolved,op,state,kind);
 if(op.action==='detach')return require('./svg-gradient-detach.cjs').plan(resolved,op,state,kind);
 if(op.action!==undefined)return require('./svg-gradient-stops.cjs').plan(resolved,op,state,kind);
 const stop=op.stop!==undefined;if(stop&&(!Number.isInteger(op.stop)||op.stop<0||op.stop>=state.stops.length))return refuse('Choose an existing gradient stop.');
 const node=stop?state.stops[op.stop]:state.node,allowed=stop?['offset','stop-color','stop-opacity']:[...coordinates[state.node.tag],'gradientUnits','spreadMethod'];
 if(!op.changes||Array.isArray(op.changes)||![Object.prototype,null].includes(Object.getPrototypeOf(op.changes)))return refuse('Provide gradient property changes.');
 const entries=Object.entries(op.changes);if(!entries.length||entries.some(([p,v])=>!allowed.includes(p)||!base.valid(p,v)))return refuse('Choose valid gradient coordinates, colors, or stop percentages.');
 const escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;'),out=new MagicString(resolved.source);
 for(const [property,value]of entries){const old=node.attrs.find(a=>a.name===property);if(value===null){if(old)out.remove(old.start,old.end);}else if(kind==='liquid'&&old?.valueStart>=0&&['"',"'"].includes(resolved.source[old.valueStart-1]))out.overwrite(old.valueStart,old.valueEnd,escape(value));else{const token=(kind==='react'?jsxName(property):property)+'="'+escape(value)+'"';if(old)out.overwrite(old.start,old.end,token);else out.appendLeft(node.nameEnd,' '+token);}}
 const after=out.toString(),adapter=kind==='react'?require('./adapters/react.cjs'):require('./adapters/liquid.cjs'),before=adapter.collect(resolved.source,resolved.relPath).elements,next=adapter.collect(after,resolved.relPath).elements;
 if(before.length!==next.length||before.some((el,i)=>el.id!==next[i].id||el.kind!==next[i].kind))return refuse('The gradient edit changes the document structure.');
 return {ok:true,hash:ids.contentHash(after),edits:after===resolved.source?[]:[{file:resolved.file,before:resolved.source,after}]};
}
module.exports={describe,plan};
