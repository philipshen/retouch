'use strict';
// Capture editor identity without changing an arrow's lexical this/arguments.
module.exports=function arrowInstanceMarker(p,source,ms){
 const fn=p.node,uid=p.scope.generateUidIdentifier('rtInstance').name;
 let first=fn.params[0],read;
 if(first?.type==='AssignmentPattern')first=first.left;
 if(!first){
  // A strict directive forbids introducing a default/rest parameter.
  if(fn.body.directives?.some(directive=>directive.value.value==='use strict'))return null;
  // Empty arrow parameter lists always have parentheses. Ignore header comments.
  const start=fn.typeParameters?.end??fn.start;
  const header=source.slice(start,fn.body.start).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,comment=>' '.repeat(comment.length));
  const open=header.indexOf('(');if(open<0)return null;
  const props=p.scope.generateUidIdentifier('rtProps').name;
  ms.appendLeft(start+open+1,props+' = void 0');read=props+'?.["data-rt-i"]';
 }else if(first.type==='Identifier')read=first.name+'?.["data-rt-i"]';
 else if(first.type==='RestElement'&&first.argument.type==='Identifier')read=first.argument.name+'[0]?.["data-rt-i"]';
 else if(first.type==='ObjectPattern'){
  const existing=first.properties.find(prop=>prop.type==='ObjectProperty'&&!prop.computed&&(prop.key.name??prop.key.value)==='data-rt-i');
  const rest=first.properties.find(prop=>prop.type==='RestElement');
  if(existing){const binding=existing.value.type==='AssignmentPattern'?existing.value.left:existing.value;if(binding.type!=='Identifier')return null;read=binding.name;}
  else if(rest?.argument.type==='Identifier')read=rest.argument.name+'["data-rt-i"]';
  else {ms.appendLeft(first.start+1,'"data-rt-i": '+uid+(first.properties.length?', ':''));return uid;}
 }else return null;
 const capture='const '+uid+' = '+read+';';
 if(fn.body.type==='BlockStatement')ms.appendLeft(fn.body.directives?.at(-1)?.end??fn.body.start+1,(fn.body.directives?.length?';':'')+capture);
 else {
  const start=fn.body.extra?.parenthesized?fn.body.extra.parenStart:fn.body.start;
  ms.appendLeft(start,'{'+capture+'return ');ms.appendLeft(fn.end,';}');
 }
 return uid;
};
