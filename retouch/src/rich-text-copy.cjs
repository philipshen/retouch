'use strict';
// Splitting text duplicates appearance, not identity or behavior. The source,
// never a client-supplied attribute map, determines the copied markup.
const tags=new Set(['li','p','div','span','a','strong','b','em','i','u','s','sup','sub','code','mark','small','abbr']);
const attributes=new Set(['data-retouch-paragraph','class','className','style','title','lang','dir','href','target','rel']);
function markup(raw,content,jsx=false,options={}){
 let tag,attrs;
 if(jsx){
  const node=require('@babel/parser').parseExpression(raw,{plugins:['jsx','typescript']});tag=node.openingElement?.name.name;
  attrs=node.openingElement?.attributes.map(a=>{if(a.type!=='JSXAttribute')throw Error('Splitting this text needs explicit source attributes.');return {name:a.name.name,raw:raw.slice(a.start,a.end)};});
 }else{
  const errors=[],node=require('parse5').parseFragment(raw,{sourceCodeLocationInfo:true,onParseError:e=>errors.push(e)}).childNodes[0];tag=node?.tagName;
  const loc=node?.sourceCodeLocation;if(!loc?.startTag||errors.some(e=>e.code==='duplicate-attribute'&&e.startOffset<loc.startTag.endOffset))throw Error('The split text source has ambiguous attributes.');
  attrs=node.attrs.map(a=>({name:a.name,raw:raw.slice(loc.attrs[a.name].startOffset,loc.attrs[a.name].endOffset)}));
 }
 if(!tags.has(tag)||!attrs)throw Error('This source element cannot be split as text.');
 const copied=[];
 for(const attr of attrs){
  if(attr.name==='href'&&Object.hasOwn(options,'href'))continue;
  if(attributes.has(attr.name))copied.push(attr.raw);
  else if(!['id','key','ref','value'].includes(attr.name)&&!/^on/i.test(attr.name)&&!/^data-rt(?:-|$)/.test(attr.name))throw Error('This text has source attributes that need an explicit split policy.');
 }
 if(Object.hasOwn(options,'href')){if(tag!=='a'||options.href!==null&&!require('../shell/link-values.js').valid(options.href))throw Error('Invalid split link URL.');if(options.href!==null)copied.push('href='+require('./rich-text.cjs').hrefMarkup(options.href,jsx));}
 const result='<'+tag+(copied.length?' '+copied.join(' '):'')+'>'+content+'</'+tag+'>';
 return Object.hasOwn(options,'marker')?require('./list-markers.cjs').patch(result,tag,options.marker,jsx):result;
}
module.exports={tags,markup};
