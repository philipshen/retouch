(function(root){
 'use strict';
 const properties=['fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-dashoffset','stroke-linecap','stroke-linejoin','opacity','filter','clip-path','mask-image','mix-blend-mode','transform','transform-origin','display','visibility','pointer-events','font-family','font-size','font-weight','letter-spacing','x','y','cx','cy','r','rx','ry','width','height','d'];
 const snapshot=elements=>elements.flatMap(el=>[el,...el.querySelectorAll('*')]).map(el=>({el,values:properties.map(p=>el.ownerDocument.defaultView.getComputedStyle(el).getPropertyValue(p))}));
 function unchanged(before){if(before.some(({el,values})=>properties.some((p,i)=>el.ownerDocument.defaultView.getComputedStyle(el).getPropertyValue(p)!==values[i])))throw Error('This mask grouping would change CSS-controlled appearance or geometry.');}
 function neutral(el,allowMask=false){const css=el.ownerDocument.defaultView.getComputedStyle(el);if(!allowMask&&css.maskImage!=='none'||css.transform!=='none'||css.opacity!=='1'||css.filter!=='none'||css.clipPath!=='none'||css.display==='none'||css.visibility!=='visible'||css.mixBlendMode!=='normal')throw Error('CSS styles the mask wrapper. Normalize those styles before masking.');}
 function prepare(infos,elements,mode='alpha'){
  if(!['alpha','luminance'].includes(mode)||infos.length<2||infos.length!==elements.length||new Set(infos.map(i=>i.file)).size!==1||new Set(infos.map(i=>i.hash)).size!==1||elements.some(el=>!el?.isConnected||el.parentElement!==elements[0].parentElement))throw Error('Select sibling SVG layers in one source file.');
  const selected=elements.map((el,i)=>({el,info:infos[i]})).sort((a,b)=>a.el.compareDocumentPosition(b.el)&4?-1:1),parent=selected[0].el.parentNode,siblings=[...parent.children],positions=selected.map(m=>siblings.indexOf(m.el));if(positions.some((n,i)=>n!==positions[0]+i))throw Error('Select consecutive layers to mask.');
  for(const {el,info}of selected){const reason=root.RetouchSVGResize.reason(el,info,true);if(reason)throw Error(reason);if(el.getAnimations?.({subtree:true}).length)throw Error('Pause animations before masking.');}
  const originals=selected.map(({el})=>({el,next:el.nextSibling})),before=snapshot(selected.map(m=>m.el)),d=parent.ownerDocument,group=d.createElementNS(parent.namespaceURI,'g'),mask=d.createElementNS(parent.namespaceURI,'mask'),content=d.createElementNS(parent.namespaceURI,'g'),id='rt-mask-preview-'+root.crypto.randomUUID();
  group.setAttribute('data-rt-mask-group','');group.setAttribute('data-rt-name','Mask group');mask.id=id;mask.setAttribute('mask-type',mode);mask.setAttribute('maskContentUnits','userSpaceOnUse');content.setAttribute('data-rt-mask-content','');content.setAttribute('mask','url(#'+id+')');group.append(mask,content);
  try{parent.insertBefore(group,selected[0].el);mask.append(selected[0].el);content.append(...selected.slice(1).map(m=>m.el));neutral(group);neutral(content,true);unchanged(before);const css=d.defaultView.getComputedStyle(mask);if(css.maskType!==mode)throw Error('CSS overrides the selected mask type.');if(!d.defaultView.getComputedStyle(content).maskImage.includes('#'+id))throw Error('CSS overrides the mask reference.');}
  finally{for(const {el,next}of originals.reverse())parent.insertBefore(el,next?.parentNode===parent?next:null);group.remove();}
  return {ids:selected.map(m=>m.info.id),maskId:selected[0].info.id,mode};
 }
 function release(group){
  const parent=group?.parentNode,mask=group?.querySelector(':scope > mask'),content=group?.querySelector(':scope > g[data-rt-mask-content]');if(!parent||!mask||!content)throw Error('Re-select the mask group.');neutral(group);neutral(content,true);
  const nodes=[...mask.childNodes,...content.childNodes],originals=nodes.map(el=>({el,parent:el.parentNode})),before=snapshot(nodes.filter(n=>n.nodeType===1));
  try{for(const node of nodes)parent.insertBefore(node,group);group.remove();unchanged(before);}
  finally{parent.insertBefore(group,nodes[0]||null);for(const {el,parent:owner}of originals)owner.append(el);}
 }
 function typeChange(group,mode){
  const mask=group?.querySelector(':scope > mask'),content=group?.querySelector(':scope > g[data-rt-mask-content]');if(!mask||!content||!['alpha','luminance'].includes(mode))throw Error('Re-select the mask group.');
  if(group.getAnimations?.({subtree:true}).length)throw Error('Pause animations before changing the mask type.');
  const original=mask.getAttribute('mask-type'),w=mask.ownerDocument.defaultView;
  try{mask.setAttribute('mask-type',mode);const override=w.getComputedStyle(content).getPropertyValue('mask-mode').trim();if(w.getComputedStyle(mask).maskType!==mode||override&&override!=='match-source'&&override!==mode)throw Error('CSS overrides this mask type. Edit those styles first.');}
  finally{if(original===null)mask.removeAttribute('mask-type');else mask.setAttribute('mask-type',original);}
 }
 let boundsOpen=false;
 function boundsFields(section,info,group,{current,save}){
  const I=root.RetouchInspector,details=root.document.createElement('details'),summary=root.document.createElement('summary');details.className='inspector-disclosure';details.open=boundsOpen;details.ontoggle=()=>{if(details.isConnected)boundsOpen=details.open;};summary.textContent='Mask bounds';details.append(summary);section.append(details);
  const defaults={x:'-10%',y:'-10%',width:'120%',height:'120%'};
  const write=changes=>{if(!current())return;const mask=group.querySelector(':scope > mask');if(!mask||group.getAnimations?.({subtree:true}).length)throw Error('Pause animations before changing mask bounds.');save('setSVGMaskBounds',{changes});};
  for(const [key,label]of [['x','X'],['y','Y'],['width','Width'],['height','Height']]){
   const input=root.document.createElement('input'),raw=info.svgMask.bounds[key],initial=raw===null?defaults[key]:Number.isFinite(Number(raw))?String(Number(raw)*100)+'%':raw;input.type='text';input.value=initial;input.spellcheck=false;
   I.field(details,'Mask '+label,input);input.parentElement.querySelector('span').textContent=label;
   input.oninput=()=>input.setCustomValidity('');input.onchange=()=>{let value=input.value.trim();if(/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(value))value+='%';if(!/^[-+]?(?:\d+\.?\d*|\.\d+)%$/.test(value)||Math.abs(parseFloat(value))>100000||['width','height'].includes(key)&&parseFloat(value)<0){input.setCustomValidity('Enter a percentage. Width and height cannot be negative.');input.reportValidity();return;}try{write({[key]:value});}catch(error){input.value=initial??defaults[key];I.note(details,error.message,'refused').setAttribute('role','alert');}};I.fieldDraft(input);
  }
  for(const labels of [['X','Y'],['Width','Height']]){const pair=root.document.createElement('div');pair.className='property-pair';const rows=labels.map(label=>details.querySelector('[aria-label="Mask '+label+'"]').closest('.inspector-field'));rows[0].before(pair);for(const row of rows){row.querySelector('span').textContent=row.querySelector('span').textContent[0];pair.append(row);}}
  const reset=I.button('Reset mask bounds',()=>{try{write({x:null,y:null,width:null,height:null});}catch(error){I.note(details,error.message,'refused').setAttribute('role','alert');}});reset.disabled=Object.values(info.svgMask.bounds).every(value=>value===null);details.append(reset);I.note(details,'Percentages follow the size of the masked content. These bounds crop the mask, without moving its shape.');
 }
 function modeField(value,onChange){
  const label=root.document.createElement('label'),select=root.document.createElement('select'),caption=root.document.createElement('span');label.className='inspector-field';caption.textContent='Mask type';label.append(caption);Object.assign(label.style,{display:'grid',gridTemplateColumns:'1fr 1fr',alignItems:'center',gap:'8px',marginBottom:'8px'});Object.assign(select.style,{width:'100%',minWidth:'0',height:'28px',border:'0',borderRadius:'4px',padding:'4px 8px',background:'var(--control-bg,#f5f5f5)',color:'inherit',font:'inherit'});select.setAttribute('aria-label','Mask type');for(const [value,text]of [['alpha','Alpha'],['luminance','Luminance']]){const option=root.document.createElement('option');option.value=value;option.textContent=text;select.append(option);}select.value=value;select.onchange=onChange;label.append(select);return {label,select};
 }
 function mount(infos,elements,{current,save,edit}){
  const button=(action,label,run)=>{const control=root.RetouchInspector.button(label,run);control.dataset.maskAction=action;return control;};
  const I=root.RetouchInspector,section=I.section('Mask'),releaseMode=infos.length===1&&infos[0].svgMask?.canRelease;
  if(infos.length===1&&infos[0].svgMask?.ownerId){section.append(button('back','Back to mask',()=>{if(current())edit([infos[0].svgMask.ownerId]);}));section.append(button('release','Release mask',()=>{if(!current())return;try{const group=elements[0]?.closest('[data-rt-mask-group]');if(group?.getAttribute('data-rt')!==infos[0].svgMask.ownerId)throw Error('Re-select the mask group.');release(group);if(current())save('releaseSVGMask',{id:infos[0].svgMask.ownerId});}catch(error){I.note(section,error.message,'refused').setAttribute('role','alert');}}));return section;}
  if(releaseMode){const field=modeField(infos[0].svgMask.mode,()=>{if(!current()){field.select.value=infos[0].svgMask.mode;return;}try{typeChange(elements[0],field.select.value);if(current())save('setSVGMaskType',{mode:field.select.value});}catch(error){field.select.value=infos[0].svgMask.mode;I.note(section,error.message,'refused').setAttribute('role','alert');}});section.append(field.label);boundsFields(section,infos[0],elements[0],{current,save});section.append(button('edit','Edit mask shape',()=>{if(current())edit(infos[0].svgMask.maskIds);}));section.append(button('release','Release mask',()=>{if(!current())return;try{release(elements[0]);if(current())save('releaseSVGMask',{});}catch(error){I.note(section,error.message,'refused').setAttribute('role','alert');}}));I.note(section,'Release keeps the original mask shape and content, including their edits.');}
  else{const {label,select}=modeField('alpha');section.append(label,button('create','Use as mask',()=>{if(!current())return;try{const op=prepare(infos,elements,select.value);if(current())save('createSVGMask',op);}catch(error){I.note(section,error.message,'refused').setAttribute('role','alert');}}));I.note(section,'The bottom selected layer becomes the mask. Shape and content stay editable.');}
  return section;
 }
 root.RetouchSVGMask={prepare,release,typeChange,mount};
})(window);
