(function(root){
 'use strict';
 const geometry=()=>root.RetouchSVGPath,array=m=>[m.a,m.b,m.c,m.d,m.e,m.f];
 function renderedPath(el,info){
  const css=el.ownerDocument.defaultView.getComputedStyle(el),fields=info.svgGeometry?.fields;if(!fields||fields.some(f=>f.editable===false))throw Error('Choose shapes with editable geometry.');
  for(const field of fields)if(el.getAttribute(field.name)!==field.value)throw Error('A shape changed. Re-select the layers.');
  if(el.localName==='path'){
   const computed=css.getPropertyValue('d').trim();let d=el.getAttribute('d');if(computed==='none')return null;if(computed){const match=/^path\(("(?:[^"\\]|\\.)*")\)$/.exec(computed);if(!match)throw Error('This CSS path cannot be combined yet.');d=JSON.parse(match[1]);}return geometry().parseCompound(d);
  }
  if(['polygon','polyline'].includes(el.localName)){const pts=[...el.points].map(p=>({x:p.x,y:p.y}));return pts.length>2?{subpaths:[{closed:true,nodes:pts}]}:null;}
  const values={};for(const f of fields){let value=css.getPropertyValue(f.name).trim();if(value&&value!=='auto'){if(!/^[-+]?(?:\d+\.?\d*|\.\d+)px$/.test(value)&&!/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(value))throw Error('Resolve percentage or calculated geometry before combining these shapes.');values[f.name]=parseFloat(value);}else values[f.name]=['rx','ry'].includes(f.name)&&el.localName==='rect'?null:el[f.name]?.baseVal?.value??0;}
  const {x=0,y=0,width:w=0,height:h=0,cx=0,cy=0}=values;let d;
  if(el.localName==='rect'){let rx=values.rx??values.ry??0,ry=values.ry??values.rx??0;rx=Math.min(rx,w/2);ry=Math.min(ry,h/2);if(w<=0||h<=0)return null;d=rx&&ry?`M${x+rx} ${y}H${x+w-rx}A${rx} ${ry} 0 0 1 ${x+w} ${y+ry}V${y+h-ry}A${rx} ${ry} 0 0 1 ${x+w-rx} ${y+h}H${x+rx}A${rx} ${ry} 0 0 1 ${x} ${y+h-ry}V${y+ry}A${rx} ${ry} 0 0 1 ${x+rx} ${y}Z`:`M${x} ${y}h${w}v${h}h${-w}Z`;}
  if(['circle','ellipse'].includes(el.localName)){const rx=el.localName==='circle'?values.r:values.rx,ry=el.localName==='circle'?values.r:values.ry;if(rx<=0||ry<=0)return null;d=`M${cx+rx} ${cy}A${rx} ${ry} 0 1 1 ${cx-rx} ${cy}A${rx} ${ry} 0 1 1 ${cx+rx} ${cy}Z`;}
  return geometry().parseCompound(d);
 }
 function prepare(infos,elements,operation){
  if(infos.length<2||infos.length!==elements.length||new Set(infos.map(i=>i.file)).size!==1||new Set(infos.map(i=>i.hash)).size!==1||elements.some(el=>!el?.isConnected||el.parentElement!==elements[0].parentElement))throw Error('Select sibling SVG shapes from one source file.');
  const base=elements[0],inv=base.getScreenCTM()?.inverse();if(!inv)throw Error('The base shape has no measurable transform.');
  const operands=elements.map((el,i)=>{const reason=root.RetouchSVGResize.reason(el,infos[i],true);if(reason)throw Error(reason);const document=renderedPath(el,infos[i]);if(!document)throw Error('Choose closed shapes with nonzero area.');return {document,fillRule:el.ownerDocument.defaultView.getComputedStyle(el).fillRule,matrix:array(inv.multiply(el.getScreenCTM()))};});
  const result=root.RetouchSVGBoolean.combineShapes(operands,operation);if(!result.ok)throw Error(result.reason);const path=result.empty?'':geometry().serializeCompound(result.document);
  if(path){
   const clone=base.ownerDocument.createElementNS(base.namespaceURI,'path'),properties=new Set([...infos[0].svgGeometry.fields.map(f=>f.name),'data-rt-shape']);for(const attr of base.attributes)if(!properties.has(attr.name))clone.setAttributeNS(attr.namespaceURI,attr.name,attr.value);clone.setAttribute('d',path);
   const w=base.ownerDocument.defaultView,paint=['fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-dasharray','stroke-dashoffset','opacity','filter','clip-path','mask','mix-blend-mode','vector-effect'],before=Object.fromEntries(paint.map(k=>[k,w.getComputedStyle(base).getPropertyValue(k)]));
   try{base.replaceWith(clone);const css=w.getComputedStyle(clone);if(paint.some(k=>css.getPropertyValue(k)!==before[k])||!root.RetouchSVGAffine.equivalent(array(clone.getScreenCTM()),array(inv.inverse())))throw Error('Changing this shape to a path would alter its CSS appearance.');const computed=css.getPropertyValue('d').trim();if(computed&&computed!=='none'){const match=/^path\(("(?:[^"\\]|\\.)*")\)$/.exec(computed);if(!match||geometry().serializeCompound(geometry().parseCompound(JSON.parse(match[1])))!==path)throw Error('CSS overrides the combined path. Remove that override first.');}}
   finally{clone.replaceWith(base);}
  }
  return path;
 }
 function mount(infos,elements,{current,save}){
  const I=root.RetouchInspector,section=I.section('Combine shapes'),row=root.document.createElement('div');Object.assign(row.style,{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:'4px'});section.append(row);
  const icons={union:'M4 4H14V10H20V20H10V14H4Z',subtract:'M4 4H14V10H10V14H4Z',intersect:'M10 10H14V14H10Z',exclude:'M4 4H14V10H10V14H4ZM14 10H20V20H10V14H14Z'};
  for(const [operation,label]of [['union','Union'],['subtract','Subtract'],['intersect','Intersect'],['exclude','Exclude overlap']]){const button=I.button(label,()=>{if(!current())return;try{const path=prepare(infos,elements,operation);if(current())save(path);}catch(error){I.note(section,error.message,'refused').setAttribute('role','alert');}});button.setAttribute('aria-label',label+' selected shapes');button.title=label+' selected shapes';button.innerHTML='<svg width=20 height=20 viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4H14V14H4ZM10 10H20V20H10Z" fill="none" stroke="currentColor" opacity=".25"/><path d="'+icons[operation]+'" fill="currentColor"/></svg>';row.append(button);}
  I.note(section,'Uses the first selected shape’s appearance. Subtract removes the other shapes from it. Undo restores the original layers.');return section;
 }
 const api={renderedPath,prepare,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGBooleanSelection=api;
})(typeof window==='object'?window:globalThis);
