'use strict';
const MagicString=require('magic-string'),ids=require('./id.cjs'),svg=require('./svg-geometry.cjs');
function literal(attr){
 if(!attr)return null;let value=attr.value;if(value?.type==='JSXExpressionContainer')value=value.expression;
 if(['StringLiteral','NumericLiteral'].includes(value?.type))return String(value.value);
 if(value?.type==='UnaryExpression'&&['-','+'].includes(value.operator)&&value.argument.type==='NumericLiteral')return String((value.operator==='-'?-1:1)*value.argument.value);
 return undefined;
}
function describe(resolved){
 const node=resolved.element.node,tag=ids.jsxElementName(node),ancestors=(resolved.elements||ids.collectElements(resolved.source,resolved.relPath).elements).filter(e=>e.node.start<node.start&&e.node.end>node.end).reverse();
 const boundary=ancestors.find(e=>['svg','foreignObject'].includes(ids.jsxElementName(e.node)));
 if(ids.jsxElementName(boundary?.node||node)!=='svg')return null;
 const attrs=node.openingElement.attributes,spread=attrs.some(a=>a.type==='JSXSpreadAttribute');
 const base=svg.describe({tag,node:{namespaceURI:'http://www.w3.org/2000/svg',attrs:[]}});if(!base)return null;
 const metadata=attrs.filter(a=>a.type==='JSXAttribute'&&a.name.name==='data-rt-shape'),coordinates=attrs.filter(a=>a.type==='JSXAttribute'&&a.name.name==='points');
 return {parametric:tag==='polygon'&&!spread&&metadata.length===1&&coordinates.length===1?require('../shell/svg-parametric.js').describe(literal(coordinates[0]),literal(metadata[0])):null,fields:base.fields.map(field=>{const matches=attrs.filter(a=>a.type==='JSXAttribute'&&a.name.name===field.name),value=literal(matches[0]),editable=!spread&&matches.length<2&&value!==undefined;return {...field,value:value??null,editable,reason:editable?null:spread?'Spread props may control this value.':'This value is dynamic or duplicated in JSX.'};})};
}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason}),field=describe(resolved)?.fields.find(f=>f.name===op.property);
 if(!field||!field.editable||!svg.valid(op.property,op.value))return refuse(field?.reason||'Choose an editable SVG coordinate or size.');
 if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the shape.');
 const node=resolved.element.node,attr=node.openingElement.attributes.find(a=>a.type==='JSXAttribute'&&a.name.name===op.property),out=new MagicString(resolved.source);
 if(op.value===null){if(attr)out.remove(attr.start,attr.end);}else{const token=op.property+'="'+op.value+'"';if(attr)out.overwrite(attr.start,attr.end,token);else out.appendLeft(node.openingElement.name.end,' '+token);}
 const after=out.toString(),before=resolved.elements||ids.collectElements(resolved.source,resolved.relPath).elements,next=ids.collectElements(after,resolved.relPath).elements;
 if(before.length!==next.length||before.some((e,i)=>e.id!==next[i].id||ids.jsxElementName(e.node)!==ids.jsxElementName(next[i].node)))return refuse('The edit would change the JSX document structure.');
 return {ok:true,hash:ids.contentHash(after),edits:after===resolved.source?[]:[{file:resolved.file,before:resolved.source,after}]};
}
module.exports={describe,plan,literal};
