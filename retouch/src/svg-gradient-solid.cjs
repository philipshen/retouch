'use strict';
const MagicString=require('magic-string'),{contentHash}=require('./id.cjs');
function plan(resolved,op,state,kind){
 const refuse=reason=>({ok:false,refused:true,reason});
 if(op.stop!==undefined||op.changes!==undefined||typeof op.value!=='string'||!require('./html-svg-gradient.cjs').valid('stop-color',op.value))return refuse('Choose a valid solid color without other gradient changes.');
 const selected=kind==='html'?resolved.element.node:state.selected,attrs=selected.attrs.filter(a=>a.name===op.paint);if(attrs.length!==1)return refuse('The selected paint attribute is ambiguous.');
 const attr=kind==='html'?selected.sourceCodeLocation.attrs?.[op.paint]:attrs[0],start=kind==='html'?attr?.startOffset:attr?.start,end=kind==='html'?attr?.endOffset:attr?.end;
 if(!Number.isInteger(start)||!Number.isInteger(end))return refuse('The selected paint has no source location.');
 const escape=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;'),out=new MagicString(resolved.source);
 if(kind==='liquid'&&attr.valueStart>=0&&['"',"'"].includes(resolved.source[attr.valueStart-1]))out.overwrite(attr.valueStart,attr.valueEnd,escape(op.value));else out.overwrite(start,end,op.paint+'="'+escape(op.value)+'"');
 // Keep the resource intact: other layers or external files may still reference it.
 const after=out.toString(),adapter=require('./adapters/'+kind+'.cjs'),before=adapter.collect(resolved.source,resolved.relPath).elements,next=adapter.collect(after,resolved.relPath).elements;
 if(before.length!==next.length||before.some((el,i)=>el.id!==next[i].id||el.kind!==next[i].kind))return refuse('Changing this paint changes existing layer identities.');
 return {ok:true,hash:contentHash(after),edits:[{file:resolved.file,before:resolved.source,after}]};
}
module.exports={plan};
