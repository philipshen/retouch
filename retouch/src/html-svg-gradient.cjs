'use strict';
const MagicString=require('magic-string'),parse5=require('parse5');
const SVG='http://www.w3.org/2000/svg';
const coordinates={linearGradient:['x1','y1','x2','y2'],radialGradient:['cx','cy','r','fx','fy','fr']};
const attr=(node,name)=>node.attrs?.find(a=>a.name===name)?.value??null;
const escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
function inspect(resolved,paint){
 if(!['fill','stroke'].includes(paint)||resolved.element.node.namespaceURI!==SVG)return null;
 const reference=/^url\(\s*['"]?#([\w:.-]+)['"]?\s*\)$/.exec(attr(resolved.element.node,paint)||'');if(!reference)return null;
 let root=resolved.element.node;while(root.parentNode)root=root.parentNode;
 const matches=[];function walk(node){if(attr(node,'id')===reference[1])matches.push(node);for(const child of node.childNodes||[])walk(child);}walk(root);
 if(matches.length!==1||matches[0].namespaceURI!==SVG||!coordinates[matches[0].tagName])return null;
 const node=matches[0],stops=(node.childNodes||[]).filter(n=>n.tagName==='stop'),duplicates=[];
 parse5.parse(resolved.source,{onParseError:error=>{if(error.code==='duplicate-attribute')duplicates.push(error.startOffset);}});
 let reason=null;
 for(const start of [node,resolved.element.node])for(let n=start;n;n=n.parentNode)if(n.attrs?.some(a=>/^(?:v-for|v-if|x-for|x-if)$/.test(a.name)))reason='This gradient belongs to a rendered template.';
 for(const n of [node,...stops]){
  const start=n.sourceCodeLocation?.startTag;
  if(!start||duplicates.some(offset=>offset>=start.startOffset&&offset<start.endOffset))reason='The gradient has missing source locations or duplicate attributes.';
  if(n.attrs?.some(a=>['href','style','class'].includes(a.name)||/\{[%{]|\b(?:v-bind|x-bind|v-for|v-if|x-for|x-if)\b/.test(a.name+' '+a.value)))reason='Styles, inheritance or template expressions control this gradient. Edit its source definition.';
  if((n.childNodes||[]).some(c=>c.tagName&&!(n===node&&c.tagName==='stop')))reason='This gradient contains animation or unsupported child elements.';
 }
 if(!stops.length||stops.length>64)reason='Choose a gradient with 1 to 64 color stops.';
 return {node,stops,id:reference[1],paint,reason};
}
function describe(resolved){return ['fill','stroke'].flatMap(paint=>{const state=inspect(resolved,paint);if(!state)return [];const {node,stops,id,reason}=state;return [{paint,id,type:node.tagName,reason,fields:[...coordinates[node.tagName],'gradientUnits','spreadMethod'].map(name=>({name,value:attr(node,name)})),stops:stops.map(stop=>({offset:attr(stop,'offset'),color:attr(stop,'stop-color'),opacity:attr(stop,'stop-opacity')}))}];});}
function valid(property,value){
 if(value===null)return true;
 if(property==='stop-color')return require('../shell/html-css-values.js').valid('color',value);
 if(property==='gradientUnits')return ['objectBoundingBox','userSpaceOnUse'].includes(value);
 if(property==='spreadMethod')return ['pad','reflect','repeat'].includes(value);
 if(typeof value!=='string'||value.length>40||!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:%|px)?$/.test(value))return false;
 const n=parseFloat(value);if(['offset','stop-opacity'].includes(property))return !value.endsWith('px')&&n>=0&&n<=(value.endsWith('%')?100:1);
 return Math.abs(n)<=100000&&(!['r','fr'].includes(property)||n>=0);
}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason}),state=inspect(resolved,op.paint);
 if(!state)return refuse('Select a layer with a local linear or radial gradient attribute.');
 if(state.reason)return refuse(state.reason);
 if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the gradient layer.');
 if(op.action!==undefined)return require('./svg-gradient-stops.cjs').plan(resolved,op,state,'html');
 const stop=op.stop!==undefined;
 if(stop&&(!Number.isInteger(op.stop)||op.stop<0||op.stop>=state.stops.length))return refuse('Choose an existing gradient stop.');
 const node=stop?state.stops[op.stop]:state.node,allowed=stop?['offset','stop-color','stop-opacity']:[...coordinates[state.node.tagName],'gradientUnits','spreadMethod'];
 if(!op.changes||Array.isArray(op.changes)||![Object.prototype,null].includes(Object.getPrototypeOf(op.changes)))return refuse('Provide gradient property changes.');
 const entries=Object.entries(op.changes);
 if(!entries.length||entries.some(([p,v])=>!allowed.includes(p)||!valid(p,v)))return refuse('Choose valid gradient coordinates, colors, or stop percentages.');
 const out=new MagicString(resolved.source);
 for(const [property,value]of entries){const old=node.sourceCodeLocation.attrs?.[property.toLowerCase()];
  if(value===null){if(old)out.remove(old.startOffset,old.endOffset);}else{const token=property+'="'+escape(value)+'"';if(old)out.overwrite(old.startOffset,old.endOffset,token);else out.appendLeft(node.sourceCodeLocation.startTag.startOffset+1+node.tagName.length,' '+token);}
 }
 const after=out.toString(),html=require('./adapters/html.cjs'),before=resolved.elements||html.collect(resolved.source,resolved.relPath).elements,next=html.collect(after,resolved.relPath).elements;
 if(before.length!==next.length||before.some((el,i)=>el.id!==next[i].id||el.tag!==next[i].tag))return refuse('The gradient edit changes the document structure.');
 return {ok:true,hash:html.contentHash(after),edits:after===resolved.source?[]:[{file:resolved.file,before:resolved.source,after}]};
}
module.exports={describe,plan,valid};
