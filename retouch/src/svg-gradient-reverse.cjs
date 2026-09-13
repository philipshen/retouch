'use strict';
const MagicString=require('magic-string'),{contentHash}=require('./id.cjs');
function plan(resolved,op,state,kind){
 const refuse=reason=>({ok:false,refused:true,reason});
 if(op.stop!==undefined||op.value!==undefined||op.changes!==undefined)return refuse('Reverse the gradient without other changes.');
 const {node,stops}=state,bounds=n=>kind==='html'?[n.sourceCodeLocation.startOffset,n.sourceCodeLocation.endOffset]:[n.start,n.end];
 const values=stops.map(n=>({offset:n.attrs.find(a=>a.name==='offset')?.value??null})),normalized=require('../shell/svg-gradient-order.js').move(values,0,null);
 if(!normalized)return refuse('This gradient contains an unsupported stop position.');
 const pieces=stops.map((n,index)=>{
  const [start,end]=bounds(n),piece=new MagicString(resolved.source.slice(start,end)),percent=values[index].offset?.trim().endsWith('%'),position=Math.round((1-normalized.original[index])*1e12)/1e12,value=String(percent?Math.round(position*100*1e10)/1e10:position)+(percent?'%':'');
  const attr=kind==='html'?n.sourceCodeLocation.attrs?.offset:n.attrs.find(a=>a.name==='offset'),a=kind==='html'?attr?.startOffset:attr?.start,b=kind==='html'?attr?.endOffset:attr?.end;
  if(kind==='liquid'&&attr?.valueStart>=0&&['"',"'"].includes(resolved.source[attr.valueStart-1]))piece.overwrite(attr.valueStart-start,attr.valueEnd-start,value);
  else if(attr)piece.overwrite(a-start,b-start,'offset="'+value+'"');
  else piece.appendLeft((kind==='html'?n.sourceCodeLocation.startTag.startOffset+1+n.tagName.length:n.nameEnd)-start,' offset="'+value+'"');
  return piece.toString();
 }).reverse();
 const out=new MagicString(resolved.source);stops.forEach((n,i)=>{const [a,b]=bounds(n);out.overwrite(a,b,pieces[i]);});
 const after=out.toString(),[start,end]=bounds(node),adapter=require('./adapters/'+kind+'.cjs'),location=el=>kind==='html'?el.location.startOffset:kind==='react'?el.node.start:el.tagStart;
 const outside=(source,finish)=>adapter.collect(source,resolved.relPath).elements.filter(el=>location(el)<=start||location(el)>=finish),before=outside(resolved.source,end),next=outside(after,end+after.length-resolved.source.length);
 if(before.length!==next.length||before.some((el,i)=>el.id!==next[i].id||el.kind!==next[i].kind))return refuse('Reversing this gradient changes unrelated layer identities.');
 return {ok:true,hash:contentHash(after),edits:after===resolved.source?[]:[{file:resolved.file,before:resolved.source,after}]};
}
module.exports={plan};
