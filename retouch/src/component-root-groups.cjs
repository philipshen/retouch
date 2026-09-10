'use strict';
// Enumerate bounded, complete host sequences without evaluating app conditions.
// A shared host anchors conditional variants to one rendered source invocation.
module.exports=function rootGroups(fn,elements,fragments=new Set()){
 const hosts=new Map(elements.filter(el=>el.kind==='host').map(el=>[el.node.start,el.id])),limit=64;
 function variants(node){
  if(node.type==='JSXText')return node.value.trim()?null:[[]];
  if(node.type==='NullLiteral'||node.type==='BooleanLiteral'||node.type==='JSXEmptyExpression')return [[]];
  if(node.type==='JSXExpressionContainer'||['TSAsExpression','TSSatisfiesExpression','TSNonNullExpression','ParenthesizedExpression'].includes(node.type))return variants(node.expression);
  if(node.type==='ConditionalExpression'){
   const left=variants(node.consequent),right=variants(node.alternate);return left&&right&&left.length+right.length<=limit?[...left,...right]:null;
  }
  if(node.type==='JSXElement'&&!fragments.has(node.start))return hosts.has(node.start)?[[hosts.get(node.start)]]:null;
  if(node.type==='JSXFragment'||node.type==='JSXElement'&&fragments.has(node.start)){
   let result=[[]];for(const child of node.children){const next=variants(child);if(!next||result.length*next.length>limit)return null;result=result.flatMap(ids=>next.map(part=>[...ids,...part]));}return result;
  }
  return null;
 }
 return require('./component-return-roots.cjs')(fn).flatMap(node=>{
  const choices=variants(node);if(!choices)return [];
  const unique=[...new Map(choices.map(ids=>[ids.join(','),ids])).values()];
  if(unique.length>1&&!unique[0].some(id=>unique.every(ids=>ids.includes(id))))return [];
  return unique.filter(ids=>ids.length);
 });
};
