'use strict';
// Logical text paragraphs use phrasing markup so a heading/label keeps its
// semantic source element. The marker makes their boundaries addressable.
function markup(content,jsx=false,spacing){const raw= '<span data-retouch-paragraph="" '+(jsx?'style={{display:"block"}}':'style="display: block;"')+'>'+content+'</span>';return spacing===undefined?raw:patchSpacing(raw,spacing,jsx);}
function validate(node){return Object.keys(node).some(key=>!['t','children','spacing'].includes(key))||Object.hasOwn(node,'spacing')&&!validSpacing(node.spacing)?'Invalid text paragraph.':null;}
function inline(raw,jsx=false){
 let start,end,tag;
 if(jsx){
  const node=require('@babel/parser').parseExpression(raw,{plugins:['jsx','typescript']}),attrs=node.openingElement?.attributes.filter(a=>a.type==='JSXAttribute'&&a.name.name==='data-retouch-paragraph');
  tag=node.openingElement?.name.name;if(!['li','p','div'].includes(tag)&&(tag!=='span'||attrs?.length!==1))throw Error('Only explicit text paragraphs or list items can be joined.');start=attrs[0]?.start;end=attrs[0]?.end;
 }else{
  const errors=[],node=require('parse5').parseFragment(raw,{sourceCodeLocationInfo:true,onParseError:e=>errors.push(e)}).childNodes[0],loc=node?.sourceCodeLocation;
  const attr=loc?.attrs?.['data-retouch-paragraph'];tag=node?.tagName;if((!['li','p','div'].includes(tag)&&(tag!=='span'||!attr))||errors.some(e=>e.code==='duplicate-attribute'&&e.startOffset<loc.startTag.endOffset))throw Error('Only explicit text paragraphs or list items can be joined.');start=attr?.startOffset;end=attr?.endOffset;
 }
 if(start!==undefined)raw=raw.slice(0,start)+raw.slice(end);
 if(tag!=='span'){const opening=new RegExp('^<'+tag+'(?=[\\s>])','i'),closing=new RegExp('</'+tag+'\\s*>$','i');if(!opening.test(raw)||!closing.test(raw))throw Error('Paragraph joins require explicit source tags.');raw=raw.replace(opening,'<span').replace(closing,'</span>');}
 return require('./inline-source-property.cjs').patch(raw,'span','inline',jsx,'display');
}
function validSpacing(value){return Number.isFinite(value)&&value>=0&&value<=10000;}
function patchSpacing(raw,value,jsx=false){
 if(!validSpacing(value))throw Error('Invalid paragraph spacing.');
 let tag,marked;
 if(jsx){const opening=require('@babel/parser').parseExpression(raw,{plugins:['jsx','typescript']}).openingElement;tag=opening?.name.name;marked=opening?.attributes.some(a=>a.type==='JSXAttribute'&&a.name.name==='data-retouch-paragraph');}
 else{const node=require('parse5').parseFragment(raw).childNodes[0];tag=node?.tagName;marked=node?.attrs?.some(a=>a.name==='data-retouch-paragraph');}
 if(!['p','div'].includes(tag)&&!(tag==='span'&&marked))throw Error('Spacing needs a paragraph source element.');
 const patch=require('./inline-source-property.cjs').patch;
 return patch(patch(raw,tag,'0px',jsx,'margin-block-start'),tag,value+'px',jsx,'margin-block-end');
}
module.exports={markup,validate,inline,validSpacing,patchSpacing};
