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
  const cleanup=require('./component-import-cleanup.cjs'),references=new Map();
  // Babel's binding list can omit TypeScript annotation references. Merge a
  // scoped identifier traversal before deciding that an import became unused.
  traverse(ast,{ReferencedIdentifier(p){const spec=p.scope.getBinding(p.node.name)?.path.node;if(spec&&['ImportSpecifier','ImportDefaultSpecifier','ImportNamespaceSpecifier'].includes(spec.type)){if(!references.has(spec))references.set(spec,[]);references.get(spec).push(p);}}});
  for(const statement of target.findParent(p=>p.isProgram()).get('body')){
   if(!statement.isImportDeclaration())continue;const removed=new Set();
   for(const spec of statement.node.specifiers){
    const binding=statement.scope.getBinding(spec.local.name);
    const refs=[...(binding?.referencePaths||[]),...(references.get(spec)||[])];
    if(binding?.path.node===spec&&!binding.constantViolations.length&&refs.length&&refs.every(ref=>ref.node.start>=target.node.start&&ref.node.end<=target.node.end))removed.add(spec);
   }
   if(!removed.size)continue;const edit=cleanup.removeBindings(ast,statement.node,removed,resolved.source,{appendSideEffect:true});ms.overwrite(edit.start,edit.end,edit.after);if(edit.append)ms.append(edit.append);
  }
  const after=ms.toString(),remaining=collectElements(after,resolved.relPath).elements,ids=new Set(remaining.map(el=>el.id));
  if(resolved.elements.some(el=>!(el.node.start>=target.node.start&&el.node.end<=target.node.end)&&!ids.has(el.id)))throw Error('The deletion could not preserve unrelated source identities.');
  return {ok:true,hash:contentHash(after),deletedComponent:{instanceId:resolved.element.id,parentId,removedSourceIds:resolved.elements.filter(el=>el.node.start>=target.node.start&&el.node.end<=target.node.end).map(el=>el.id)},edits:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
function planSelection(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason});
 try{
  if(op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the components.');
  const ids=op.ids;
  if(!Array.isArray(ids)||ids.length<2||ids.length>100||new Set(ids).size!==ids.length||!ids.includes(resolved.element.id)||ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{10}$/.test(id)))return refuse('Choose 2 to 100 distinct component usages from one source file.');
  const original=collectElements(resolved.source,resolved.relPath).elements,members=ids.map(id=>original.find(element=>element.id===id));
  if(members.some(element=>element?.kind!=='instance'))return refuse('Select component usages from the same source file.');
  const roots=members.filter(element=>!members.some(parent=>parent!==element&&parent.node.start<element.node.start&&parent.node.end>element.node.end));
  let source=resolved.source,elements=original;const removed=new Set(),parents=new Set();
  for(const root of [...roots].sort((a,b)=>b.node.start-a.node.start)){
   const element=elements.find(item=>item.id===root.id);if(!element)return refuse('A selected component lost its source identity.');
   const current={...resolved,source,elements,element,hash:contentHash(source)},result=plan(current,{type:'deleteComponent',id:element.id,fileHash:current.hash});if(!result.ok)return result;
   for(const id of result.deletedComponent.removedSourceIds)removed.add(id);parents.add(result.deletedComponent.parentId);
   source=result.edits[0].after;elements=collectElements(source,resolved.relPath).elements;
  }
  if(original.some(element=>!removed.has(element.id)&&!elements.some(item=>item.id===element.id&&item.kind===element.kind)))return refuse('The deletion could not preserve unrelated source identities.');
  return {ok:true,hash:contentHash(source),removedSourceIds:[...removed],deletedComponentIds:roots.map(element=>element.id),parentId:parents.size===1?[...parents][0]:null,rootCount:roots.length,edits:[{file:resolved.file,before:resolved.source,after:source}]};
 }catch(error){return refuse(error.message);}
}
module.exports={plan,planSelection};
