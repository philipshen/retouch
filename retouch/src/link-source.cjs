'use strict';
const links=require('../shell/link-values.js');
function describe(resolved,kind){
 const ids=[],editableLinkIds=[],root=resolved.element;
 const bounds=element=>kind==='react'?[element.node.start,element.node.end]:kind==='html'?[element.location.startOffset,element.location.endOffset]:[element.tagStart,element.closeEnd];
 const [start,end]=bounds(root);
 for(const element of resolved.elements||[]){
  const [from,to]=bounds(element);if(from<=start||to>=end)continue;
  const literal=literalHref(resolved,element,kind);if(literal)editableLinkIds.push(element.id);
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
  if(literal&&links.valid(href))ids.push(element.id);
 }
 return {plainLinkIds:ids,editableLinkIds};
}
module.exports={describe};

// Attribute edits preserve the rest of the original opening tag byte for byte.
function htmlHref(source,node){
 const loc=node.sourceCodeLocation,attrs=node.attrs||[],hrefs=attrs.filter(a=>a.name==='href');
 if(node.tagName!=='a'||hrefs.length>1||!loc?.startTag)return null;
 const open=source.slice(loc.startOffset,loc.startTag.endOffset),errors=[];
 require('parse5').parseFragment(open,{onParseError:e=>errors.push(e.code)});
 if(errors.includes('duplicate-attribute'))return null;
 if(!hrefs.length){if(/\{[%{]/.test(open))return null;const at=loc.startTag.endOffset-(open.endsWith('/>')?2:1);return {start:at,end:at,href:null,missing:true};}
 if(!loc.attrs?.href)return null;
 const attr=loc.attrs.href,raw=source.slice(attr.startOffset,attr.endOffset);
 if(/\{[%{]/.test(raw)||!links.valid(hrefs[0].value))return null;
 return {start:attr.startOffset,end:attr.endOffset,href:hrefs[0].value};
}
function literalHref(resolved,element,kind){
 if(kind==='html')return htmlHref(resolved.source,element.node);
 if(kind==='react'){
  const node=element.node,attrs=node.openingElement.attributes,hrefs=attrs.filter(a=>a.name?.name==='href');
  if(node.openingElement.name.name!=='a'||attrs.some(a=>a.type==='JSXSpreadAttribute')||hrefs.length>1)return null;
  if(!hrefs.length){const at=node.openingElement.end-(node.openingElement.selfClosing?2:1);return {start:at,end:at,href:null,missing:true};}
  const attr=hrefs[0],value=attr.value,href=value?.type==='StringLiteral'?value.value:value?.expression?.type==='StringLiteral'?value.expression.value:null;
  return links.valid(href)?{start:attr.start,end:attr.end,href}:null;
 }
 const hrefs=(element.attributes||[]).filter(a=>a.name==='href');
 if(element.tag!=='a'||element.dynamicTag||element.attributeExpressions||hrefs.length>1)return null;
 if(!hrefs.length){const at=element.openEnd-(element.selfClosing?2:1);return {start:at,end:at,href:null,missing:true};}
 const attr=hrefs[0],href=require('./liquid-classes.cjs').decode(attr.value||'');
 return !attr.dynamic&&!/\{[%{]/.test(attr.value||'')&&links.valid(href)?{start:attr.attrStart,end:attr.attrEnd,href}:null;
}
function patch(resolved,element,kind,href,openingOnly=false){
 const attr=literalHref(resolved,element,kind);if(!attr)throw Error('This link URL is controlled by its source.');
 const start=kind==='react'?element.node.start:kind==='html'?element.location.startOffset:element.tagStart;
 const end=kind==='react'?(openingOnly?element.node.openingElement.end:element.node.end):kind==='html'?(openingOnly?element.location.startTag.endOffset:element.location.endOffset):(openingOnly?element.openEnd:element.closeEnd);
 return resolved.source.slice(start,attr.start)+attributePatch(attr,href,kind==='react')+resolved.source.slice(attr.end,end);
}
module.exports.htmlHref=htmlHref;
module.exports.literalHref=literalHref;
module.exports.patch=patch;

function attributePatch(attr,href,jsx=false){return href===null?'':(attr.missing?' ':'')+'href='+require('./rich-text.cjs').hrefMarkup(href,jsx);}
module.exports.attributePatch=attributePatch;
