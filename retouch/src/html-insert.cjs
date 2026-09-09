'use strict';
const MagicString=require('magic-string');
const containers=new Set(['body','div','main','section','article','aside','header','footer','nav','form','li','td','th','blockquote']);
const presets={text:'<p>New text</p>',frame:'<div aria-label="Frame" style="min-height:100px;padding:16px;border:1px dashed #999"></div>'};
function describe(resolved){
 const element=resolved.element;
 if(!containers.has(element.tag)||!element.location.endTag)return {canInsert:false,insertReason:'Select an explicitly closed content container to add a layer.'};
 for(let node=element.node;node;node=node.parentNode)if(node.attrs?.some(a=>/^(?:x-for|x-if|v-for|v-if)$/.test(a.name)))return {canInsert:false,insertReason:'This container is rendered by a template.'};
 return {canInsert:true,insertReason:null};
}
function plan(resolved,op){
 const html=require('./adapters/html.cjs'),refuse=reason=>({ok:false,refused:true,reason});
 if(op.fileHash&&op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the container.');
 const capability=describe(resolved);if(!capability.canInsert)return refuse(capability.insertReason);
 if(!Object.hasOwn(presets,op.preset))return refuse('Choose a text layer or frame.');
 const offset=resolved.element.location.endTag.startOffset,source=resolved.source;
 const indent=source.slice(0,resolved.element.location.startTag.startOffset).match(/(?:^|\n)([ \t]*)$/)?.[1]||'';
 const insertion='\n'+indent+'  '+presets[op.preset]+'\n'+indent;
 const out=new MagicString(source);out.appendLeft(offset,insertion);const after=out.toString();
 const before=resolved.elements||html.collect(source,resolved.relPath).elements,next=html.collect(after,resolved.relPath).elements;
 const parent=next.find(e=>e.id===resolved.element.id),created=next.find(e=>e.location.startOffset===offset+indent.length+3);
 if(next.length!==before.length+1||!created||created.node.parentNode!==parent?.node||before.some(e=>!next.some(n=>n.id===e.id&&n.tag===e.tag)))return refuse('The inserted layer would change the parsed HTML structure.');
 return {ok:true,hash:html.contentHash(after),parentId:parent.id,createdId:created.id,structural:true,edits:[{file:resolved.file,before:source,after}]};
}
module.exports={describe,plan};
