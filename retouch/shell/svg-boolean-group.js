(function(root){
 'use strict';
 const openOriginals=new Set();
 const labels={union:'Union',subtract:'Subtract',intersect:'Intersect',exclude:'Exclude overlap'};
 const paint=['fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-dasharray','stroke-dashoffset','opacity','filter','clip-path','mask-image','mix-blend-mode','vector-effect','transform','transform-origin','visibility'];
 const shape=[...paint,'x','y','cx','cy','r','rx','ry','width','height','d'];
 const css=(el,props)=>props.map(key=>el.ownerDocument.defaultView.getComputedStyle(el).getPropertyValue(key));
 const same=(a,b)=>a.length===b.length&&a.every((value,i)=>value===b[i]);
 function neutral(el){const c=el.ownerDocument.defaultView.getComputedStyle(el);if(c.transform!=='none'||c.opacity!=='1'||c.filter!=='none'||c.clipPath!=='none'||c.maskImage!=='none'||c.mixBlendMode!=='normal'||c.visibility!=='visible')throw Error('CSS styles the boolean wrapper. Remove that override before grouping.');}
 function resultPath(base,info,path){const result=base.ownerDocument.createElementNS(base.namespaceURI,'path'),remove=new Set([...info.svgGeometry.fields.map(f=>f.name),'data-rt-shape']);for(const attr of base.attributes)if(!remove.has(attr.name)&&!/^data-rt(?:$|-revision|-client)/.test(attr.name))result.setAttributeNS(attr.namespaceURI,attr.name,attr.value);result.setAttribute('data-rt-boolean-result','');if(!result.hasAttribute('data-rt-name'))result.setAttribute('data-rt-name','Result');result.setAttribute('d',path);return result;}
 function prepare(infos,elements,operation){
  const path=root.RetouchSVGBooleanSelection.prepare(infos,elements,operation),base=elements[0],parent=base.parentNode,sorted=[...elements].sort((a,b)=>a.compareDocumentPosition(b)&4?-1:1),positions=sorted.map(el=>[...parent.children].indexOf(el));if(positions.some((n,i)=>n!==positions[0]+i))throw Error('Select consecutive shapes to keep their stacking order.');
  const originals=sorted.map(el=>({el,next:el.nextSibling,values:css(el,shape)})),before=css(base,paint),d=base.ownerDocument,group=d.createElementNS(base.namespaceURI,'g'),operands=d.createElementNS(base.namespaceURI,'g'),result=resultPath(base,infos[0],path);
  group.setAttribute('data-rt-boolean',operation);group.setAttribute('data-rt-name',labels[operation]);group.setAttribute('data-rt-boolean-base',sorted.indexOf(base));operands.setAttribute('data-rt-boolean-operands','');operands.setAttribute('data-rt-name','Original shapes');operands.setAttribute('display','none');group.append(operands,result);
  try{parent.insertBefore(group,sorted[0]);operands.append(...sorted);neutral(group);neutral(operands);if(d.defaultView.getComputedStyle(operands).display!=='none')throw Error('CSS exposes the original boolean shapes.');if(!same(before,css(result,paint))||originals.some(({el,values})=>!same(values,css(el,shape))))throw Error('Boolean grouping would change CSS-controlled appearance or geometry.');}
  finally{for(const {el,next}of originals.reverse())parent.insertBefore(el,next?.parentNode===parent?next:null);group.remove();}
  return path;
 }
 function compute(group,infos,operation,edit){
  const operands=group.querySelector(':scope > [data-rt-boolean-operands]'),result=group.querySelector(':scope > [data-rt-boolean-result]');if(!operands||!result)throw Error('Re-select the boolean group.');neutral(group);neutral(operands);
  const elements=infos.map(info=>[...operands.children].find(el=>el.getAttribute('data-rt')===info.id));if(elements.some(el=>!el))throw Error('An original shape no longer resolves.');
  const target=edit?elements[infos.findIndex(i=>i.id===edit.operandId)]:null,property=edit?.operandOp.property,previous=target?.getAttribute(property);const display=operands.getAttribute('display');
  try{
   operands.removeAttribute('display');
   let captured=infos.map(info=>({...info,booleanOperandPreview:true}));
   if(edit){if(!target||edit.operandOp.type!=='setSVGGeometry')throw Error('Choose an original geometry field.');const value=edit.operandOp.value;if(value===null)target.removeAttribute(property);else target.setAttribute(property,value);captured=captured.map(info=>info.id===edit.operandId?{...info,svgGeometry:{...info.svgGeometry,fields:info.svgGeometry.fields.map(f=>f.name===property?{...f,value}:f)}}:info);}
   const path=root.RetouchSVGBooleanSelection.prepare(captured,elements,operation),old=result.getAttribute('d');try{result.setAttribute('d',path);const computed=group.ownerDocument.defaultView.getComputedStyle(result).getPropertyValue('d').trim();if(computed&&computed!=='none'){const match=/^path\(("(?:[^"\\]|\\.)*")\)$/.exec(computed);if(!match||root.RetouchSVGPath.serializeCompound(root.RetouchSVGPath.parseCompound(JSON.parse(match[1])))!==(path||null))throw Error('CSS overrides the boolean result.');}else if(computed==='none'&&path)throw Error('CSS hides the boolean result path.');}finally{result.setAttribute('d',old);}
   return path;
  }finally{if(edit){if(previous===null)target.removeAttribute(property);else target.setAttribute(property,previous);}if(display===null)operands.removeAttribute('display');else operands.setAttribute('display',display);}
 }
 function release(group){
  const parent=group.parentNode,operands=group.querySelector(':scope > [data-rt-boolean-operands]');if(!parent||!operands)throw Error('Re-select the boolean group.');neutral(group);neutral(operands);const originals=[...operands.childNodes],before=originals.filter(n=>n.nodeType===1).map(el=>({el,values:css(el,shape)}));
  try{for(const el of originals)parent.insertBefore(el,group);if(before.some(({el,values})=>!same(values,css(el,shape))))throw Error('Releasing this boolean group would change CSS-controlled geometry or appearance.');}
  finally{operands.append(...originals);}
 }
 function mount(info,target,{current,selected=current,load,save}){
  const I=root.RetouchInspector,section=I.section('Boolean group'),meta=info.svgBooleanGroup,select=root.document.createElement('select');select.setAttribute('aria-label','Boolean operation');for(const [value,label]of Object.entries(labels))select.append(new Option(label,value));select.value=meta.operation;I.field(section,'Boolean operation',select);select.parentElement.querySelector('span').textContent='Operation';
  const fail=error=>I.note(section,error.message,'refused').setAttribute('role','alert');let originals=null;
  const ready=async()=>{if(!originals)originals=await load([meta.baseId,...meta.operandIds.filter(id=>id!==meta.baseId)]);return originals;};
  select.onchange=async()=>{if(!current())return;const operation=select.value;try{const infos=await ready();if(current())await save('setSVGBooleanOperation',{operation,path:compute(target,infos,operation)});}catch(error){select.value=meta.operation;fail(error);}};
  section.append(I.button('Release boolean group',()=>{if(!current())return;try{release(target);save('releaseSVGBooleanGroup',{});}catch(error){fail(error);}}));
  const details=root.document.createElement('details'),summary=root.document.createElement('summary');summary.textContent='Original shapes';Object.assign(summary.style,{fontSize:'12px',fontWeight:'600',padding:'8px 0',cursor:'pointer'});details.append(summary);const key=info.file+'#'+info.id;details.open=openOriginals.has(key);section.append(details);let loaded=false;
  details.ontoggle=async()=>{if(details.open)openOriginals.add(key);else openOriginals.delete(key);if(!details.open||loaded)return;try{const infos=await ready();if(!selected())return;loaded=true;for(const operand of infos){const box=root.document.createElement('div'),name=root.document.createElement('strong');name.textContent=operand.layerName||target.querySelector('[data-rt="'+operand.id+'"]')?.getAttribute('aria-label')||operand.tag;Object.assign(name.style,{display:'block',fontSize:'12px',margin:'8px 0'});box.append(name);const rows=new Map();for(const field of operand.svgGeometry.fields){const input=root.document.createElement('input');input.type='text';input.value=field.value??'';input.disabled=field.editable===false;I.field(box,'Original '+operand.tag+' '+field.label,input);rows.set(field.name,input.closest('.inspector-field'));input.parentElement.querySelector('span').textContent=field.label;input.onchange=()=>{if(!current())return;const value=input.value.trim()||null,edit={operandId:operand.id,operandOp:{type:'setSVGGeometry',property:field.name,value}};try{const path=compute(target,infos,meta.operation,edit);save('setSVGBooleanOperand',{...edit,path});}catch(error){input.value=field.value??'';fail(error);}};I.fieldDraft(input);}for(const pair of [['x','y'],['cx','cy'],['width','height'],['rx','ry'],['x1','y1'],['x2','y2']]){if(!pair.every(key=>rows.has(key)))continue;const grid=root.document.createElement('div');grid.className='property-pair';rows.get(pair[0]).before(grid);for(const key of pair){const row=rows.get(key);row.querySelector('span').textContent=({width:'W',height:'H',rx:'Rx',ry:'Ry'})[key]||key.toUpperCase();grid.append(row);}}details.append(box);}}catch(error){fail(error);}};
  I.note(section,'Original shapes stay in the group. Geometry edits apply to every screen size; the combined outline uses the current SVG size.');return section;
 }
 root.RetouchSVGBooleanGroup={prepare,compute,release,mount};
})(window);
