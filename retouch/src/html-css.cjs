'use strict';
const background=require('../shell/background-paint.js'),shadowVisibility=require('../shell/shadow-visibility.js'),filterVisibility=require('../shell/filter-visibility.js');
const parse5=require('parse5'),MagicString=require('magic-string'),html=require('./adapters/html.cjs');
const {valid,families,overlaps,variableName,variableCycle}=require('../shell/html-css-values.js');
const escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const attr=(node,name)=>node.attrs?.find(a=>a.name===name)?.value;
function rule(id,width,values,legacy=false){
 const group=p=>Number(!families[p]||p==='border-radius'),key=p=>families['border-radius'].includes(p)?'border-radius-'+p:p;
 // Keep truncation as one stored setting, expanding the legacy browser fallback
 // after authored declarations. Reset removes the expansion without losing them.
 const body=`[data-rt-style="${id}"]{`+Object.entries(values).sort(([a],[b])=>legacy?a.localeCompare(b):group(a)-group(b)||key(a).localeCompare(key(b))).filter(([k])=>k!=='line-clamp').map(([k,v])=>`${k}:${v} !important;`).join('')+(values['line-clamp']===undefined?'':values['line-clamp']==='none'?'-webkit-line-clamp:unset !important;overflow:visible !important;display:block !important;-webkit-box-orient:horizontal !important;':`overflow:hidden !important;display:-webkit-box !important;-webkit-box-orient:vertical !important;-webkit-line-clamp:${values['line-clamp']} !important;`)+'}';
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
function describe(resolved){try{const state=inspect(resolved);return {cssAuthoring:true,cssRules:Object.fromEntries(state.blocks.map(b=>[b.width,b.values])),cssRuleTexts:Object.fromEntries(state.blocks.map(b=>[b.width,b.node.childNodes.map(n=>n.value||'').join('')]))};}catch(e){return {cssAuthoring:true,cssReason:e.message,cssRules:{}};}}
function plan(resolved,op){
 const refuse=reason=>({ok:false,refused:true,reason});
 try{
  if(op.fileHash&&op.fileHash!==resolved.hash)return refuse('The file changed. Re-select the element.');
  if(op.changes!==undefined&&(op.changes===null||typeof op.changes!=='object'||Array.isArray(op.changes)||Object.hasOwn(op,'property')))return refuse('Provide a property or a CSS change set.');
  if(op.resetScope!==undefined&&(op.resetScope!==true||Object.hasOwn(op,'property')||Object.hasOwn(op,'value')||Object.hasOwn(op,'changes')))return refuse('Reset a screen scope without additional property changes.');
  const originalSource=resolved.source;
  if(Object.keys(op.changes||{[op.property]:op.value}).some(name=>/^--rt-scale-(?:factor|move-[xy])$/.test(name))){const source=require('./group-scale-runtime.cjs').upgrade(originalSource);if(source!==originalSource){const elements=html.collect(source,resolved.relPath).elements;resolved={...resolved,source,elements,element:elements.find(item=>item.id===resolved.element.id)};}}
  const state=inspect(resolved),block=state.blocks.find(b=>b.width===op.width),values={...block?.values};
  let changes=op.resetScope?Object.keys(values).map(property=>[property,null]):op.changes===undefined?[[op.property,op.value]]:Object.entries(op.changes);
  if(op.resetScope&&Number.isInteger(op.width)&&op.width>=0&&op.width<=7680&&!changes.length)return {ok:true,hash:resolved.hash,edits:[]};
  if(!Number.isInteger(op.width)||op.width<0||op.width>7680||!changes.length||!op.resetScope&&changes.length>32||changes.some(([property,value])=>!valid(property,value)))return refuse('Unsupported CSS property, value or screen width.');
  // Color edits and resets must update the hidden original in the same source
  // transaction. Explicit visibility change sets already carry both properties.
  const colorChange=changes.find(([property])=>property==='background-color');
  const effective=Object.assign({},...state.blocks.filter(item=>item.width<=op.width).sort((a,b)=>a.width-b.width).map(item=>item.values));
  if(colorChange&&!changes.some(([property])=>property===background.property)&&Object.hasOwn(effective,background.property)&&(colorChange[1]===null||effective[background.property]!=='none')){
   const replacement=colorChange[1]===null?background.reset():background.edit(effective['background-color'],effective[background.property],colorChange[1]);
   changes=changes.filter(([property])=>property!=='background-color').concat(Object.entries(replacement));
  }
  for(const [property,key]of Object.entries(filterVisibility.properties)){
   const effect=changes.find(([name])=>name===property),metadata=changes.find(([name])=>name===key);
   if(metadata){if(!effect)return refuse('Write filter visibility with its filter stack.');if(effect[1]===null||metadata[1]===null){if(effect[1]!==null||metadata[1]!==null)return refuse('Reset filter visibility and its stack together.');}else filterVisibility.read(effect[1],metadata[1]);}
   else if(effect&&state.blocks.some(block=>block.width<=op.width&&Object.hasOwn(block.values,key)))changes.push([key,effect[1]===null?null:'none']);
  }
  const shadowChange=changes.find(([property])=>property==='box-shadow'),metadataChange=changes.find(([property])=>property===shadowVisibility.property);
  if(metadataChange){if(!shadowChange)return refuse('Write shadow visibility with its shadow stack.');const css=shadowChange[1],metadata=metadataChange[1];if(css===null||metadata===null){if(css!==null||metadata!==null)return refuse('Reset the shadow stack and its visibility together.');}else shadowVisibility.read(css,metadata);}
  else if(shadowChange&&state.blocks.some(block=>block.width<=op.width&&Object.hasOwn(block.values,shadowVisibility.property)))changes.push([shadowVisibility.property,shadowChange[1]===null?null:'none']);
  const inline=attr(resolved.element.node,'style')||'';
  // Reset must remain possible even if an external inline rule now wins.
  const important=[...inline.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/(?:^|;)\s*([a-z-]+)\s*:[^;]*!\s*important\s*(?=;|$)/gi)].map(m=>m[1].toLowerCase());
  if(changes.some(([property,value])=>value!==null&&important.some(p=>overlaps(p,property))))return refuse('This property overlaps an important inline style. Edit that source rule first.');
  // Presets clear both logical and physical bounds. Once a physical bound is
  // edited or reset, retain the other physical bound and release neutral aliases.
  for(const bound of ['min','max']){
   const neutral=bound==='min'?'0px':'none',aliases=[bound+'-inline-size',bound+'-block-size'];
   if(['width','height'].every(axis=>values[bound+'-'+axis]===neutral)&&changes.some(([key])=>key===bound+'-width'||key===bound+'-height')&&!changes.some(([key])=>aliases.includes(key)))for(const key of aliases)if(values[key]===neutral)delete values[key];
  }
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
  if(op.resetScope||changes.some(([property,value])=>variableName(property)&&typeof value==='string'&&value.startsWith('var('))){
   const effective={};for(const [width,props]of [...rules].sort(([a],[b])=>a-b)){Object.assign(effective,props);const cycle=variableCycle(effective);if(cycle)return refuse('Variable alias cycle at '+(width?width+'px and larger':'all sizes')+': '+cycle.join(' → '));}
  }
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
