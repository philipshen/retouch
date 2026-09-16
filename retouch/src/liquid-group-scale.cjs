'use strict';
// Source-backed Liquid group scaling and persistent transform ownership.
const MagicString=require('magic-string'),liquid=require('./adapters/liquid.cjs'),runtime=require('./group-scale-runtime.cjs');
const attr=(el,name)=>el.attributes?.find(a=>a.name===name),value=(el,name)=>{const a=attr(el,name);if(a?.dynamic)throw Error('Resolve dynamic scale attributes first.');return a?.value;};
const escape=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
function describe(resolved){
 const group=resolved.element,scaleMember=!!group?.attributes?.some(a=>a.name==='data-rt-scale-member');if(!group?.attributes?.some(a=>a.name==='data-rt-group'))return scaleMember?{scaleMember:true}:{};
 const decode=text=>require('parse5').parseFragment('<textarea>'+text.replace(/</g,'&lt;')+'</textarea>').childNodes[0].childNodes[0]?.value||'',metadata=value(group,'data-rt-scale'),elements=resolved.elements||liquid.collect(resolved.source,resolved.relPath).elements;
 return {groupScale:{runtimeRevision:runtime.revision(),metadata:metadata==null?null:decode(metadata),members:Object.fromEntries(elements.filter(e=>e.tagStart>group.tagStart&&e.closeEnd<=group.closeStart).map(e=>[e.id,value(e,'data-rt-scale-member')??null]))}};
}
function independentStyles(members){
 const snapshots=Object.create(null),classes=require('./liquid-classes.cjs');
 for(const member of members){
  if(/--rt-scale-/.test(value(member,'style')||''))throw Error('Resolve inline independent transforms before composing the group.');
  const literal=classes.decode(classes.clean(member.classAttr?.value||''));if(/\{[%{]/.test(literal))throw Error('Resolve dynamic member classes before composing the group.');
  const ranges=require('./group-scale-classes.cjs').snapshot(literal);if(Object.keys(ranges).length)snapshots[value(member,'data-rt-scale-member')??member.id]=ranges;
 }
 return snapshots;
}
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
  const shift=op.offset??[0,0],delta=op.move??[0,0];if([shift,delta].some(pair=>!Array.isArray(pair)||pair.length!==2||pair.some(n=>!Number.isFinite(n)||Math.abs(n)>10000)))throw Error('Choose finite group offsets.');
  const data=JSON.parse(require('./group-scale-metadata.cjs').compose(prior,op,()=>independentStyles(members)));
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
function release(resolved){
 const metadata=value(resolved.element,'data-rt-scale');if(metadata==null)return '';
 const decode=text=>require('parse5').parseFragment('<textarea>'+text.replace(/</g,'&lt;')+'</textarea>').childNodes[0].childNodes[0]?.value||'',data=decode(metadata),bootstrap=require('../runtime/group-scale-bootstrap.js');bootstrap.parse(data);
 if(!resolved.source.includes(runtime.script()))throw Error('Upgrade the saved scale runtime before ungrouping.');
 const roots=resolved.elements.filter(e=>e.parent===resolved.element),ids=roots.map(e=>value(e,'data-rt-scale-member'));bootstrap.members(JSON.stringify(ids));
 const id=liquid.contentHash(resolved.source+'|release|'+resolved.element.id).slice(0,10);
 return '{% raw %}<script type="application/json" data-rt-scale-set="'+id+'" data-rt-scale-scope="siblings" data-rt-scale="'+escape(data)+'">'+JSON.stringify(ids)+'</script>{% endraw %}';
}
function reclaim(resolved,roots,discover=false){
 let ids=roots.map(e=>value(e,'data-rt-scale-member'));if(ids.some(id=>id==null))return null;
 const bootstrap=require('../runtime/group-scale-bootstrap.js');bootstrap.members(JSON.stringify(ids));const records=[];
 for(const match of resolved.source.matchAll(/\{% raw %\}([\s\S]*?)\{% endraw %\}/g)){
  if(!/data-rt-scale-set\s*=/.test(match[1]))continue;
  const fragment=require('parse5').parseFragment(match[1],{sourceCodeLocationInfo:true}),script=fragment.childNodes[0],attrs=Object.fromEntries((script?.attrs||[]).map(a=>[a.name,a.value]));
  if(fragment.childNodes.length!==1||script?.tagName!=='script'||!script.sourceCodeLocation?.endTag||attrs.type!=='application/json'||attrs['data-rt-scale-scope']!=='siblings'||!/^[a-zA-Z0-9_-]{1,80}$/.test(attrs['data-rt-scale-set']||'')||Object.keys(attrs).some(key=>!['type','data-rt-scale-set','data-rt-scale-scope','data-rt-scale'].includes(key)))throw Error('Invalid released Liquid scale record.');
  const members=bootstrap.members((script.childNodes||[]).map(n=>n.value||'').join(''));bootstrap.parse(attrs['data-rt-scale']);
  if(!members.some(id=>ids.includes(id)))continue;
  if(discover){const parent=roots[0].parent;roots=(resolved.elements||liquid.collect(resolved.source,resolved.relPath).elements).filter(e=>e.parent===parent&&members.includes(value(e,'data-rt-scale-member'))).sort((a,b)=>a.tagStart-b.tagStart);ids=roots.map(e=>value(e,'data-rt-scale-member'));}
  if(members.length!==ids.length||members.some(id=>!ids.includes(id)))throw Error('Select every member of the released scale group.');
  records.push({start:match.index,end:match.index+match[0].length,metadata:attrs['data-rt-scale']});
 }
 if(!records.length)return null;if(records.length!==1)throw Error('Released scale members have multiple owners.');
 const record=records[0];if(roots.some((e,i)=>i&&resolved.source.slice(roots[i-1].closeEnd,e.tagStart).trim())||record.start<roots.at(-1).closeEnd||resolved.source.slice(roots.at(-1).closeEnd,record.start).trim())throw Error('Keep released scale members adjacent to their ownership record.');
 const elements=resolved.elements||liquid.collect(resolved.source,resolved.relPath).elements;if(ids.some(id=>elements.filter(e=>value(e,'data-rt-scale-member')===id).length!==1))throw Error('Released scale members need distinct source identities.');runtime.upgrade(resolved.source);
 return {...record,attribute:'data-rt-scale="'+escape(record.metadata)+'"'};
}
function clone(resolved,range){
 const elements=resolved.elements||liquid.collect(resolved.source,resolved.relPath).elements,chunk=new MagicString(resolved.source.slice(range.start,range.end)),copies=new Map(),identities=new Set(elements.map(e=>value(e,'data-rt-scale-member')).filter(Boolean));
 for(const element of elements){
  const marker=attr(element,'data-rt-scale-member');if(!marker||marker.attrStart<range.start||marker.attrEnd>range.end)continue;
  const old=value(element,'data-rt-scale-member');if(!/^[a-zA-Z0-9_-]{1,80}$/.test(old)||copies.has(old))throw Error('Copied group members need distinct persistent identities.');
  let id,counter=0;do{id=liquid.contentHash(resolved.source+'|scale-copy|'+element.id+'|'+counter++).slice(0,10);}while(identities.has(id));identities.add(id);copies.set(old,id);chunk.overwrite(marker.attrStart-range.start,marker.attrEnd-range.start,'data-rt-scale-member="'+id+'"');
 }
 if(copies.size&&/data-rt-scale-set\s*=/.test(resolved.source))throw Error('Released Liquid scale copies need instance ownership mapping.');
 return {chunk:chunk.toString(),append(source){
  if(!copies.size)return source;
  const elements=liquid.collect(source,resolved.relPath).elements,out=new MagicString(source),decode=text=>require('parse5').parseFragment('<textarea>'+text.replace(/</g,'&lt;')+'</textarea>').childNodes[0].childNodes[0]?.value||'';
  for(const group of elements){
   if(attr(group,'data-rt-scale-set'))throw Error('Released Liquid scale copies need instance ownership mapping.');
   const marker=attr(group,'data-rt-scale');if(!marker)continue;
   const data=JSON.parse(decode(value(group,'data-rt-scale')));require('../runtime/group-scale-bootstrap.js').parse(JSON.stringify(data));
   if(!data.steps?.some(step=>step.styles))continue;
   const owned=new Set(elements.filter(e=>e.tagStart>group.tagStart&&e.closeEnd<=group.closeStart).map(e=>value(e,'data-rt-scale-member')).filter(Boolean));
   for(const step of data.steps)if(step.styles){for(const [old,id]of copies)if(owned.has(id)&&Object.hasOwn(step.styles,old))step.styles[id]=step.styles[old];step.styles=Object.fromEntries(Object.entries(step.styles).filter(([id])=>owned.has(id)));}
   const metadata=JSON.stringify(data);require('../runtime/group-scale-bootstrap.js').parse(metadata);out.overwrite(marker.attrStart,marker.attrEnd,'data-rt-scale="'+escape(metadata)+'"');
  }
  return runtime.upgrade(out.toString());
 }};
}
module.exports={plan,clone,release,reclaim,describe};
