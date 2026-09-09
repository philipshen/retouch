'use strict';
const parse5=require('parse5'),MagicString=require('magic-string'),html=require('./adapters/html.cjs');
const {valid,families,overlaps}=require('../shell/html-css-values.js');
const escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const attr=(node,name)=>node.attrs?.find(a=>a.name===name)?.value;
function rule(id,width,values,legacy=false){
 const group=p=>Number(!families[p]||p==='border-radius'),key=p=>families['border-radius'].includes(p)?'border-radius-'+p:p;
 const body=`[data-rt-style="${id}"]{`+Object.entries(values).sort(([a],[b])=>legacy?a.localeCompare(b):group(a)-group(b)||key(a).localeCompare(key(b))).map(([k,v])=>`${k}:${v} !important;`).join('')+'}';
 return width?`@media (min-width: ${width}px){${body}}`:body;
}
function inspect(resolved){
 const tree=parse5.parse(resolved.source,{sourceCodeLocationInfo:true}),used=new Set();
 function identities(node){for(const name of ['data-rt-style','data-rt-css']){const value=attr(node,name);if(value)used.add(value);}for(const child of node.childNodes||[])identities(child);}
 identities(tree);
 let id=attr(resolved.element.node,'data-rt-style')||resolved.element.id;
 if(!attr(resolved.element.node,'data-rt-style'))for(let attempt=0;used.has(id);attempt++)id=html.contentHash(resolved.source+'|'+resolved.element.id+'|'+attempt).slice(0,10);
 if(!/^[a-f0-9]{10}$/.test(id))throw Error('The element has an unsupported style identity.');
 const blocks=[],owners=[];let headEnd=null;
 function walk(node){
  if(attr(node,'data-rt-style')===id)owners.push(node);
  if(node.tagName==='head'&&node.sourceCodeLocation?.endTag)headEnd=node.sourceCodeLocation.endTag.startOffset;
  if(node.tagName==='style'&&attr(node,'data-rt-css')===id){
   const width=Number(attr(node,'data-rt-width')),values=JSON.parse(attr(node,'data-rt-values')||'null');
   if(!Number.isInteger(width)||width<0||width>7680||!values||Array.isArray(values)||typeof values!=='object'||Object.entries(values).some(([p,v])=>!valid(p,v)||v===null))throw Error('The stored CSS rule is invalid.');
   if(![rule(id,width,values),rule(id,width,values,true)].includes(node.childNodes.map(n=>n.value||'').join('')))throw Error('The CSS rule changed outside the editor.');
   if(!node.sourceCodeLocation?.endTag||blocks.some(b=>b.width===width))throw Error('The CSS rule is ambiguous.');
   blocks.push({node,width,values});
  }
  for(const child of node.childNodes||[])walk(child);
 }
 walk(tree);if(owners.length>1||(owners.length===1&&!attr(resolved.element.node,'data-rt-style')))throw Error('This style identity is shared by multiple elements.');
 return {id,blocks,headEnd,used};
}
function describe(resolved){try{const state=inspect(resolved);return {cssAuthoring:true,cssRules:Object.fromEntries(state.blocks.map(b=>[b.width,b.values]))};}catch(e){return {cssAuthoring:true,cssReason:e.message,cssRules:{}};}}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason});
 try{
  if(op.fileHash&&op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the element.');
  if(op.changes!==undefined&&(op.changes===null||typeof op.changes!=='object'||Array.isArray(op.changes)||Object.hasOwn(op,'property')))return refuse('Provide a property or a CSS change set.');
  const changes=op.changes===undefined?[[op.property,op.value]]:Object.entries(op.changes);
  if(!Number.isInteger(op.width)||op.width<0||op.width>7680||!changes.length||changes.length>32||changes.some(([property,value])=>!valid(property,value)))return refuse('Unsupported CSS property, value or screen width.');
  const inline=attr(resolved.element.node,'style')||'';
  // Reset must remain possible even if an external inline rule now wins.
  const important=[...inline.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/(?:^|;)\s*([a-z-]+)\s*:[^;]*!\s*important\s*(?=;|$)/gi)].map(m=>m[1].toLowerCase());
  if(changes.some(([property,value])=>value!==null&&important.some(p=>overlaps(p,property))))return refuse('This property overlaps an important inline style. Edit that source rule first.');
  const state=inspect(resolved),block=state.blocks.find(b=>b.width===op.width),values={...block?.values};
  for(const [property,value]of changes){
  if(value===null)delete values[property];else {
   values[property]=value;
   // A new shorthand supersedes its old per-edge overrides in this scope.
   for(const child of families[property]||[])delete values[child];
  }}
  if(JSON.stringify(values)===JSON.stringify(block?.values||{}))return {ok:true,hash:resolved.hash,edits:[]};
  const out=new MagicString(resolved.source);
  if(!attr(resolved.element.node,'data-rt-style'))out.appendLeft(resolved.element.location.startTag.startOffset+1+resolved.element.tag.length,` data-rt-style="${state.id}"`);
  const rules=new Map(state.blocks.map(b=>[b.width,b.values]));
  if(Object.keys(values).length)rules.set(op.width,values);else rules.delete(op.width);
  for(const old of state.blocks)out.remove(old.node.sourceCodeLocation.startOffset,old.node.sourceCodeLocation.endOffset);
  const content=[...rules].sort(([a],[b])=>a-b).map(([width,props])=>`<style data-rt-css="${state.id}" data-rt-width="${width}" data-rt-values="${escape(JSON.stringify(props))}">${rule(state.id,width,props)}</style>`).join('');
  if(content)out.appendLeft(state.headEnd??resolved.source.length,content);
  const after=out.toString();return {ok:true,hash:html.contentHash(after),edits:[{file:resolved.file,before:resolved.source,after}]};
 }catch(e){return refuse(e.message);}
}
function clone(resolved,range){
 const chunk=new MagicString(resolved.source.slice(range.start,range.end)),styles=[];
 const elements=resolved.elements||html.collect(resolved.source,resolved.relPath).elements;
 const allocated=new Set();
 for(const element of elements){
  const marker=element.location.attrs?.['data-rt-style'];
  if(!marker||marker.startOffset<range.start||marker.endOffset>range.end)continue;
  const state=inspect({...resolved,element});let id,counter=0;
  do{id=html.contentHash(resolved.source+'|copy|'+state.id+'|'+counter++).slice(0,10);}while(state.used.has(id)||allocated.has(id));
  allocated.add(id);
  chunk.overwrite(marker.startOffset-range.start,marker.endOffset-range.start,`data-rt-style="${id}"`);
  for(const block of state.blocks.sort((a,b)=>a.width-b.width))styles.push(`<style data-rt-css="${id}" data-rt-width="${block.width}" data-rt-values="${escape(JSON.stringify(block.values))}">${rule(id,block.width,block.values)}</style>`);
 }
 return {chunk:chunk.toString(),append(source){
  if(!styles.length)return source;
  const tree=parse5.parse(source,{sourceCodeLocationInfo:true});let end=source.length;
  function walk(node){if(node.tagName==='head'&&node.sourceCodeLocation?.endTag)end=node.sourceCodeLocation.endTag.startOffset;for(const child of node.childNodes||[])walk(child);}
  walk(tree);return source.slice(0,end)+styles.join('')+source.slice(end);
 }};
}
module.exports={describe,plan,valid,rule,clone};
