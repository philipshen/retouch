'use strict';
const links=require('../shell/link-values.js');
function describe(resolved,kind){
 const ids=[],root=resolved.element;
 const bounds=element=>kind==='react'?[element.node.start,element.node.end]:kind==='html'?[element.location.startOffset,element.location.endOffset]:[element.tagStart,element.closeEnd];
 const [start,end]=bounds(root);
 for(const element of resolved.elements||[]){
  const [from,to]=bounds(element);if(from<=start||to>=end)continue;
  let href;
  if(kind==='react'){
   const node=element.node,attrs=node.openingElement.attributes;if(node.openingElement.name.name!=='a'||attrs.length!==1||attrs[0].name?.name!=='href')continue;
   const value=attrs[0].value;href=value?.type==='StringLiteral'?value.value:value?.expression?.type==='StringLiteral'?value.expression.value:null;
  }else if(kind==='html'){
   if(element.tag!=='a'||element.node.attrs.length!==1||element.node.attrs[0].name!=='href'||/\{[%{]/.test(resolved.source.slice(element.location.startTag.startOffset,element.location.startTag.endOffset)))continue;
   href=element.node.attrs[0].value;
  }else{
   if(element.tag!=='a'||element.dynamicTag||element.attributeExpressions||element.attributes.length!==1||element.attributes[0].name!=='href'||element.attributes[0].dynamic||/\{[%{]/.test(element.attributes[0].value||''))continue;
   href=require('./liquid-classes.cjs').decode(element.attributes[0].value);
  }
  if(links.valid(href))ids.push(element.id);
 }
 return {plainLinkIds:ids};
}
module.exports={describe};
