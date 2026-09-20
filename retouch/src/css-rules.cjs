'use strict';
// Shared responsive CSS value/cascade planning, independent of source language.
const background=require('../shell/background-paint.js'),shadowVisibility=require('../shell/shadow-visibility.js'),filterVisibility=require('../shell/filter-visibility.js');
const {valid,families,overlaps,variableName,variableCycle}=require('../shell/html-css-values.js');
function rule(id,width,values,legacy=false){
 const group=p=>Number(!families[p]||p==='border-radius'),key=p=>families['border-radius'].includes(p)?'border-radius-'+p:p;
 // Keep truncation as one stored setting, expanding the legacy browser fallback
 // after authored declarations. Reset removes the expansion without losing them.
 const body=`[data-rt-style="${id}"]{`+Object.entries(values).sort(([a],[b])=>legacy?a.localeCompare(b):group(a)-group(b)||key(a).localeCompare(key(b))).filter(([k])=>k!=='line-clamp').map(([k,v])=>`${k}:${v} !important;`).join('')+(values['line-clamp']===undefined?'':values['line-clamp']==='none'?'-webkit-line-clamp:unset !important;overflow:visible !important;display:block !important;-webkit-box-orient:horizontal !important;':`overflow:hidden !important;display:-webkit-box !important;-webkit-box-orient:vertical !important;-webkit-line-clamp:${values['line-clamp']} !important;`)+'}';
 return width?`@media (min-width: ${width}px){${body}}`:body;
}
function change(state,op,inline=''){
 const refuse=reason=>({ok:false,refused:true,reason});
 try{
  if(op.changes!==undefined&&(op.changes===null||typeof op.changes!=='object'||Array.isArray(op.changes)||Object.hasOwn(op,'property')))return refuse('Provide a property or a CSS change set.');
  if(op.resetScope!==undefined&&(op.resetScope!==true||Object.hasOwn(op,'property')||Object.hasOwn(op,'value')||Object.hasOwn(op,'changes')))return refuse('Reset a screen scope without additional property changes.');
  const block=state.blocks.find(b=>b.width===op.width),values={...block?.values};
  let changes=op.resetScope?Object.keys(values).map(property=>[property,null]):op.changes===undefined?[[op.property,op.value]]:Object.entries(op.changes);
  if(op.resetScope&&Number.isInteger(op.width)&&op.width>=0&&op.width<=7680&&!changes.length)return {ok:true,changed:false};
  if(!Number.isInteger(op.width)||op.width<0||op.width>7680||!changes.length||!op.resetScope&&changes.length>64||changes.some(([property,value])=>!valid(property,value)))return refuse('Unsupported CSS property, value or screen width.');
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
  if(JSON.stringify(values)===JSON.stringify(block?.values||{}))return {ok:true,changed:false};
  const rules=new Map(state.blocks.map(b=>[b.width,b.values]));
  if(Object.keys(values).length)rules.set(op.width,values);else rules.delete(op.width);
  if(op.resetScope||changes.some(([property,value])=>variableName(property)&&typeof value==='string'&&value.startsWith('var('))){
   const effective={};for(const [width,props]of [...rules].sort(([a],[b])=>a-b)){Object.assign(effective,props);const cycle=variableCycle(effective);if(cycle)return refuse('Variable alias cycle at '+(width?width+'px and larger':'all sizes')+': '+cycle.join(' → '));}
  }
  return {ok:true,changed:true,rules};
 }catch(error){return refuse(error.message);}
}
module.exports={rule,change,valid};
