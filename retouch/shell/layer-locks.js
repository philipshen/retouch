(function(root){
 'use strict';
 // Editor-only locks: never add attributes or styles to the user's page.
 function create({route=()=>''}={}){
  const pages=new Map();
  function key(el){return el?.getAttribute?.('data-rt-i')||el?.getAttribute?.('data-rt');}
  function entries(){const page=route();if(!pages.has(page))pages.set(page,new Set());return pages.get(page);}
  function direct(el){const id=key(el);return !!id&&entries().has(id);}
  function locked(el){for(let node=el;node;node=node.parentElement)if(direct(node))return true;return false;}
  function set(el,value){const id=key(el);if(!id)return false;if(value)entries().add(id);else entries().delete(id);return true;}
  return {direct,locked,set};
 }
 const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchLayerLocks=api;
})(typeof window==='object'?window:globalThis);
