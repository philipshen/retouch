'use strict';
// Semantic text blocks. Source writers validate placement against the actual
// parent and preserved descendants before producing any edit.
const tags=new Set(['p','ul','ol','li']);
const flow=new Set(['div','section','article','aside','nav','main','header','footer','blockquote','li','td','th','form','fieldset','figure','figcaption','details','dialog','body']);
const phrasing=new Set(['span','a','strong','em','b','i','u','s','sup','sub','br','code','mark','small','abbr','time','img','input','label','button']);
const contains=items=>Array.isArray(items)&&items.some(item=>item&&(item.t==='block'||item.t==='keep'&&item.tag||contains(item.children)));
function validateNode(node){
 if(!tags.has(node.tag)||Object.keys(node).some(key=>!['t','tag','children','start','template','marker'].includes(key)))return 'Unsupported paragraph or list node.';
 if(Object.hasOwn(node,'marker')&&!require('./list-markers.cjs').valid(node.tag,node.marker))return 'Invalid list marker.';
 if(Object.hasOwn(node,'template')&&(!['ul','ol'].includes(node.tag)||!/^[0-9a-f]{10}$/.test(node.template||'')))return 'Invalid list appearance source.';
 if(Object.hasOwn(node,'start')&&(node.tag!=='ol'||!Number.isInteger(node.start)||node.start<1||node.start>1000000))return 'Invalid ordered list start.';
 return null;
}
function placement(items,parent,keptTag,level=0){
 for(const item of items){
  const kept=item.t==='keep'?keptTag(item.id):null;
  const tag=item.t==='block'||item.t==='wrap'?item.tag:item.t==='link'?'a':item.t==='style'||item.t==='styles'?'span':item.t==='break'?'br':item.t==='keep'?(item.tag||(typeof kept==='string'?kept:kept?.tag)):'#text';
  if(parent==='ul'||parent==='ol'){
   if(tag!=='li'&&tag!=='#comment'&&!(item.t==='text'&&!item.value.trim()))return 'Lists must contain list items.';
  }else if(tag==='li')return 'List items need an ordered or unordered list.';
  if((item.t==='block'||tags.has(tag)||flow.has(tag)||/^h[1-6]$/.test(tag||''))&&!(parent==='ul'||parent==='ol')&&!flow.has(parent))return 'This source element cannot contain paragraphs or lists.';
  // New paragraph boundaries must not move a preserved block/component into
  // phrasing content, where browsers could repair or rearrange the markup.
  if(parent==='p'&&tag!=='#text'&&tag!=='#comment'&&!phrasing.has(tag))return 'Paragraphs can contain only inline text content.';
  if(item.t==='keep'&&(parent==='p'||phrasing.has(parent))&&typeof kept==='object'&&kept&&!kept.inline)return 'Paragraphs can contain only inline text content.';
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
 return node.marker?require('./list-markers.cjs').patch(raw,node.tag,node.marker,jsx):raw;
}
const inlineTag=tag=>tag==='#text'||tag==='#comment'||phrasing.has(tag);
function patchTag(raw,from,to){
 if(!(tags.has(from)||from==='div')||!['p','ul','ol','li','div'].includes(to))throw Error('Only paragraph and list source tags can be converted.');
 const opening=new RegExp('^<'+from+'(?=[\\s>])','i'),closing=new RegExp('</'+from+'\\s*>$','i');
 if(!opening.test(raw)||!closing.test(raw))throw Error('The paragraph/list source needs explicit static opening and closing tags.');
 return raw.replace(opening,'<'+to).replace(closing,'</'+to+'>');
}
module.exports={contains,validateNode,placement,markup,inlineTag,patchTag};
