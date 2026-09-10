'use strict';
const traverse=require('@babel/traverse').default,MagicString=require('magic-string');
const {parseSource,collectElements,contentHash}=require('./id.cjs');
const refuse=reason=>({ok:false,refused:true,reason});
function context(resolved){
 if(resolved.element.kind!=='instance')throw Error('Select a component instance to duplicate.');
 let target;traverse(parseSource(resolved.source),{JSXElement(p){if(p.node.start===resolved.element.node.start){target=p;p.stop();}}});
 if(!target||!['JSXElement','JSXFragment'].includes(target.parent.type)||target.listKey!=='children')throw Error('Duplicate an instance inside JSX siblings. A component root or expression needs a containing frame first.');
 let unsafe=false;target.traverse({JSXSpreadAttribute(){unsafe=true;},JSXAttribute(p){if(['id','ref'].includes(p.node.name?.name))unsafe=true;}});
 if(unsafe)throw Error('This usage contains an id, ref, or spread attribute. Give the copy an explicit independent identity before duplicating.');
 const definition=require('./components.cjs').definition(resolved);let fixedId=false;
 traverse(definition.fn,{noScope:true,JSXAttribute(p){if(p.node.name?.name==='id'&&p.node.value?.type==='StringLiteral')fixedId=true;}});
 if(fixedId)throw Error('This definition contains a fixed DOM id. Make that identity instance-specific before duplicating.');
 const keys=target.node.openingElement.attributes.filter(a=>a.name?.name==='key');if(keys.length>1)throw Error('Resolve duplicate key attributes before duplicating.');
 let parentId=null;for(let p=target.parentPath;p;p=p.parentPath){const host=resolved.elements?.find(e=>e.kind==='host'&&e.node.start===p.node.start);if(host){parentId=host.id;break;}}
 return {target:target.node,key:keys[0],parentId};
}
function describe(resolved){try{return {ok:true,parentId:context(resolved).parentId};}catch(error){return refuse(error.message);}}
function plan(resolved,op){
 if(op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the instance before duplicating.');
 try{
  const {target,key,parentId}=context(resolved),chunk=new MagicString(resolved.source.slice(target.start,target.end));
  if(key){let value='retouch-copy-'+contentHash(resolved.source+'|'+resolved.element.id).slice(0,12);while(resolved.source.includes(value))value+='x';chunk.overwrite(key.start-target.start,key.end-target.start,'key='+JSON.stringify(value));}
  const copy=chunk.toString(),gap='\n'+(resolved.source.slice(0,target.start).match(/(?:^|\n)([ \t]*)$/)?.[1]||''),insert=target.end+gap.length;
  const after=resolved.source.slice(0,target.end)+gap+copy+resolved.source.slice(target.end),elements=collectElements(after,resolved.relPath).elements,duplicate=elements.find(e=>e.kind==='instance'&&e.node.start===insert);
  if(!duplicate)throw Error('The copied usage could not be mapped back to source.');
  return {ok:true,hash:contentHash(after),duplicatedComponent:{instanceId:duplicate.id,originalId:resolved.element.id,parentId},edits:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
module.exports={describe,plan};
