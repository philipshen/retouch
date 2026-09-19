(function(root){
 'use strict';
 // A clock advances only while both the document and its authored layer are active.
 function create({eligible,perform}){
  const entries=new Map();let disposed=false;
  function update(items){if(disposed)return;const live=new Set();for(const {key,item}of items){live.add(key);const signature=JSON.stringify(item),old=entries.get(key);if(old?.signature!==signature)entries.set(key,{item,signature,remaining:item.delay,done:false,last:null});}for(const key of entries.keys())if(!live.has(key))entries.delete(key);}
  function tick(time){if(disposed)return;for(const [key,entry]of entries){if(disposed)break;if(entry.done)continue;if(!eligible(key)){entry.last=null;continue;}if(entry.last!==null)entry.remaining-=Math.max(0,time-entry.last);entry.last=time;if(entry.remaining<=0){entry.done=true;perform(entry.item,key);}}}
  return {update,tick,pause(){for(const entry of entries.values())entry.last=null;},dispose(){disposed=true;entries.clear();},get pending(){return !disposed&&[...entries.values()].some(entry=>!entry.done);}};
 }
 const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchPrototypeTimers=api;
})(typeof window==='object'?window:globalThis);
