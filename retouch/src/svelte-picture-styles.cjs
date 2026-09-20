'use strict';
const MagicString=require('magic-string'),postcss=require('postcss'),compiler=require('svelte/compiler');
const css=require('./svelte-css.cjs'),source=require('./svelte-source.cjs'),stylesheet=require('./picture-stylesheet.cjs');
// Adapt the authored CSS in one component. This is not a proof that styles
// imported by JavaScript, ancestors or the host document have been adapted.
function plan(resolved,{source:text=resolved.source}={}){
 const state=css.documentState(text,resolved.relPath),out=new MagicString(text);
 if(!state.style)return {source:text,changed:false};
 const ranges=state.range?[{start:state.style.content.start,end:state.range.start},{start:state.range.end,end:state.style.content.end}]:[{start:state.style.content.start,end:state.style.content.end}];
 let changed=false;
 for(const range of ranges){
  const before=text.slice(range.start,range.end);if(!before.trim())continue;
  const parsed=postcss.parse(before);
  parsed.walkAtRules(rule=>{if(rule.name.toLowerCase()==='import')throw Error('Imported CSS must be adapted before creating a Svelte picture wrapper.');});
  // Svelte's :global is a compiler directive, not an ordinary CSS pseudo.
  // Do not run ordinary selector expansion over it without a scope proof.
  parsed.walkRules(rule=>{const selector=require('postcss-selector-parser')().astSync(rule.selector);selector.walkPseudos(node=>{if(node.value.toLowerCase()===':global')throw Error('Global Svelte selectors need a separate scope-preserving picture adaptation.');});});
  const after=stylesheet.transform(before);if(after!==before){out.overwrite(range.start,range.end,after);changed=true;}
 }
 const after=out.toString(),next=source.collect(after,resolved.relPath).elements;
 if(next.length!==state.parsed.elements.length||next.some((element,index)=>element.id!==state.parsed.elements[index].id||element.tag!==state.parsed.elements[index].tag))throw Error('Stylesheet adaptation changed Svelte source identities.');
 const final=css.documentState(after,resolved.relPath);if(JSON.stringify(final.model)!==JSON.stringify(state.model))throw Error('Stylesheet adaptation changed managed responsive styles.');
 compiler.compile(after,{filename:resolved.relPath,generate:false});
 return {source:after,changed};
}
module.exports={plan};
