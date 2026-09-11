'use strict';
const {collectElements,contentHash}=require('./id.cjs'),traverse=require('@babel/traverse').default,MagicString=require('magic-string');
const refuse=reason=>({ok:false,refused:true,reason});
function context(resolved){
 if(resolved.element.kind!=='instance')throw Error('Select a component usage to move.');
 const {ast}=collectElements(resolved.source,resolved.relPath),paths=new Map();traverse(ast,{JSXElement(p){paths.set(p.node.start,p);}});
 const source=paths.get(resolved.element.node.start),owner=source?.getFunctionParent();if(!source||!owner)throw Error('Select a component usage inside a render function.');
 const createsCycle=require('./component-move-cycles.cjs')(ast,source);
 const references=[];let typed=false,contextual=false;source.traverse({TSType(){typed=true;},ThisExpression(){contextual=true;},Super(){contextual=true;},MetaProperty(){contextual=true;},AwaitExpression(){contextual=true;},YieldExpression(){contextual=true;},PrivateName(){contextual=true;},ReferencedIdentifier(p){if(['arguments','eval'].includes(p.node.name))contextual=true;const binding=p.scope.getBinding(p.node.name);if(binding&&binding.path.node.start>=source.node.start&&binding.path.node.end<=source.node.end)return;references.push({name:p.node.name,binding});}});
 function destination(element){
  const target=paths.get(element?.node?.start);if(!target||!require('./insert-component.cjs').canContain({...resolved,element}))throw Error('Choose a container that accepts child layers.');
  if(target.node.openingElement.attributes.some(attr=>attr.type==='JSXSpreadAttribute'))throw Error('This container spreads properties that may supply children.');
  return validateTarget(target);
 }
 function validateTarget(target){
  if(target.node.start>=source.node.start&&target.node.end<=source.node.end)throw Error('A component cannot contain itself.');
  const targetOwner=target.getFunctionParent();if(!targetOwner)throw Error('Choose a container inside a render function.');
  if(contextual&&targetOwner!==owner)throw Error('This component uses execution context that must stay in its render function.');
  let componentName=source.node.openingElement.name;while(componentName.type==='JSXMemberExpression')componentName=componentName.object;
  const componentBinding=source.scope.getBinding(componentName.name);
  if(componentBinding&&target.node.start>=componentBinding.path.node.start&&target.node.end<=componentBinding.path.node.end)throw Error('A component cannot be moved into its own definition.');
  if(createsCycle(target))throw Error('Moving here would create a recursive component or render-helper cycle.');
  if(typed&&target.scope!==source.scope)throw Error('Typed expressions must stay in the same lexical scope.');
  for(const {name,binding}of references){if(target.scope.getBinding(name)!==binding)throw Error('Moving here would change what "'+name+'" refers to.');if(binding&&binding.scope.getFunctionParent()&&!['module','hoisted','param','local'].includes(binding.kind)&&binding.path.node.end>target.node.start)throw Error('The value "'+name+'" is not available when this container is created.');}
  return target;
 }
 function siblingDestination(element){const anchor=paths.get(element?.node?.start);if(!anchor||anchor.listKey!=='children'||!['JSXElement','JSXFragment'].includes(anchor.parent.type))throw Error('Choose a layer inside a source container.');if(anchor.node.start>=source.node.start&&anchor.node.end<=source.node.end)throw Error('Choose a layer outside the selected component.');if(anchor.parent.type==='JSXFragment'){validateTarget(anchor.parentPath);return anchor.parentPath;}const parent=resolved.elements.find(el=>el.node.start===anchor.parent.start);destination(parent);return anchor.parentPath;}
 return {source,destination,siblingDestination};
}
function describe(resolved){try{const ctx=context(resolved),containers=[],selectionContainers=[];for(const element of resolved.elements)try{const target=ctx.destination(element);selectionContainers.push(element.id);if(target!==ctx.source.parentPath)containers.push(element.id);}catch{}const crossTargets=[];for(const element of resolved.elements)try{if(ctx.siblingDestination(element)!==ctx.source.parentPath)crossTargets.push(element.id);}catch{}return {containers,selectionContainers,crossTargets,canReparent:containers.length>0};}catch{return {containers:[],canReparent:false};}}
function plan(resolved,op){
 if(op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the component before moving it.');
 try{
  const ctx=context(resolved),target=ctx.destination(resolved.elements.find(el=>el.id===op.destinationId)),source=ctx.source,node=source.node;
  if(target===source.parentPath){const move=require('./move-component.cjs');return move.describe(resolved).canMoveLast?move.plan(resolved,{...op,destinationId:undefined,direction:'last'}):{ok:true,unchanged:true,hash:resolved.hash,edits:[]};}
  const chunk=resolved.source.slice(node.start,node.end),placeholder=source.listKey==='children'?'':source.parent.type==='JSXAttribute'?'{null}':'null',opening=target.node.openingElement,tag=resolved.source.slice(opening.name.start,opening.name.end);
  const removal={start:node.start,end:node.end,text:placeholder},insertion=opening.selfClosing?{start:opening.end-2,end:opening.end,text:'>\n'+chunk+'\n</'+tag+'>',offset:2}:{start:target.node.closingElement.start,end:target.node.closingElement.start,text:'\n'+chunk+'\n',offset:1},edits=[removal,insertion],ms=new MagicString(resolved.source);
  for(const edit of edits){if(edit.start===edit.end)ms.appendLeft(edit.start,edit.text);else ms.overwrite(edit.start,edit.end,edit.text);}
  const offset=(position,excluded)=>edits.filter(edit=>edit!==excluded&&edit.end<=position).reduce((sum,edit)=>sum+edit.text.length-(edit.end-edit.start),0),movedStart=insertion.start+offset(insertion.start,insertion)+insertion.offset,after=ms.toString(),elements=collectElements(after,resolved.relPath).elements,sourceIdMap=[],mapped=new Set();let selected;
  for(const element of resolved.elements){const moved=element.node.start>=node.start&&element.node.end<=node.end,start=moved?movedStart+element.node.start-node.start:element.node.start+offset(element.node.start),next=elements.find(el=>el.kind===element.kind&&el.node.start===start);if(!next||mapped.has(next.id))throw Error('The moved layers could not be mapped back to source.');mapped.add(next.id);if(element.id!==next.id)sourceIdMap.push([element.id,next.id]);if(element.id===resolved.element.id)selected=next;}
  if(mapped.size!==elements.length||!selected||after.slice(selected.node.start,selected.node.end)!==chunk)throw Error('Moving changed the component contents.');
  return {ok:true,hash:contentHash(after),movedComponent:{instanceId:selected.id,previousInstanceId:resolved.element.id,sourceIdMap},edits:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
function planSelection(resolved,op,allowSingle=false){
 const positioned=['before','after'].includes(op.direction)&&op.destinationId!==undefined;
 if(op.direction!==undefined&&op.direction!=='inside'){const direct=require('./move-component.cjs').planSelection(resolved,op);if(direct.ok||!positioned)return direct;}
 try{
  if(op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the components.');
  const ids=op.ids;
  if(!Array.isArray(ids)||ids.length<(allowSingle?1:2)||ids.length>100||new Set(ids).size!==ids.length||!ids.includes(resolved.element.id)||ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{10}$/.test(id)))return refuse('Choose 2 to 100 distinct component usages in one source file.');
  const original=collectElements(resolved.source,resolved.relPath).elements,members=ids.map(id=>original.find(element=>element.id===id)),destination=original.find(element=>element.id===op.destinationId);
  if(members.some(element=>element?.kind!=='instance'))return refuse('Select component usages from the same source file.');
  const roots=members.filter(element=>!members.some(parent=>parent!==element&&parent.node.start<element.node.start&&parent.node.end>element.node.end)).sort((a,b)=>a.node.start-b.node.start);
  const contexts=roots.map(element=>context({...resolved,elements:original,element}));for(const ctx of contexts){if(positioned)ctx.siblingDestination(destination);else ctx.destination(destination);}
  if(positioned)return positionedSelection(resolved,op,original,roots,contexts,destination);
  let source=resolved.source,elements=original;const identities=new Map(original.map(element=>[element.id,element.id]));
  for(const root of roots){
   const id=identities.get(root.id),element=elements.find(item=>item.id===id);if(!element)return refuse('A selected component lost its source identity.');
   const current={...resolved,source,elements,element,hash:contentHash(source)},result=plan(current,{type:'moveComponent',id,fileHash:current.hash,direction:'inside',destinationId:identities.get(destination.id)});if(!result.ok)return result;if(result.unchanged)continue;
   const mapping=new Map(result.movedComponent.sourceIdMap);for(const [before,now]of identities)identities.set(before,mapping.get(now)||now);
   source=result.edits[0].after;elements=collectElements(source,resolved.relPath).elements;
  }
  const selectionIds=roots.map(element=>identities.get(element.id)),sourceIdMap=[...identities].filter(([before,after])=>before!==after);
  if(new Set(identities.values()).size!==original.length||elements.length!==original.length)throw Error('Moving changed the number of source layers.');
  return {ok:true,unchanged:source===resolved.source,hash:contentHash(source),selectionIds,sourceIdMap,destinationId:identities.get(op.destinationId),rootCount:roots.length,edits:source===resolved.source?[]:[{file:resolved.file,before:resolved.source,after:source}]};
 }catch(error){return refuse(error.message);}
}
function positionedSelection(resolved,op,original,roots,contexts,destination){
 const point=op.direction==='before'?destination.node.start:destination.node.end,removals=contexts.map(ctx=>({start:ctx.source.node.start,end:ctx.source.node.end,text:ctx.source.listKey==='children'?'':ctx.source.parent.type==='JSXAttribute'?'{null}':'null'})),offset=position=>removals.filter(edit=>edit.end<=position).reduce((sum,edit)=>sum+edit.text.length-(edit.end-edit.start),0),positions=new Map();
 let inserted='\n';for(const root of roots){positions.set(root.id,point+offset(point)+inserted.length);inserted+=resolved.source.slice(root.node.start,root.node.end)+'\n';}
 const ms=new MagicString(resolved.source);for(const edit of removals)ms.overwrite(edit.start,edit.end,edit.text);ms.appendLeft(point,inserted);
 const after=ms.toString(),elements=collectElements(after,resolved.relPath).elements,identities=new Map(),mapped=new Set();
 for(const element of original){const root=roots.find(root=>element.node.start>=root.node.start&&element.node.end<=root.node.end),start=root?positions.get(root.id)+element.node.start-root.node.start:element.node.start+offset(element.node.start)+(point<=element.node.start?inserted.length:0),next=elements.find(el=>el.kind===element.kind&&el.node.start===start);if(!next||mapped.has(next.id))throw Error('The positioned layers could not be mapped back to source.');mapped.add(next.id);identities.set(element.id,next.id);}
 if(mapped.size!==elements.length)throw Error('Positioning changed the number of source layers.');
 for(const root of roots){const next=elements.find(el=>el.id===identities.get(root.id));if(after.slice(next.node.start,next.node.end)!==resolved.source.slice(root.node.start,root.node.end))throw Error('Positioning changed component contents.');}
 return {ok:true,unchanged:after===resolved.source,hash:contentHash(after),selectionIds:roots.map(root=>identities.get(root.id)),sourceIdMap:[...identities].filter(([a,b])=>a!==b),destinationId:identities.get(destination.id),rootCount:roots.length,edits:after===resolved.source?[]:[{file:resolved.file,before:resolved.source,after}]};
}
function planPosition(resolved,op){
 const result=planSelection(resolved,{...op,ids:[resolved.element.id]},true);if(!result.ok||result.unchanged)return result;
 return {...result,movedComponent:{instanceId:result.selectionIds[0],previousInstanceId:resolved.element.id,sourceIdMap:result.sourceIdMap}};
}
module.exports={describe,plan,planSelection,planPosition};
