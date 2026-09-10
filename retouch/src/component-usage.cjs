'use strict';
const fs=require('node:fs');
const path=require('node:path');
// Count authored call sites, not DOM instances (a loop is still one call site).
function catalogue(index) {
  if(index.componentUsage)return index.componentUsage;
  const entries=new Map(),counts=new Map();
  if(!index.adapter.describeComponent)return {entries,counts};
  for(const file of index.fileIds.keys()) {
    try {
      const source=fs.readFileSync(file,'utf8');
      const relPath=path.relative(index.appRoot,file).split(path.sep).join('/');
      const {elements,ast}=index.adapter.collect(source,relPath);
      for(const element of elements) {
        if(element.kind!=='instance')continue;
        const info=index.adapter.describeComponent({appRoot:index.appRoot,file,relPath,source,element,elements,hash:index.adapter.contentHash(source)});
        if(!info.ok || !info.definitionId)continue;
        const key=info.file+'#'+info.definitionId;
        entries.set(element.id,{layerName:index.adapter.name==='react'?require('./jsx-layer-name.cjs').describe({source,relPath,element,ast}).layerName:undefined,key,definitionId:info.definitionId,canDeleteComponent:info.canDelete===true,canDuplicateComponent:info.canDuplicate===true,componentDuplicateReason:info.duplicateReason,rootGroups:info.rootGroups,explicitComponent:info.explicitComponent===true,name:info.name,file:info.file,usageFile:relPath,line:element.node?.loc?.start?.line||null});
        counts.set(key,(counts.get(key)||0)+1);
      }
    } catch {}
  }
  return index.componentUsage={entries,counts};
}
function usage(index,id) {
  const {entries,counts}=catalogue(index),entry=entries.get(id);
  return entry?{usageCount:counts.get(entry.key),definitionId:entry.definitionId,canDeleteComponent:entry.canDeleteComponent,canDuplicateComponent:entry.canDuplicateComponent,componentDuplicateReason:entry.componentDuplicateReason,rootGroups:entry.rootGroups,inlineComponent:counts.get(entry.key)===1&&!entry.explicitComponent}:null;
}
function describe(index,resolved) {
  const info=index.adapter.describe(resolved);
  if(info.kind==='instance')Object.assign(info,usage(index,info.id));
  if(info.components)info.components=info.components.filter(c=>!usage(index,c.id)?.inlineComponent);
  return info;
}
function library(index){
 const {entries,counts}=catalogue(index),groups=new Map();
 for(const [id,entry] of entries){
  if(counts.get(entry.key)<2&&!entry.explicitComponent)continue;
  let group=groups.get(entry.key);if(!group){group={key:entry.key,definitionId:entry.definitionId,rootGroups:entry.rootGroups,file:entry.file,names:[],usages:[]};groups.set(entry.key,group);}
  if(!group.names.includes(entry.name))group.names.push(entry.name);
  group.usages.push({id,name:entry.name,layerName:entry.layerName,file:entry.usageFile,line:entry.line});
 }
 if(index.adapter.name==='react')for(const file of index.fileIds.keys()){
  try{
   const source=fs.readFileSync(file,'utf8'),rel=path.relative(index.appRoot,file).split(path.sep).join('/');
   for(const definition of require('./component-definitions.cjs').definitions(source,rel)){
    const key=rel+'#'+definition.definitionId,group=groups.get(key);
    if(group){for(const name of definition.names)if(!group.names.includes(name))group.names.push(name);continue;}
    const usages=[...entries].filter(([,entry])=>entry.key===key).map(([id,entry])=>({id,name:entry.name,layerName:entry.layerName,file:entry.usageFile,line:entry.line}));
    groups.set(key,{key,definitionId:definition.definitionId,rootGroups:[...entries.values()].find(entry=>entry.key===key)?.rootGroups,file:rel,names:[...new Set([...definition.names,...usages.map(usage=>usage.name)])],usages,...(!usages.length?{definitionOnly:true}:{})});
   }
  }catch{}
 }
 const components=[...groups.values()].map(group=>({...group,name:group.names.sort()[0],usageCount:group.usages.length,usages:group.usages.sort((a,b)=>a.file.localeCompare(b.file)||(a.line||0)-(b.line||0))})).sort((a,b)=>a.name.localeCompare(b.name)||a.file.localeCompare(b.file));
 return {components:components.slice(0,2000),total:components.length,truncated:components.length>2000,unreadableFiles:index.errors.size};
}
module.exports={usage,describe,library};
