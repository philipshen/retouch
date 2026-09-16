'use strict';
// Semantic text blocks. Source writers validate placement against the actual
// parent and preserved descendants before producing any edit.
const tags=new Set(['p','div','ul','ol','li']);
const flow=new Set(['div','section','article','aside','nav','main','header','footer','blockquote','li','td','th','form','fieldset','figure','figcaption','details','dialog','body']);
const phrasing=new Set(['span','a','strong','em','b','i','u','s','sup','sub','br','code','mark','small','abbr','time','img','input','label','button']);
const contains=items=>Array.isArray(items)&&items.some(item=>item&&(item.t==='paragraph'||item.t==='block'||item.t==='copy'||item.t==='keep'&&(item.tag||item.paragraph||Object.hasOwn(item,'start')||Object.hasOwn(item,'spacing')||Object.hasOwn(item,'listSpacing')||Object.hasOwn(item,'listInset'))||contains(item.children)));
function validateNode(node){
 if(!tags.has(node.tag)||Object.keys(node).some(key=>!['t','tag','children','start','template','marker','spacing','listSpacing','listInset'].includes(key)))return 'Unsupported paragraph or list node.';
 if(Object.hasOwn(node,'listInset')&&(!['ul','ol'].includes(node.tag)||!require('./list-inset.cjs').valid(node.listInset)))return 'Invalid list inset.';
 if(Object.hasOwn(node,'listSpacing')&&(!['ul','ol'].includes(node.tag)||!require('./list-spacing.cjs').valid(node.listSpacing)))return 'Invalid list spacing preference.';
 if(Object.hasOwn(node,'spacing')&&(!['p','div','li'].includes(node.tag)||!require('./text-paragraphs.cjs').validSpacing(node.spacing)))return 'Invalid paragraph spacing.';
 if(Object.hasOwn(node,'marker')&&!require('./list-markers.cjs').valid(node.tag,node.marker))return 'Invalid list marker.';
 if(Object.hasOwn(node,'template')&&(!['ul','ol'].includes(node.tag)||!/^[0-9a-f]{10}$/.test(node.template||'')))return 'Invalid list appearance source.';
 if(Object.hasOwn(node,'start')&&(node.tag!=='ol'||!Number.isInteger(node.start)||node.start<1||node.start>1000000))return 'Invalid ordered list start.';
 return null;
}
function placement(items,parent,keptTag,level=0){
 for(const item of items){
  const kept=['keep','copy'].includes(item.t)?keptTag(item.id):null;
  const tag=item.t==='paragraph'?'span':item.t==='block'||item.t==='wrap'?item.tag:item.t==='link'?'a':item.t==='style'||item.t==='styles'?'span':item.t==='break'?'br':['keep','copy'].includes(item.t)?(item.paragraph==='inline'?'span':item.tag||(typeof kept==='string'?kept:kept?.tag)):'#text';
  if(item.t==='paragraph'&&(['br','img','input'].includes(parent)||!flow.has(parent)&&!phrasing.has(parent)&&parent!=='p'&&!/^h[1-6]$/.test(parent)))return 'This source element cannot contain text paragraphs.';
  if(parent==='ul'||parent==='ol'){
   if(tag!=='li'&&tag!=='#comment'&&!(item.t==='text'&&!item.value.trim()))return 'Lists must contain list items.';
  }else if(tag==='li')return 'List items need an ordered or unordered list.';
  if((item.t==='block'||tags.has(tag)||flow.has(tag)||/^h[1-6]$/.test(tag||''))&&!(parent==='ul'||parent==='ol')&&!flow.has(parent))return 'This source element cannot contain paragraphs or lists.';
  // New paragraph boundaries must not move a preserved block/component into
  // phrasing content, where browsers could repair or rearrange the markup.
  if(parent==='p'&&tag!=='#text'&&tag!=='#comment'&&!phrasing.has(tag))return 'Paragraphs can contain only inline text content.';
  if(['keep','copy'].includes(item.t)&&(parent==='p'||phrasing.has(parent))&&typeof kept==='object'&&kept&&!kept.inline&&!(item.paragraph==='inline'&&(item.children||kept.inlineChildren)))return 'Paragraphs can contain only inline text content.';
  if(item.paragraph==='inline'&&!item.children&&typeof kept==='object'&&kept&&!kept.inlineChildren)return 'Paragraphs can contain only inline text content.';
  if(item.tag&&item.t==='keep'&&!item.children&&kept&&typeof kept==='object'){
   if(['ul','ol'].includes(tag)!==['ul','ol'].includes(kept.tag))return 'Changing list structure requires mapped children.';
   if(tag==='p'&&!kept.inlineChildren)return 'Paragraphs can contain only inline text content.';
  }
  const next=level+(tag==='ul'||tag==='ol'?1:0);
  if(next>5)return 'Lists support at most five indentation levels.';
  if(item.children){const error=placement(item.children,tag,keptTag,next);if(error)return error;}
 }
 return null;
}
function markup(node,content,jsx=false,template=null){
 const error=validateNode(node);if(error)throw Error(error);
 let style=node.tag==='ul'||node.tag==='ol'?' style="list-style: revert; margin: 0; padding-inline-start: 1.5em;"':node.tag==='p'?' style="margin: 0;"':'';
 if(jsx&&style)style=node.tag==='p'?' style={{margin:0}}':' style={{listStyle:"revert",margin:0,paddingInlineStart:"1.5em"}}';
 let appearance='';
 if(node.template){
  if(!template||!['ul','ol'].includes(template.tag)||!Array.isArray(template.attributes))throw Error('The list appearance source is not a list in this text layer.');
  const seen=new Set();for(const attr of template.attributes){if(!['class','className','style'].includes(attr.name)||seen.has(attr.name))throw Error('Ambiguous list appearance source.');seen.add(attr.name);appearance+=' '+attr.raw;}
  if(seen.has('style'))style='';
 }
 const raw='<'+node.tag+appearance+style+(Object.hasOwn(node,'start')?' start="'+node.start+'"':'')+'>'+content+'</'+node.tag+'>';
 const spaced=Object.hasOwn(node,'listSpacing')?require('./list-spacing.cjs').patch(raw,node.listSpacing,jsx):raw;
 const inset=Object.hasOwn(node,'listInset')?require('./list-inset.cjs').patch(spaced,node.tag,node.listInset,jsx):spaced;
 const styled=node.marker?require('./list-markers.cjs').patch(inset,node.tag,node.marker,jsx):inset;
 return Object.hasOwn(node,'spacing')?require('./text-paragraphs.cjs').patchSpacing(styled,node.spacing,jsx):styled;
}
const inlineTag=tag=>tag==='#text'||tag==='#comment'||phrasing.has(tag);
function patchTag(raw,from,to){
 if(!(tags.has(from)||from==='div')||!['p','ul','ol','li','div'].includes(to))throw Error('Only paragraph and list source tags can be converted.');
 const opening=new RegExp('^<'+from+'(?=[\\s>])','i'),closing=new RegExp('</'+from+'\\s*>$','i');
 if(!opening.test(raw)||!closing.test(raw))throw Error('The paragraph/list source needs explicit static opening and closing tags.');
 return raw.replace(opening,'<'+to).replace(closing,'</'+to+'>');
}
module.exports={contains,validateNode,placement,markup,inlineTag,patchTag};
