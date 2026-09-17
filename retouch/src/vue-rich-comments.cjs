'use strict';
const {NodeTypes}=require('@vue/compiler-dom');
const {parseFragment}=require('parse5');

// Source comments remain opaque tokens, even when the compiler emits no DOM
// node for them. Multiple dynamic values merged across comments share one token:
// their individual rendered boundaries cannot be inferred from a string.
function project(data,sourceRoot,renderedRoot,options,groups){
 const offset=sourceRoot.loc.start.offset;
 const entries=data.expressions.map(entry=>({...entry,start:entry.start+offset,end:entry.end+offset,id:data.tokenIds.get(entry.marker)}));
 if(entries.some(entry=>!entry.id))throw Error('A preserved Vue value could not be mapped.');
 const token=entry=>({t:'token',id:entry.id,...(entry.empty?{empty:true}:{})});
 function textParts(raw,rendered){
  const start=raw[0].loc.start.offset,end=raw.at(-1).loc.end.offset;
  const owned=entries.filter(entry=>entry.start>=start&&entry.end<=end),events=[],emitted=new Set();
  for(const entry of owned.filter(entry=>!entry.empty)){events.push({start:entry.start,parts:[token(entry)]});emitted.add(entry.id);}
  for(const node of rendered){
   if(owned.some(entry=>!entry.empty&&node.loc.start.offset>=entry.start&&node.loc.end.offset<=entry.end))continue;
   if(node.type!==NodeTypes.TEXT)throw Error('The rendered Vue expression has no preserved source.');
   const parsed=parseFragment(node.loc.source,{sourceCodeLocationInfo:true}).childNodes;
   const parts=[];let previousSpace=false;
   for(const child of parsed){
    const at=node.loc.start.offset+child.sourceCodeLocation.startOffset;
    if(child.nodeName==='#comment'){
     const entry=owned.find(entry=>entry.empty&&entry.start===at);
     if(!entry)throw Error('A stripped Vue comment could not be mapped.');
     parts.push(token(entry));emitted.add(entry.id);continue;
    }
    if(child.nodeName!=='#text')throw Error('The renderer changed a literal Vue text region.');
    // HTML parsing normalizes literal CRLF, whereas Vue can retain it in
    // preserve mode. Decode entities without losing the original CR bytes.
    const rawText=node.loc.source.slice(child.sourceCodeLocation.startOffset,child.sourceCodeLocation.endOffset);
    const decoded=rawText.includes('\r')?parseFragment(rawText.replace(/\r/g,'&#13;')).childNodes.map(item=>{if(item.nodeName!=='#text')throw Error('The literal Vue text changed shape.');return item.value;}).join(''):child.value;
    let value='';
    for(const character of decoded){
     const space=/[\t\r\n\f ]/.test(character);
     if(options.whitespace==='preserve'||!space||!previousSpace)value+=options.whitespace==='preserve'||!space?character:' ';
     previousSpace=space;
    }
    if(value)parts.push({t:'text',value});
   }
   if(parts.filter(part=>part.t==='text').map(part=>part.value).join('')!==node.content)throw Error('The Vue compiler changed literal text in an unsupported way.');
   events.push({start:node.loc.start.offset,parts});
  }
  for(const entry of owned)if(!emitted.has(entry.id)){
   if(!entry.empty)throw Error('A live Vue value disappeared from the rendered text.');
   events.push({start:entry.start,parts:[token(entry)]});
  }
  return events.sort((a,b)=>a.start-b.start).flatMap(event=>event.parts);
 }
 function walk(items,raw,nodes){
  const originals=groups(raw,true),rendered=groups(nodes),used=new Set(),result=[];
  originals.forEach((group,index)=>{
   const start=group.nodes[0].loc.start.offset,end=group.nodes.at(-1).loc.end.offset;
   const match=rendered.find(item=>item.text===group.text&&item.nodes.some(node=>node.loc.start.offset<end&&node.loc.end.offset>start));
   if(match){if(used.has(match))throw Error('The rendered Vue text has ambiguous source ownership.');used.add(match);}
   if(!group.text){
    if(!match||!items[index])throw Error('The rendered Vue element could not be matched.');
    result.push({...items[index],children:walk(items[index].children,group.nodes[0].children,match.nodes[0].children)});
   }else{
    const parts=textParts(group.nodes,match?.nodes||[]);
    if(parts.length)result.push({t:'text',parts,value:parts.filter(part=>part.t==='text').map(part=>part.value).join('')});
   }
  });
  if(used.size!==rendered.length)throw Error('The rendered Vue text contains unmapped nodes.');
  return result;
 }
 return {children:walk(data.descriptor.children,sourceRoot.children,renderedRoot.children)};
}
module.exports={project};
