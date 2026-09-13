'use strict';
const MagicString=require('magic-string'),points=require('../shell/svg-points.js');
const shapes={rect:['x','y','width','height','rx','ry'],circle:['cx','cy','r'],ellipse:['cx','cy','rx','ry'],line:['x1','y1','x2','y2'],polygon:['points'],polyline:['points'],path:['d']};
const labels={points:'Points',d:'Path data',x:'X',y:'Y',width:'Width',height:'Height',rx:'Horizontal radius',ry:'Vertical radius',cx:'Center X',cy:'Center Y',r:'Radius',x1:'Start X',y1:'Start Y',x2:'End X',y2:'End Y'};
function describe(element){if(element.node.namespaceURI!=='http://www.w3.org/2000/svg'||!shapes[element.tag])return null;return {parametric:element.tag==='polygon'?require('../shell/svg-parametric.js').describe(element.node.attrs.find(a=>a.name==='points')?.value,element.node.attrs.find(a=>a.name==='data-rt-shape')?.value):null,fields:shapes[element.tag].map(name=>({name,label:labels[name],value:element.node.attrs.find(a=>a.name===name)?.value??null}))};}
function valid(name,value){if(value===null)return true;if(name==='d')return !!require('../shell/svg-path.js').parseCompound(value);if(name==='points')return !!points.parse(value);if(typeof value!=='string'||value.length>40||!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:px|%)?$/.test(value))return false;const number=parseFloat(value);return Math.abs(number)<=100000&&(!['width','height','r','rx','ry'].includes(name)||number>=0);}
function changes(op){
 if(!Object.hasOwn(op,'changes'))return typeof op.property==='string'?[[op.property,op.value]]:null;
 if(op.property!==undefined||op.value!==undefined||!op.changes||Array.isArray(op.changes)||![Object.prototype,null].includes(Object.getPrototypeOf(op.changes)))return null;
 const entries=Object.entries(op.changes);return entries.length&&entries.length<=8?entries:null;
}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason}),shape=describe(resolved.element),entries=changes(op);
 if(!shape||!entries||entries.some(([property,value])=>!shape.fields.some(f=>f.name===property)||!valid(property,value)))return refuse('Choose a supported SVG shape coordinate or size.');
 if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the shape.');
 for(let node=resolved.element.node;node;node=node.parentNode)if(node.attrs?.some(a=>/^(?:v-for|v-if|x-for|x-if)$/.test(a.name)))return refuse('This shape belongs to a rendered template.');
 const el=resolved.element,out=new MagicString(resolved.source);
 for(const [property,value]of entries){const old=el.location.attrs?.[property];
 if(value===null){if(old)out.remove(old.startOffset,old.endOffset);}else{const token=property+'="'+value+'"';if(old)out.overwrite(old.startOffset,old.endOffset,token);else out.appendLeft(el.location.startTag.startOffset+1+el.tag.length,' '+token);}
 }
 const after=out.toString(),html=require('./adapters/html.cjs');if(after===resolved.source)return {ok:true,hash:resolved.hash,edits:[]};
 const before=resolved.elements||html.collect(resolved.source,resolved.relPath).elements,next=html.collect(after,resolved.relPath).elements;
 if(before.length!==next.length||before.some((e,i)=>e.id!==next[i].id||e.tag!==next[i].tag))return refuse('The shape edit changes the parsed document.');
 return {ok:true,hash:html.contentHash(after),edits:[{file:resolved.file,before:resolved.source,after}]};
}
module.exports={describe,valid,changes,plan};
