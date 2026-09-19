'use strict';
const MagicString=require('magic-string'),responsive=require('./html-responsive-image.cjs'),{parse}=require('./capture-srcset.cjs');
const attr=(node,name)=>node.attrs?.find(item=>item.name===name)?.value??null;
const escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
function sourceMarkup(op){
 responsive.imageURL(op.src);const descriptor=op.descriptor||'1x',parsed=typeof descriptor==='string'&&parse('candidate '+descriptor);
 if(!parsed||parsed.length!==1||parsed[0].descriptors.length!==1||!/[wx]$/.test(descriptor)||descriptor.length>64)throw Error('Choose one valid width or pixel-density descriptor.');
 const attrs=[['style','display: none'],['srcset',op.src+' '+descriptor]];
 for(const name of ['media','type','sizes']){const value=op[name==='type'?'sourceType':name];if(value===undefined||value===null||value==='')continue;if(typeof value!=='string'||value.length>4096||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))throw Error('Use source settings of at most 4,096 characters without control characters.');attrs.push([name,value]);}
 return '<source '+attrs.map(([name,value])=>name+'="'+escape(value)+'"').join(' ')+'>';
}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason});
 try{
  if(!op.fileHash||op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the image.');
  if(!['add','remove','move'].includes(op.action))return refuse('Choose add, remove or move source.');
  const html=require('./adapters/html.cjs'),elements=resolved.elements||html.collect(resolved.source,resolved.relPath).elements,state=responsive.inspect({...resolved,elements});
  if(!state)return refuse('Choose an HTML image.');
  const image=resolved.element,picture=state.picture?image.node.parentNode:null,sources=state.nodes.slice(1),pictureElement=picture?elements.find(element=>element.node===picture):null;
  if(picture&&(!pictureElement||!pictureElement.location.endTag))return refuse('Choose a complete, unambiguous picture element.');
  for(let node=image.node.parentNode;node;node=node.parentNode){if(node!==picture&&node.tagName==='picture')return refuse('Nested picture markup is ambiguous.');if(node.attrs?.some(attr=>/^(?:x-for|x-if|v-for|v-if)$/.test(attr.name)))return refuse('This image is rendered by a template.');}
  if(op.action!=='add'&&(!Number.isInteger(op.sourceIndex)||!sources[op.sourceIndex]))return refuse('Choose an available picture source.');
  const removed=new Set(),changes=[];let wrapperStart=null,wrapperAdded=false,unwrap=false,sourceIndex=null,moved=null;
  const insert=(at,text)=>changes.push({start:at,end:at,text});
  const remove=node=>{removed.add(node);changes.push({start:node.sourceCodeLocation.startOffset,end:node.sourceCodeLocation.endOffset,text:''});};
  if(op.action==='add'){
   if(state.candidates.length>=256||sources.length>=255)return refuse('This image has too many responsive sources or candidates.');
   const markup=sourceMarkup(op);sourceIndex=op.index??0;
   if(!Number.isInteger(sourceIndex)||sourceIndex<0||sourceIndex>sources.length)return refuse('Choose a source position within this picture.');
   if(picture)insert(sources[sourceIndex]?.sourceCodeLocation.startOffset??image.location.startOffset,markup);
   else{wrapperAdded=true;wrapperStart=image.location.startOffset;insert(wrapperStart,'<picture data-rt-picture="" style="display: contents">'+markup);insert(image.location.endOffset,'</picture>');}
  }else if(op.action==='remove'){
   remove(sources[op.sourceIndex]);
   const children=picture.childNodes.filter(node=>node.nodeName!=='#text'||node.value.trim());
   unwrap=sources.length===1&&picture.attrs.length===2&&attr(picture,'data-rt-picture')===''&&attr(picture,'style')==='display: contents'&&children.length===2&&children.includes(image.node)&&children.includes(sources[0]);
   if(unwrap){removed.add(picture);changes.push({start:pictureElement.location.startOffset,end:pictureElement.location.startTag.endOffset,text:''},{start:pictureElement.location.endTag.startOffset,end:pictureElement.location.endOffset,text:''});}
  }else{
   sourceIndex=op.destinationIndex;
   if(!Number.isInteger(sourceIndex)||sourceIndex<0||sourceIndex>=sources.length)return refuse('Choose a source position within this picture.');
   if(sourceIndex===op.sourceIndex)return {ok:true,hash:resolved.hash,edits:[],imageId:image.id,sourceIndex};
   const node=sources[op.sourceIndex],start=node.sourceCodeLocation.startOffset,end=node.sourceCodeLocation.endOffset,at=sourceIndex<op.sourceIndex?sources[sourceIndex].sourceCodeLocation.startOffset:sources[sourceIndex+1]?.sourceCodeLocation.startOffset??image.location.startOffset;
   changes.push({start,end,text:''});insert(at,resolved.source.slice(start,end));moved={node,at};
  }
  const out=new MagicString(resolved.source);for(const change of changes)if(change.start===change.end)out.appendLeft(change.start,change.text);else out.overwrite(change.start,change.end,change.text);
  let after=out.toString();const next=html.collect(after,resolved.relPath).elements;
  const delta=op.action==='add'?(wrapperAdded?2:1):op.action==='remove'?(unwrap?-2:-1):0;
  if(next.length!==elements.length+delta)return refuse('The source edit changes unrelated parsed markup.');
  const shifted=offset=>offset+changes.reduce((sum,change)=>sum+(offset>=change.end?change.text.length-(change.end-change.start):0),0);
  const movedOffset=moved?moved.at+changes.reduce((sum,change)=>sum+(change.start!==change.end&&change.end<=moved.at?change.text.length-(change.end-change.start):0),0):null;
  const mapped=new Map(),byOffset=new Map(next.map(element=>[element.location.startOffset,element]));
  for(const element of elements){if(removed.has(element.node))continue;const offset=element.node===moved?.node?movedOffset:shifted(element.location.startOffset),match=byOffset.get(offset);if(!match||match.tag!==element.tag)return refuse('An existing layer lost its source identity.');mapped.set(element.node,match);}
  const wrapper=wrapperAdded?next.find(element=>element.tag==='picture'&&element.location.startOffset===wrapperStart):null;
  if(wrapperAdded&&!wrapper)return refuse('The image could not be wrapped in a picture.');
  for(const element of elements){if(removed.has(element.node))continue;const current=mapped.get(element.node),expected=element===image&&wrapperAdded?wrapper:element===image&&unwrap?mapped.get(picture.parentNode):mapped.get(element.node.parentNode);
   if(expected?current.node.parentNode!==expected.node:current.node.parentNode?.tagName!==(element===image&&unwrap?picture.parentNode:element.node.parentNode)?.tagName)return refuse('The source edit moves an unrelated layer.');
  }
  const selected=mapped.get(image.node),root=wrapperAdded||unwrap?(picture?.parentNode||image.node.parentNode):picture,rootElement=elements.find(element=>element.node===root);
  if(!rootElement&&root?.tagName!=='body')return refuse('The image has no stable preview container.');
  if(wrapperAdded){const parent=mapped.get(image.node.parentNode);if(parent?wrapper.node.parentNode!==parent.node:wrapper.node.parentNode?.tagName!==image.node.parentNode?.tagName)return refuse('The new picture changed its source parent.');}
  const descriptor=responsive.describe({...resolved,source:after,elements:next,element:selected,hash:html.contentHash(after)});
  if(descriptor?.reason||!descriptor)return refuse(descriptor?.reason||'The picture source no longer resolves.');
  if(op.action==='add'&&descriptor.sources.length!==state.sources.length+1)return refuse('The added source is not part of the selected image.');
  const survivors=new Set(mapped.values());
  const styles=wrapperAdded?require('./picture-style-plan.cjs').plan(resolved,{source:after}):null;
  if(styles){after=styles.source;const styled=html.collect(after,resolved.relPath).elements;if(styled.length!==next.length||styled.some((element,index)=>element.id!==next[index].id||element.tag!==next[index].tag))return refuse('Stylesheet adaptation changed unrelated markup.');}
  return {ok:true,hash:html.contentHash(after),imageId:selected.id,imageBeforeId:image.id,sourceIndex,scope:{id:rootElement?.id||null,tag:root.tagName},authorStyles:!!styles?.inlineRefresh,revalidateStyles:!!(styles?.linksChanged||styles?.edits.slice(1).some(edit=>edit.before!==edit.after)),sourceIdMap:elements.filter(element=>!removed.has(element.node)).flatMap(element=>{const id=mapped.get(element.node).id;return id===element.id?[]:[[element.id,id]];}),removedSourceIds:elements.filter(element=>removed.has(element.node)).map(element=>element.id),createdSourceIds:next.filter(element=>!survivors.has(element)).map(element=>element.id),structural:true,edits:styles?.edits||[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
module.exports={plan};
