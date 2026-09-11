'use strict';
const traverse=require('@babel/traverse').default,MagicString=require('magic-string');
const {parseSource,collectElements,contentHash}=require('./id.cjs');
const refuse=reason=>({ok:false,refused:true,reason});
function dependencyAudit(resolved){
 const dependencies=new Map(),checks=new Map();let invalid=null;
 const audit={
  path(file){try{const check=require('./source-path-checks.cjs').snapshot(resolved.appRoot,file),prior=checks.get(file);if(prior&&JSON.stringify(prior)!==JSON.stringify(check))throw Error('Component resolution changed during planning.');checks.set(file,check);if(checks.size>1000)throw Error('The component resolution is too large to duplicate safely.');}catch(error){invalid=error;throw error;}},
  read(file,source){const key=checks.get(file)?.realPath||file;if(key===resolved.file)return;const prior=dependencies.get(key);if(prior!==undefined&&prior!==source){invalid=Error('A component dependency changed during planning.');throw invalid;}dependencies.set(key,source);},
 };
 return {audit,finish(){if(invalid)throw invalid;return {edits:[...dependencies].map(([file,before])=>({file,before,after:before})),pathChecks:[...checks.values()]};}};
}
function context(resolved,audit){
 if(resolved.element.kind!=='instance')throw Error('Select a component instance to duplicate.');
 let target;traverse(parseSource(resolved.source),{JSXElement(p){if(p.node.start===resolved.element.node.start){target=p;p.stop();}}});
 if(!target)throw Error('The component usage no longer resolves.');
 const wrapped=!['JSXElement','JSXFragment'].includes(target.parent.type)||target.listKey!=='children';
 let unsafe=false;target.traverse({JSXSpreadAttribute(){unsafe=true;},JSXAttribute(p){if(['id','ref'].includes(p.node.name?.name))unsafe=true;}});
 if(unsafe)throw Error('This usage contains an id, ref, or spread attribute. Give the copy an explicit independent identity before duplicating.');
 const definition=require('./components.cjs').definition(resolved,audit);let fixedId=false;
 traverse(definition.fn,{noScope:true,JSXAttribute(p){if(p.node.name?.name==='id'&&p.node.value?.type==='StringLiteral')fixedId=true;}});
 if(fixedId)throw Error('This definition contains a fixed DOM id. Make that identity instance-specific before duplicating.');
 const keys=target.node.openingElement.attributes.filter(a=>a.name?.name==='key');if(keys.length>1)throw Error('Resolve duplicate key attributes before duplicating.');
 let parentId=null;for(let p=target.parentPath;p;p=p.parentPath){const host=resolved.elements?.find(e=>e.kind==='host'&&e.node.start===p.node.start);if(host){parentId=host.id;break;}}
 return {target:target.node,key:keys[0],parentId,wrapped};
}
function describe(resolved){try{return {ok:true,parentId:context(resolved).parentId};}catch(error){return refuse(error.message);}}
function plan(resolved,op){
 if(op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the instance before duplicating.');
 try{
  const dependencies=dependencyAudit(resolved),{target,key,parentId,wrapped}=context(resolved,dependencies.audit),chunk=new MagicString(resolved.source.slice(target.start,target.end));
  if(key){let value='retouch-copy-'+contentHash(resolved.source+'|'+resolved.element.id).slice(0,12);while(resolved.source.includes(value))value+='x';chunk.overwrite(key.start-target.start,key.end-target.start,'key='+JSON.stringify(value));}
  const copy=chunk.toString(),gap='\n'+(resolved.source.slice(0,target.start).match(/(?:^|\n)([ \t]*)$/)?.[1]||'');
  let original=resolved.source.slice(target.start,target.end),open='<>',close='</>',importText='';
  if(wrapped&&key){
   let name='RetouchFragment',suffix=0;while(resolved.source.includes(name))name='RetouchFragment'+(++suffix);
   open='<'+name+' '+resolved.source.slice(key.start,key.end)+'>';close='</'+name+'>';
   original=original.slice(0,key.start-target.start)+original.slice(key.end-target.start);
   importText='\nimport { Fragment as '+name+' } from "react";\n';
  }
  const insert=wrapped?target.start+open.length+original.length+gap.length:target.end+gap.length;
  const after=(wrapped?resolved.source.slice(0,target.start)+open+original+gap+copy+close+resolved.source.slice(target.end):resolved.source.slice(0,target.end)+gap+copy+resolved.source.slice(target.end))+importText;
  const elements=collectElements(after,resolved.relPath).elements,duplicate=elements.find(e=>e.kind==='instance'&&e.node.start===insert);
  const retained=elements.find(e=>e.kind==='instance'&&e.node.start===target.start+(wrapped?open.length:0));
  if(!duplicate||!retained)throw Error('The copied usage could not be mapped back to source.');
  const originalElements=resolved.elements||collectElements(resolved.source,resolved.relPath).elements,delta=after.length-resolved.source.length-importText.length,sourceIdMap=[],mapped=new Set();
  for(const element of originalElements){const before=element.node.start,inside=before>=target.start&&before<target.end,offset=inside?before+(wrapped?open.length:0)-(wrapped&&key&&before>=key.end?key.end-key.start:0):before+(before>=target.end?delta:0),next=elements.find(item=>item.kind===element.kind&&item.node.start===offset);if(!next||mapped.has(next.id))throw Error('An original layer lost its source identity during duplication.');mapped.add(next.id);if(next.id!==element.id)sourceIdMap.push([element.id,next.id]);}
  const guarded=dependencies.finish();
  return {ok:true,hash:contentHash(after),pathChecks:guarded.pathChecks,duplicatedComponent:{instanceId:duplicate.id,originalId:resolved.element.id,retainedInstanceId:retained.id,sourceIdMap,parentId,wrapped},edits:[{file:resolved.file,before:resolved.source,after},...guarded.edits]};
 }catch(error){return refuse(error.message);}
}
function planSelection(resolved,op){
 try{
  if(op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the components.');
  const ids=op.ids;
  if(!Array.isArray(ids)||ids.length<2||ids.length>100||new Set(ids).size!==ids.length||!ids.includes(resolved.element.id)||ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{10}$/.test(id)))return refuse('Choose 2 to 100 distinct component usages from one source file.');
  const original=collectElements(resolved.source,resolved.relPath).elements,members=ids.map(id=>original.find(element=>element.id===id));
  if(members.some(element=>element?.kind!=='instance'))return refuse('Select component usages from the same source file.');
  // A selected parent already includes its selected descendants in its copy.
  const roots=members.filter(element=>!members.some(parent=>parent!==element&&parent.node.start<element.node.start&&parent.node.end>element.node.end));
  const dependencies=dependencyAudit(resolved);
  for(const element of roots)context({...resolved,elements:original,element},dependencies.audit);
  const guarded=dependencies.finish();
  let source=resolved.source,elements=original;const identities=new Map(original.map(element=>[element.id,element.id])),copies=[];
  for(const root of [...roots].sort((a,b)=>b.node.start-a.node.start)){
   const id=identities.get(root.id),element=elements.find(item=>item.id===id);
   if(!element)return refuse('A selected component lost its identity.');
   const current={...resolved,source,hash:contentHash(source),elements,element};
   const result=plan(current,{type:'duplicateComponent',id,fileHash:current.hash});if(!result.ok)return result;
   const mapping=new Map(result.duplicatedComponent.sourceIdMap),remap=id=>mapping.get(id)||id;
   for(const [before,now]of identities)identities.set(before,remap(now));
   for(const copy of copies)copy.instanceId=remap(copy.instanceId);
   copies.push({originalId:root.id,instanceId:result.duplicatedComponent.instanceId});
   source=result.edits[0].after;elements=collectElements(source,resolved.relPath).elements;
  }
  copies.sort((a,b)=>elements.find(item=>item.id===a.instanceId).node.start-elements.find(item=>item.id===b.instanceId).node.start);
  const sourceIdMap=[...identities].filter(([before,after])=>before!==after),selectionIds=copies.map(copy=>copy.instanceId);
  if(new Set(selectionIds).size!==roots.length||selectionIds.some(id=>!elements.some(element=>element.id===id&&element.kind==='instance')))return refuse('The copied components could not be mapped back to source.');
  return {ok:true,hash:contentHash(source),pathChecks:guarded.pathChecks,selectionIds,sourceIdMap,copiedComponents:copies,rootCount:roots.length,edits:[{file:resolved.file,before:resolved.source,after:source},...guarded.edits]};
 }catch(error){return refuse(error.message);}
}
module.exports={describe,plan,planSelection};
