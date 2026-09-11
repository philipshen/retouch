'use strict';
const MagicString=require('magic-string'),traverse=require('@babel/traverse').default;
const {parseSource,contentHash,collectElements}=require('./id.cjs');
const refuse=reason=>({ok:false,refused:true,reason});
function literal(attr){
 if(!attr.value)return {type:'boolean',value:true};
 let node=attr.value;if(node.type==='JSXExpressionContainer')node=node.expression;
 if(node.type==='StringLiteral')return {type:'string',value:node.value};
 if(node.type==='BooleanLiteral')return {type:'boolean',value:node.value};
 if(node.type==='NumericLiteral')return {type:'number',value:node.value};
 if(node.type==='UnaryExpression'&&node.operator==='-'&&node.argument.type==='NumericLiteral')return {type:'number',value:-node.argument.value};
 return null;
}
function defaultProp(resolved,name,definition){
 try{
  const def=definition||require('./components.cjs').definition(resolved);
  let param=def.fn.params[0];if(param?.type==='AssignmentPattern')param=param.left;
  if(param?.type!=='ObjectPattern')return null;
  const fields=param.properties.filter(p=>p.type==='ObjectProperty'&&!p.computed&&(p.key.name||p.key.value)===name);
  if(fields.length!==1||fields[0].value.type!=='AssignmentPattern')return null;
  const value=literal({value:fields[0].value.right});return value?{...value,definition:def}:null;
 }catch{return null;}
}
function describe(resolved,name,definition){
 const attrs=resolved.element.node.openingElement.attributes;
 if(resolved.element.kind!=='instance')return {reason:'Select a component instance.'};
 if(!/^[A-Za-z_$][\w$]*$/.test(name)||['key','ref','children','__proto__','__self','__source'].includes(name)||name.startsWith('data-rt'))return {reason:'This property has special component behavior.'};
 if(attrs.some(a=>a.type==='JSXSpreadAttribute'))return {reason:'A spread controls this usage. Edit its source binding.'};
 const matches=attrs.filter(a=>a.type==='JSXAttribute'&&a.name.name===name);
 if(matches.length>1)return {reason:'Resolve duplicate attributes first.'};
 const fallback=defaultProp(resolved,name,definition),choice=require('./component-prop-choices.cjs').property(resolved,name,definition);
 const defaults=fallback?{definitionHash:contentHash(fallback.definition.source),defaultValue:fallback.value,canReset:matches.length===1}:{};
 const contract=choice?{contractDefined:true,choices:choice.choices,type:choice.type,definitionHash:choice.revision,allowUnset:choice.optional&&!fallback,canClear:choice.optional&&!fallback&&matches.length===1}:{};
 if(!matches.length){
  if(fallback)return {editable:true,type:fallback.type,value:fallback.value,inherited:true,...defaults,...contract};
  if(choice)return {editable:true,unset:true,...contract};
  return {reason:'This property uses its definition default.'};
 }
 const value=literal(matches[0]);if(value&&choice&&!choice.choices&&typeof value.value!==choice.type)return {reason:'The literal does not match the declared property type.',...defaults};return value?{editable:true,...value,...defaults,...contract}:{reason:'This property is driven by an expression. Edit its source binding.',...defaults,...contract};
}
function plan(resolved,op){
 if(op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the instance before editing its properties.');
 try{
  if(op.reset===true&&op.clear===true)return refuse('Choose reset or unset, not both.');
  const remove=op.reset===true||op.clear===true;
  const info=describe(resolved,op.name);if(op.clear===true?!info.canClear:op.reset===true?!info.canReset:!info.editable)return refuse(info.reason||(op.clear===true?'This property cannot be unset.':'This property has no literal default to restore.'));
  if(op.definitionHash!==undefined&&op.definitionHash!==info.definitionHash)return refuse('The component type or default changed. Re-select the instance.');
  const fallback=op.reset===true||info.inherited?defaultProp(resolved,op.name):null;
  if((op.reset===true||info.inherited)&&!fallback)return refuse('The component default no longer resolves. Re-select the instance.');
  if(!remove&&(typeof op.value!==info.type||info.type==='number'&&!Number.isFinite(op.value)||info.type==='string'&&op.value.length>100000))return refuse('Use a valid '+info.type+' value for this property.');
  const choice=info.contractDefined?require('./component-prop-choices.cjs').property(resolved,op.name):null;
  if(info.contractDefined&&(!choice||op.definitionHash!==choice.revision))return refuse('The component type changed. Re-select the instance.');
  if(fallback&&(op.definitionHash!==(choice?.revision||contentHash(fallback.definition.source))||choice&&fallback.definition.source!==choice.definition.source))return refuse('The component definition changed. Re-select the instance before using its default.');
  if(!remove&&choice?.choices&&!choice.choices.includes(op.value))return refuse('Choose one of the values declared by this component.');
  const dependencies=choice?.dependencies||(fallback?[fallback.definition]:[]);
  const attr=resolved.element.node.openingElement.attributes.find(a=>a.type==='JSXAttribute'&&a.name.name===op.name);
  // Expression strings avoid JSX entity and multiline whitespace normalization.
  const code=remove?'':op.name+'={'+JSON.stringify(op.value).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+'}';
  const ms=new MagicString(resolved.source);if(attr)ms.overwrite(attr.start,attr.end,code);else ms.appendLeft(resolved.element.node.openingElement.name.end,' '+code);
  let parentId=null;traverse(parseSource(resolved.source),{JSXElement(p){if(p.node.start!==resolved.element.node.start)return;for(let q=p.parentPath;q;q=q.parentPath){const host=resolved.elements.find(e=>e.kind==='host'&&e.node.start===q.node.start);if(host){parentId=host.id;break;}}p.stop();}});
  const edits=[{file:resolved.file,before:resolved.source,after:ms.toString()}];
  for(const dependency of dependencies)if(dependency.file!==resolved.file)edits.push({file:dependency.file,before:dependency.source,after:dependency.source});
  return {ok:true,hash:contentHash(ms.toString()),componentProp:{instanceId:resolved.element.id,parentId},edits,pathChecks:choice?.pathChecks||[]};
 }catch(error){return refuse('Could not edit the component property: '+error.message);}
}
function planSelection(resolved,op){
 try{
  if(op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the instances.');
  const ids=op.ids,hashes=op.definitionHashes===undefined?{}:op.definitionHashes;
  if(!Array.isArray(ids)||ids.length<2||ids.length>100||new Set(ids).size!==ids.length||!ids.includes(resolved.element.id)||ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{10}$/.test(id)))return refuse('Choose between 2 and 100 distinct component usages in one source file.');
  if(!hashes||typeof hashes!=='object'||Array.isArray(hashes)||Object.keys(hashes).some(id=>!ids.includes(id)||typeof hashes[id]!=='string'))return refuse('Provide definition hashes only for selected instances.');
  const elements=collectElements(resolved.source,resolved.relPath).elements,members=ids.map(id=>elements.find(element=>element.id===id));
  if(members.some(element=>element?.kind!=='instance'))return refuse('Select component usages from the same source file.');
  const ranges=[],dependencies=new Map(),pathChecks=[];
  // Validate every usage against the SAME snapshot. Sequential planning would
  // change a local definition's revision after editing its first usage.
  for(const element of members){
   const current={...resolved,elements,element},info=describe(current,op.name);
   const result=plan(current,{...op,id:element.id,definitionHash:hashes[element.id]});
   if(!result.ok)return result;
   for(const edit of result.edits){
    if(edit.file===resolved.file)continue;
    if(edit.before!==edit.after)return refuse('A component dependency requires a separate source operation.');
    const previous=dependencies.get(edit.file);if(previous&&previous.before!==edit.before)return refuse('A component dependency changed while planning the selection.');
    dependencies.set(edit.file,edit);
   }
   pathChecks.push(...(result.pathChecks||[]));
   // Keep equivalent explicit literals byte-for-byte, but still validate their
   // contracts and include their dependency guards above.
   if(op.reset!==true&&op.clear!==true&&!info.inherited&&!info.unset&&info.value===op.value)continue;
   const edit=result.edits.find(edit=>edit.file===resolved.file),before=resolved.source,after=edit?.after;
   if(typeof after!=='string'||edit.before!==before)return refuse('The component edit does not match the selection snapshot.');
   if(after===before)continue;
   let start=0,end=before.length,afterEnd=after.length;
   while(start<end&&start<afterEnd&&before[start]===after[start])start++;
   while(end>start&&afterEnd>start&&before[end-1]===after[afterEnd-1]){end--;afterEnd--;}
   const opening=element.node.openingElement;
   if(start<opening.start||end>opening.end)return refuse('A property edit extends outside its component usage.');
   ranges.push({start,end,text:after.slice(start,afterEnd)});
  }
  ranges.sort((a,b)=>a.start-b.start);
  if(ranges.some((range,i)=>i&&(range.start<ranges[i-1].end||range.start===ranges[i-1].start)))return refuse('Selected property edits overlap.');
  const ms=new MagicString(resolved.source);
  for(const range of ranges)if(range.start===range.end)ms.appendLeft(range.start,range.text);else ms.overwrite(range.start,range.end,range.text);
  const source=ms.toString(),hash=contentHash(source),fresh=collectElements(source,resolved.relPath).elements;
  const selection=ids.map(id=>{const element=fresh.find(element=>element.id===id);if(element?.kind!=='instance')throw Error('A component usage lost its source identity.');return require('./adapters/react.cjs').describe({...resolved,source,hash,elements:fresh,element});});
  return {ok:true,hash,selection,edits:[{file:resolved.file,before:resolved.source,after:source},...dependencies.values()],pathChecks};
 }catch(error){return refuse('Could not edit selected component properties: '+error.message);}
}
module.exports={describe,plan,planSelection,literal};
