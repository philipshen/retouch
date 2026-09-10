'use strict';
const {collectElements,contentHash}=require('./id.cjs'),traverse=require('@babel/traverse').default;
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason});
 if(op.fileHash!==resolved.hash)return refuse('The usage source changed. Re-select the component before deleting.');
 if(resolved.element.kind!=='instance')return refuse('Select a component usage to delete.');
 try{
  const {ast}=collectElements(resolved.source,resolved.relPath);let target;
  traverse(ast,{JSXElement(p){if(p.node.start===resolved.element.node.start){target=p;p.stop();}}});
  if(!target)throw Error('The component usage no longer resolves.');
  let parentId=null;for(let p=target.parentPath;p;p=p.parentPath){const host=resolved.elements.find(el=>el.kind==='host'&&el.node.start===p.node.start);if(host){parentId=host.id;break;}}
  // Keep a null child slot so unrelated structural source IDs do not shift.
  const child=['JSXElement','JSXFragment'].includes(target.parent.type)&&target.listKey==='children',replacement=child||target.parent.type==='JSXAttribute'?'{null}':'null';
  const after=resolved.source.slice(0,target.node.start)+replacement+resolved.source.slice(target.node.end);collectElements(after,resolved.relPath);
  return {ok:true,hash:contentHash(after),deletedComponent:{instanceId:resolved.element.id,parentId},edits:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
module.exports={plan};
