(function(root){
 'use strict';
 const I=typeof module==='object'&&module.exports?require('./inspector.js'):root.RetouchInspector;
 function measure(candidate){const token=candidate.descriptors?.find(value=>/[wx]$/.test(value))||'1x';return {unit:token.slice(-1),value:Number(token.slice(0,-1))};}
 function suggestion(descriptor,sourceIndex){const entries=descriptor.candidates.filter(candidate=>candidate.attribute==='srcset'&&candidate.sourceIndex===sourceIndex).map(measure),unit=entries[0]?.unit||'x',maximum=Math.max(0,...entries.filter(entry=>entry.unit===unit).map(entry=>entry.value));return {unit,value:unit==='w'?maximum*2||640:!entries.length&&descriptor.plain&&descriptor.sources.find(source=>source.index===sourceIndex)?.src?2:maximum+1};}
 function mount(descriptor,candidate,onSave,{open=false,onToggle=()=>{}}={}){
  const details=document.createElement('details'),summary=document.createElement('summary');details.className='advanced';details.open=open;details.ontoggle=()=>{if(details.isConnected)onToggle(details.open);};summary.textContent=descriptor.plain?'Responsive images':'Candidate options';details.append(summary);
  const box=document.createElement('div');box.className='responsive-image-candidates';details.append(box);
  if(descriptor.plain)I.note(box,'Keep this image as the fallback and add versions for higher pixel densities or different display sizes.');
  const error=I.note(box,'','refused');error.hidden=true;error.setAttribute('role','alert');
  const run=async(button,change)=>{error.hidden=true;button.disabled=true;try{await onSave(change);}catch(reason){error.textContent=reason.message;error.hidden=false;}finally{button.disabled=false;}};
  function resolution(prefix,initial){
   const type=I.select(box,prefix+'resolution type',[['x','Pixel density (×)'],['w','Image width (px)']],initial.unit,()=>{value.min=type.value==='w'?'1':'0';value.step=type.value==='w'?'1':'any';});
   type.parentElement.querySelector('span').textContent='Resolution';
   const value=document.createElement('input');value.type='number';value.min=initial.unit==='w'?'1':'0';value.step=initial.unit==='w'?'1':'any';value.value=initial.value;I.field(box,prefix+'resolution value',value).parentElement.querySelector('span').textContent='Value';
   return {type,value,read:()=>value.value+type.value};
  }
  if(candidate.attribute==='srcset'){
   const current=resolution('Candidate ',measure(candidate)),apply=I.button('Apply candidate resolution',()=>run(apply,{action:'descriptor',sourceIndex:candidate.sourceIndex,candidate:candidate.key,descriptor:current.read()})),remove=I.button('Remove image candidate',()=>run(remove,{action:'remove',sourceIndex:candidate.sourceIndex,candidate:candidate.key}));box.append(apply,remove);
   I.note(box,'Removing the last candidate makes the browser try another source or the fallback image.');
  }
  const heading=document.createElement('h4');heading.textContent='Add candidate';box.append(heading);
  const sources=descriptor.sources.map(source=>[String(source.index),source.index<0?'Image':'Source '+(source.index+1)+(source.media?' · '+source.media:'')]);
  const destination=I.select(box,'New candidate source',sources,String(candidate.sourceIndex),()=>{const next=suggestion(descriptor,Number(destination.value));nextResolution.type.value=next.unit;nextResolution.value.value=next.value;nextResolution.type.onchange();});
  destination.parentElement.querySelector('span').textContent='Source';
  const url=document.createElement('input');url.type='text';url.placeholder='/images/photo@2x.png';I.field(box,'New candidate image path',url).parentElement.querySelector('span').textContent='Image path';
  const nextResolution=resolution('New ',suggestion(descriptor,candidate.sourceIndex)),add=I.button('Add image candidate',()=>run(add,{action:'add',sourceIndex:Number(destination.value),src:url.value.trim(),descriptor:nextResolution.read()}));box.append(add);
  I.note(box,'Use pixel density for 1×/2× images, or the actual image width for sources with display sizes. Each resolution must be unique within its source.');return details;
 }
 const api={measure,suggestion,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchResponsiveImageCandidates=api;
})(typeof globalThis!=='undefined'?globalThis:this);
