(function(root){
 'use strict';
 const openOriginals=new Set(),openStrokes=new Set();
 const labels={union:'Union',subtract:'Subtract',intersect:'Intersect',exclude:'Exclude overlap'};
 const paint=['fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-dasharray','stroke-dashoffset','opacity','filter','clip-path','mask-image','mix-blend-mode','vector-effect','transform','transform-origin','visibility'];
 const shape=[...paint,'x','y','cx','cy','r','rx','ry','width','height','d'];
 const css=(el,props)=>props.map(key=>el.ownerDocument.defaultView.getComputedStyle(el).getPropertyValue(key));
 const same=(a,b)=>a.length===b.length&&a.every((value,i)=>value===b[i]);
 function neutral(el,allowTransform=false){const c=el.ownerDocument.defaultView.getComputedStyle(el);if(!allowTransform&&c.transform!=='none'||c.opacity!=='1'||c.filter!=='none'||c.clipPath!=='none'||c.maskImage!=='none'||c.mixBlendMode!=='normal'||c.visibility!=='visible')throw Error('CSS styles the boolean wrapper. Remove that override before grouping.');}
 function resultPath(base,info,path){const result=base.ownerDocument.createElementNS(base.namespaceURI,'path'),remove=new Set([...info.svgGeometry.fields.map(f=>f.name),'data-rt-shape']);for(const attr of base.attributes)if(!remove.has(attr.name)&&!/^data-rt(?:$|-revision|-client)/.test(attr.name))result.setAttributeNS(attr.namespaceURI,attr.name,attr.value);result.setAttribute('data-rt-boolean-result','');if(!result.hasAttribute('data-rt-name'))result.setAttribute('data-rt-name','Result');result.setAttribute('d',path);return result;}
 function prepare(infos,elements,operation){
  const path=root.RetouchSVGBooleanSelection.prepare(infos,elements,operation),base=elements[0],parent=base.parentNode,sorted=[...elements].sort((a,b)=>a.compareDocumentPosition(b)&4?-1:1),positions=sorted.map(el=>[...parent.children].indexOf(el));if(positions.some((n,i)=>n!==positions[0]+i))throw Error('Select consecutive shapes to keep their stacking order.');
  const originals=sorted.map(el=>({el,next:el.nextSibling,values:css(el,shape)})),before=css(base,paint),d=base.ownerDocument,group=d.createElementNS(base.namespaceURI,'g'),operands=d.createElementNS(base.namespaceURI,'g'),result=resultPath(base,infos[0],path);
  group.setAttribute('data-rt-boolean',operation);group.setAttribute('data-rt-name',labels[operation]);group.setAttribute('data-rt-boolean-base',sorted.indexOf(base));operands.setAttribute('data-rt-boolean-operands','');operands.setAttribute('data-rt-name','Original shapes');operands.setAttribute('display','none');group.append(operands,result);
  try{parent.insertBefore(group,sorted[0]);operands.append(...sorted);neutral(group,group.hasAttribute('transform'));neutral(operands);if(d.defaultView.getComputedStyle(operands).display!=='none')throw Error('CSS exposes the original boolean shapes.');if(!same(before,css(result,paint))||originals.some(({el,values})=>!same(values,css(el,shape))))throw Error('Boolean grouping would change CSS-controlled appearance or geometry.');}
  finally{for(const {el,next}of originals.reverse())parent.insertBefore(el,next?.parentNode===parent?next:null);group.remove();}
  return path;
 }
 function computedPathReference(group,path){
  // Let the browser serialize its own path precision (Chromium rounds CSS d).
  const probe=group.ownerDocument.createElementNS(group.namespaceURI,'path');probe.style.cssText='all:initial!important;display:none!important;';probe.style.setProperty('d','path('+JSON.stringify(path)+')','important');
  try{group.append(probe);return group.ownerDocument.defaultView.getComputedStyle(probe).getPropertyValue('d').trim();}finally{probe.remove();}
 }
 function compute(group,infos,operation,edit){
  const operands=group.querySelector(':scope > [data-rt-boolean-operands]'),result=group.querySelector(':scope > [data-rt-boolean-result]');if(!operands||!result)throw Error('Re-select the boolean group.');neutral(group,group.hasAttribute('transform'));neutral(operands);
  const previousOperation=group.getAttribute('data-rt-boolean'),previousName=group.getAttribute('data-rt-name');
  if(operation!==previousOperation){const watched=[group,operands,...operands.querySelectorAll('*'),result],before=watched.map(el=>css(el,shape));try{group.setAttribute('data-rt-boolean',operation);if(previousName===labels[previousOperation])group.setAttribute('data-rt-name',labels[operation]);neutral(group,group.hasAttribute('transform'));neutral(operands);if(watched.some((el,i)=>!same(before[i],css(el,shape))))throw Error('Changing the operation would alter CSS-controlled appearance or geometry.');}finally{group.setAttribute('data-rt-boolean',previousOperation);if(previousName===null)group.removeAttribute('data-rt-name');else group.setAttribute('data-rt-name',previousName);}}
  const elements=infos.map(info=>[...operands.children].find(el=>el.getAttribute('data-rt')===info.id));if(elements.some(el=>!el))throw Error('An original shape no longer resolves.');
  const target=edit?elements[infos.findIndex(i=>i.id===edit.operandId)]:null,property=edit?.operandOp.type==='setSVGTransform'?'transform':edit?.operandOp.property,previous=target?.getAttribute(property);const display=operands.getAttribute('display');
  try{
   operands.removeAttribute('display');
   let captured=infos.map(info=>({...info,booleanOperandPreview:true}));
   if(edit){
    if(!target)throw Error('Choose an original shape.');
    if(edit.operandOp.type==='setSVGTransform'){
     const matrix=edit.operandOp.matrix;if(!root.RetouchSVGAffine.valid(matrix))throw Error('Choose a valid original shape transform.');const value=root.RetouchSVGAffine.format(matrix);target.setAttribute('transform',value);
     captured=captured.map(info=>info.id===edit.operandId?{...info,svgTransform:{...info.svgTransform,matrix,value}}:info);
    }else if(edit.operandOp.type==='setSVGGeometry'){
     const value=edit.operandOp.value;if(value===null)target.removeAttribute(property);else target.setAttribute(property,value);captured=captured.map(info=>info.id===edit.operandId?{...info,svgGeometry:{...info.svgGeometry,fields:info.svgGeometry.fields.map(f=>f.name===property?{...f,value}:f)}}:info);
    }else throw Error('Choose an original geometry field or transform.');
   }
   const path=root.RetouchSVGBooleanSelection.prepare(captured,elements,operation),old=result.getAttribute('d');try{result.setAttribute('d',path);const computed=group.ownerDocument.defaultView.getComputedStyle(result).getPropertyValue('d').trim();if(computed&&computed!=='none'){if(computed!==computedPathReference(group,path))throw Error('CSS overrides the boolean result.');}else if(computed==='none'&&path)throw Error('CSS hides the boolean result path.');}finally{result.setAttribute('d',old);}
   return path;
  }finally{if(edit&&target){if(previous===null)target.removeAttribute(property);else target.setAttribute(property,previous);}if(display===null)operands.removeAttribute('display');else operands.setAttribute('display',display);}
 }
 function operandAtPoint(group,x,y,allow=()=>true){
  const container=group?.querySelector(':scope > [data-rt-boolean-operands]');if(!container||!Number.isFinite(x)||!Number.isFinite(y))return null;
  const display=container.getAttribute('display');
  try{container.removeAttribute('display');for(const el of [...container.children].reverse()){
   if(!allow(el)||!el.getAttribute('data-rt')||typeof el.isPointInFill!=='function')continue;
   try{const m=el.getScreenCTM();if(m&&el.isPointInFill(new group.ownerDocument.defaultView.DOMPoint(x,y).matrixTransform(m.inverse())))return el.getAttribute('data-rt');}catch{}
  }return null;}finally{if(display===null)container.removeAttribute('display');else container.setAttribute('display',display);}
 }
 function revealOriginals(info){openOriginals.add(info.file+'#'+info.id);}
 function preview(group,infos,operand,operation){
  const container=group.querySelector(':scope > [data-rt-boolean-operands]'),result=group.querySelector(':scope > [data-rt-boolean-result]');if(!container||!result)throw Error('Re-select the boolean group.');
  const saved=[[container,'display'],[container,'style'],[result,'d'],[result,'transform']].map(([el,name])=>({el,name,value:el.getAttribute(name)}));
  const put=({el,name,value})=>{if(value===null)el.removeAttribute(name);else el.setAttribute(name,value);};
  const conceal=()=>{container.removeAttribute('display');container.setAttribute('style',(saved[1].value||'')+';opacity:0!important;');};
  conceal();
  return {update(matrix){
   // Compute against authored appearance, then display only the combined result.
   for(const item of saved.slice(1))put(item);
   try{const path=compute(group,infos,operation,{operandId:operand.id,operandOp:{type:'setSVGTransform',matrix}});result.setAttribute('d',path);if(operand.id===infos[0].id)result.setAttribute('transform',root.RetouchSVGAffine.format(matrix));}
   finally{conceal();}
  },restore(){for(const item of saved)put(item);}};
 }
 function release(group){
  const parent=group.parentNode,operands=group.querySelector(':scope > [data-rt-boolean-operands]'),result=group.querySelector(':scope > [data-rt-boolean-result]');if(!parent||!operands||!result)throw Error('Re-select the boolean group.');
  const keep=group.hasAttribute('transform');if(keep&&!root.RetouchSVGAffine.parse(group.getAttribute('transform')))throw Error('The group transform cannot be preserved.');neutral(group,keep);neutral(operands);
  const originals=[...operands.childNodes],before=originals.filter(n=>n.nodeType===1).map(el=>({el,values:css(el,shape)})),children=[...group.childNodes],operation=group.getAttribute('data-rt-boolean'),base=group.getAttribute('data-rt-boolean-base');if(keep)before.push({el:group,values:css(group,shape)});
  try{if(keep){group.removeAttribute('data-rt-boolean');group.removeAttribute('data-rt-boolean-base');for(const el of originals)group.insertBefore(el,operands);operands.remove();result.remove();}else for(const el of originals)parent.insertBefore(el,group);if(before.some(({el,values})=>!same(values,css(el,shape))))throw Error('Releasing this boolean group would change CSS-controlled geometry or appearance.');}
  finally{if(keep){group.setAttribute('data-rt-boolean',operation);group.setAttribute('data-rt-boolean-base',base);group.replaceChildren(...children);}operands.append(...originals);}
 }
 function paintReason(target,property){
  if(['fill','stroke'].includes(property))return root.RetouchSVGPaint.attributeReason(target,property);
  const samples={'stroke-width':['1','2'],'stroke-linecap':['butt','round'],'stroke-linejoin':['miter','bevel'],'stroke-dasharray':['2 3','4 5'],'stroke-dashoffset':['1','2'],'stroke-miterlimit':['2','4'],'vector-effect':['none','non-scaling-stroke']}[property];
  if(!target?.isConnected||!samples)return 'Choose an editable SVG stroke property.';
  const w=target.ownerDocument.defaultView,css=w.getComputedStyle(target),durations=css.transitionDuration.split(',');if(target.getAnimations?.().length||css.transitionProperty.split(',').some((key,i)=>[property,'all'].includes(key.trim())&&parseFloat(durations[i%durations.length])>0))return 'Pause stroke animations or transitions before editing.';
  const previous=target.getAttribute(property),probe=root.document.createElementNS(target.namespaceURI,'path');probe.style.cssText='all:initial!important;display:none!important;';
  // Keep reference probes out of the source document so selectors stay unchanged.
  try{root.document.body.append(probe);for(const sample of samples){target.setAttribute(property,sample);probe.style.setProperty(property,sample,'important');if(w.getComputedStyle(target).getPropertyValue(property)!==root.getComputedStyle(probe).getPropertyValue(property))return 'Page styles control the combined '+property+'.';}return null;}
  finally{probe.remove();if(previous===null)target.removeAttribute(property);else target.setAttribute(property,previous);}
 }
 function mount(info,target,{current,selected=current,resolveTarget=()=>target,load,save,onCanvas}){
  const I=root.RetouchInspector,section=I.section('Boolean group'),meta=info.svgBooleanGroup,select=root.document.createElement('select');select.setAttribute('aria-label','Boolean operation');for(const [value,label]of Object.entries(labels))select.append(new Option(label,value));select.value=meta.operation;I.field(section,'Boolean operation',select);select.parentElement.querySelector('span').textContent='Operation';
  const fail=error=>I.note(section,error.message,'refused').setAttribute('role','alert');let originals=null;
  const ready=async()=>{if(!originals)originals=await load([meta.baseId,...meta.operandIds.filter(id=>id!==meta.baseId)]);return originals;};
  select.onchange=async()=>{if(!current())return;const operation=select.value;try{const infos=await ready();if(current())await save('setSVGBooleanOperation',{operation,path:compute(resolveTarget(),infos,operation)});}catch(error){select.value=meta.operation;fail(error);}};
  section.append(I.button('Release boolean group',()=>{if(!current())return;try{release(resolveTarget());save('releaseSVGBooleanGroup',{});}catch(error){fail(error);}}));
  const strokeDetails=root.document.createElement('details'),strokeSummary=root.document.createElement('summary'),strokeKey=info.file+'#'+info.id;strokeSummary.textContent='Stroke settings';strokeDetails.append(strokeSummary);strokeDetails.open=openStrokes.has(strokeKey);strokeDetails.ontoggle=()=>{if(strokeDetails.open)openStrokes.add(strokeKey);else openStrokes.delete(strokeKey);};
  const fieldLabels={fill:'Fill',stroke:'Stroke','stroke-width':'Weight','stroke-linecap':'Ends','stroke-linejoin':'Joins','stroke-dasharray':'Dashes','stroke-dashoffset':'Offset','stroke-miterlimit':'Miter limit','vector-effect':'Scaling'};
  for(const [property,shortLabel]of Object.entries(fieldLabels)){const label='Combined '+({fill:'fill',stroke:'stroke','stroke-width':'stroke width','stroke-linecap':'stroke ends','stroke-linejoin':'stroke joins','stroke-dasharray':'dash pattern','stroke-dashoffset':'dash offset','stroke-miterlimit':'miter limit','vector-effect':'stroke scaling'})[property];
   const options=root.RetouchHTMLCSSValues.options[property],input=root.document.createElement(options?'select':'input'),result=resolveTarget()?.querySelector(':scope > [data-rt-boolean-result]');const initial=meta.paints?.[property]??(result?result.ownerDocument.defaultView.getComputedStyle(result).getPropertyValue(property):'');if(options)for(const value of new Set([initial,...options]))input.append(new Option(property==='vector-effect'?(value==='non-scaling-stroke'?'Keep width':'Scale with shape'):value[0]?.toUpperCase()+value.slice(1),value));else input.type='text';input.value=initial;
   input.onchange=()=>{if(!current())return;const value=input.value.trim()||null,target=resolveTarget()?.querySelector(':scope > [data-rt-boolean-result]');try{
    if(!root.RetouchHTMLCSSValues.valid(property,value))throw Error('Use a supported paint value.');if(!target)throw Error('Re-select the boolean group.');
    const reason=paintReason(target,property);if(reason)throw Error(reason);
    save('setSVGBooleanPaint',{property,value});
   }catch(error){fail(error);}};if(!options)I.fieldDraft(input);if(['fill','stroke'].includes(property)){input.dataset.paintProperty=property;input.retouchPaintPreview=()=>root.RetouchPaintPicker.propertyPreview({el:resolveTarget()?.querySelector(':scope > [data-rt-boolean-result]'),input,property});}I.field(['fill','stroke','stroke-width'].includes(property)?section:strokeDetails,label,input);input.closest('.inspector-field').querySelector(':scope > span').textContent=shortLabel;
  }
  section.append(strokeDetails);
  I.note(section,'Combined paint is independent. Releasing the group restores the originals’ paints.');
  const details=root.document.createElement('details'),summary=root.document.createElement('summary');summary.textContent='Original shapes';Object.assign(summary.style,{fontSize:'12px',fontWeight:'600',padding:'8px 0',cursor:'pointer'});details.append(summary);const key=info.file+'#'+info.id;details.open=openOriginals.has(key);section.append(details);let loaded=false;
  details.ontoggle=async()=>{if(details.open)openOriginals.add(key);else openOriginals.delete(key);if(!details.open||loaded)return;try{const infos=await ready();if(!selected())return;loaded=true;for(const operand of infos){const box=root.document.createElement('div'),name=root.document.createElement('strong');name.textContent=operand.layerName||resolveTarget()?.querySelector('[data-rt="'+operand.id+'"]')?.getAttribute('aria-label')||operand.tag;Object.assign(name.style,{display:'block',fontSize:'12px',margin:'8px 0'});box.append(name);if(onCanvas){const tools=root.document.createElement('div');tools.className='stack-presets';for(const action of ['move','resize','rotate']){const label=action[0].toUpperCase()+action.slice(1),button=I.button(label,()=>{if(current())onCanvas(info,operand,infos,action);});button.setAttribute('aria-label',label+' original '+name.textContent+' on canvas');button.title=label+' original on canvas';tools.append(button);}box.append(tools);}const rows=new Map();for(const field of operand.svgGeometry.fields){const input=root.document.createElement('input');input.type='text';input.value=field.value??'';input.disabled=field.editable===false;I.field(box,'Original '+operand.tag+' '+field.label,input);rows.set(field.name,input.closest('.inspector-field'));input.parentElement.querySelector('span').textContent=field.label;input.onchange=()=>{if(!current())return;const value=input.value.trim()||null,edit={operandId:operand.id,operandOp:{type:'setSVGGeometry',property:field.name,value}};try{const path=compute(resolveTarget(),infos,meta.operation,edit);save('setSVGBooleanOperand',{...edit,path});}catch(error){input.value=field.value??'';fail(error);}};I.fieldDraft(input);}for(const pair of [['x','y'],['cx','cy'],['width','height'],['rx','ry'],['x1','y1'],['x2','y2']]){if(!pair.every(key=>rows.has(key)))continue;const grid=root.document.createElement('div');grid.className='property-pair';rows.get(pair[0]).before(grid);for(const key of pair){const row=rows.get(key);row.querySelector('span').textContent=({width:'W',height:'H',rx:'Rx',ry:'Ry'})[key]||key.toUpperCase();grid.append(row);}}details.append(box);}}catch(error){fail(error);}};
  I.note(section,'Double-click the combined shape to move an original. Geometry edits apply to every screen size; the combined outline uses the current SVG size.');return section;
 }
 root.RetouchSVGBooleanGroup={prepare,compute,operandAtPoint,revealOriginals,preview,release,mount};
})(window);
