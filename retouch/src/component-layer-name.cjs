'use strict';
const {collectElements,contentHash}=require('./id.cjs');
const marker='@retouch-layer ';
function comment(name){return name?' /* '+marker+JSON.stringify(name).replace(/\*/g,'\\u002a')+' */':'';}
function metadata(resolved){
 const opening=resolved.element.node.openingElement,start=(opening.typeParameters||opening.typeArguments||opening.name).end,end=opening.attributes[0]?.start??opening.end;
 const {ast}=collectElements(resolved.source,resolved.relPath);
 const comments=(ast.comments||[]).filter(c=>c.type==='CommentBlock'&&c.start>=start&&c.end<=end&&c.value.trim().startsWith(marker));
 let name='';if(comments.length===1)try{const value=JSON.parse(comments[0].value.trim().slice(marker.length));if(typeof value==='string')name=value;}catch{}
 return {start,comments,name};
}
function describe(resolved){return resolved.element.kind==='instance'?{canRename:true,layerName:metadata(resolved).name}:{};}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason});
 if(op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the component before naming it.');
 if(resolved.element.kind!=='instance')return refuse('Select a component instance to name.');
 if(typeof op.name!=='string'||op.name.length>200||/[\u0000-\u001f\u007f]/.test(op.name))return refuse('Use a name of up to 200 characters without control characters.');
 try{
  const {start,comments}=metadata(resolved),name=op.name.trim(),MagicString=require('magic-string'),ms=new MagicString(resolved.source);
  // Opening-tag comments carry editor metadata without adding runtime props.
  for(const comment of comments)ms.remove(comment.start,comment.end);
  if(name)ms.appendLeft(start,comment(name));
  const after=ms.toString(),ids=collectElements(after,resolved.relPath).elements.map(el=>el.id);
  if(JSON.stringify(ids)!==JSON.stringify(resolved.elements.map(el=>el.id)))throw Error('Naming changed source identities.');
  return {ok:true,hash:contentHash(after),edits:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
module.exports={describe,plan,comment};
