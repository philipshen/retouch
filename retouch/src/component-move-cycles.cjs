'use strict';
const traverse=require('@babel/traverse').default;

// Track local function dependencies conservatively: passing a function as a
// property also counts, since the receiving component may invoke it to render.
// Imports and dynamic property dispatch require project-wide analysis elsewhere.
module.exports=function componentMoveCycles(ast,source){
 const graph=new Map(),dependencies=new Set();
 function localFunction(binding,seen=new Set()){
  if(!binding||!binding.constant||seen.has(binding))return null;
  seen.add(binding);const path=binding.path;
  if(path.isFunction())return path.node;
  if(!path.isVariableDeclarator())return null;
  const init=path.get('init');
  if(init.isFunction())return init.node;
  if(init.isIdentifier())return localFunction(init.scope.getBinding(init.node.name),seen);
  return null;
 }
 function add(owner,dependency){if(!owner)return;if(!graph.has(owner))graph.set(owner,new Set());graph.get(owner).add(dependency);}
 traverse(ast,{Function(path){
  if(path.node.start>=source.node.start&&path.node.end<=source.node.end)return;
  // Inline render callbacks have no binding. Include nested functions because
  // their enclosing function may call them directly or pass them to a renderer.
  add(path.getFunctionParent()?.node,path.node);
 },ReferencedIdentifier(path){
  const dependency=localFunction(path.scope.getBinding(path.node.name));if(!dependency)return;
  if(path.node.start>=source.node.start&&path.node.end<=source.node.end){dependencies.add(dependency);return;}
  const owner=path.getFunctionParent()?.node;if(!owner)return;
  add(owner,dependency);
 }});
 return target=>{
  const owner=target.getFunctionParent()?.node,seen=new Set(),pending=[...dependencies];
  if(owner===source.getFunctionParent()?.node)return false;
  while(pending.length){const current=pending.pop();if(current===owner)return true;if(seen.has(current))continue;seen.add(current);for(const next of graph.get(current)||[])pending.push(next);}
  return false;
 };
};
