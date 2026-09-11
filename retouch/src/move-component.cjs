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
function describe(resolved){const parents=require('./reparent-component.cjs').describe(resolved);try{const {siblings,index}=context(resolved);return {...parents,ok:true,fileHash:resolved.hash,siblingIds:siblings.map(node=>resolved.elements.find(el=>el.node.start===node.start)?.id||null),targets:siblings.filter((_,i)=>i!==index).map(node=>resolved.elements.find(el=>el.node.start===node.start)?.id).filter(Boolean),canMoveBefore:index>0,canMoveAfter:index<siblings.length-1,canMoveFirst:index>0,canMoveLast:index<siblings.length-1};}catch(error){return {...refuse(error.message),...parents,fileHash:resolved.hash,targets:[]};}}
function plan(resolved,op){
 if(op.direction==='inside')return require('./reparent-component.cjs').plan(resolved,op);
 if(op.fileHash!==resolved.hash)return refuse('The source changed. Re-select the component before moving it.');
 if(op.destinationId!==undefined&&['before','after'].includes(op.direction)){let sibling=false;try{const target=resolved.elements.find(el=>el.id===op.destinationId);sibling=context(resolved).siblings.some(node=>node.start===target?.node.start);}catch{}if(!sibling)return require('./reparent-component.cjs').planPosition(resolved,op);}
 try{
  const {siblings,index}=context(resolved);let destination=({before:index-1,after:index+1,first:0,last:siblings.length-1})[op.direction];
  if(op.destinationId!==undefined){
   if(!['before','after'].includes(op.direction))throw Error('Choose a position before or after the destination.');
   const target=resolved.elements.find(el=>el.id===op.destinationId),other=siblings.find(node=>node.start===target?.node.start);if(!other||other===siblings[index])throw Error('Choose another sibling layer in this source container.');
   destination=siblings.filter((_,i)=>i!==index).indexOf(other)+(op.direction==='after'?1:0);
  }
  if(op.destinationId!==undefined&&destination===index)return {ok:true,unchanged:true,hash:resolved.hash,edits:[]};
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
function planSelection(resolved,op){
 try{
  if(op.fileHash!==resolved.hash)throw Error('The source changed. Re-select the components.');
  const ids=op.ids;if(!Array.isArray(ids)||ids.length<2||ids.length>100||new Set(ids).size!==ids.length||!ids.includes(resolved.element.id)||ids.some(id=>typeof id!=='string'||!/^[a-f0-9]{10}$/.test(id)))throw Error('Choose 2 to 100 distinct component usages in one source file.');
  if(!['before','after','first','last'].includes(op.direction))throw Error('Choose a position before or after another sibling layer.');
  const original=collectElements(resolved.source,resolved.relPath).elements,members=ids.map(id=>original.find(el=>el.id===id));if(members.some(el=>el?.kind!=='instance'))throw Error('Select component usages from the same source file.');
  const roots=members.filter(el=>!members.some(parent=>parent!==el&&parent.node.start<el.node.start&&parent.node.end>el.node.end)).sort((a,b)=>a.node.start-b.node.start),{siblings}=context({...resolved,element:roots[0]});
  const starts=new Set(roots.map(el=>el.node.start));if(roots.some(el=>!siblings.some(node=>node.start===el.node.start)))throw Error('Select component usages in the same source container.');
  let target,direction=op.direction;
  if(op.destinationId!==undefined){if(!['before','after'].includes(direction))throw Error('Choose before or after for an explicit destination.');const destination=original.find(el=>el.id===op.destinationId);target=siblings.find(node=>node.start===destination?.node.start);if(!target||starts.has(target.start))throw Error('Choose an unselected sibling layer.');}
  else{const first=siblings.findIndex(node=>starts.has(node.start)),last=siblings.findLastIndex(node=>starts.has(node.start));target=direction==='first'?siblings.find(node=>!starts.has(node.start)):direction==='last'?siblings.findLast(node=>!starts.has(node.start)):direction==='before'?siblings[first-1]:siblings[last+1];if(!target)return {ok:true,unchanged:true,hash:resolved.hash,selectionIds:roots.map(el=>el.id),sourceIdMap:[],rootCount:roots.length,edits:[]};direction=['first','before'].includes(direction)?'before':'after';}
  const selected=siblings.filter(node=>starts.has(node.start)),reordered=siblings.filter(node=>!starts.has(node.start));reordered.splice(reordered.indexOf(target)+(direction==='after'?1:0),0,...selected);
  const ms=new MagicString(resolved.source),positions=[];let shift=0;
  for(let i=0;i<siblings.length;i++){const slot=siblings[i],replacement=reordered[i],chunk=resolved.source.slice(replacement.start,replacement.end);positions.push({original:replacement,start:slot.start+shift});if(slot!==replacement)ms.overwrite(slot.start,slot.end,chunk);shift+=chunk.length-(slot.end-slot.start);}
  const after=ms.toString(),elements=collectElements(after,resolved.relPath).elements,identities=new Map(),mapped=new Set();
  for(const element of original){const position=positions.find(item=>element.node.start>=item.original.start&&element.node.end<=item.original.end),start=position?position.start+element.node.start-position.original.start:element.node.start,next=elements.find(item=>item.kind===element.kind&&item.node.start===start);if(!next||mapped.has(next.id))throw Error('The reordered layers could not be mapped back to source.');mapped.add(next.id);identities.set(element.id,next.id);}
  if(mapped.size!==elements.length)throw Error('Reordering changed the number of source layers.');
  return {ok:true,unchanged:after===resolved.source,hash:contentHash(after),selectionIds:roots.map(el=>identities.get(el.id)),sourceIdMap:[...identities].filter(([a,b])=>a!==b),rootCount:roots.length,destinationId:identities.get(op.destinationId),edits:after===resolved.source?[]:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return refuse(error.message);}
}
module.exports={describe,plan,planSelection};
