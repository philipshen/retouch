'use strict';
// Logical text paragraphs use phrasing markup so a heading/label keeps its
// semantic source element. The marker makes their boundaries addressable.
function markup(content,jsx=false){return '<span data-retouch-paragraph="" '+(jsx?'style={{display:"block"}}':'style="display: block;"')+'>'+content+'</span>';}
function validate(node){return Object.keys(node).some(key=>!['t','children'].includes(key))?'Invalid text paragraph.':null;}
function inline(raw,jsx=false){
 let start,end,tag;
 if(jsx){
  const node=require('@babel/parser').parseExpression(raw,{plugins:['jsx','typescript']}),attrs=node.openingElement?.attributes.filter(a=>a.type==='JSXAttribute'&&a.name.name==='data-retouch-paragraph');
  tag=node.openingElement?.name.name;if(tag!=='li'&&(tag!=='span'||attrs?.length!==1))throw Error('Only explicit text paragraphs or list items can be joined.');start=attrs[0]?.start;end=attrs[0]?.end;
 }else{
  const errors=[],node=require('parse5').parseFragment(raw,{sourceCodeLocationInfo:true,onParseError:e=>errors.push(e)}).childNodes[0],loc=node?.sourceCodeLocation;
  const attr=loc?.attrs?.['data-retouch-paragraph'];tag=node?.tagName;if((tag!=='li'&&(tag!=='span'||!attr))||errors.some(e=>e.code==='duplicate-attribute'&&e.startOffset<loc.startTag.endOffset))throw Error('Only explicit text paragraphs or list items can be joined.');start=attr?.startOffset;end=attr?.endOffset;
 }
 if(start!==undefined)raw=raw.slice(0,start)+raw.slice(end);
 if(tag==='li'){if(!/^<li(?=[\s>])/i.test(raw)||!/<\/li\s*>$/i.test(raw))throw Error('List joins require explicit source tags.');raw=raw.replace(/^<li(?=[\s>])/i,'<span').replace(/<\/li\s*>$/i,'</span>');}
 return require('./inline-source-property.cjs').patch(raw,'span','inline',jsx,'display');
}
module.exports={markup,validate,inline};
