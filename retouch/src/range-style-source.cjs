'use strict';
// Source evidence for replacing a plain range-style wrapper. Runtime styles
// alone cannot distinguish literal declarations from bindings or spread props.
const rangeStyles=require('../shell/range-style-values.js');
function css(value){
 const match=typeof value==='string'&&value.match(/^\s*(font-weight|font-style|font-size|color)\s*:\s*([^;]+?)\s*;?\s*$/);
 return match&&rangeStyles.valid(match[1],match[2])?{property:match[1],value:match[2]}:null;
}
function style(element,source,kind){
 if(kind==='react'){
  const node=element.node,opening=node.openingElement;
  if(opening?.name.type!=='JSXIdentifier'||opening.name.name!=='span'||!node.closingElement||!node.children.every(child=>child.type==='JSXText'))return null;
  if(opening.attributes.length!==1)return null;
  const attr=opening.attributes[0],expression=attr.value?.expression;
  if(attr.type!=='JSXAttribute'||attr.name.name!=='style'||expression?.type!=='ObjectExpression'||expression.properties.length!==1)return null;
  const item=expression.properties[0];if(item.type!=='ObjectProperty'||item.computed||item.shorthand)return null;
  const name=item.key.type==='Identifier'?item.key.name:item.key.value,property=name==='fontWeight'?'font-weight':name==='fontStyle'?'font-style':name==='fontSize'?'font-size':name==='color'?'color':null;
  const value=item.value.type==='StringLiteral'||item.value.type==='NumericLiteral'?String(item.value.value):null;
  return property&&rangeStyles.valid(property,value)?{property,value}:null;
 }
 if(element.tag!=='span')return null;
 if(kind==='html'){
  if(!element.location.endTag||!element.node.childNodes.every(node=>node.nodeName==='#text')||element.node.attrs.length!==1||element.node.attrs[0].name!=='style')return null;
  return css(element.node.attrs[0].value);
 }
 if(element.dynamicTag||element.attributeExpressions||element.textBinding||element.closeStart==null||element.children.length||element.attributes.length!==1||element.attributes[0].name!=='style'||/\{[%{]|<!--/.test(source.slice(element.childrenStart,element.childrenEnd)))return null;
 return css(element.attributes[0].value);
}
function describe(resolved,kind){
 const root=resolved.element,ids={};
 const bounds=element=>kind==='react'?[element.node.start,element.node.end]:kind==='html'?[element.location.startOffset,element.location.endOffset]:[element.tagStart,element.closeEnd];
 const [start,end]=bounds(root);
 for(const element of resolved.elements||[]){const [from,to]=bounds(element);if(from<=start||to>=end)continue;const value=style(element,resolved.source,kind);if(value)ids[element.id]=value;}
 return {rangeStyleIds:ids,textRangeStyle:style(root,resolved.source,kind)};
}
module.exports={describe,style};
