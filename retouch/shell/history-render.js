(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.RetouchHistoryRender=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function targets(manifest,document){
  if(!manifest||manifest.attribute!=='data-rt-revision'||!Array.isArray(manifest.groups))return null;
  const hashes=new Map(manifest.groups.flatMap(group=>group.ids.map(id=>[id,group.hash]))),result=new Map();
  for(const node of document.querySelectorAll('[data-rt]')){const id=node.getAttribute('data-rt');if(hashes.has(id))result.set(id,hashes.get(id));}
  const styles=manifest.groups.filter(group=>group.css&&group.ids.some(id=>result.has(id))).map(group=>group.css);
  return {attribute:manifest.attribute,hashes:result,styles};
 }
 function matches(target,document){
  if(!target)return false;
  const found=new Set();
  for(const node of document.querySelectorAll('[data-rt]')){
   const id=node.getAttribute('data-rt');if(!target.hashes.has(id))continue;
   if(node.getAttribute(target.attribute)!==target.hashes.get(id))return false;
   found.add(id);
  }
  if(found.size!==target.hashes.size)return false;
  return (target.styles||[]).every(css=>[...(document.styleSheets||[])].some(sheet=>{try{
   if(sheet.disabled||sheet.media?.mediaText&&!document.defaultView?.matchMedia(sheet.media.mediaText).matches)return false;
   return [...sheet.cssRules].some(rule=>rule.selectorText===css.selector&&rule.style?.getPropertyValue(css.property).trim()===css.value);
  }catch{return false;}}));
 }
 return {targets,matches};
});
