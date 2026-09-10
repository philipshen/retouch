'use strict';
// Returned JSX roots belong to this function, never a nested callback.
module.exports=function returnedRoots(fn){
  const result=[];
  function expression(node){
   if(!node)return;
   if(node.type==='JSXElement'||node.type==='JSXFragment'){result.push(node);return;}
   if(node.type==='ConditionalExpression'){expression(node.consequent);expression(node.alternate);}
   if(node.type==='LogicalExpression'){expression(node.left);expression(node.right);}
   if(['TSAsExpression','TSSatisfiesExpression','TSNonNullExpression','ParenthesizedExpression'].includes(node.type))expression(node.expression);
  }
  function statements(node){
   if(!node||typeof node!=='object')return;
   if(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression','ClassDeclaration','ClassExpression'].includes(node.type))return;
   if(node.type==='ReturnStatement'){expression(node.argument);return;}
   for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(statements);else if(value&&typeof value==='object'&&value.type)statements(value);}
  }
  if(fn.body.type==='BlockStatement')statements(fn.body);else expression(fn.body);return result;
 };
