'use strict';
const MagicString=require('magic-string'),svg=require('./svg-geometry.cjs');
function describe(resolved){
 const node=resolved.element;if(node.kind!=='host'||node.dynamicTag||node.generatedImage)return null;
 let boundary=node.parent;while(boundary&&!['svg','foreignobject'].includes(boundary.tag)){if(boundary.dynamicTag)return null;boundary=boundary.parent;}if(boundary?.tag!=='svg')return null;
 const shape=svg.describe({tag:node.tag,node:{namespaceURI:'http://www.w3.org/2000/svg',attrs:[]}});if(!shape)return null;
 return {fields:shape.fields.map(field=>{const attrs=(node.attributes||[]).filter(attr=>attr.name===field.name),attr=attrs[0],dynamic=attr&&/\{[%{]/.test(attr.value||''),editable=!node.attributeExpressions&&attrs.length<2&&!dynamic;return {...field,value:attr?.value??null,editable,reason:editable?null:node.attributeExpressions?'Liquid attribute expressions may control this value.':dynamic?'This coordinate is controlled by a Liquid expression.':'This coordinate has duplicate attributes.'};})};
}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason}),field=describe(resolved)?.fields.find(field=>field.name===op.property);
 if(!field?.editable||!svg.valid(op.property,op.value))return refuse(field?.reason||'Choose an editable SVG coordinate or size.');
 if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the shape.');
 const node=resolved.element,attr=node.attributes.find(attr=>attr.name===op.property),out=new MagicString(resolved.source);
 if(op.value===null){if(attr)out.remove(attr.attrStart,attr.attrEnd);}else if(attr&&attr.valueStart>=0&&['"',"'"].includes(resolved.source[attr.valueStart-1]))out.overwrite(attr.valueStart,attr.valueEnd,op.value);else{const token=op.property+'="'+op.value+'"';if(attr)out.overwrite(attr.attrStart,attr.attrEnd,token);else out.appendLeft(node.nameEnd,' '+token);}
 const after=out.toString(),adapter=require('./adapters/liquid.cjs'),before=adapter.collect(resolved.source,resolved.relPath).elements,next=adapter.collect(after,resolved.relPath).elements;
 if(before.length!==next.length||before.some((el,i)=>el.id!==next[i].id||el.tag!==next[i].tag||el.kind!==next[i].kind))return refuse('The edit would change the Liquid document structure.');
 return {ok:true,hash:adapter.contentHash(after),edits:after===resolved.source?[]:[{file:resolved.file,before:resolved.source,after}]};
}
module.exports={describe,plan};
