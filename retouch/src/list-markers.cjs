'use strict';
const valid=(tag,value)=>tag==='ul'?value==='disc':tag==='ol'&&['decimal','lower-alpha','lower-roman'].includes(value);
// Split only at declaration boundaries; quoted URLs, comments, and custom
// property blocks must remain intact when a marker override is appended.
function css(value,marker){
 const parts=[];let start=0,quote=null,comment=false,stack=[];
 for(let i=0;i<value.length;i++){
  const c=value[i],next=value[i+1];
  if(comment){if(c==='*'&&next==='/'){comment=false;i++;}continue;}
  if(quote){if(c==='\\')i++;else if(c===quote)quote=null;continue;}
  if(c==='/'&&next==='*'){comment=true;i++;continue;}
  if(c==='"'||c==="'"){quote=c;continue;}if(c==='\\'){i++;continue;}
  if('([{'.includes(c))stack.push(c);else if(')]}'.includes(c)&&stack.pop()!==({')':'(',']':'[','}':'{'})[c])throw Error('The list style has unbalanced CSS.');
  if(c===';'&&!stack.length){parts.push(value.slice(start,i+1));start=i+1;}
 }
 if(quote||comment||stack.length)throw Error('The list style has incomplete CSS.');
 parts.push(value.slice(start));
 const clean=part=>part.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\\([a-f\d]{1,6})(?:\r\n|[\t\n\r\f ])?|\\([^\n\r\f])/gi,(_,hex,char)=>hex?String.fromCodePoint(Math.min(parseInt(hex,16)||0xfffd,0x10ffff)):char);
 const relevant=part=>/^\s*(?:list-style(?:-type)?|all)\s*:/i.test(clean(part));
 const important=parts.some(part=>relevant(part)&&/!\s*important\s*;?\s*$/i.test(clean(part)));
 // Replace our trailing canonical override, keeping earlier author CSS exact.
 const last=parts.findLastIndex(part=>part.trim());
 if(last>=0&&/^ ?list-style-type: (?:disc|decimal|lower-alpha|lower-roman)(?: !important)?;$/.test(parts[last]))value=parts.slice(0,last).join('');
 return value+(value.trim()&&!value.trimEnd().endsWith(';')?';':'')+(value?' ':'')+'list-style-type: '+marker+(important?' !important':'')+';';
}
function patch(raw,tag,marker,jsx=false){
 if(!valid(tag,marker))throw Error('Invalid list marker.');
 if(jsx){
  const node=require('@babel/parser').parseExpression(raw,{plugins:['jsx','typescript']}),opening=node.openingElement;
  if(!opening||opening.name.name!==tag||opening.attributes.some(a=>a.type==='JSXSpreadAttribute'))throw Error('List markers need an explicit source style.');
  const attrs=opening.attributes.filter(a=>a.name.name==='style');if(attrs.length>1)throw Error('Ambiguous list style.');
  const attr=attrs[0];if(!attr)return raw.slice(0,opening.end-1)+' style={{listStyleType:'+JSON.stringify(marker)+'}}'+raw.slice(opening.end-1);
  const expression=attr.value?.expression;if(!expression||expression.type==='JSXEmptyExpression')throw Error('List markers need a style expression.');
  if(expression.type==='ObjectExpression'){
   const properties=expression.properties,last=properties.at(-1);
   if(last?.type==='ObjectProperty'&&!last.computed&&(last.key.name||last.key.value)==='listStyleType')return raw.slice(0,last.value.start)+JSON.stringify(marker)+raw.slice(last.value.end);
   const hasMarker=properties.some(p=>p.type==='ObjectProperty'&&!p.computed&&(p.key.name||p.key.value)==='listStyleType');
   if(hasMarker)return raw.slice(0,expression.start)+'{...('+raw.slice(expression.start,expression.end)+'),listStyleType:'+JSON.stringify(marker)+'}'+raw.slice(expression.end);
   const tail=raw.slice(last?.end||expression.start+1,expression.end-1).replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
   const at=expression.end-1;return raw.slice(0,at)+(last&&!tail.includes(',')?',':'')+'\nlistStyleType:'+JSON.stringify(marker)+raw.slice(at);
  }
  return raw.slice(0,expression.start)+'{...('+raw.slice(expression.start,expression.end)+'),listStyleType:'+JSON.stringify(marker)+'}'+raw.slice(expression.end);
 }
 const errors=[],tree=require('parse5').parseFragment(raw,{sourceCodeLocationInfo:true,onParseError:e=>errors.push(e)}),node=tree.childNodes[0],loc=node?.sourceCodeLocation;
 if(node?.tagName!==tag||!loc?.startTag||errors.some(e=>e.code==='duplicate-attribute'&&e.startOffset<loc.startTag.endOffset))throw Error('Ambiguous list source.');
 const attr=node.attrs.find(a=>a.name==='style'),escape=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
 if(attr&&/\{[{%]/.test(attr.value))throw Error('The list style is controlled by its template.');
 const style='style="'+escape(css(attr?.value||'',marker))+'"';
 if(attr){const range=loc.attrs.style;return raw.slice(0,range.startOffset)+style+raw.slice(range.endOffset);}
 return raw.slice(0,loc.startTag.endOffset-1)+' '+style+raw.slice(loc.startTag.endOffset-1);
}
module.exports={valid,patch,css};
