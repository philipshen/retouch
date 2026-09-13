'use strict';
const MagicString=require('magic-string'),{contentHash}=require('./id.cjs');
function inlinePaintOwnership(selected,kind,source){
 let style=selected.attrs.find(a=>a.name==='style');if(!style)return {properties:[]};
 const unsafe=()=>({reason:'Dynamic or malformed inline styles control this SVG layer.',properties:[]});
 if(kind==='react'){
  const attribute=selected.node.openingElement.attributes.find(a=>a.type==='JSXAttribute'&&a.name.name==='style'),object=attribute?.value?.expression;
  if(object?.type==='NullLiteral')return {properties:[]};
  if(object?.type!=='ObjectExpression')return unsafe();const properties=[],conversions={};
  for(const property of object.properties){
   if(property.type!=='ObjectProperty'||property.computed||!['Identifier','StringLiteral'].includes(property.key.type))return unsafe();
   // Inspect ownership without evaluating the source expressions.
   const value=property.value;
   if(value.type!=='NullLiteral'&&value.value!=='')properties.push(property.key.name??property.key.value);
  }
  for(const paint of ['fill','stroke']){
   const matches=object.properties.filter(property=>(property.key.name??property.key.value)===paint);
   const value=matches.length===1?matches[0].value:null;
   if(value?.type==='StringLiteral'&&!/\bvar\(/i.test(value.value)&&require('./html-svg-gradient.cjs').valid('stop-color',value.value))conversions[paint]={start:value.start,end:value.end,text:'null'};
  }
  return {properties,conversions};
 }
 if(typeof style.value!=='string')return unsafe();
 if(kind==='liquid'){const parsed=require('parse5').parseFragment('<i '+source.slice(style.start,style.end)+'>').childNodes[0];style={...style,value:parsed?.attrs.find(attribute=>attribute.name==='style')?.value};if(typeof style.value!=='string')return unsafe();}
 const properties=[],declarations=[],stack=[];let text='',quote=null,comment=false,segmentStart=0;
 const declaration=end=>{const start=segmentStart;segmentStart=end;const clean=text.trim();text='';if(!clean)return true;const colon=clean.indexOf(':');if(colon<1)return false;
  const name=clean.slice(0,colon).trim().replace(/\\([a-f\d]{1,6})(?:\r\n|[\t\n\r\f ])?|\\([^\n\r\f])/gi,(_,hex,char)=>hex?String.fromCodePoint(Math.min(parseInt(hex,16)||0xfffd,0x10ffff)):char).toLowerCase();
  if(!/^(?:--[\w-]+|[a-z-]+)$/.test(name))return false;properties.push(name);declarations.push({name,value:clean.slice(colon+1).trim(),start,end});return true;
 };
 for(let i=0;i<style.value.length;i++){
  const c=style.value[i],next=style.value[i+1];if(comment){if(c==='*'&&next==='/'){comment=false;i++;}continue;}
  if(quote){text+=c;if(c==='\\'){if(next!==undefined)text+=style.value[++i];}else if(c===quote)quote=null;continue;}
  if(c==='/'&&next==='*'){comment=true;i++;continue;}if(c==='"'||c==="'"){quote=c;text+=c;continue;}
  if(c==='\\'){text+=c;if(next!==undefined)text+=style.value[++i];continue;}
  if('([{'.includes(c))stack.push(c);else if(')]}'.includes(c)){if(stack.pop()!==({')':'(',']':'[','}':'{'})[c])return unsafe();}
  if(c===';'&&!stack.length){if(!declaration(i+1))return unsafe();}else text+=c;
 }
 if(quote||comment||stack.length||!declaration(style.value.length))return unsafe();
 const conversions={},raw=source.slice(style.start,style.end),quoted=/^style\s*=\s*(["'])([\s\S]*)\1$/i.exec(raw);
 for(const paint of ['fill','stroke']){
  const matches=declarations.filter(declaration=>declaration.name===paint),declaration=matches.length===1?matches[0]:null;
  if(!declaration||/\bvar\(/i.test(declaration.value)||!require('./html-svg-gradient.cjs').valid('stop-color',declaration.value.replace(/\s*!important\s*$/i,'')))continue;
  if(quoted&&quoted[2]===style.value){const offset=style.start+raw.indexOf(quoted[1])+1;conversions[paint]={start:offset+declaration.start,end:offset+declaration.end,text:''};}
  else{const remaining=style.value.slice(0,declaration.start)+style.value.slice(declaration.end);conversions[paint]={start:style.start,end:style.end,text:'style="'+remaining.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')+'"'};}
 }
 return {properties,conversions};
}
function inspect(resolved,kind){
 const tag=kind==='react'?require('./id.cjs').jsxElementName(resolved.element.node):resolved.element.tag;if(!['rect','circle','ellipse','line','path','polygon','polyline','text','g'].includes(tag))return null;
 let selected,viewport,nodes;
 if(kind==='html'){
  const raw=resolved.element.node;if(raw.namespaceURI!=='http://www.w3.org/2000/svg')return null;
  let root=raw;while(root.parentNode)root=root.parentNode;nodes=[];
  const walk=n=>{if(n.tagName)nodes.push(n);for(const c of n.childNodes||[])walk(c);};walk(root);
  const record=n=>({tag:n.tagName,start:n.sourceCodeLocation?.startOffset,nameEnd:n.sourceCodeLocation?.startOffset+1+n.tagName.length,close:n.sourceCodeLocation?.endTag?.startOffset,attrs:(n.attrs||[]).map(a=>({...a,start:n.sourceCodeLocation?.attrs?.[a.name.toLowerCase()]?.startOffset,end:n.sourceCodeLocation?.attrs?.[a.name.toLowerCase()]?.endOffset})),unsafe:false});
  selected=record(raw);for(let n=raw.parentNode;n;n=n.parentNode)if(n.tagName==='svg'){viewport=record(n);break;}
 }else{const source=require('./source-svg-gradient.cjs'),records=source.records(resolved,kind);nodes=records.nodes;selected=records.selected;if(!selected||!source.svg(selected))return null;for(let n=selected.parent;n;n=n.parent)if(n.tag==='svg'){viewport={...n,close:kind==='react'?n.node.closingElement?.start:n.node.closeStart};break;}}
 if(!['rect','circle','ellipse','line','path','polygon','polyline','text','g'].includes(selected.tag))return null;
 let reason=null;if(!viewport||!Number.isInteger(viewport.close)||resolved.source.slice(viewport.close,viewport.close+2)!=='</')reason='This layer needs an explicit SVG viewport closing tag.';
 const inline=inlinePaintOwnership(selected,kind,resolved.source);
 const unknownAttributes=selected.attrs.some(a=>a.value===undefined&&a.name!=='style'&&(kind!=='react'||['class','className','dangerouslySetInnerHTML'].includes(a.name)));
 if(selected.unsafe||unknownAttributes||selected.attrs.some((a,i)=>selected.attrs.findIndex(b=>b.name===a.name)!==i))reason='Dynamic or duplicate attributes control this SVG layer.';
 if(inline.reason)reason=inline.reason;
 if(selected.attrs.some(a=>/\{[%{]|\b(?:v-bind|x-bind|v-for|v-if|x-for|x-if)\b/.test(a.name+' '+a.value)))reason='Template expressions control this SVG layer.';
 const classes=selected.attrs.filter(a=>['class','className'].includes(a.name)).map(a=>a.value||'').join(' '),paintReasons=Object.fromEntries(['fill','stroke'].map(paint=>[paint,classes.split(/\s+/).some(token=>require('../shell/svg-paint.js').property(require('../shell/responsive.js').split(token).value)===paint)?'Paint classes control this '+paint+', including responsive or state variants. Edit its paint styles instead.':null]));
 for(const paint of ['fill','stroke'])if(inline.properties.some(name=>name.toLowerCase()==='all')||inline.properties.some(name=>name.toLowerCase()===paint)&&!inline.conversions?.[paint])paintReasons[paint]='Inline styles control this '+paint+'. Edit its paint styles instead.';
 for(const paint of ['fill','stroke'])if(selected.attrs.some(a=>a.name===paint&&a.value===undefined))paintReasons[paint]='A dynamic expression controls this '+paint+'. Edit its source expression instead.';
 return {selected,viewport,nodes,reason,paintReasons,inlineConversions:inline.conversions||{}};
}
function describe(resolved,kind){const state=inspect(resolved,kind);if(!state)return null;return {reason:state.reason,paintReasons:state.paintReasons,inlinePaints:Object.keys(state.inlineConversions),values:['fill','stroke'].flatMap(paint=>{const value=state.selected.attrs.find(a=>a.name===paint)?.value;return value===undefined&&state.selected.attrs.some(a=>a.name===paint)?[]:[{paint,value:value??null}];}),paints:['fill','stroke'].filter(p=>!/^url\(/.test(state.selected.attrs.find(a=>a.name===p)?.value||''))};}
function plan(resolved,op,kind){
 const refuse=reason=>({ok:false,refused:true,reason}),state=inspect(resolved,kind);if(!state)return refuse('Select an SVG shape to create a gradient.');if(state.reason)return refuse(state.reason);
 if(op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the SVG layer.');
 const value=op.value;if(!['fill','stroke'].includes(op.paint)||op.stop!==undefined||op.changes!==undefined||!value||Object.keys(value).sort().join(',')!=='color,type'||!['linearGradient','radialGradient'].includes(value.type)||typeof value.color!=='string'||!require('./html-svg-gradient.cjs').valid('stop-color',value.color))return refuse('Choose a gradient type and a valid starting color.');
 if(state.paintReasons[op.paint])return refuse(state.paintReasons[op.paint]);
 const {selected,viewport}=state,old=selected.attrs.find(a=>a.name===op.paint);if(/^url\(/.test(old?.value||''))return refuse('Edit the existing paint resource instead.');
 let id,serial=0;do{id='rt-gradient-'+contentHash(resolved.source+'|'+resolved.element.id+'|'+op.paint+'|'+serial++).slice(0,12);}while(resolved.source.includes(id));
 const escape=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'),color=kind==='react'?'stopColor':'stop-color',opacity=kind==='react'?'stopOpacity':'stop-opacity';
 const resource='<defs><'+value.type+' id="'+id+'"><stop offset="0" '+color+'="'+escape(value.color)+'"/><stop offset="1" '+color+'="'+escape(value.color)+'" '+opacity+'="0"/></'+value.type+'></defs>',token=op.paint+'="url(#'+id+')"',out=new MagicString(resolved.source);
 let delta;if(old){if(!Number.isInteger(old.start)||!Number.isInteger(old.end))return refuse('The paint attribute has no source location.');out.overwrite(old.start,old.end,token);delta=token.length-(old.end-old.start);}else{out.appendLeft(selected.nameEnd,' '+token);delta=token.length+1;}
 const conversion=state.inlineConversions[op.paint];if(conversion){out.overwrite(conversion.start,conversion.end,conversion.text);delta+=conversion.text.length-(conversion.end-conversion.start);}
 out.appendLeft(viewport.close,resource);const after=out.toString(),at=viewport.close+delta,adapter=require('./adapters/'+kind+'.cjs'),location=el=>kind==='html'?el.location.startOffset:kind==='react'?el.node.start:el.tagStart;
 const before=adapter.collect(resolved.source,resolved.relPath).elements,next=adapter.collect(after,resolved.relPath).elements.filter(el=>location(el)<at||location(el)>=at+resource.length);
 if(before.length!==next.length||before.some((el,i)=>el.id!==next[i].id||el.kind!==next[i].kind))return refuse('Creating this gradient changes existing layer identities.');
 return {ok:true,hash:contentHash(after),edits:[{file:resolved.file,before:resolved.source,after}]};
}
module.exports={describe,plan};
