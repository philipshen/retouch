'use strict';
const postcss=require('postcss'),{transform:selector}=require('./picture-selectors.cjs');

// Keep each declaration in its original rule and cascade position. Copying
// computed styles would lose media queries, interaction states and inheritance.
function transform(source){
 if(typeof source!=='string'||Buffer.byteLength(source)>2*1024*1024)throw Error('A stylesheet is too large to adapt for a picture.');
 const root=postcss.parse(source);let size=Buffer.byteLength(source);
 root.walkAtRules(rule=>{if(['scope','namespace'].includes(rule.name.toLowerCase()))throw Error('Scoped or namespaced stylesheets cannot yet be adapted for a picture.');});
 root.walkRules(rule=>{
  for(let parent=rule.parent;parent;parent=parent.parent){
   if(parent.type==='atrule'&&/^(?:-\w+-)?keyframes$/i.test(parent.name))return;
   if(parent.type==='rule')throw Error('Nested CSS rules cannot yet be adapted for a picture.');
  }
  const before=rule.selector,after=selector(before);size+=Buffer.byteLength(after)-Buffer.byteLength(before);
  if(size>20*1024*1024)throw Error('The adapted stylesheet is too large.');
  rule.selector=after;
 });
 const result=root.toString();
 if(Buffer.byteLength(result)>20*1024*1024)throw Error('The adapted stylesheet is too large.');
 return result;
}
module.exports={transform};
