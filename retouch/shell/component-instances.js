(function(root){
 'use strict';
 function group(elements,patterns=[]){
  const result=[];
  for(let i=0;i<elements.length;){
   const candidates=patterns.filter(ids=>ids.length&&ids.every((id,n)=>{
    const el=elements[i+n];return el?.getAttribute('data-rt')===id&&(!n||elements[i+n-1].nextElementSibling===el);
   }));
   const unique=[...new Map(candidates.map(ids=>[ids.join(','),ids])).values()];
   const complete=unique.length===1,count=complete?unique[0].length:1;
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
