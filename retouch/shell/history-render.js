(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.RetouchHistoryRender=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function targets(manifest,document){
  if(!manifest||manifest.attribute!=='data-rt-revision'||!Array.isArray(manifest.groups))return null;
  const hashes=new Map(manifest.groups.flatMap(group=>group.ids.map(id=>[id,group.hash]))),result=new Map();
  for(const node of document.querySelectorAll('[data-rt]')){const id=node.getAttribute('data-rt');if(hashes.has(id))result.set(id,hashes.get(id));}
  return {attribute:manifest.attribute,hashes:result};
 }
 function matches(target,document){
  if(!target)return false;
  const found=new Set();
  for(const node of document.querySelectorAll('[data-rt]')){
   const id=node.getAttribute('data-rt');if(!target.hashes.has(id))continue;
   if(node.getAttribute(target.attribute)!==target.hashes.get(id))return false;
   found.add(id);
  }
  return found.size===target.hashes.size;
 }
 return {targets,matches};
});
