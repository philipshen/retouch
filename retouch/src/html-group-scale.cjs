'use strict';
const MagicString=require('magic-string'),parse5=require('parse5'),html=require('./adapters/html.cjs'),runtime=require('./group-scale-runtime.cjs'),{parse}=require('../runtime/group-scale-bootstrap.js');
const attr=(node,name)=>node.attrs?.find(item=>item.name===name)?.value;
const contains=(parent,node)=>{for(let current=node;current;current=current.parentNode)if(current===parent)return true;return false;};
const escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
function independentStyles(resolved,elements,group){
 const snapshot=Object.create(null),css=require('./html-css.cjs'),keys=['--rt-scale-factor','--rt-scale-move-x','--rt-scale-move-y'];
 for(const item of elements.filter(item=>item!==group&&contains(group.node,item.node))){
  const id=attr(item.node,'data-rt-scale-member');if(!id)continue;
  if(/--rt-scale-(?:factor|move-[xy])\s*:/.test(attr(item.node,'style')||''))throw Error('Resolve inline independent transforms before composing the group.');
  const state=css.describe({...resolved,elements,element:item});if(state.cssReason)throw Error(state.cssReason);const values={};
  for(const [width,rules]of Object.entries(state.cssRules||{}).sort(([a],[b])=>Number(a)-Number(b))){
   if(!keys.some(key=>Object.hasOwn(rules,key)))continue;for(const key of keys)if(Object.hasOwn(rules,key))values[key]=rules[key];
   const factor=Number(values[keys[0]]??1),move=keys.slice(1).map(key=>{const value=String(values[key]??'0px').trim();if(!/^[-+]?(?:\d*\.)?\d+px$/.test(value))throw Error('Resolve literal independent movement before composing the group.');return parseFloat(value);});
   if(!Number.isFinite(factor)||factor<.01||factor>100||move.some(n=>!Number.isFinite(n)||Math.abs(n)>100000))throw Error('Resolve bounded independent transforms before composing the group.');
   snapshot[id]??=Object.create(null);snapshot[id][width]={factor,move};
  }
 }
 return snapshot;
}
function plan(resolved,op){
 try{
  if(op.fileHash!==resolved.hash)throw Error('The file changed. Re-select the group.');
  if(!Number.isInteger(op.width)||op.width<0||op.width>7680||typeof op.factor!=='number'||!Number.isFinite(op.factor)||op.factor<.01||op.factor>100)throw Error('Choose a valid screen width and scale factor.');
  const originalSource=resolved.source;resolved={...resolved,source:runtime.upgrade(originalSource)};
  const {element,source,relPath}=resolved,elements=html.collect(source,relPath).elements,group=elements.find(item=>item.id===element.id);
  if(!group||group.node.namespaceURI!=='http://www.w3.org/1999/xhtml'||attr(group.node,'data-rt-group')===undefined)throw Error('Choose a source-backed group.');
  const groups=elements.filter(item=>attr(item.node,'data-rt-scale')!==undefined);
  if(groups.some(other=>other.id!==group.id&&(contains(other.node,group.node)||contains(group.node,other.node))))throw Error('Overlapping responsive scale groups are not supported yet.');
  let root=group.node;while(root.parentNode)root=root.parentNode;
  function checkReleased(node){
   if(attr(node,'data-rt-scale-set')!==undefined){
    if(node.tagName!=='script'||attr(node,'type')!=='application/json')throw Error('Invalid released scale metadata.');
    const ids=require('../runtime/group-scale-bootstrap.js').members((node.childNodes||[]).map(child=>child.value||'').join(''));
    if(elements.some(item=>ids.includes(attr(item.node,'data-rt-scale-member'))&&(contains(item.node,group.node)||contains(group.node,item.node))))throw Error('Overlapping responsive scale groups are not supported yet.');
   }
   for(const child of node.childNodes||[])checkReleased(child);
  }
  checkReleased(root);
  const shift=op.offset??[0,0],move=op.move??[0,0];if([shift,move].some(pair=>!Array.isArray(pair)||pair.length!==2||pair.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>10000)))throw Error('Choose finite group offsets.');
  if(source===originalSource&&op.factor===1&&[...shift,...move].every(n=>n===0))return {ok:true,hash:resolved.hash,edits:[]};
  const stored=attr(group.node,'data-rt-scale'),metadata=require('./group-scale-metadata.cjs').compose(stored===undefined?null:JSON.parse(stored),op,()=>independentStyles({...resolved,source},elements,group));

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
  return {ok:true,hash:html.contentHash(after),edits:[{file:resolved.file,before:originalSource,after}]};
 }catch(error){return {ok:false,refused:true,reason:error.message};}
}
function describe(resolved){
 const elements=html.collect(resolved.source,resolved.relPath).elements,group=elements.find(item=>item.id===resolved.element.id);if(!group||attr(group.node,'data-rt-group')===undefined)return {};
 const members=elements.filter(item=>item.id!==group.id&&contains(group.node,item.node));
 return {groupScale:{runtimeRevision:runtime.revision(),metadata:attr(group.node,'data-rt-scale')??null,members:Object.fromEntries(members.map(item=>[item.id,attr(item.node,'data-rt-scale-member')??null]))}};
}
function release(resolved){
 const metadata=attr(resolved.element.node,'data-rt-scale');if(metadata===undefined)return null;parse(metadata);
 const elements=html.collect(resolved.source,resolved.relPath).elements,group=elements.find(item=>item.id===resolved.element.id),children=elements.filter(item=>item.node.parentNode===group.node),ids=children.map(item=>attr(item.node,'data-rt-scale-member'));
 require('../runtime/group-scale-bootstrap.js').members(JSON.stringify(ids));
 const tree=parse5.parse(resolved.source,{sourceCodeLocationInfo:true}),scripts=[];let end=null;
 function walk(node){if(node.tagName==='body')end=node.sourceCodeLocation?.endTag?.startOffset??null;if(attr(node,'data-rt-scale-runtime')!==undefined)scripts.push(node);for(const child of node.childNodes||[])walk(child);}
 walk(tree);if(end===null||scripts.length!==1||!scripts[0].sourceCodeLocation?.endTag||resolved.source.slice(scripts[0].sourceCodeLocation.startOffset,scripts[0].sourceCodeLocation.endOffset)!==runtime.script())throw Error('The saved scale runtime changed outside the editor.');
 const id=html.contentHash(resolved.source+'|released-scale|'+resolved.element.id).slice(0,10);
 return {at:end,text:'<script type="application/json" data-rt-scale-set="'+id+'" data-rt-scale="'+escape(metadata)+'">'+JSON.stringify(ids)+'</script>'};
}
function reclaim(resolved,roots){
 const ids=roots.map(item=>attr(item.node,'data-rt-scale-member'));if(ids.some(id=>id===undefined))return null;
 const validate=require('../runtime/group-scale-bootstrap.js').members;validate(JSON.stringify(ids));
 const tree=parse5.parse(resolved.source,{sourceCodeLocationInfo:true}),sets=[],runtimes=[];
 function walk(node){
  if(attr(node,'data-rt-scale-runtime')!==undefined)runtimes.push(node);
  if(attr(node,'data-rt-scale-set')!==undefined){
   if(node.tagName!=='script'||attr(node,'type')!=='application/json'||!node.sourceCodeLocation?.endTag)throw Error('Invalid released scale metadata.');
   const members=validate((node.childNodes||[]).map(child=>child.value||'').join(''));
   if(members.length===ids.length&&members.every(id=>ids.includes(id))){const metadata=attr(node,'data-rt-scale');parse(metadata);sets.push({metadata,node});}
  }
  for(const child of node.childNodes||[])walk(child);
 }
 walk(tree);if(!sets.length)return null;if(sets.length!==1)throw Error('Released scale members have multiple owners.');
 const elements=resolved.elements||html.collect(resolved.source,resolved.relPath).elements;if(ids.some(id=>elements.filter(item=>attr(item.node,'data-rt-scale-member')===id).length!==1))throw Error('Released scale members need distinct persistent identities.');
 if(runtimes.length!==1)throw Error('The saved scale runtime changed outside the editor.');runtime.upgrade(resolved.source);
 const {metadata,node}=sets[0];return {attribute:'data-rt-scale="'+escape(metadata)+'"',start:node.sourceCodeLocation.startOffset,end:node.sourceCodeLocation.endOffset};
}
module.exports={plan,describe,release,reclaim};
