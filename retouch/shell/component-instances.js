(function(root){
 'use strict';
 function anchoredFamilies(patterns){
  const parent=patterns.map((_,i)=>i),owner=new Map(),families=new Map();
  const find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
  patterns.forEach((ids,i)=>ids.forEach(id=>{if(owner.has(id))parent[find(i)]=find(owner.get(id));else owner.set(id,i);}));
  patterns.forEach((ids,i)=>{const key=find(i);if(!families.has(key))families.set(key,[]);families.get(key).push(ids);});
  const result=new Map();for(const members of families.values()){
   const anchored=members[0].some(id=>members.every(ids=>ids.filter(value=>value===id).length===1));for(const ids of members)result.set(ids,anchored);
  }
  return result;
 }
 function group(elements,patterns=[]){
  const result=[],anchored=anchoredFamilies(patterns);
  for(let i=0;i<elements.length;){
   const candidates=patterns.filter(ids=>ids.length&&ids.every((id,n)=>{
    const el=elements[i+n];return el?.getAttribute('data-rt')===id&&(!n||elements[i+n-1].nextElementSibling===el);
   }));
   const unique=[...new Map(candidates.map(ids=>[ids.join(','),ids])).values()];
   // A shared host occurs exactly once per invocation. Among overlapping
   // variants, the longest matching sequence cannot cross that boundary.
   const complete=unique.length===1||unique.length>1&&anchored.get(unique[0]);
   const count=complete?Math.max(...unique.map(ids=>ids.length)):1;
   result.push({element:elements[i],elements:elements.slice(i,i+count),complete});i+=count;
  }
  return result;
 }
 function bounds(elements){
  const rects=elements.map(el=>el.getBoundingClientRect()).filter(r=>r.width||r.height);if(!rects.length)return null;
  const left=Math.min(...rects.map(r=>r.left)),top=Math.min(...rects.map(r=>r.top));return {left,top,width:Math.max(...rects.map(r=>r.right))-left,height:Math.max(...rects.map(r=>r.bottom))-top};
 }
 const api={group,bounds};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RetouchComponentInstances=api;
})(typeof window!=='undefined'?window:globalThis);
