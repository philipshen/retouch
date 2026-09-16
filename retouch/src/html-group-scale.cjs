'use strict';
const MagicString=require('magic-string'),parse5=require('parse5'),html=require('./adapters/html.cjs'),runtime=require('./group-scale-runtime.cjs'),{parse}=require('../runtime/group-scale-bootstrap.js');
const attr=(node,name)=>node.attrs?.find(item=>item.name===name)?.value;
const contains=(parent,node)=>{for(let current=node;current;current=current.parentNode)if(current===parent)return true;return false;};
const escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
function plan(resolved,op){
 try{
  if(op.fileHash!==resolved.hash)throw Error('The file changed. Re-select the group.');
  if(!Number.isInteger(op.width)||op.width<0||op.width>7680||typeof op.factor!=='number'||!Number.isFinite(op.factor)||op.factor<.01||op.factor>100)throw Error('Choose a valid screen width and scale factor.');
  const {element,source,relPath}=resolved,elements=html.collect(source,relPath).elements,group=elements.find(item=>item.id===element.id);
  if(!group||group.node.namespaceURI!=='http://www.w3.org/1999/xhtml'||attr(group.node,'data-rt-group')===undefined)throw Error('Choose a source-backed group.');
  const groups=elements.filter(item=>attr(item.node,'data-rt-scale')!==undefined);
  if(groups.some(other=>other.id!==group.id&&(contains(other.node,group.node)||contains(group.node,other.node))))throw Error('Overlapping responsive scale groups are not supported yet.');
  const stored=attr(group.node,'data-rt-scale'),ranges=stored===undefined?[]:parse(stored);let current=1;
  for(const [width,value]of ranges)if(width<=op.width)current=value;
  const values=Object.fromEntries(ranges);values[op.width]=current*op.factor;
  const metadata=JSON.stringify({version:1,ranges:values});parse(metadata);
  if(op.factor===1)return {ok:true,hash:resolved.hash,edits:[]};
  const tree=parse5.parse(source,{sourceCodeLocationInfo:true}),scripts=[];let bodyEnd=null;
  function walk(node){if(node.tagName==='body')bodyEnd=node.sourceCodeLocation?.endTag?.startOffset??null;if(attr(node,'data-rt-scale-runtime')!==undefined)scripts.push(node);for(const child of node.childNodes||[])walk(child);}
  walk(tree);if(bodyEnd===null)throw Error('Responsive scaling needs an explicit HTML body end tag.');
  if(scripts.length>1||scripts.some(node=>node.tagName!=='script'||!node.sourceCodeLocation?.endTag||source.slice(node.sourceCodeLocation.startOffset,node.sourceCodeLocation.endOffset)!==runtime.script()))throw Error('The saved scale runtime changed outside the editor.');
  const out=new MagicString(source),set=(item,name,value)=>{const location=item.location.attrs?.[name],text=name+'="'+escape(value)+'"';if(location)out.overwrite(location.startOffset,location.endOffset,text);else out.appendLeft(item.location.startTag.startOffset+1+item.tag.length,' '+text);};
  set(group,'data-rt-scale',metadata);
  const members=elements.filter(item=>item!==group&&contains(group.node,item.node)),identities=new Set();
  if(!members.length)throw Error('Choose a group with source children.');
  for(const member of members){const id=attr(member.node,'data-rt-scale-member')??member.id;if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||identities.has(id))throw Error('Group members need distinct persistent identities.');identities.add(id);if(attr(member.node,'data-rt-scale-member')===undefined)set(member,'data-rt-scale-member',id);}
  if(!scripts.length)out.appendLeft(bodyEnd,runtime.script());
  const after=out.toString(),next=html.collect(after,relPath).elements;
  if(next.length!==elements.length||next.some((item,i)=>item.id!==elements[i].id||item.tag!==elements[i].tag))throw Error('Scaling changed source layer identity.');
  return {ok:true,hash:html.contentHash(after),edits:[{file:resolved.file,before:source,after}]};
 }catch(error){return {ok:false,refused:true,reason:error.message};}
}
module.exports={plan};
