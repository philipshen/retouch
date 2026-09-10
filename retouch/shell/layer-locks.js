(function(root){
 'use strict';
 // Editor-only locks: never add attributes or styles to the user's page.
 function create({route=()=>'',storage,scope}={}){
  const pages=new Map(),validScope=scope&&/^[a-f0-9]{64}$/.test(scope.project)&&/^[a-f0-9]{64}$/.test(scope.session),storageKey=validScope?'retouch.layer-locks.v1:'+scope.project:null;
  if(storageKey&&storage)try{
   const saved=JSON.parse(storage.getItem(storageKey));
   if(saved?.version===1&&saved.session===scope.session&&Array.isArray(saved.pages)&&saved.pages.length<=1000){
    let count=0;
    for(const entry of saved.pages){
     if(!Array.isArray(entry)||entry.length!==2||typeof entry[0]!=='string'||entry[0].length>4096||!Array.isArray(entry[1])||entry[1].some(id=>typeof id!=='string'||!/^[a-f0-9]{10}$/.test(id)))throw Error('Invalid saved locks');
     count+=entry[1].length;if(count>5000)throw Error('Too many saved locks');pages.set(entry[0],new Set(entry[1]));
    }
   }
  }catch{pages.clear();}
  function remember(){if(storageKey&&storage)try{storage.setItem(storageKey,JSON.stringify({version:1,session:scope.session,pages:[...pages].filter(([,ids])=>ids.size).map(([page,ids])=>[page,[...ids]])}));}catch{}}

  function key(el){return el?.getAttribute?.('data-rt-i')||el?.getAttribute?.('data-rt');}
  function entries(page=route()){if(!pages.has(page))pages.set(page,new Set());return pages.get(page);}
  function direct(el){const id=key(el);return !!id&&entries().has(id);}
  function locked(el){for(let node=el;node;node=node.parentElement)if(direct(node))return true;return false;}
  function set(el,value){const id=key(el);if(!id)return false;if(value)entries().add(id);else entries().delete(id);remember();return true;}
  function change(el,value){const id=key(el),page=route();if(!id)return null;const before=entries(page).has(id),after=!!value;if(before===after)return null;set(el,after);return {id,route:page,before,after};}
  function changeMany(nodes,value){
   const ids=[...new Set(nodes.map(key))];if(!ids.length||ids.some(id=>!id))return [];
   const page=route(),after=!!value,locks=entries(page),changes=ids.filter(id=>locks.has(id)!==after).map(id=>({id,route:page,before:locks.has(id),after}));
   for(const change of changes){if(after)locks.add(change.id);else locks.delete(change.id);}if(changes.length)remember();return changes;
  }
  function restoreMany(changes,direction){
   if(changes.some(change=>entries(change.route).has(change.id)!==(direction==='undo'?change.after:change.before)))return {ok:false,reason:'The layer lock changed since this history entry.'};
   for(const change of changes){const next=direction==='undo'?change.before:change.after,locks=entries(change.route);if(next)locks.add(change.id);else locks.delete(change.id);}remember();return {ok:true};
  }
  function restore(change,direction){return restoreMany([change],direction);}
  function remap(pairs,direction='redo'){
   if(!Array.isArray(pairs)||pairs.some(pair=>!Array.isArray(pair)||pair.length!==2||pair.some(id=>typeof id!=='string'||!/^[a-f0-9]{10}$/.test(id)))||new Set(pairs.map(pair=>pair[0])).size!==pairs.length||new Set(pairs.map(pair=>pair[1])).size!==pairs.length)throw Error('Invalid source layer mapping');
   const mapping=new Map(pairs.map(pair=>direction==='undo'?[pair[1],pair[0]]:pair));
   for(const [page,ids]of pages)pages.set(page,new Set([...ids].map(id=>mapping.get(id)||id)));remember();
  }
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
  return {direct,locked,set,change,changeMany,restore,restoreMany,remap,pick};
 }
 const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchLayerLocks=api;
})(typeof window==='object'?window:globalThis);
