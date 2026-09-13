'use strict';
// Semantic text blocks. Source writers validate placement against the actual
// parent and preserved descendants before producing any edit.
const tags=new Set(['p','ul','ol','li']);
const flow=new Set(['div','section','article','aside','nav','main','header','footer','blockquote','li','td','th','form','fieldset','figure','figcaption','details','dialog','body']);
const phrasing=new Set(['span','a','strong','em','b','i','u','s','sup','sub','br','code','mark','small','abbr','time','img','input','label','button']);
const contains=items=>Array.isArray(items)&&items.some(item=>item&&(item.t==='block'||contains(item.children)));
function validateNode(node){
 if(!tags.has(node.tag)||Object.keys(node).some(key=>!['t','tag','children','start'].includes(key)))return 'Unsupported paragraph or list node.';
 if(Object.hasOwn(node,'start')&&(node.tag!=='ol'||!Number.isInteger(node.start)||node.start<1||node.start>1000000))return 'Invalid ordered list start.';
 return null;
}
function placement(items,parent,keptTag,level=0){
 for(const item of items){
  const kept=item.t==='keep'?keptTag(item.id):null;
  const tag=item.t==='block'||item.t==='wrap'?item.tag:item.t==='link'?'a':item.t==='style'||item.t==='styles'?'span':item.t==='break'?'br':item.t==='keep'?(typeof kept==='string'?kept:kept?.tag):'#text';
  if(parent==='ul'||parent==='ol'){
   if(tag!=='li'&&tag!=='#comment'&&!(item.t==='text'&&!item.value.trim()))return 'Lists must contain list items.';
  }else if(tag==='li')return 'List items need an ordered or unordered list.';
  if((item.t==='block'||tags.has(tag)||flow.has(tag)||/^h[1-6]$/.test(tag||''))&&!(parent==='ul'||parent==='ol')&&!flow.has(parent))return 'This source element cannot contain paragraphs or lists.';
  // New paragraph boundaries must not move a preserved block/component into
  // phrasing content, where browsers could repair or rearrange the markup.
  if(parent==='p'&&tag!=='#text'&&tag!=='#comment'&&!phrasing.has(tag))return 'Paragraphs can contain only inline text content.';
  if(item.t==='keep'&&(parent==='p'||phrasing.has(parent))&&typeof kept==='object'&&kept&&!kept.inline)return 'Paragraphs can contain only inline text content.';
  const next=level+(tag==='ul'||tag==='ol'?1:0);
  if(next>5)return 'Lists support at most five indentation levels.';
  if(item.children){const error=placement(item.children,tag,keptTag,next);if(error)return error;}
 }
 return null;
}
function markup(node,content){
 const error=validateNode(node);if(error)throw Error(error);
 return '<'+node.tag+(Object.hasOwn(node,'start')?' start="'+node.start+'"':'')+'>'+content+'</'+node.tag+'>';
}
const inlineTag=tag=>tag==='#text'||tag==='#comment'||phrasing.has(tag);
module.exports={contains,validateNode,placement,markup,inlineTag};
