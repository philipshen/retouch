'use strict';
// HTML source documents form the editing foundation for renderer-independent
// site imports. Locations come from the HTML parser, never from client mappings.
const path=require('node:path'),crypto=require('node:crypto');
const parse5=require('parse5'),MagicString=require('magic-string'),structure=require('../structure.cjs'),insertion=require('../html-insert.cjs');
const hash=source=>crypto.createHash('sha1').update(source).digest('hex');
const skip=new Set(['script','style','template']);
const textTags=new Set(['h1','h2','h3','h4','h5','h6','p','span','div','blockquote','label','a','li']);
const refuse=reason=>({ok:false,refused:true,reason});
const escapeText=value=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const escapeAttr=value=>escapeText(value).replace(/"/g,'&quot;');
function collect(source,relPath){
 const duplicateAttributes=[];
 const tree=parse5.parse(source,{sourceCodeLocationInfo:true,onParseError:e=>{if(e.code==='duplicate-attribute')duplicateAttributes.push(e.startOffset);}}),elements=[];
 function walk(parent,route){
  let index=0;
  for(const node of parent.childNodes||[]){
   if(!node.tagName)continue;
   const here=route+'/'+index++;
   if(skip.has(node.tagName)||node.namespaceURI!=='http://www.w3.org/1999/xhtml'&&!(node.namespaceURI==='http://www.w3.org/2000/svg'&&['svg','g','rect','circle','ellipse','line','path','polyline','polygon'].includes(node.tagName)))continue;
   const start=node.sourceCodeLocation?.startTag;
   if(start&&!duplicateAttributes.some(offset=>offset>=start.startOffset&&offset<start.endOffset))elements.push({id:hash(relPath+'|'+here).slice(0,10),kind:'host',tag:node.tagName,node,location:node.sourceCodeLocation});
   walk(node,here);
  }
 }
 walk(tree,'');return {elements};
}
function stamp(source,file,root){
 const rel=root?path.relative(root,file).split(path.sep).join('/'):file;
 const {elements}=collect(source,rel);if(!elements.length)return null;
 const out=new MagicString(source);
 for(const el of elements){
  const prior=el.location.attrs?.['data-rt'];
  if(prior)out.overwrite(prior.startOffset,prior.endOffset,`data-rt="${el.id}"`);
  else out.appendLeft(el.location.startTag.startOffset+1+el.tag.length,` data-rt="${el.id}"`);
 }
 return {code:out.toString(),map:out.generateMap({hires:true,source:file})};
}
function attr(el,name){return el.node.attrs.find(a=>a.name===name)?.value??null;}
function plain(el){return el.location.endTag&&(el.node.childNodes||[]).every(n=>n.nodeName==='#text');}
function picture(el){for(let p=el.node.parentNode;p;p=p.parentNode)if(p.tagName==='picture')return true;return false;}
function describe(resolved){
 const el=resolved.element,canText=el.node.namespaceURI==='http://www.w3.org/1999/xhtml'&&!!plain(el),canSrc=el.tag==='img'&&attr(el,'srcset')===null&&!picture(el);
 return {svgDeletion:require('../svg-delete.cjs').describe(resolved),svgInsertion:require('../svg-insert.cjs').describe(resolved),svgGeometry:require('../svg-geometry.cjs').describe(el),structure:{...structure.describe(resolved,'html'),...insertion.describe(resolved),...require('../svg-delete.cjs').describe(resolved)},id:el.id,kind:'host',tag:el.tag,file:resolved.relPath,hash:resolved.hash,className:attr(el,'class')||'',classNameDynamic:false,
  canRename:true,layerName:attr(el,'data-rt-name')||'',text:canText?el.node.childNodes.map(n=>n.value).join(''):null,textDynamic:!canText,mixedText:false,canSetChildren:false,
  textReason:canText?null:'This HTML region contains nested markup, comments, or an implicit closing tag.',
  src:attr(el,'src'),srcDynamic:false,canSetSrc:canSrc,srcReason:canSrc?null:'Select a plain image without responsive sources.',
  canSetTag:!!el.location.endTag&&textTags.has(el.tag),context:resolved.context||null};
}
function planOp(resolved,op){
 if(op.type==='deleteElement'&&resolved.element.node.namespaceURI==='http://www.w3.org/2000/svg')return require('../svg-delete.cjs').plan(resolved,op);
 if(op.type==='insertSVG')return require('../svg-insert.cjs').plan(resolved,op);
 if(op.type==='setSVGGeometry')return require('../svg-geometry.cjs').plan(resolved,op);
 if(op.type==='reparentElement')return require('../html-reparent.cjs').plan(resolved,op);
 if(op.type==='insertElement')return insertion.plan(resolved,op);
 if(structure.types.has(op.type))return structure.planOp(resolved,op,'html');
 if(op.fileHash&&op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the element.');
 const el=resolved.element,out=new MagicString(resolved.source);
 function setAttr(name,value){
  const token=`${name}="${escapeAttr(value)}"`,old=el.location.attrs?.[name];
  if(old)out.overwrite(old.startOffset,old.endOffset,token);
  else out.appendLeft(el.location.startTag.startOffset+1+el.tag.length,' '+token);
 }
 if(op.type==='renameElement'){
  if(typeof op.name!=='string'||op.name.length>200||/[\x00-\x1f\x7f]/.test(op.name))return refuse('Use a single-line layer name of up to 200 characters.');
  const name=op.name.trim(),old=el.location.attrs?.['data-rt-name'];
  if(name)setAttr('data-rt-name',name);else if(old)out.remove(old.startOffset,old.endOffset);
 }else if(op.type==='setClasses'){
  if(typeof op.classes!=='string'||op.classes.length>100000||/[\0-\x08\x0b\x0c\x0e-\x1f]/.test(op.classes))return refuse('Invalid class string.');
  setAttr('class',op.classes);
 }else if(op.type==='setText'){
  if(!plain(el))return refuse('Editing nested markup or implicit closing tags needs a structured HTML operation.');
  if(typeof op.text!=='string'||op.text.length>1000000)return refuse('Invalid text.');
  out.overwrite(el.location.startTag.endOffset,el.location.endTag.startOffset,escapeText(op.text));
 }else if(op.type==='setTag'){
  if(!describe(resolved).canSetTag||!textTags.has(op.tag))return refuse('Unsupported HTML tag change.');
  out.overwrite(el.location.startTag.startOffset+1,el.location.startTag.startOffset+1+el.tag.length,op.tag);
  out.overwrite(el.location.endTag.startOffset+2,el.location.endTag.startOffset+2+el.tag.length,op.tag);
 }else if(op.type==='setSrc'){
  if(!describe(resolved).canSetSrc||typeof op.src!=='string'||/[\0-\x1f]/.test(op.src))return refuse('Unsupported image source.');
  try{if(!['http:','https:'].includes(new URL(op.src,'https://retouch.local/').protocol))return refuse('Unsupported image URL scheme.');}catch{return refuse('Invalid image URL.');}
  setAttr('src',op.src);
 }else return refuse('This HTML operation is not implemented.');
 const after=out.toString();
 if(after===resolved.source)return {ok:true,hash:resolved.hash,edits:[]};
 const beforeElements=resolved.elements||collect(resolved.source,resolved.relPath).elements;
 const nextElements=collect(after,resolved.relPath).elements;
 if(beforeElements.length!==nextElements.length||beforeElements.some((before,i)=>before.id!==nextElements[i].id||nextElements[i].tag!==(before.id===el.id&&op.type==='setTag'?op.tag:before.tag)))return refuse('This edit changes the parsed HTML structure. Use a structured document operation.');
 return {ok:true,hash:hash(after),edits:[{file:resolved.file,before:resolved.source,after}]};
}
module.exports={name:'html',matches:file=>/\.html?$/i.test(file),collect,stamp,contentHash:hash,describe,planOp,
 applyOp:(resolved,op)=>require('../transactions.cjs').applyPlan(resolved.appRoot||path.dirname(resolved.file),planOp(resolved,op)),
 capabilities:{classAttr:'class',ops:['insertSVG','setSVGGeometry','reparentElement','renameElement','insertElement','setClasses','setText','setTag','setSrc',...structure.types]}};
