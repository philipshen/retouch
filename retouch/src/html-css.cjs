'use strict';
const parse5=require('parse5'),MagicString=require('magic-string'),html=require('./adapters/html.cjs');
const {valid,rule,change}=require('./css-rules.cjs');
const escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const attr=(node,name)=>node.attrs?.find(a=>a.name===name)?.value;
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
function describe(resolved){try{const state=inspect(resolved);return {cssAuthoring:true,cssRules:Object.fromEntries(state.blocks.map(b=>[b.width,b.values])),cssRuleTexts:Object.fromEntries(state.blocks.map(b=>[b.width,b.node.childNodes.map(n=>n.value||'').join('')]))};}catch(e){return {cssAuthoring:true,cssReason:e.message,cssRules:{}};}}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason});
 try{
  if(op.fileHash&&op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the element.');
  const originalSource=resolved.source;
  if(Object.keys(op.changes||{[op.property]:op.value}).some(name=>/^--rt-scale-(?:factor|move-[xy])$/.test(name))){const source=require('./group-scale-runtime.cjs').upgrade(originalSource);if(source!==originalSource){const elements=html.collect(source,resolved.relPath).elements;resolved={...resolved,source,elements,element:elements.find(item=>item.id===resolved.element.id)};}}
  const state=inspect(resolved),update=change(state,op,attr(resolved.element.node,'style')||'');
  if(!update.ok)return update;
  if(!update.changed)return {ok:true,hash:resolved.hash,edits:[]};
  const rules=update.rules,out=new MagicString(resolved.source);
  if(!attr(resolved.element.node,'data-rt-style'))out.appendLeft(resolved.element.location.startTag.startOffset+1+resolved.element.tag.length,` data-rt-style="${state.id}"`);
  for(const old of state.blocks)out.remove(old.node.sourceCodeLocation.startOffset,old.node.sourceCodeLocation.endOffset);
  const content=[...rules].sort(([a],[b])=>a-b).map(([width,props])=>`<style data-rt-css="${state.id}" data-rt-width="${width}" data-rt-values="${escape(JSON.stringify(props))}">${rule(state.id,width,props)}</style>`).join('');
  if(content)out.appendLeft(state.headEnd??resolved.source.length,content);
  const after=out.toString();return {ok:true,hash:html.contentHash(after),edits:[{file:resolved.file,before:originalSource,after}]};
 }catch(e){return refuse(e.message);}
}
function clone(resolved,range){
 const chunk=new MagicString(resolved.source.slice(range.start,range.end)),styles=[];
 const elements=resolved.elements||html.collect(resolved.source,resolved.relPath).elements;
 const scaleCopies=new Map(),allocated=new Set(),scaleIdentities=new Set(elements.map(element=>attr(element.node,'data-rt-scale-member')).filter(Boolean));
 for(const element of elements){
  const scaleMarker=element.location.attrs?.['data-rt-scale-member'];
  if(scaleMarker&&scaleMarker.startOffset>=range.start&&scaleMarker.endOffset<=range.end){
   let id,counter=0;do{id=html.contentHash(resolved.source+'|scale-copy|'+element.id+'|'+counter++).slice(0,10);}while(scaleIdentities.has(id));scaleIdentities.add(id);scaleCopies.set(attr(element.node,'data-rt-scale-member'),id);
   chunk.overwrite(scaleMarker.startOffset-range.start,scaleMarker.endOffset-range.start,`data-rt-scale-member="${id}"`);
  }
  const marker=element.location.attrs?.['data-rt-style'];
  if(!marker||marker.startOffset<range.start||marker.endOffset>range.end)continue;
  const state=inspect({...resolved,element});let id,counter=0;
  do{id=html.contentHash(resolved.source+'|copy|'+state.id+'|'+counter++).slice(0,10);}while(state.used.has(id)||allocated.has(id));
  allocated.add(id);
  chunk.overwrite(marker.startOffset-range.start,marker.endOffset-range.start,`data-rt-style="${id}"`);
  for(const block of state.blocks.sort((a,b)=>a.width-b.width))styles.push(`<style data-rt-css="${id}" data-rt-width="${block.width}" data-rt-values="${escape(JSON.stringify(block.values))}">${rule(id,block.width,block.values)}</style>`);
 }
 return {chunk:chunk.toString(),append(source){
  if(scaleCopies.size){
   const tree=parse5.parse(source,{sourceCodeLocationInfo:true}),out=new MagicString(source);
   function copyMembership(node){
    let releasedIds=null;
    if(attr(node,'data-rt-scale-set')!==undefined){
     if(node.tagName!=='script'||attr(node,'type')!=='application/json'||!node.sourceCodeLocation?.endTag)throw Error('Invalid released scale metadata.');
     const validate=require('../runtime/group-scale-bootstrap.js').members,ids=validate((node.childNodes||[]).map(child=>child.value||'').join('')),copies=ids.flatMap(id=>scaleCopies.has(id)?[scaleCopies.get(id)]:[]);
     releasedIds=[...ids,...copies];
     if(copies.length){const value=JSON.stringify(releasedIds);validate(value);out.overwrite(node.sourceCodeLocation.startTag.endOffset,node.sourceCodeLocation.endTag.startOffset,value);}
    }
    const metadata=attr(node,'data-rt-scale');
    if(metadata!==undefined){
     const data=JSON.parse(metadata);if(data.steps?.some(step=>step.styles)){
      const owned=new Set(),collect=node=>{const id=attr(node,'data-rt-scale-member');if(id)owned.add(id);for(const child of node.childNodes||[])collect(child);};
      if(releasedIds){const find=node=>{if(releasedIds.includes(attr(node,'data-rt-scale-member')))collect(node);else for(const child of node.childNodes||[])find(child);};find(tree);}else if(attr(node,'data-rt-group')!==undefined)collect(node);
      for(const step of data.steps)if(step.styles){for(const [old,id]of scaleCopies)if(owned.has(id)&&Object.hasOwn(step.styles,old))step.styles[id]=step.styles[old];step.styles=Object.fromEntries(Object.entries(step.styles).filter(([id])=>owned.has(id)));}
      const value=JSON.stringify(data);require('../runtime/group-scale-bootstrap.js').parse(value);const location=node.sourceCodeLocation.attrs['data-rt-scale'];out.overwrite(location.startOffset,location.endOffset,'data-rt-scale="'+escape(value)+'"');
     }
    }
    for(const child of node.childNodes||[])copyMembership(child);
   }
   copyMembership(tree);source=out.toString();
  }
  if(!styles.length)return source;
  const tree=parse5.parse(source,{sourceCodeLocationInfo:true});let end=source.length;
  function walk(node){if(node.tagName==='head'&&node.sourceCodeLocation?.endTag)end=node.sourceCodeLocation.endTag.startOffset;for(const child of node.childNodes||[])walk(child);}
  walk(tree);return source.slice(0,end)+styles.join('')+source.slice(end);
 }};
}
module.exports={describe,plan,valid,rule,clone};
