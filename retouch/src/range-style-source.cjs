'use strict';
// Source evidence for replacing a plain range-style wrapper. Runtime styles
// alone cannot distinguish literal declarations from bindings or spread props.
const rangeStyles=require('../shell/range-style-values.js');
function describeProperties(properties){
 if(!rangeStyles.validProperties(properties))return null;
 const entries=Object.entries(properties);return entries.length===1?{property:entries[0][0],value:entries[0][1]}:{properties};
}
function css(value){
 if(typeof value!=='string')return null;
 const properties={};
 for(const declaration of value.split(';').filter(part=>part.trim())){
  const match=declaration.match(/^\s*([a-z-]+)\s*:\s*(.+?)\s*$/);
  if(!match||Object.hasOwn(properties,match[1])||!rangeStyles.valid(match[1],match[2]))return null;
  properties[match[1]]=match[2];
 }
 return describeProperties(properties);
}
function style(element,source,kind){
 if(kind==='react'){
  const node=element.node,opening=node.openingElement;
  if(opening?.name.type!=='JSXIdentifier'||opening.name.name!=='span'||!node.closingElement||!node.children.every(child=>child.type==='JSXText'))return null;
  if(opening.attributes.length!==1)return null;
  const attr=opening.attributes[0],expression=attr.value?.expression;
  if(attr.type!=='JSXAttribute'||attr.name.name!=='style'||expression?.type!=='ObjectExpression'||!expression.properties.length)return null;
  const properties={};
  for(const item of expression.properties){
   if(item.type!=='ObjectProperty'||item.computed||item.shorthand)return null;
   const name=item.key.type==='Identifier'?item.key.name:item.key.value,property=rangeStyles.names.find(property=>rangeStyles.camel(property)===name);
   const value=item.value.type==='StringLiteral'||item.value.type==='NumericLiteral'?String(item.value.value):null;
   if(!property||Object.hasOwn(properties,property)||!rangeStyles.valid(property,value))return null;
   properties[property]=value;
  }
  return describeProperties(properties);
 }
 if(element.tag!=='span')return null;
 if(kind==='html'){
  if(!element.location.endTag||!element.node.childNodes.every(node=>node.nodeName==='#text')||element.node.attrs.length!==1||element.node.attrs[0].name!=='style')return null;
  return css(element.node.attrs[0].value);
 }
 if(element.dynamicTag||element.attributeExpressions||element.textBinding||element.closeStart==null||element.children.length||element.attributes.length!==1||element.attributes[0].name!=='style'||/\{[%{]|<!--/.test(source.slice(element.childrenStart,element.childrenEnd)))return null;
 return css(require('./liquid-classes.cjs').decode(element.attributes[0].value));
}
function describe(resolved,kind){
 const root=resolved.element,ids={};
 const bounds=element=>kind==='react'?[element.node.start,element.node.end]:kind==='html'?[element.location.startOffset,element.location.endOffset]:[element.tagStart,element.closeEnd];
 const [start,end]=bounds(root);
 for(const element of resolved.elements||[]){const [from,to]=bounds(element);if(from<=start||to>=end)continue;const value=style(element,resolved.source,kind);if(value)ids[element.id]=value;}
 return {rangeStyleIds:ids,textRangeStyle:style(root,resolved.source,kind)};
}
module.exports={describe,style};
