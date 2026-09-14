'use strict';
const MagicString=require('magic-string'),paths=require('../shell/svg-path.js');
function pathFor(tag,fields){
 const values={};for(const field of fields){if(field.editable===false)return null;if(field.value==null){values[field.name]=null;continue;}if(!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:px)?$/.test(String(field.value)))return null;values[field.name]=parseFloat(field.value);if(!Number.isFinite(values[field.name])||Math.abs(values[field.name])>100000)return null;}
 const n=name=>values[name]??0;let d;
 if(tag==='rect'){
  const x=n('x'),y=n('y'),w=n('width'),h=n('height');if(w<=0||h<=0)return null;const rx=Math.min(values.rx??values.ry??0,w/2),ry=Math.min(values.ry??values.rx??0,h/2);if(rx<0||ry<0)return null;
  d=rx&&ry?`M ${x+rx} ${y} H ${x+w-rx} A ${rx} ${ry} 0 0 1 ${x+w} ${y+ry} V ${y+h-ry} A ${rx} ${ry} 0 0 1 ${x+w-rx} ${y+h} H ${x+rx} A ${rx} ${ry} 0 0 1 ${x} ${y+h-ry} V ${y+ry} A ${rx} ${ry} 0 0 1 ${x+rx} ${y} Z`:`M ${x} ${y} H ${x+w} V ${y+h} H ${x} Z`;
 }else if(tag==='circle'||tag==='ellipse'){
  const cx=n('cx'),cy=n('cy'),rx=tag==='circle'?n('r'):n('rx'),ry=tag==='circle'?n('r'):n('ry');if(rx<=0||ry<=0)return null;d=`M ${cx+rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx} ${cy+ry} A ${rx} ${ry} 0 0 1 ${cx-rx} ${cy} A ${rx} ${ry} 0 0 1 ${cx} ${cy-ry} A ${rx} ${ry} 0 0 1 ${cx+rx} ${cy} Z`;
 }else if(tag==='line')d=`M ${n('x1')} ${n('y1')} L ${n('x2')} ${n('y2')}`;
 return d&&paths.parseCompound(d)?d:null;
}
function metadataOnly(kind,node,source,start,end){
 if(end==null)return true;
 if(kind==='react')return node.children.every(child=>child.type==='JSXText'?!child.value.trim():child.type==='JSXExpressionContainer'?child.expression.type==='JSXEmptyExpression':child.type==='JSXElement'&&['title','desc'].includes(require('./id.cjs').jsxElementName(child)));
 const children=kind==='html'?(node.childNodes||[]).filter(child=>child.tagName):node.children||[];
 if(children.some(child=>!['title','desc'].includes(kind==='html'?child.tagName:child.tag)))return false;
 let cursor=start,remainder='';
 for(const child of children){const a=kind==='html'?child.sourceCodeLocation?.startOffset:child.tagStart,b=kind==='html'?child.sourceCodeLocation?.endOffset:child.closeEnd;if(a==null||b==null||a<cursor||b>end)return false;remainder+=source.slice(cursor,a);cursor=b;}
 remainder+=source.slice(cursor,end);return !remainder.replace(/<!--[\s\S]*?-->/g,'').trim();
}
function context(resolved){
 const node=resolved.element.node||resolved.element,kind=node.openingElement?'react':node.namespaceURI?'html':'liquid';
 const tag=kind==='react'?require('./id.cjs').jsxElementName(node):resolved.element.tag;
 const geometry=kind==='react'?require('./jsx-svg-geometry.cjs').describe(resolved):kind==='html'?require('./svg-geometry.cjs').describe(resolved.element):require('./liquid-svg-geometry.cjs').describe(resolved);
 if(!geometry||!['rect','circle','ellipse','line','polyline'].includes(tag))return null;
 if(kind==='html')for(let ancestor=node;ancestor;ancestor=ancestor.parentNode)if(ancestor.attrs?.some(a=>['v-for','v-if','x-for','x-if'].includes(a.name)))return null;
 const attrs=kind==='react'?node.openingElement.attributes:kind==='html'?node.attrs:node.attributes;
 if(attrs.some(a=>['d','ref','v-for','v-if','x-for','x-if'].includes(typeof a.name==='string'?a.name:a.name?.name)))return null;
 const start=kind==='react'?node.openingElement.end:kind==='html'?resolved.element.location.startTag.endOffset:node.openEnd;
 const end=kind==='react'?node.closingElement?.start:kind==='html'?resolved.element.location.endTag?.startOffset:node.selfClosing?null:node.closeStart;
 if(!metadataOnly(kind,node,resolved.source,start,end))return null;
 if(tag==='polyline'){
  if(geometry.parametric?.kind!=='arrow')return null;const fill=attrs.find(attribute=>(typeof attribute.name==='string'?attribute.name:attribute.name?.name)==='fill');
  if((kind==='react'?require('./jsx-svg-geometry.cjs').literal(fill):fill?.value)!=='none')return null;
 }

 const d=tag==='polyline'?require('../shell/svg-parametric.js').arrowPath(geometry.fields.find(field=>field.name==='points')?.value):pathFor(tag,geometry.fields);return d?{kind,node,tag,fields:geometry.fields,d}:null;
}
function arrowFor(c){
 if(!c||c.tag!=='line')return null;
 const attrs=c.kind==='react'?c.node.openingElement.attributes:c.kind==='html'?c.node.attrs:c.node.attributes;
 if(attrs.some(a=>(typeof a.name==='string'?a.name:a.name?.name)==='data-rt-shape'))return null;
 const fill=attrs.find(a=>(typeof a.name==='string'?a.name:a.name?.name)==='fill');
 if(fill){let value=fill.value;if(c.kind==='react'){if(value?.type==='JSXExpressionContainer')value=value.expression;if(value?.type!=='StringLiteral')return null;}else if(/\{[%{]/.test(value||''))return null;}
 const values=Object.fromEntries(c.fields.map(f=>[f.name,parseFloat(f.value||0)])),{x1,y1,x2,y2}=values,head=Math.min(12,Math.hypot(x2-x1,y2-y1)*.3);
 const points=require('../shell/svg-parametric.js').generate({kind:'arrow',x1,y1,x2,y2,headLength:head,headWidth:head});
 return points?{points,properties:[...c.fields.map(f=>f.name),'fill']}:null;
}
function describe(resolved){const c=context(resolved);return c?{path:c.d,properties:c.fields.map(f=>f.name),arrow:arrowFor(c)}:null;}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason}),c=context(resolved);if(!c)return refuse('Convert a literal SVG primitive without dynamic geometry or non-metadata child content.');if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the shape.');
 const arrow=op.type==='convertSVGToArrow'?arrowFor(c):null;if(op.type==='convertSVGToArrow'&&!arrow)return refuse('Convert a literal line without dynamic fill or existing shape metadata.');
 const editedArrow=op.arrowPoints!==undefined;if(editedArrow&&(op.type!=='convertSVGToPath'||c.tag!=='polyline'||typeof op.arrowPoints!=='string'||!require('../shell/svg-parametric.js').arrowPath(op.arrowPoints)))return refuse('Only recognized legacy arrows accept edited arrow geometry.');
 const desiredPath=editedArrow?require('../shell/svg-parametric.js').arrowPath(op.arrowPoints):c.d;
 const targetTag='path',addition=arrow?' d="'+require('../shell/svg-parametric.js').arrowPath(arrow.points)+'" fill="none" data-rt-shape="arrow"':' d="'+desiredPath+'"',properties=arrow?arrow.properties:c.fields.map(f=>f.name);
 const out=new MagicString(resolved.source),{node,kind,tag}=c;let collect,name;
 if(kind==='react'){
  const ids=require('./id.cjs');collect=s=>ids.collectElements(s,resolved.relPath).elements;name=e=>ids.jsxElementName(e.node);
  out.overwrite(node.openingElement.name.start,node.openingElement.name.end,targetTag);if(node.closingElement)out.overwrite(node.closingElement.name.start,node.closingElement.name.end,targetTag);
  for(const attr of node.openingElement.attributes)if(properties.includes(attr.name?.name))out.remove(attr.start,attr.end);out.appendLeft(node.openingElement.name.end,addition);
 }else{
  const adapter=require('./adapters/'+kind+'.cjs');collect=s=>adapter.collect(s,resolved.relPath).elements;name=e=>e.tag;
  const start=kind==='html'?resolved.element.location.startTag.startOffset:node.tagStart,close=kind==='html'?resolved.element.location.endTag?.startOffset:node.selfClosing?null:node.closeStart;
  out.overwrite(start+1,start+1+tag.length,targetTag);if(close!=null)out.overwrite(close+2,close+2+tag.length,targetTag);
  for(const name of properties){const attr=kind==='html'?resolved.element.location.attrs?.[name]:node.attributes.find(a=>a.name===name);if(attr)out.remove(kind==='html'?attr.startOffset:attr.attrStart,kind==='html'?attr.endOffset:attr.attrEnd);}out.appendLeft(start+1+tag.length,addition);
 }
 const after=out.toString(),before=collect(resolved.source),next=collect(after);
 if(before.length!==next.length||before.some((e,i)=>e.id!==next[i].id||name(next[i])!==(e.id===resolved.element.id?targetTag:name(e))))return refuse('Conversion would change neighboring source identities.');
 return {ok:true,hash:require('./id.cjs').contentHash(after),edits:[{file:resolved.file,before:resolved.source,after}]};
}
module.exports={pathFor,describe,plan};
