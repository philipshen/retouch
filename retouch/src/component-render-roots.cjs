'use strict';
// Flatten transparent fragments and conditional expressions, stopping at each
// rendered JSX element. Descendants belong to that element, not the fragment.
module.exports=function renderRoots(fn,fragments=new Set()){
 const roots=[];
 function visit(node){
  if(!node)return;
  if(node.type==='JSXElement'){if(fragments.has(node.start))node.children.forEach(visit);else roots.push(node);return;}
  if(node.type==='JSXFragment'){node.children.forEach(visit);return;}
  if(node.type==='JSXExpressionContainer'){visit(node.expression);return;}
  if(node.type==='ConditionalExpression'){visit(node.consequent);visit(node.alternate);return;}
  if(node.type==='LogicalExpression'){visit(node.left);visit(node.right);return;}
  if(['TSAsExpression','TSSatisfiesExpression','TSNonNullExpression','ParenthesizedExpression'].includes(node.type))visit(node.expression);
 }
 require('./component-return-roots.cjs')(fn).forEach(visit);return roots;
};
