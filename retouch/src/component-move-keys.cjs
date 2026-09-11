'use strict';
// Only statically known keys are compared. Dynamic expressions and spreads are
// not evaluated here, and this check does not establish their runtime uniqueness.
function literalKey(node){
 if(node?.type!=='JSXElement')return undefined;
 const attributes=node.openingElement.attributes;if(attributes.some(attr=>attr.type==='JSXSpreadAttribute'))return undefined;
 const keys=attributes.filter(attr=>attr.name?.name==='key');if(keys.length!==1)return undefined;
 let value=keys[0].value;if(!value)return 'true';if(value.type==='JSXExpressionContainer')value=value.expression;
 if(['StringLiteral','NumericLiteral','BooleanLiteral'].includes(value.type))return String(value.value);
 if(value.type==='NullLiteral')return 'null';
 if(value.type==='UnaryExpression'&&['+','-'].includes(value.operator)&&value.argument.type==='NumericLiteral')return String(value.operator==='-'?-value.argument.value:value.argument.value);
 if(value.type==='TemplateLiteral'&&value.expressions.length===0)return value.quasis[0].value.cooked??undefined;
 return undefined;
}
// Repair only incoming roots: a cross-parent move already changes React identity.
// Dynamic/spread keys remain unknown and are never rewritten.
module.exports=function repairMoveKeys(resolved,op,target,sources,replan){
 const incoming=sources.filter(source=>source.parentPath?.node.start!==target.node.start||source.parentPath?.node.end!==target.node.end);if(!incoming.length)return;
 const {collectElements,contentHash}=require('./id.cjs'),MagicString=require('magic-string');
 const known=new Set((target.node.children||[]).map(literalKey).filter(key=>key!==undefined)),reserved=new Set(resolved.elements.map(element=>literalKey(element.node)).filter(key=>key!==undefined)),repairs=[];
 for(const source of incoming){
  const key=literalKey(source.node);if(key===undefined)continue;
  if(!known.has(key)){known.add(key);continue;}
  let replacement='retouch-move-'+contentHash(resolved.source+'|'+source.node.start).slice(0,12);
  while(reserved.has(replacement)||resolved.source.includes(replacement))replacement+='x';
  reserved.add(replacement);known.add(replacement);
  const attribute=source.node.openingElement.attributes.find(attr=>attr.name?.name==='key');
  repairs.push({start:attribute.start,end:attribute.end,text:'key='+JSON.stringify(replacement)});
 }
 if(!repairs.length)return;
 const ms=new MagicString(resolved.source);for(const edit of repairs)ms.overwrite(edit.start,edit.end,edit.text);
 const source=ms.toString(),elements=collectElements(source,resolved.relPath).elements,identities=new Map(),mapped=new Set();
 for(const before of resolved.elements){
  const start=before.node.start+repairs.filter(edit=>edit.end<=before.node.start).reduce((sum,edit)=>sum+edit.text.length-(edit.end-edit.start),0),after=elements.find(element=>element.kind===before.kind&&element.node.start===start);
  if(!after||mapped.has(after.id))throw Error('The moved key could not be mapped back to source.');
  mapped.add(after.id);identities.set(before.id,after.id);
 }
 if(mapped.size!==elements.length)throw Error('Key repair changed the number of source layers.');
 const remap=id=>identities.get(id)||id,element=elements.find(element=>element.id===remap(resolved.element.id)),hash=contentHash(source);
 const result=replan({...resolved,source,elements,element,hash},{...op,id:remap(op.id),ids:op.ids?.map(remap),destinationId:remap(op.destinationId),fileHash:hash});
 if(!result.ok)return result;
 if(result.edits?.length!==1||result.edits[0].file!==resolved.file||result.edits[0].before!==source)throw Error('The repaired move did not produce one source transaction.');
 const next=new Map(result.sourceIdMap||result.movedComponent?.sourceIdMap||[]),sourceIdMap=[...identities].map(([before,after])=>[before,next.get(after)||after]).filter(([before,after])=>before!==after);
 return {...result,...(result.sourceIdMap?{sourceIdMap}:{}),...(result.movedComponent?{movedComponent:{...result.movedComponent,previousInstanceId:resolved.element.id,sourceIdMap}}:{}),edits:[{...result.edits[0],before:resolved.source}]};
};
