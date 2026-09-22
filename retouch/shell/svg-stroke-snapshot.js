(function(root){
 'use strict';
 const G=()=>root.RetouchSVGPath,A=()=>root.RetouchSVGAffine;
 const scalar=value=>{const text=String(value).trim();return /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?(?:px)?$/i.test(text)?parseFloat(text):NaN;};
 const matrix=value=>value&&[value.a,value.b,value.c,value.d,value.e,value.f];
 function viewportDiagonal(el){
  const svg=el.viewportElement||el.ownerSVGElement;if(!svg)throw Error('The stroke has no SVG viewport.');
  const box=svg.viewBox.baseVal,css=svg.ownerDocument.defaultView.getComputedStyle(svg),width=box.width>0?box.width:scalar(css.width),height=box.height>0?box.height:scalar(css.height);
  if(![width,height].every(value=>Number.isFinite(value)&&value>0))throw Error('Resolve the SVG viewport before capturing percentage strokes.');return Math.hypot(width,height)/Math.SQRT2;
 }
 function length(el,value){
  const literal=scalar(value);if(Number.isFinite(literal))return literal;
  if(/^[-+]?(?:\d+\.?\d*|\.\d+)%$/.test(value))return parseFloat(value)/100*viewportDiagonal(el);
  throw Error('Resolve the stroke length to pixels or a viewport percentage.');
 }
 function geometry(el,candidate,css){
  const fields=new Map(candidate.fields.map(field=>[field.name,field.value]));
  for(const [name,value]of fields)if(el.getAttribute(name)!==value)throw Error('The source geometry changed. Re-select the vector.');
  if(el.localName==='path'){
   const used=css.getPropertyValue('d').trim();let path=el.getAttribute('d');
   if(used){const match=/^path\(("(?:[^"\\]|\\.)*")\)$/.exec(used);if(!match)throw Error('Resolve the rendered CSS path before capturing this stroke.');path=JSON.parse(match[1]);}
   if(G().serializeCompound(G().parseCompound(path))!==candidate.path)throw Error('Page CSS changes the source path.');return;
  }
  if(['polygon','polyline'].includes(el.localName)){
   const path=[...el.points].map((point,i)=>(i?'L':'M')+point.x+' '+point.y).join(' ')+(el.localName==='polygon'?'Z':'');
   if(G().serializeCompound(G().parseCompound(path))!==candidate.path)throw Error('The rendered points changed.');return;
  }
  const source=name=>{const raw=fields.get(name);if(raw!==null&&raw!==undefined)return scalar(raw);if(name==='rx'||name==='ry'){const other=fields.get(name==='rx'?'ry':'rx');return other===null||other===undefined?0:scalar(other);}return 0;};
  const used=name=>{const raw=css.getPropertyValue(name).trim();if(raw==='auto'){const other=css.getPropertyValue(name==='rx'?'ry':'rx').trim();return other==='auto'?0:scalar(other);}return raw?scalar(raw):el[name]?.baseVal?.value;};
  for(const name of fields.keys()){const wanted=source(name),actual=used(name);if(!Number.isFinite(wanted)||!Number.isFinite(actual)||Math.abs(wanted-actual)>1e-6*Math.max(1,Math.abs(wanted)))throw Error('Page CSS changes or leaves unresolved the shape '+name+'.');}
 }
 function capture(el,candidate){
  if(!el?.isConnected||el.namespaceURI!=='http://www.w3.org/2000/svg'||el.localName!==candidate?.tag||el.getAttribute('data-rt')!==candidate.id)throw Error('Select the original connected SVG shape.');
  if(!/^[a-f0-9]{10}$/.test(candidate.id)||el.getRootNode().querySelectorAll('[data-rt="'+candidate.id+'"]').length!==1)throw Error('Select a source shape rendered once.');
  if(el.getAnimations?.({subtree:true}).some(animation=>animation.playState!=='finished')||el.querySelector('animate,animateTransform,animateMotion,set'))throw Error('Pause or remove shape animations before capturing the stroke.');
  const css=el.ownerDocument.defaultView.getComputedStyle(el);
  if(css.display==='none'||css.visibility!=='visible')throw Error('Choose a visible shape.');
  for(const [property,allowed]of [['filter',['none']],['clip-path',['none']],['mask-image',['none']],['mix-blend-mode',['normal']],['vector-effect',['none']],['paint-order',['normal','fill stroke markers','fill stroke']],['marker-start',['none']],['marker-mid',['none']],['marker-end',['none']]])if(!allowed.includes(css.getPropertyValue(property).trim()))throw Error('Resolve '+property+' before capturing this stroke.');
  geometry(el,candidate,css);
  const parent=el.parentElement.getScreenCTM?.(),actual=el.getScreenCTM?.();if(!parent||!actual||parent.is2D===false||actual.is2D===false)throw Error('The shape needs a measurable two-dimensional transform.');
  const relative=matrix(parent.inverse().multiply(actual));if(!A().valid(relative)||!A().equivalent(relative,candidate.matrix))throw Error('Page CSS changes the source transform.');
  const gradients={},paint=property=>{const value=css.getPropertyValue(property).trim();if(value.startsWith('url(')){const gradient=root.RetouchSVGStrokeGradientCapture.capture(el,value);if(!gradient)throw Error('Resolve this gradient paint before alignment.');gradients[property]=gradient;return '#000000';}return value==='currentcolor'||value==='currentColor'?css.color:value;};
  const fill=paint('fill'),stroke=paint('stroke');
  const rawDash=css.strokeDasharray.trim(),dasharray=rawDash==='none'?'none':rawDash.split(/[\s,]+/).map(value=>length(el,value)).join(' ');
  return root.RetouchSVGStrokeAlignment.normalize({document:G().parseCompound(candidate.path),matrix:candidate.matrix,position:'center',width:length(el,css.strokeWidth),fill,stroke,gradients,fillRule:css.fillRule,linecap:css.strokeLinecap,linejoin:css.strokeLinejoin,miterlimit:Number(css.strokeMiterlimit),dasharray,dashoffset:length(el,css.strokeDashoffset),opacity:Number(css.opacity),fillOpacity:Number(css.fillOpacity),strokeOpacity:Number(css.strokeOpacity)});
 }
 const api={capture};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGStrokeSnapshot=api;
})(typeof window==='object'?window:globalThis);
