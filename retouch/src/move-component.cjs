'use strict';
const {collectElements,contentHash}=require('./id.cjs'),traverse=require('@babel/traverse').default,MagicString=require('magic-string');
const refuse=reason=>({ok:false,refused:true,reason});
function context(resolved){
 if(resolved.element.kind!=='instance')throw Error('Select a component usage to move.');
 const {ast}=collectElements(resolved.source,resolved.relPath);let target;
 traverse(ast,{JSXElement(p){if(p.node.start===resolved.element.node.start){target=p;p.stop();}}});
 if(!target||target.listKey!=='children'||!['JSXElement','JSXFragment'].includes(target.parent.type))throw Error('This usage has no sibling layers to reorder.');
 const siblings=target.parent.children.filter(node=>!(node.type==='JSXText'&&!node.value.trim())&&!(node.type==='JSXExpressionContainer'&&node.expression.type==='JSXEmptyExpression')),index=siblings.indexOf(target.node);
 if(index<0)throw Error('The component usage no longer resolves.');
 return {siblings,index};
}
function describe(resolved){try{const {siblings,index}=context(resolved);return {ok:true,canMoveBefore:index>0,canMoveAfter:index<siblings.length-1,canMoveFirst:index>0,canMoveLast:index<siblings.length-1};}catch(error){return refuse(error.message);}}
function plan(resolved,op){
 if(op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the component before moving it.');
 try{
  const {siblings,index}=context(resolved),destination=({before:index-1,after:index+1,first:0,last:siblings.length-1})[op.direction];
  if(!Number.isInteger(destination)||destination<0||destination>=siblings.length||destination===index)throw Error('The component cannot move farther in that direction.');
  const reordered=[...siblings],[moved]=reordered.splice(index,1);reordered.splice(destination,0,moved);
  const ms=new MagicString(resolved.source);let shift=0,movedStart;const positions=[];
  for(let i=0;i<siblings.length;i++){
   const slot=siblings[i],replacement=reordered[i],chunk=resolved.source.slice(replacement.start,replacement.end);
   positions.push({original:replacement,start:slot.start+shift});
   if(i===destination)movedStart=slot.start+shift;
   if(slot!==replacement)ms.overwrite(slot.start,slot.end,chunk);
   shift+=chunk.length-(slot.end-slot.start);
  }
  const after=ms.toString(),elements=collectElements(after,resolved.relPath).elements,selected=elements.find(el=>el.kind==='instance'&&el.node.start===movedStart);
  if(!selected||after.slice(selected.node.start,selected.node.end)!==resolved.source.slice(moved.start,moved.end))throw Error('The moved component could not be mapped back to source.');
  const sourceIdMap=[],mapped=new Set();
  for(const element of resolved.elements){const position=positions.find(item=>element.node.start>=item.original.start&&element.node.end<=item.original.end),start=position?position.start+element.node.start-position.original.start:element.node.start,next=elements.find(item=>item.kind===element.kind&&item.node.start===start);if(!next||mapped.has(next.id))throw Error('The reordered layers could not be mapped back to source.');mapped.add(next.id);if(next.id!==element.id)sourceIdMap.push([element.id,next.id]);}
  if(mapped.size!==elements.length)throw Error('Reordering changed the number of source layers.');
  return {ok:true,hash:contentHash(after),movedComponent:{instanceId:selected.id,previousInstanceId:resolved.element.id,sourceIdMap},edits:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
module.exports={describe,plan};
