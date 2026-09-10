'use strict';
const prefix='{% comment %}retouch-layer-v1:',suffix='{% endcomment %}';
function valid(name){return typeof name==='string'&&name.length<=200&&!/[\u0000-\u001f\u007f]/.test(name);}
function read(source,start){
 if(!source.startsWith(prefix,start))return null;const end=source.indexOf(suffix,start+prefix.length);if(end<0)return null;
 const encoded=source.slice(start+prefix.length,end);if(!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))return null;
 try{const bytes=Buffer.from(encoded,'base64'),name=JSON.parse(bytes.toString('utf8'));if(bytes.toString('base64')!==encoded||!valid(name))return null;return {start,end:end+suffix.length,name};}catch{return null;}
}
function comment(name){return prefix+Buffer.from(JSON.stringify(name)).toString('base64')+suffix;}
function strip(source){return source.replace(/\{% comment %\}retouch-layer-v1:[A-Za-z0-9+/=]*\{% endcomment %\}/g,(text)=>read(text,0)?'':text);}
function attribute(name){return ' data-rt-layer-name="'+name.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\{/g,'&#123;').replace(/\}/g,'&#125;')+'"';}
function describe(resolved){const node=resolved.element;return node.kind==='host'&&!node.generatedImage?{canRename:true,layerName:node.layerNames?.length===1?node.layerNames[0].name:''}:{};}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason});
 if(op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the layer before naming it.');
 if(!describe(resolved).canRename)return refuse('Select a template element to name.');
 if(!valid(op.name))return refuse('Use a name of up to 200 characters without control characters.');
 try{
  const node=resolved.element,ms=new(require('magic-string'))(resolved.source),name=op.name.trim();
  for(const saved of node.layerNames||[])ms.remove(saved.start,saved.end);
  if(name)ms.appendLeft(node.nameEnd,comment(name));
  const after=ms.toString(),adapter=require('./adapters/liquid.cjs'),ids=adapter.collect(after,resolved.relPath).elements.map(el=>el.id);
  if(JSON.stringify(ids)!==JSON.stringify(resolved.elements.map(el=>el.id)))throw Error('Naming changed source identities.');
  return {ok:true,hash:adapter.contentHash(after),edits:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
module.exports={read,comment,strip,attribute,describe,plan};
