'use strict';
const MagicString=require('magic-string'),{contentHash}=require('./id.cjs');
function plan(resolved,op,state,kind){
 const refuse=reason=>({ok:false,refused:true,reason});
 if(op.changes!==undefined||op.stop!==undefined||op.value!==undefined)return refuse('Make the selected gradient unique without other changes.');
 const {node,stops}=state,selected=kind==='html'?resolved.element.node:state.selected,parent=kind==='html'?node.parentNode:node.parent;
 const bounds=n=>kind==='html'?[n.sourceCodeLocation.startOffset,n.sourceCodeLocation.endOffset]:[n.start,n.end];
 const attributes=n=>kind==='html'?(n.attrs||[]).map(a=>({...a,...n.sourceCodeLocation.attrs?.[a.name.toLowerCase()],start:n.sourceCodeLocation.attrs?.[a.name.toLowerCase()]?.startOffset,end:n.sourceCodeLocation.attrs?.[a.name.toLowerCase()]?.endOffset})):n.attrs;
 const at=kind==='html'?parent?.sourceCodeLocation?.endTag?.startOffset:kind==='react'?parent?.node.closingElement?.start:parent?.node.closeStart;
 if(!Number.isInteger(at)||resolved.source.slice(at,at+2)!=='</')return refuse('This gradient needs an explicit source parent closing tag before it can be copied.');
 const [start,end]=bounds(node),copy=new MagicString(resolved.source.slice(start,end)),out=new MagicString(resolved.source),map=new Map();let serial=0;
 const freshId=()=>{let id;do{id='rt-gradient-'+contentHash(resolved.source+'|'+resolved.element.id+'|'+op.paint+'|'+serial++).slice(0,12);}while(resolved.source.includes(id)||[...map.values()].includes(id));return id;};
 for(const n of [node,...stops]){const id=attributes(n).find(a=>a.name==='id')?.value;if(id!==undefined&&id!==null){if(map.has(id))return refuse('This gradient contains duplicate resource IDs.');map.set(id,freshId());}}
 const id=map.get(state.id);if(!id)return refuse('The gradient resource ID could not be copied.');
 const escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
 for(const n of [node,...stops])for(const a of attributes(n)){
  let value=a.value;if(typeof value!=='string')continue;
  if(a.name==='id')value=map.get(value);else if(n===node&&kind==='react'&&a.name==='key')value=id;else if(['aria-labelledby','aria-describedby'].includes(a.name))value=value.split(/\s+/).map(token=>map.get(token)||token).join(' ');else{value=value.replace(/url\(\s*(['"]?)#([\w:.-]+)\1\s*\)/g,(raw,quote,key)=>map.has(key)?'url(#'+map.get(key)+')':raw);if(['href','xlink:href','xlinkHref'].includes(a.name)&&value.startsWith('#')&&map.has(value.slice(1)))value='#'+map.get(value.slice(1));}
  if(value!==a.value){if(!Number.isInteger(a.start)||!Number.isInteger(a.end))return refuse('A gradient attribute has no unambiguous source location.');copy.overwrite(a.start-start,a.end-start,resolved.source.slice(a.start,a.end).match(/^[^\s=]+/)[0]+'="'+escape(value)+'"');}
 }
 const paint=attributes(selected).filter(a=>a.name===op.paint);if(paint.length!==1||!Number.isInteger(paint[0].start)||!Number.isInteger(paint[0].end))return refuse('The selected paint attribute is ambiguous.');
 const token=op.paint+'="url(#'+id+')"',chunk=copy.toString(),old=paint[0];out.overwrite(old.start,old.end,token);out.appendLeft(at,chunk);
 const after=out.toString(),adapter=require('./adapters/'+kind+'.cjs'),location=el=>kind==='html'?el.location.startOffset:kind==='react'?el.node.start:el.tagStart,cloneStart=at+(old.start<at?token.length-(old.end-old.start):0);
 const before=adapter.collect(resolved.source,resolved.relPath).elements,next=adapter.collect(after,resolved.relPath).elements.filter(el=>location(el)<cloneStart||location(el)>=cloneStart+chunk.length);
 if(before.length!==next.length||before.some((el,i)=>el.id!==next[i].id||el.kind!==next[i].kind))return refuse('The gradient copy changes existing layer identities.');
 return {ok:true,hash:contentHash(after),edits:[{file:resolved.file,before:resolved.source,after}]};
}
module.exports={plan};
