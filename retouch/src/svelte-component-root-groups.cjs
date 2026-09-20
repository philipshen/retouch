'use strict';
// Enumerate complete root sequences without evaluating application expressions.
// Conditional sequences share a native anchor, so neighboring invocations cannot
// be mistaken for one component when their branches render different roots.
module.exports=function rootGroups(ast,roots){
 const hosts=new Map(roots.map(root=>[root.node,root.id])),limit=64;
 const unique=groups=>[...new Map(groups.map(ids=>[ids.join(','),ids])).values()];
 function fragment(value){
  let result=[[]];for(const node of value?.nodes||[]){const next=variants(node);if(!next||result.length*next.length>limit)return null;result=unique(result.flatMap(ids=>next.map(part=>[...ids,...part])));}return result;
 }
 function alternatives(fragments){const result=[];for(const item of fragments){const next=fragment(item);if(!next||result.length+next.length>limit)return null;result.push(...next);}return unique(result);}
 function variants(node){
  if(node.type==='RegularElement')return hosts.has(node)?[[hosts.get(node)]]:null;
  if(node.type==='Text')return node.data.trim()?null:[[]];
  if(['Comment','ConstTag','DebugTag','SnippetBlock','SvelteHead','SvelteWindow','SvelteBody','SvelteDocument'].includes(node.type))return [[]];
  if(node.type==='IfBlock')return alternatives([node.consequent,node.alternate]);
  if(node.type==='AwaitBlock')return alternatives([node.pending,node.then,node.catch]);
  if(node.type==='KeyBlock')return fragment(node.fragment);
  return null;
 }
 const groups=fragment(ast.fragment);
 if(!groups||groups.some(ids=>!ids.length)||groups.length>1&&!groups[0].some(id=>groups.every(ids=>ids.filter(value=>value===id).length===1)))return [];
 return groups;
};
