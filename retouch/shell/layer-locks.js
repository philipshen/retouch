(function(root){
 'use strict';
 // Editor-only locks: never add attributes or styles to the user's page.
 function create({route=()=>''}={}){
  const pages=new Map();
  function key(el){return el?.getAttribute?.('data-rt-i')||el?.getAttribute?.('data-rt');}
  function entries(page=route()){if(!pages.has(page))pages.set(page,new Set());return pages.get(page);}
  function direct(el){const id=key(el);return !!id&&entries().has(id);}
  function locked(el){for(let node=el;node;node=node.parentElement)if(direct(node))return true;return false;}
  function set(el,value){const id=key(el);if(!id)return false;if(value)entries().add(id);else entries().delete(id);return true;}
  function change(el,value){const id=key(el),page=route();if(!id)return null;const before=entries(page).has(id),after=!!value;if(before===after)return null;set(el,after);return {id,route:page,before,after};}
  function restore(change,direction){
   const expected=direction==='undo'?change.after:change.before,next=direction==='undo'?change.before:change.after,locks=entries(change.route);
   if(locks.has(change.id)!==expected)return {ok:false,reason:'The layer lock changed since this history entry.'};
   if(next)locks.add(change.id);else locks.delete(change.id);return {ok:true};
  }
  return {direct,locked,set,change,restore};
 }
 const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchLayerLocks=api;
})(typeof window==='object'?window:globalThis);
