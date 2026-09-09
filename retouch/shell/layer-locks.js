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
  function changeMany(nodes,value){
   const ids=[...new Set(nodes.map(key))];if(!ids.length||ids.some(id=>!id))return [];
   const page=route(),after=!!value,locks=entries(page),changes=ids.filter(id=>locks.has(id)!==after).map(id=>({id,route:page,before:locks.has(id),after}));
   for(const change of changes){if(after)locks.add(change.id);else locks.delete(change.id);}return changes;
  }
  function restoreMany(changes,direction){
   if(changes.some(change=>entries(change.route).has(change.id)!==(direction==='undo'?change.after:change.before)))return {ok:false,reason:'The layer lock changed since this history entry.'};
   for(const change of changes){const next=direction==='undo'?change.before:change.after,locks=entries(change.route);if(next)locks.add(change.id);else locks.delete(change.id);}return {ok:true};
  }
  function restore(change,direction){return restoreMany([change],direction);}
  function pick(node,x,y){
   const selector='[data-rt], [data-rt-i]',first=node?.closest?.(selector);
   if(!first||!locked(first))return first||null;
   if(!Number.isFinite(x)||!Number.isFinite(y))return null;
   for(const hit of node.ownerDocument.elementsFromPoint(x,y)){
    const candidate=hit.closest?.(selector);
    if(candidate&&!locked(candidate)&&!candidate.contains(node)&&!['HTML','BODY'].includes(candidate.tagName))return candidate;
   }
   return null;
  }
  return {direct,locked,set,change,changeMany,restore,restoreMany,pick};
 }
 const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchLayerLocks=api;
})(typeof window==='object'?window:globalThis);
