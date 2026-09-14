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
 function mount(infos,elements,{current,save,edit}){
  const I=root.RetouchInspector,section=I.section('Mask'),releaseMode=infos.length===1&&infos[0].svgMask?.canRelease;
  if(infos.length===1&&infos[0].svgMask?.ownerId){section.append(I.button('Back to mask',()=>{if(current())edit([infos[0].svgMask.ownerId]);}));return section;}
  if(releaseMode){section.append(I.button('Edit mask shape',()=>{if(current())edit(infos[0].svgMask.maskIds);}));section.append(I.button('Release mask',()=>{if(!current())return;try{release(elements[0]);if(current())save('releaseSVGMask',{});}catch(error){I.note(section,error.message,'refused').setAttribute('role','alert');}}));I.note(section,'Release keeps the original mask shape and content, including their edits.');}
  else{const label=root.document.createElement('label'),select=root.document.createElement('select');label.className='inspector-field';const caption=root.document.createElement('span');caption.textContent='Mask type';label.append(caption);Object.assign(label.style,{display:'grid',gridTemplateColumns:'1fr 1fr',alignItems:'center',gap:'8px',marginBottom:'8px'});Object.assign(select.style,{width:'100%',minWidth:'0',height:'28px',border:'0',borderRadius:'4px',padding:'4px 8px',background:'var(--control-bg,#f5f5f5)',color:'inherit',font:'inherit'});select.setAttribute('aria-label','Mask type');for(const [value,text]of [['alpha','Alpha'],['luminance','Luminance']]){const option=root.document.createElement('option');option.value=value;option.textContent=text;select.append(option);}label.append(select);section.append(label,I.button('Use as mask',()=>{if(!current())return;try{const op=prepare(infos,elements,select.value);if(current())save('createSVGMask',op);}catch(error){I.note(section,error.message,'refused').setAttribute('role','alert');}}));I.note(section,'The bottom selected layer becomes the mask. Shape and content stay editable.');}
  return section;
 }
 root.RetouchSVGMask={prepare,release,mount};
})(window);
