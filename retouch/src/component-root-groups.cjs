'use strict';
// Only complete, statically known host sequences can establish a DOM instance
// boundary without injecting wrappers or depending on React runtime internals.
module.exports=function rootGroups(fn,elements,fragments=new Set()){
 const hosts=new Map(elements.filter(el=>el.kind==='host').map(el=>[el.node.start,el.id]));
 function sequence(node){
  if(node.type==='JSXText')return node.value.trim()?null:[];
  if(node.type==='JSXElement'&&!fragments.has(node.start))return hosts.has(node.start)?[hosts.get(node.start)]:null;
  if(node.type==='JSXFragment'||node.type==='JSXElement'&&fragments.has(node.start)){
   const parts=node.children.map(sequence);return parts.some(part=>part===null)?null:parts.flat();
  }
  return null;
 }
 return require('./component-return-roots.cjs')(fn).map(sequence).filter(ids=>ids?.length);
};
