'use strict';
const valid=value=>value===null||Number.isInteger(value)&&value>=1&&value<=1000000;
function patch(raw,value,jsx=false){
 if(!valid(value))throw Error('Invalid ordered list start.');
 let start,end,missing=false;
 if(jsx){
  const node=require('@babel/parser').parseExpression(raw,{plugins:['jsx','typescript']}),open=node.openingElement,attrs=open?.attributes||[],starts=attrs.filter(attr=>attr.name?.name==='start');
  if(open?.name.name!=='ol'||attrs.some(attr=>attr.type==='JSXSpreadAttribute')||starts.length>1)throw Error('The list start is controlled by its source.');
  const attr=starts[0];if(attr){const v=attr.value,old=v?.type==='StringLiteral'?v.value:v?.expression?.type==='NumericLiteral'?v.expression.value:null;if(old===null||!/^\d+$/.test(String(old))||!valid(Number(old)))throw Error('The list start is controlled by its source.');start=attr.start;end=attr.end;}else{start=end=open.end-(open.selfClosing?2:1);missing=true;}
 }else{
  const errors=[],fragment=require('parse5').parseFragment(raw,{sourceCodeLocationInfo:true,onParseError:error=>errors.push(error.code)}),node=fragment.childNodes.find(node=>node.tagName),loc=node?.sourceCodeLocation;
  if(node?.tagName!=='ol'||!loc?.startTag||errors.includes('duplicate-attribute'))throw Error('The list start is controlled by its source.');
  const open=raw.slice(loc.startOffset,loc.startTag.endOffset);if(/\{[%{]/.test(open))throw Error('The list start is controlled by its source.');
  const attr=node.attrs.find(attr=>attr.name==='start');if(attr){if(!/^\d+$/.test(attr.value)||!valid(Number(attr.value)))throw Error('The list start is controlled by its source.');start=loc.attrs.start.startOffset;end=loc.attrs.start.endOffset;}else{start=end=loc.startTag.endOffset-(open.endsWith('/>')?2:1);missing=true;}
 }
 return raw.slice(0,start)+(value===null?'':(missing?' ':'')+'start="'+value+'"')+raw.slice(end);
}
module.exports={valid,patch};
