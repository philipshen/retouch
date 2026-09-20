'use strict';
const MagicString=require('magic-string'),postcss=require('postcss'),compiler=require('svelte/compiler');
const css=require('./svelte-css.cjs'),source=require('./svelte-source.cjs'),stylesheet=require('./picture-stylesheet.cjs');
const selectorParser=require('postcss-selector-parser'),pictureSelector=require('./picture-selectors.cjs');
function transformSelector(text){
 const root=selectorParser().astSync(text),result=[];
 for(const entry of root.nodes){
  const globals=[];entry.walkPseudos(node=>{if(node.value.toLowerCase()===':global')globals.push(node);});
  if(!globals.length){result.push(pictureSelector.transform(entry.toString()));continue;}
  const meaningful=entry.nodes.filter(node=>node.type!=='comment');
  // A whole-selector global directive has no scoped boundary to move. Keep
  // every expanded alternative global so Svelte never inserts a scope class.
  if(globals.length!==1||meaningful.length!==1||meaningful[0]!==globals[0]||!globals[0].nodes?.length)throw Error('Mixed or block global Svelte selectors need a separate scope-preserving picture adaptation.');
  const inner=globals[0].nodes.map(node=>node.toString()).join(',');
  const expanded=selectorParser().astSync(pictureSelector.transform(inner));
  for(const alternative of expanded.nodes){const copy=entry.clone(),directive=copy.nodes.find(node=>node.type==='pseudo'&&node.value.toLowerCase()===':global');directive.removeAll();directive.append(alternative.clone());result.push(copy.toString());}
 }
 return result.join(',');
}
// Keep global blocks intact: moving their children to the component root
// would change Svelte's keyframe and selector scoping semantics.
function transformStyles(parsed){
 if(Buffer.byteLength(parsed.toString())>2*1024*1024)throw Error('A stylesheet is too large to adapt for a picture.');
 const blocks=[];let marker='retouch-preserved-global-block';
 while(parsed.toString().includes(marker))marker+='-';
 parsed.walkRules(rule=>{
  if(rule.selector.trim()!==':global')return;
  for(let parent=rule.parent;parent;parent=parent.parent)if(parent.type==='rule')throw Error('Nested global blocks need a separate scope-preserving picture adaptation.');
  const inner=postcss.root();for(const node of rule.nodes||[])inner.append(node.clone());
  const adapted=postcss.parse(stylesheet.transform(inner.toString(),{transformSelector}));
  const block=rule.clone({nodes:[]});for(const node of [...adapted.nodes])block.append(node);
  const index=blocks.length;blocks.push(block);rule.replaceWith(postcss.comment({text:marker+index}));
 });
 const result=postcss.parse(stylesheet.transform(parsed.toString(),{transformSelector}));
 result.walkComments(comment=>{if(comment.text.startsWith(marker)){const index=Number(comment.text.slice(marker.length));if(Number.isInteger(index)&&blocks[index])comment.replaceWith(blocks[index]);}});
 const text=result.toString();if(Buffer.byteLength(text)>20*1024*1024)throw Error('The adapted stylesheet is too large.');return text;
}
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
  const after=transformStyles(parsed);if(after!==before){out.overwrite(range.start,range.end,after);changed=true;}
 }
 const after=out.toString(),next=source.collect(after,resolved.relPath).elements;
 if(next.length!==state.parsed.elements.length||next.some((element,index)=>element.id!==state.parsed.elements[index].id||element.tag!==state.parsed.elements[index].tag))throw Error('Stylesheet adaptation changed Svelte source identities.');
 const final=css.documentState(after,resolved.relPath);if(JSON.stringify(final.model)!==JSON.stringify(state.model))throw Error('Stylesheet adaptation changed managed responsive styles.');
 compiler.compile(after,{filename:resolved.relPath,generate:false});
 return {source:after,changed};
}
module.exports={plan};
