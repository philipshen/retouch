'use strict';
const valid=value=>value===null||Number.isFinite(value)&&value>=0&&value<=10000;
const attribute='data-retouch-list-spacing';
function patch(raw,value,jsx=false){
 if(!valid(value))throw Error('Invalid list spacing preference.');
 let start,end,missing=false;
 if(jsx){
  const node=require('@babel/parser').parseExpression(raw,{plugins:['jsx','typescript']}),open=node.openingElement,attrs=open?.attributes||[],starts=attrs.filter(attr=>attr.name?.name===attribute);
  if(!['ul','ol'].includes(open?.name.name)||attrs.some(attr=>attr.type==='JSXSpreadAttribute')||starts.length>1)throw Error('The list spacing preference is controlled by its source.');
  const attr=starts[0];if(attr){const v=attr.value,old=v?.type==='StringLiteral'?v.value:v?.expression?.type==='NumericLiteral'?v.expression.value:null;if(old===null||!/^\d+(?:\.\d+)?(?:e-\d+)?$/i.test(String(old))||!valid(Number(old)))throw Error('The list spacing preference is controlled by its source.');start=attr.start;end=attr.end;}else{start=end=open.end-(open.selfClosing?2:1);missing=true;}
 }else{
  const errors=[],fragment=require('parse5').parseFragment(raw,{sourceCodeLocationInfo:true,onParseError:error=>errors.push(error.code)}),node=fragment.childNodes.find(node=>node.tagName),loc=node?.sourceCodeLocation;
  if(!['ul','ol'].includes(node?.tagName)||!loc?.startTag||errors.includes('duplicate-attribute'))throw Error('The list spacing preference is controlled by its source.');
  const open=raw.slice(loc.startOffset,loc.startTag.endOffset);if(/\{[%{]/.test(open))throw Error('The list spacing preference is controlled by its source.');
  const attr=node.attrs.find(attr=>attr.name===attribute);if(attr){if(!/^\d+(?:\.\d+)?(?:e-\d+)?$/i.test(attr.value)||!valid(Number(attr.value)))throw Error('The list spacing preference is controlled by its source.');start=loc.attrs[attribute].startOffset;end=loc.attrs[attribute].endOffset;}else{start=end=loc.startTag.endOffset-(open.endsWith('/>')?2:1);missing=true;}
 }
 return raw.slice(0,start)+(value===null?'':(missing?' ':'')+attribute+'="'+value+'"')+raw.slice(end);
}
module.exports={valid,patch};
