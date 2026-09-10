(function(root){
 'use strict';
 const fields={opacity:{label:'Opacity (%)',matches:t=>/^opacity-|^\[opacity:/.test(t),token:v=>'opacity-['+v/100+']'},visibility:{label:'Visibility',matches:t=>/^(visible|invisible|collapse)$|^\[visibility:/.test(t),options:['visible','hidden','collapse'],token:v=>({visible:'visible',hidden:'invisible',collapse:'collapse'})[v]},'mix-blend-mode':{label:'Blend mode',matches:t=>/^mix-blend-|^\[mix-blend-mode:/.test(t),options:['normal','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','hard-light','soft-light','difference','exclusion','hue','saturation','color','luminosity'],token:v=>'mix-blend-'+v},isolation:{label:'Blend group',matches:t=>/^(isolate|isolation-auto)$|^\[isolation:/.test(t),options:['auto','isolate'],token:v=>v==='auto'?'isolation-auto':'isolate'}};
 const inspector=()=>root.RetouchInspector||require('./inspector.js');
 Object.assign(fields,{
  'font-size':{label:'Font size (px)',min:0,max:2000,matches:t=>inspector().fontSizeToken(t),token:v=>'[font-size:'+v+'px]'},
  'font-weight':{label:'Font weight (1–1000)',min:1,max:1000,step:1,matches:t=>inspector().fontWeightToken(t),token:v=>'[font-weight:'+v+']'},
  'line-height':{label:'Line height (px)',min:0,max:2000,matches:t=>inspector().lineHeightToken(t),token:v=>'[line-height:'+v+'px]'},
  'letter-spacing':{label:'Letter spacing (px)',min:-1000,max:1000,matches:t=>inspector().letterSpacingToken(t),token:v=>'[letter-spacing:'+v+'px]'},
  'text-align':{label:'Text alignment',matches:t=>inspector().textAlignToken(t),options:['left','center','right','justify','start','end'],token:v=>'[text-align:'+v+']'},
  'font-style':{label:'Font slant',matches:t=>inspector().fontStyleToken(t),options:['normal','italic','oblique'],token:v=>'[font-style:'+v+']'},
  'text-transform':{label:'Text case',matches:t=>inspector().caseToken(t),options:['none','uppercase','lowercase','capitalize'],token:v=>'[text-transform:'+v+']'}
 });
 function coupledSize(token){let depth=0;for(const c of token){if(c==='['||c==='(')depth++;else if(c===']'||c===')')depth--;else if(c==='/'&&!depth)return inspector().fontSizeToken(token);}return false;}
 function change(classes,scope,property,value,document=null){
  const field=fields[property];if(!field||value!==null&&(field.options?!field.options.includes(value):!Number.isFinite(value)||value<(field.min??0)||value>(field.max??100)||field.step===1&&!Number.isInteger(value)))throw Error('Choose a supported shared style value.');
  const I=root.RetouchInspector||require('./inspector.js'),R=root.RetouchResponsive||require('./responsive.js');
  const active=R.project(classes,scope).split(/\s+/).map(I.base).filter(Boolean);
  if(['font-size','line-height'].includes(property)&&active.some(coupledSize))throw Error('A selected layer combines font size and line height in one utility. Separate those values before editing them independently.');
  if(['font-size','font-weight','line-height','font-style'].includes(property)&&active.some(token=>/^\[font:/.test(token)))throw Error('A selected layer uses a font shorthand. Edit that shorthand before changing its typography.');
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
   else{input.type='number';input.min=String(field.min??0);input.max=String(field.max??100);input.step=String(field.step??'any');input.placeholder=mixed?'Mixed':'';}
   const display=mixed?'':field.options?values[0]:property==='opacity'?String(Math.round(Number(values[0])*10000)/100):Number.isFinite(parseFloat(values[0]))?String(parseFloat(values[0])):'';
   input.value=display;input.disabled=blocked;input.title=blocked?'An inline style controls this property on a selected layer. Edit that source style first.':'';
   const write=value=>{try{save(Object.fromEntries(infos.map((info,i)=>[info.id,change(info.className,scope,property,value,elements[i].ownerDocument)])));}catch(error){I.note(sec,error.message,'refused');}};
   input.onchange=()=>{if(input.value!==''&&input.checkValidity())write(field.options?input.value:Number(input.value));};input.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();input.value=display;input.blur();}else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();input.blur();}};I.field(sec,'Shared '+field.label,input);
   const reset=I.button('Reset shared '+field.label.toLowerCase(),()=>write(null));try{reset.disabled=infos.every(info=>change(info.className,scope,property,null)===(info.className||''));}catch(error){reset.disabled=true;reset.title=error.message;}sec.append(reset);
  }
  I.note(sec,'Values show the current preview. Edits follow the selected style scope; reset removes that scope’s matching classes.');return sec;
 }
 const api={change,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchReactSelection=api;
})(typeof window==='object'?window:globalThis);
