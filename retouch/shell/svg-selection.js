(function(root){
 'use strict';
 const A=()=>root.RetouchSVGAffine||require('./svg-affine.js'),array=m=>[m.a,m.b,m.c,m.d,m.e,m.f];
 function inverse(m){const d=m[0]*m[3]-m[1]*m[2];return Math.abs(d)<1e-9?null:[m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];}
 function transform(parent,global,own){const inv=inverse(parent);return inv&&A().multiply(A().multiply(A().multiply(inv,global),parent),own);}
 function matricesFor(members,global){return Object.fromEntries(members.map(m=>[m.info.id,m.covered?m.info.svgTransform.matrix:transform(m.parent,global,m.info.svgTransform.matrix)]));}
 function capture(infos,elements){
  if(infos.length!==elements.length||elements.some(el=>!el?.isConnected)||new Set(infos.map(i=>i.file)).size!==1)throw Error('Select visible vectors from one source file.');
  const members=infos.map((info,i)=>{const el=elements[i],reason=root.RetouchSVGResize.reason(el,info,true);if(reason)throw Error(reason);if(el.getAttribute('transform')!==info.svgTransform.value)throw Error('The vector changed. Re-select it.');const data=root.RetouchSVGResize.measure(el),parent=A().multiply(array(data.m),inverse(info.svgTransform.matrix));return {info,el,parent,covered:elements.some(ancestor=>ancestor!==el&&ancestor.contains(el)),rect:el.getBoundingClientRect()};});
  const outer=members.filter(m=>!m.covered);const left=Math.min(...outer.map(m=>m.rect.left)),top=Math.min(...outer.map(m=>m.rect.top)),right=Math.max(...outer.map(m=>m.rect.right)),bottom=Math.max(...outer.map(m=>m.rect.bottom));return {members,box:{left,top,width:right-left,height:bottom-top},w:elements[0].ownerDocument.defaultView};
 }
 function mount(infos,elements,{save,current}){
  const I=root.RetouchInspector,section=I.section('Selection transform');let initial;try{initial=capture(infos,elements);}catch(error){I.note(section,error.message,'refused').setAttribute('role','alert');return section;}
  function apply(kind,value){if(!current())throw Error('Re-select these vectors before transforming.');const {members,box,w}=capture(infos,elements),cx=box.left+box.width/2,cy=box.top+box.height/2;let g;
   if(kind==='x'||kind==='y'){if(!Number.isFinite(value)||Math.abs(value)>100000)throw Error('Enter a position within 100000 pixels.');g=[1,0,0,1,kind==='x'?value-box.left-w.scrollX:0,kind==='y'?value-box.top-w.scrollY:0];}
   else if(kind==='width'||kind==='height'){if(!Number.isFinite(value)||value<=0||value>100000||!box[kind])throw Error('Enter a positive selection size up to 100000 pixels.');const sx=kind==='width'?value/box.width:1,sy=kind==='height'?value/box.height:1;g=[sx,0,0,sy,box.left*(1-sx),box.top*(1-sy)];}
   else if(kind==='rotation'){if(!Number.isFinite(value)||Math.abs(value)>360)throw Error('Enter an angle from -360 to 360 degrees.');g=A().parse('rotate('+(-value)+' '+cx+' '+cy+')');}
   else {const sx=kind==='flip-x'?-1:1,sy=kind==='flip-y'?-1:1;g=[sx,0,0,sy,cx*(1-sx),cy*(1-sy)];}
   const matrices=matricesFor(members,g);if(Object.values(matrices).some(m=>!A().valid(m)))throw Error('Keep every transformed vector within the supported range.');if(members.some(m=>!A().equivalent(matrices[m.info.id],m.info.svgTransform.matrix)))save(matrices);
  }
  for(const [kind,label,value]of [['x','Selection X',initial.box.left+initial.w.scrollX],['y','Selection Y',initial.box.top+initial.w.scrollY],['width','Selection width',initial.box.width],['height','Selection height',initial.box.height],['rotation','Rotate selection (°)',0]]){const input=root.document.createElement('input');input.type='text';input.inputMode='decimal';input.value=String(Math.round(value*10000)/10000);input.oninput=()=>input.setCustomValidity('');input.onchange=()=>{try{const value=root.RetouchNumericExpression.evaluate(input.value);apply(kind,value);input.value=String(Math.round(value*10000)/10000);}catch(error){input.setCustomValidity(error.message);input.reportValidity();}};root.RetouchNumericExpression.field(input);I.field(section,label,input);}
  const flips=root.RetouchFlip.mount(elements[0],()=>{});for(const button of flips.querySelectorAll('button')){button.disabled=false;button.onclick=()=>{try{apply('flip-'+button.dataset.flipAxis);}catch(error){I.note(section,error.message,'refused');}};}section.append(flips);I.note(section,'Bounds in document pixels. Rotation and flips use the selection center. Changes apply to all screen sizes.');return section;
 }
 const api={inverse,transform,matricesFor,capture,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGSelection=api;
})(typeof window==='object'?window:globalThis);
