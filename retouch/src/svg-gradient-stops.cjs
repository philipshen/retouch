'use strict';
const MagicString=require('magic-string');
// Structural edits are restricted to one already validated gradient definition.
// Stop identities may change; every source identity outside that definition must survive.
function plan(resolved,op,state,kind){
 const refuse=reason=>({ok:false,refused:true,reason}),{stops,node}=state;
 if(!['insertStop','removeStop'].includes(op.action)||op.changes!==undefined)return refuse('Choose a gradient stop action.');
 if(!Number.isInteger(op.stop)||op.stop<0||op.stop>(op.action==='insertStop'?stops.length:stops.length-1))return refuse('Choose a valid gradient stop index.');
 const bounds=n=>kind==='html'?[n.sourceCodeLocation.startOffset,n.sourceCodeLocation.endOffset]:[n.start,n.end];
 const [start,end]=bounds(node),out=new MagicString(resolved.source);
 if(op.action==='removeStop'){
  if(stops.length<=2)return refuse('Keep at least two gradient stops.');
  const [a,b]=bounds(stops[op.stop]);out.remove(a,b);
 }else{
  if(stops.length>=64)return refuse('This gradient already has 64 stops.');
  const value=op.value,valid=require('./html-svg-gradient.cjs').valid;
  if(!value||Array.isArray(value)||Object.keys(value).sort().join(',')!=='color,offset,opacity'||typeof value.offset!=='string'||typeof value.color!=='string'||typeof value.opacity!=='string'||!valid('offset',value.offset)||!valid('stop-color',value.color)||!valid('stop-opacity',value.opacity))return refuse('Provide a stop position, color and opacity.');
  const escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  const token='<stop offset="'+escape(value.offset)+'" '+(kind==='react'?'stopColor':'stop-color')+'="'+escape(value.color)+'" '+(kind==='react'?'stopOpacity':'stop-opacity')+'="'+escape(value.opacity)+'"/>';
  out.appendLeft(op.stop<stops.length?bounds(stops[op.stop])[0]:bounds(stops.at(-1))[1],token);
 }
 const after=out.toString(),adapter=require('./adapters/'+(kind==='html'?'html':kind==='react'?'react':'liquid')+'.cjs');
 const location=el=>kind==='html'?el.location.startOffset:kind==='react'?el.node.start:el.tagStart;
 const before=adapter.collect(resolved.source,resolved.relPath).elements.filter(el=>location(el)<=start||location(el)>=end),delta=after.length-resolved.source.length,next=adapter.collect(after,resolved.relPath).elements.filter(el=>location(el)<=start||location(el)>=end+delta);
 if(before.length!==next.length||before.some((el,i)=>el.id!==next[i].id||el.kind!==next[i].kind))return refuse('The stop edit changes identities outside the gradient.');
 return {ok:true,hash:require('./id.cjs').contentHash(after),edits:[{file:resolved.file,before:resolved.source,after}]};
}
module.exports={plan};
