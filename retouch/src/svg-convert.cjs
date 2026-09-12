'use strict';
const MagicString=require('magic-string'),paths=require('../shell/svg-path.js');
function pathFor(tag,fields){
 const values={};for(const field of fields){if(field.editable===false)return null;if(field.value==null){values[field.name]=null;continue;}if(!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:px)?$/.test(String(field.value)))return null;values[field.name]=parseFloat(field.value);if(!Number.isFinite(values[field.name])||Math.abs(values[field.name])>100000)return null;}
 const n=name=>values[name]??0;let d;
 if(tag==='rect'){
  const x=n('x'),y=n('y'),w=n('width'),h=n('height');if(w<=0||h<=0)return null;const rx=Math.min(values.rx??values.ry??0,w/2),ry=Math.min(values.ry??values.rx??0,h/2);if(rx<0||ry<0)return null;
  d=rx&&ry?`M ${x+rx} ${y} H ${x+w-rx} A ${rx} ${ry} 0 0 1 ${x+w} ${y+ry} V ${y+h-ry} A ${rx} ${ry} 0 0 1 ${x+w-rx} ${y+h} H ${x+rx} A ${rx} ${ry} 0 0 1 ${x} ${y+h-ry} V ${y+ry} A ${rx} ${ry} 0 0 1 ${x+rx} ${y} Z`:`M ${x} ${y} H ${x+w} V ${y+h} H ${x} Z`;
 }else if(tag==='circle'||tag==='ellipse'){
  const cx=n('cx'),cy=n('cy'),rx=tag==='circle'?n('r'):n('rx'),ry=tag==='circle'?n('r'):n('ry');if(rx<=0||ry<=0)return null;d=`M ${cx+rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx-rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx+rx} ${cy} Z`;
 }else if(tag==='line')d=`M ${n('x1')} ${n('y1')} L ${n('x2')} ${n('y2')}`;
 return d&&paths.parseCompound(d)?d:null;
}
function context(resolved){
 const node=resolved.element.node||resolved.element,kind=node.openingElement?'react':node.namespaceURI?'html':'liquid';
 const tag=kind==='react'?require('./id.cjs').jsxElementName(node):resolved.element.tag;
 const geometry=kind==='react'?require('./jsx-svg-geometry.cjs').describe(resolved):kind==='html'?require('./svg-geometry.cjs').describe(resolved.element):require('./liquid-svg-geometry.cjs').describe(resolved);
 if(!geometry||!['rect','circle','ellipse','line'].includes(tag))return null;
 if(kind==='html')for(let ancestor=node;ancestor;ancestor=ancestor.parentNode)if(ancestor.attrs?.some(a=>['v-for','v-if','x-for','x-if'].includes(a.name)))return null;
 const attrs=kind==='react'?node.openingElement.attributes:kind==='html'?node.attrs:node.attributes;
 if(attrs.some(a=>['d','ref','v-for','v-if','x-for','x-if'].includes(typeof a.name==='string'?a.name:a.name?.name)))return null;
 const start=kind==='react'?node.openingElement.end:kind==='html'?resolved.element.location.startTag.endOffset:node.openEnd;
 const end=kind==='react'?node.closingElement?.start:kind==='html'?resolved.element.location.endTag?.startOffset:node.selfClosing?null:node.closeStart;
 if(end!=null&&resolved.source.slice(start,end).trim())return null;
 const d=pathFor(tag,geometry.fields);return d?{kind,node,tag,fields:geometry.fields,d}:null;
}
function describe(resolved){const c=context(resolved);return c?{path:c.d,properties:c.fields.map(f=>f.name)}:null;}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason}),c=context(resolved);if(!c)return refuse('Convert a literal SVG primitive without dynamic geometry or child content.');if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the shape.');
 const out=new MagicString(resolved.source),{node,kind,tag}=c;let collect,name;
 if(kind==='react'){
  const ids=require('./id.cjs');collect=s=>ids.collectElements(s,resolved.relPath).elements;name=e=>ids.jsxElementName(e.node);
  out.overwrite(node.openingElement.name.start,node.openingElement.name.end,'path');if(node.closingElement)out.overwrite(node.closingElement.name.start,node.closingElement.name.end,'path');
  for(const attr of node.openingElement.attributes)if(c.fields.some(f=>f.name===attr.name?.name))out.remove(attr.start,attr.end);out.appendLeft(node.openingElement.name.end,' d="'+c.d+'"');
 }else{
  const adapter=require('./adapters/'+kind+'.cjs');collect=s=>adapter.collect(s,resolved.relPath).elements;name=e=>e.tag;
  const start=kind==='html'?resolved.element.location.startTag.startOffset:node.tagStart,close=kind==='html'?resolved.element.location.endTag?.startOffset:node.selfClosing?null:node.closeStart;
  out.overwrite(start+1,start+1+tag.length,'path');if(close!=null)out.overwrite(close+2,close+2+tag.length,'path');
  for(const field of c.fields){const attr=kind==='html'?resolved.element.location.attrs?.[field.name]:node.attributes.find(a=>a.name===field.name);if(attr)out.remove(kind==='html'?attr.startOffset:attr.attrStart,kind==='html'?attr.endOffset:attr.attrEnd);}out.appendLeft(start+1+tag.length,' d="'+c.d+'"');
 }
 const after=out.toString(),before=collect(resolved.source),next=collect(after);
 if(before.length!==next.length||before.some((e,i)=>e.id!==next[i].id||name(next[i])!==(e.id===resolved.element.id?'path':name(e))))return refuse('Conversion would change neighboring source identities.');
 return {ok:true,hash:require('./id.cjs').contentHash(after),edits:[{file:resolved.file,before:resolved.source,after}]};
}
module.exports={pathFor,describe,plan};
