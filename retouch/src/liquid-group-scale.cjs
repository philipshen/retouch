'use strict';
// Source planner for Liquid group scaling. Editor capability remains gated until
// member editing, copying and ungrouping preserve the saved runtime ownership.
const MagicString=require('magic-string'),liquid=require('./adapters/liquid.cjs'),runtime=require('./group-scale-runtime.cjs'),{parse}=require('../runtime/group-scale-bootstrap.js');
const attr=(el,name)=>el.attributes?.find(a=>a.name===name),value=(el,name)=>{const a=attr(el,name);if(a?.dynamic)throw Error('Resolve dynamic scale attributes first.');return a?.value;};
const escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
function plan(resolved,op){
 try{
  if(op.fileHash!==resolved.hash)throw Error('The file changed. Re-select the group.');
  if(!Number.isInteger(op.width)||op.width<0||op.width>7680||!Number.isFinite(op.factor)||op.factor<.01||op.factor>100)throw Error('Choose a valid screen width and scale factor.');
  const source=runtime.upgrade(resolved.source),elements=liquid.collect(source,resolved.relPath).elements,group=elements.find(e=>e.id===resolved.element.id);
  if(!group||group.dynamicTag||group.attributeExpressions||!attr(group,'data-rt-group')||!Number.isInteger(group.closeStart))throw Error('Choose a literal source-backed Liquid group.');
  const inside=e=>e.tagStart>group.tagStart&&e.closeEnd<=group.closeStart,members=elements.filter(inside);
  if(!members.length||members.length>100||members.some(e=>e.kind==='instance'||e.generatedImage||e.dynamicTag||e.attributeExpressions))throw Error('Choose 1–100 literal source children.');
  if(/\{%[-\s]*(?:for|tablerow|render|include)\b/.test(source.slice(group.openEnd,group.closeStart)))throw Error('Repeated or rendered children need instance-aware scale identities.');
  if(elements.some(e=>e!==group&&attr(e,'data-rt-scale')&&(inside(e)||e.tagStart<group.tagStart&&e.closeEnd>group.closeEnd)))throw Error('Overlapping responsive scale groups are not supported yet.');
  if(/data-rt-scale-set\s*=/.test(source))throw Error('Released scale sets need ownership mapping before Liquid group edits.');
  const stored=value(group,'data-rt-scale'),decode=text=>require('parse5').parseFragment('<textarea>'+text.replace(/</g,'&lt;')+'</textarea>').childNodes[0].childNodes[0]?.value||'',prior=stored==null?null:JSON.parse(decode(stored));
  if(prior?.steps?.length)throw Error('Ordered member transforms need Liquid class snapshots before editing.');
  const ranges=prior?parse(JSON.stringify(prior)):[],values=Object.fromEntries(ranges),offsets={...prior?.offsets},pixels={...prior?.pixels};let factor=1,offset=[0,0],move=[0,0];
  for(const [width,next]of ranges)if(width<=op.width){factor=next;offset=offsets[width]||[0,0];move=pixels[width]||[0,0];}
  const shift=op.offset??[0,0],delta=op.move??[0,0];if([shift,delta].some(pair=>!Array.isArray(pair)||pair.length!==2||pair.some(n=>!Number.isFinite(n)||Math.abs(n)>10000)))throw Error('Choose finite group offsets.');
  values[op.width]=factor*op.factor;offsets[op.width]=offset.map((n,i)=>n+factor*shift[i]);pixels[op.width]=move.map((n,i)=>n+delta[i]);
  const data={version:1,ranges:values,offsets,pixels};parse(JSON.stringify(data));
  const out=new MagicString(source),set=(el,name,val)=>{const a=attr(el,name),text=name+'="'+escape(val)+'"';if(a)out.overwrite(a.attrStart,a.attrEnd,text);else out.appendLeft(el.nameEnd,' '+text);};
  set(group,'data-rt-scale',JSON.stringify(data));const seen=new Set();
  for(const member of members){const id=value(member,'data-rt-scale-member')??member.id;if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||seen.has(id))throw Error('Group members need distinct persistent identities.');seen.add(id);set(member,'data-rt-scale-member',id);}
  // A raw block keeps the embedded JavaScript opaque to Liquid. Appending it
  // outside the template's control flow preserves all existing source IDs.
  if(!source.includes(runtime.script()))out.append('\n{% raw %}'+runtime.script()+'{% endraw %}');
  const after=out.toString(),next=liquid.collect(after,resolved.relPath).elements;
  if(next.length!==elements.length||next.some((e,i)=>e.id!==elements[i].id||e.tag!==elements[i].tag))throw Error('Scaling changed source layer identity.');
  return {ok:true,hash:liquid.contentHash(after),edits:[{file:resolved.file,before:resolved.source,after}]};
 }catch(error){return {ok:false,refused:true,reason:error.message};}
}
module.exports={plan};
