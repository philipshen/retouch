(function(root){
 'use strict';
 const fields={opacity:{label:'Opacity (%)',matches:t=>/^opacity-|^\[opacity:/.test(t),token:v=>'opacity-['+v/100+']'},visibility:{label:'Visibility',matches:t=>/^(visible|invisible|collapse)$|^\[visibility:/.test(t),options:['visible','hidden','collapse'],token:v=>({visible:'visible',hidden:'invisible',collapse:'collapse'})[v]},'mix-blend-mode':{label:'Blend mode',matches:t=>/^mix-blend-|^\[mix-blend-mode:/.test(t),options:['normal','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','hard-light','soft-light','difference','exclusion','hue','saturation','color','luminosity'],token:v=>'mix-blend-'+v},isolation:{label:'Blend group',matches:t=>/^(isolate|isolation-auto)$|^\[isolation:/.test(t),options:['auto','isolate'],token:v=>v==='auto'?'isolation-auto':'isolate'}};
 function change(classes,scope,property,value,document=null){
  const field=fields[property];if(!field||value!==null&&(field.options?!field.options.includes(value):!Number.isFinite(value)||value<0||value>100))throw Error('Choose a supported shared style value.');
  const I=root.RetouchInspector||require('./inspector.js'),R=root.RetouchResponsive||require('./responsive.js');
  let addition=value===null?'':field.token(value);if(scope&&value!==null&&R.inherited(classes,scope,document).split(/\s+/).some(token=>I.base(token)!==null&&field.matches(I.base(token))&&/^!|!$/.test(token)))addition='!'+addition;
  const projected=R.project(classes,scope),next=I.replace(projected,field.matches,addition);return next===projected?(classes||''):R.replaceScope(classes,next,scope);
 }
 function mount(infos,elements,scope,save){
  const I=root.RetouchInspector,sec=I.section('Shared styles');
  if(elements.some(el=>!el?.isConnected)||infos.some(info=>info.classNameDynamic||info.svgPaint?.reason)){I.note(sec,'Shared styles need literal class names without spread props on every selected layer.','refused');return sec;}
  I.note(sec,'Shift-click a range in Layers; Cmd/Ctrl-click toggles layers. On the canvas, Shift-click toggles. Each edit updates these source layers and undoes together, including every rendered instance.');
  for(const [property,field]of Object.entries(fields)){
   const values=elements.map(el=>el.ownerDocument.defaultView.getComputedStyle(el).getPropertyValue(property)),mixed=values.some(v=>v!==values[0]),input=root.document.createElement(field.options?'select':'input'),blocked=elements.some(el=>el.style.getPropertyValue(property));
   if(field.options){if(mixed){const o=root.document.createElement('option');o.value='';o.textContent='Mixed';o.disabled=true;input.append(o);}for(const value of field.options){const o=root.document.createElement('option');o.value=value;o.textContent=value;input.append(o);}}
   else{input.type='number';input.min='0';input.max='100';input.step='any';input.placeholder=mixed?'Mixed':'';}
   input.value=mixed?'':property==='opacity'?String(Math.round(Number(values[0])*10000)/100):values[0];input.disabled=blocked;input.title=blocked?'An inline style controls this property on a selected layer. Edit that source style first.':'';
   const write=value=>{try{save(Object.fromEntries(infos.map((info,i)=>[info.id,change(info.className,scope,property,value,elements[i].ownerDocument)])));}catch(error){I.note(sec,error.message,'refused');}};
   input.onchange=()=>{if(input.value!==''&&input.checkValidity())write(property==='opacity'?Number(input.value):input.value);};input.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();input.value=mixed?'':property==='opacity'?String(Math.round(Number(values[0])*10000)/100):values[0];input.blur();}else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();input.blur();}};I.field(sec,'Shared '+field.label,input);
   const reset=I.button('Reset shared '+field.label.toLowerCase(),()=>write(null));reset.disabled=infos.every(info=>change(info.className,scope,property,null)===(info.className||''));sec.append(reset);
  }
  I.note(sec,'Values show the current preview. Edits follow the selected style scope; reset removes that scope’s matching classes.');return sec;
 }
 const api={change,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchReactSelection=api;
})(typeof window==='object'?window:globalThis);
