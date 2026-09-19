'use strict';
const V=require('../shell/prototype-values.js'),MagicString=require('magic-string');
const refuse=reason=>({ok:false,refused:true,reason});
function metadata(resolved,adapter,name=V.attribute){
 const e=resolved.element;let attrs,insert;
 if(e.kind!=='host')throw Error('Select a rendered element to add interactions.');
 if(adapter.name==='html'){
  attrs=e.node.attrs.filter(a=>a.name===name).map(a=>({value:a.value,start:e.location.attrs[name].startOffset,end:e.location.attrs[name].endOffset}));insert=e.location.startTag.startOffset+1+e.tag.length;
 }else if(adapter.name==='react'){
  const opening=e.node.openingElement;
  if(opening.attributes.some(a=>a.type==='JSXSpreadAttribute'))throw Error('This layer spreads runtime attributes. Choose an explicit element.');
  attrs=opening.attributes.filter(a=>a.name?.name===name).map(a=>{if(a.value?.type!=='StringLiteral')throw Error('Prototype interactions must be literal.');return {value:a.value.value,start:a.start,end:a.end};});insert=opening.name.end;
 }else if(adapter.name==='liquid'){
  if(e.generatedImage||e.attributeExpressions||e.dynamicTag)throw Error('Choose an explicit template element without generated attributes.');
  attrs=e.attributes.filter(a=>a.name===name).map(a=>{if(typeof a.value!=='string'||/\{[%{]/.test(a.value))throw Error('Prototype interactions must be literal.');return {value:require('parse5').parseFragment('<i data-value="'+a.value.replace(/"/g,'&quot;')+'">').childNodes[0].attrs[0].value,start:a.attrStart,end:a.attrEnd};});insert=e.nameEnd;
 }else if(adapter.name==='vue'){
  const {NodeTypes}=require('@vue/compiler-dom');
  if(e.node.props.some(p=>p.type===NodeTypes.DIRECTIVE&&p.name==='bind'&&(!p.arg||!p.arg.isStatic||p.arg.content.toLowerCase()===name)))throw Error('This layer computes runtime attributes. Choose an explicit element.');
  attrs=e.attributes.filter(a=>a.name.toLowerCase()===name).map(a=>({value:a.value,start:a.start,end:a.end}));insert=e.start+1+e.tag.length;
 }else throw Error('Prototype source authoring is unavailable for this renderer.');
 if(attrs.length>1)throw Error('The layer has duplicate prototype attributes.');
 return {old:attrs[0],insert,interactions:name===V.attribute?V.parse(attrs[0]?.value??null):undefined};
}
function anchor(resolved,adapter){try{return metadata(resolved,adapter,'id').old?.value??null;}catch{return undefined;}}
function describe(resolved,adapter){try{return {prototypeAnchor:anchor(resolved,adapter),prototypeEditable:true,prototypeInteractions:metadata(resolved,adapter).interactions};}catch(error){return {prototypeEditable:false,prototypeReason:error.message};}}
function plan(resolved,op,adapter){try{
 if(op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the layer.');
 if(Object.keys(op).some(key=>!['type','id','fileHash','context','interactions','historyGroup'].includes(key)))return refuse('Invalid prototype operation.');
 const meta=metadata(resolved,adapter),interactions=V.validate(op.interactions);
 if(JSON.stringify(meta.interactions)===JSON.stringify(interactions))return {ok:true,hash:resolved.hash,edits:[]};
 const value=JSON.stringify(interactions).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\{/g,'&#123;').replace(/\}/g,'&#125;');
 const out=new MagicString(resolved.source),token=V.attribute+'="'+value+'"';
 if(meta.old){if(interactions.length)out.overwrite(meta.old.start,meta.old.end,token);else out.remove(meta.old.start,meta.old.end);}else if(interactions.length)out.appendLeft(meta.insert,' '+token);
 const after=out.toString(),elements=adapter.collect(after,resolved.relPath).elements;
 if(JSON.stringify(elements.map(e=>e.id))!==JSON.stringify(resolved.elements.map(e=>e.id)))return refuse('The interaction would change source identities.');
 const updated=elements.find(e=>e.id===resolved.element.id);if(JSON.stringify(metadata({...resolved,source:after,element:updated},adapter).interactions)!==JSON.stringify(interactions))return refuse('The renderer did not preserve the interaction.');
 return {ok:true,hash:adapter.contentHash(after),edits:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}}
module.exports={describe,plan,metadata};
