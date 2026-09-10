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
 return {source,destination};
}
function describe(resolved){try{const ctx=context(resolved),containers=[];for(const element of resolved.elements)try{const target=ctx.destination(element);if(target!==ctx.source.parentPath)containers.push(element.id);}catch{}return {containers,canReparent:containers.length>0};}catch{return {containers:[],canReparent:false};}}
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
module.exports={describe,plan};
