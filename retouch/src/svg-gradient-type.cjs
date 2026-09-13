'use strict';
const MagicString=require('magic-string'),{contentHash}=require('./id.cjs');
function plan(resolved,op,state,kind){
 const refuse=reason=>({ok:false,refused:true,reason});
 if(!['linearGradient','radialGradient'].includes(op.value)||op.changes!==undefined||op.stop!==undefined)return refuse('Choose Linear or Radial without other gradient changes.');
 const node=state.node,type=kind==='html'?node.tagName:node.tag;
 if(type===op.value)return {ok:true,hash:resolved.hash,edits:[]};
 const start=kind==='html'?node.sourceCodeLocation.startTag.startOffset:node.start;
 const close=kind==='html'?node.sourceCodeLocation.endTag?.startOffset:kind==='react'?node.node.closingElement?.start:node.node.closeStart;
 const end=kind==='html'?node.sourceCodeLocation.endOffset:node.end;
 if(!Number.isInteger(close)||resolved.source.slice(close,close+2)!=='</'||resolved.source.slice(start+1,start+1+type.length).toLowerCase()!==type.toLowerCase()||resolved.source.slice(close+2,close+2+type.length).toLowerCase()!==type.toLowerCase())return refuse('This gradient needs explicit source opening and closing tags.');
 // Retain inactive coordinates so switching back restores the previous geometry.
 const out=new MagicString(resolved.source);out.overwrite(start+1,start+1+type.length,op.value);out.overwrite(close+2,close+2+type.length,op.value);
 const after=out.toString(),adapter=require('./adapters/'+kind+'.cjs'),location=el=>kind==='html'?el.location.startOffset:kind==='react'?el.node.start:el.tagStart;
 const outside=(source,finish)=>adapter.collect(source,resolved.relPath).elements.filter(el=>location(el)<start||location(el)>=finish);
 const before=outside(resolved.source,end),next=outside(after,end+2*(op.value.length-type.length));
 if(before.length!==next.length||before.some((el,i)=>el.id!==next[i].id||el.kind!==next[i].kind))return refuse('Changing gradient type changes unrelated layer identities.');
 return {ok:true,hash:contentHash(after),edits:[{file:resolved.file,before:resolved.source,after}]};
}
module.exports={plan};
