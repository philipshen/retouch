'use strict';
// Capture editor identity and its usage revision without changing lexical this/arguments.
module.exports=function arrowInstanceMarker(p,source,ms){
 const fn=p.node,uid=p.scope.generateUidIdentifier('rtInstance').name;
 const slots=[['identity','data-rt-i'],['revision','data-rt-i-revision']];let first=fn.params[0],base;
 if(first?.type==='AssignmentPattern')first=first.left;
 if(!first){
  if(fn.body.directives?.some(directive=>directive.value.value==='use strict'))return null;
  const start=fn.typeParameters?.end??fn.start;
  const header=source.slice(start,fn.body.start).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,comment=>' '.repeat(comment.length)),open=header.indexOf('(');if(open<0)return null;
  base=p.scope.generateUidIdentifier('rtProps').name;ms.appendLeft(start+open+1,base+' = void 0');
 }else if(first.type==='Identifier')base=first.name;
 else if(first.type==='RestElement'&&first.argument.type==='Identifier')base=first.argument.name+'[0]';
 else if(first.type!=='ObjectPattern')return null;
 const reads=[],additions=[];
 for(const [key,attribute] of slots){
  let read;if(base)read=base+'?.['+JSON.stringify(attribute)+']';
  else{
   const existing=first.properties.find(prop=>prop.type==='ObjectProperty'&&!prop.computed&&(prop.key.name??prop.key.value)===attribute),rest=first.properties.find(prop=>prop.type==='RestElement');
   if(existing){const binding=existing.value.type==='AssignmentPattern'?existing.value.left:existing.value;if(binding.type!=='Identifier')return null;read=binding.name;}
   else if(rest?.argument.type==='Identifier')read=rest.argument.name+'['+JSON.stringify(attribute)+']';
   else{read=p.scope.generateUidIdentifier('rt'+key).name;additions.push(JSON.stringify(attribute)+': '+read);}
  }
  reads.push(key+': '+read);
 }
 if(additions.length)ms.appendLeft(first.start+1,additions.join(', ')+(first.properties.length?', ':''));
 const capture='const '+uid+' = {'+reads.join(', ')+'};';
 if(fn.body.type==='BlockStatement')ms.appendLeft(fn.body.directives?.at(-1)?.end??fn.body.start+1,(fn.body.directives?.length?';':'')+capture);
 else{const start=fn.body.extra?.parenthesized?fn.body.extra.parenStart:fn.body.start;ms.appendLeft(start,'{'+capture+'return ');ms.appendLeft(fn.end,';}');}
 return {identity:uid+'.identity',revision:uid+'.revision'};
};
