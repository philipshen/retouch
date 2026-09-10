'use strict';
const {collectElements,contentHash}=require('./id.cjs'),traverse=require('@babel/traverse').default,MagicString=require('magic-string');
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
  const ms=new MagicString(resolved.source);ms.overwrite(target.node.start,target.node.end,replacement);
  const cleanup=require('./component-import-cleanup.cjs')(ast,target,resolved.source,'',{preserveKey:false,appendSideEffect:true});
  if(cleanup){ms.overwrite(cleanup.start,cleanup.end,cleanup.after);if(cleanup.append)ms.append(cleanup.append);}
  const after=ms.toString(),remaining=collectElements(after,resolved.relPath).elements,ids=new Set(remaining.map(el=>el.id));
  if(resolved.elements.some(el=>!(el.node.start>=target.node.start&&el.node.end<=target.node.end)&&!ids.has(el.id)))throw Error('The deletion could not preserve unrelated source identities.');
  return {ok:true,hash:contentHash(after),deletedComponent:{instanceId:resolved.element.id,parentId},edits:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
module.exports={plan};
