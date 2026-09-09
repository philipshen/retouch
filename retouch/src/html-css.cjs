'use strict';
const parse5=require('parse5'),MagicString=require('magic-string'),html=require('./adapters/html.cjs');
const lengths=new Set(['width','height','min-width','max-width','min-height','max-height','gap','column-gap','row-gap','padding','padding-top','padding-right','padding-bottom','padding-left','font-size','line-height','letter-spacing','border-radius','border-width']);
const choices={display:['block','inline-block','flex','grid','none'], 'flex-direction':['row','column','row-reverse','column-reverse'],'flex-wrap':['nowrap','wrap','wrap-reverse'],'align-items':['start','center','end','stretch','baseline'],'justify-content':['start','center','end','space-between','space-around','space-evenly'],'text-align':['start','left','center','right','justify'],'border-style':['none','solid','dashed','dotted','double']};
const colors=new Set(['color','background-color','border-color']);
const escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const attr=(node,name)=>node.attrs?.find(a=>a.name===name)?.value;
function valid(property,value){
 if(value===null)return lengths.has(property)||colors.has(property)||Object.hasOwn(choices,property);
 if(typeof value!=='string'||value.length>150)return false;
 if(lengths.has(property))return /^(?:\d*\.?\d+(?:px|rem|em|%|vw|vh|ch)?|auto|none|normal|min-content|max-content|fit-content)$/.test(value);
 if(colors.has(property))return /^(?:#[a-f\d]{3,8}|[a-z]+|(?:rgb|rgba|hsl|hsla)\([\d.%,\s/]+\))$/i.test(value);
 return choices[property]?.includes(value)||false;
}
function rule(id,width,values){
 const body=`[data-rt-style="${id}"]{`+Object.entries(values).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}:${v} !important;`).join('')+'}';
 return width?`@media (min-width: ${width}px){${body}}`:body;
}
function inspect(resolved){
 const id=attr(resolved.element.node,'data-rt-style')||resolved.element.id;
 if(!/^[a-f0-9]{10}$/.test(id))throw Error('The element has an unsupported style identity.');
 const tree=parse5.parse(resolved.source,{sourceCodeLocationInfo:true}),blocks=[],owners=[];let headEnd=null;
 function walk(node){
  if(attr(node,'data-rt-style')===id)owners.push(node);
  if(node.tagName==='head'&&node.sourceCodeLocation?.endTag)headEnd=node.sourceCodeLocation.endTag.startOffset;
  if(node.tagName==='style'&&attr(node,'data-rt-css')===id){
   const width=Number(attr(node,'data-rt-width')),values=JSON.parse(attr(node,'data-rt-values')||'null');
   if(!Number.isInteger(width)||width<0||width>7680||!values||Array.isArray(values)||typeof values!=='object'||Object.entries(values).some(([p,v])=>!valid(p,v)||v===null))throw Error('The stored CSS rule is invalid.');
   if(node.childNodes.map(n=>n.value||'').join('')!==rule(id,width,values))throw Error('The CSS rule changed outside the editor.');
   if(!node.sourceCodeLocation?.endTag||blocks.some(b=>b.width===width))throw Error('The CSS rule is ambiguous.');
   blocks.push({node,width,values});
  }
  for(const child of node.childNodes||[])walk(child);
 }
 walk(tree);if(owners.length>1||(owners.length===1&&!attr(resolved.element.node,'data-rt-style')))throw Error('This style identity is shared by multiple elements.');
 return {id,blocks,headEnd};
}
function describe(resolved){try{const state=inspect(resolved);return {cssAuthoring:true,cssRules:Object.fromEntries(state.blocks.map(b=>[b.width,b.values]))};}catch(e){return {cssAuthoring:true,cssReason:e.message,cssRules:{}};}}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason});
 try{
  if(op.fileHash&&op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the element.');
  if(!Number.isInteger(op.width)||op.width<0||op.width>7680||!valid(op.property,op.value))return refuse('Unsupported CSS property, value or screen width.');
  const inline=attr(resolved.element.node,'style')||'';
  if(new RegExp('(?:^|;)\\s*'+op.property+'\\s*:[^;]*!important','i').test(inline))return refuse('This property has an important inline style. Edit that source rule first.');
  const state=inspect(resolved),block=state.blocks.find(b=>b.width===op.width),values={...block?.values};
  if(op.value===null)delete values[op.property];else values[op.property]=op.value;
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
module.exports={describe,plan,valid,rule};
