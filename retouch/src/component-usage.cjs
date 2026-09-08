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
      const {elements}=index.adapter.collect(source,relPath);
      for(const element of elements) {
        if(element.kind!=='instance')continue;
        const info=index.adapter.describeComponent({appRoot:index.appRoot,file,relPath,source,element,elements,hash:index.adapter.contentHash(source)});
        if(!info.ok || !info.definitionId)continue;
        const key=info.file+'#'+info.definitionId;
        entries.set(element.id,{key,definitionId:info.definitionId});
        counts.set(key,(counts.get(key)||0)+1);
      }
    } catch {}
  }
  return index.componentUsage={entries,counts};
}
function usage(index,id) {
  const {entries,counts}=catalogue(index),entry=entries.get(id);
  return entry?{usageCount:counts.get(entry.key),definitionId:entry.definitionId,inlineComponent:counts.get(entry.key)===1}:null;
}
function describe(index,resolved) {
  const info=index.adapter.describe(resolved);
  if(info.kind==='instance')Object.assign(info,usage(index,info.id));
  if(info.components)info.components=info.components.filter(c=>!usage(index,c.id)?.inlineComponent);
  return info;
}
module.exports={usage,describe};
