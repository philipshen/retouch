(function(root){
 'use strict';
 const fields={opacity:{label:'Opacity (%)',matches:t=>/^opacity-|^\[opacity:/.test(t),token:v=>'opacity-['+v/100+']'},visibility:{label:'Visibility',matches:t=>/^(visible|invisible|collapse)$|^\[visibility:/.test(t),options:['visible','hidden','collapse'],token:v=>({visible:'visible',hidden:'invisible',collapse:'collapse'})[v]},'mix-blend-mode':{label:'Blend mode',matches:t=>/^mix-blend-|^\[mix-blend-mode:/.test(t),options:['normal','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','hard-light','soft-light','difference','exclusion','hue','saturation','color','luminosity'],token:v=>'mix-blend-'+v},isolation:{label:'Blend group',matches:t=>/^(isolate|isolation-auto)$|^\[isolation:/.test(t),options:['auto','isolate'],token:v=>v==='auto'?'isolation-auto':'isolate'}};
 const inspector=()=>root.RetouchInspector||require('./inspector.js');
 Object.assign(fields,{
  'font-family':{label:'Font family',picker:true,valid:v=>!!inspector().fontFamilyClass(v),matches:t=>inspector().fontFamilyToken(t),token:v=>inspector().fontFamilyClass(v)},
  'font-size':{label:'Font size (px)',min:0,max:2000,matches:t=>inspector().fontSizeToken(t),token:v=>'[font-size:'+v+'px]'},
  'font-weight':{label:'Font weight (1–1000)',min:1,max:1000,step:1,matches:t=>inspector().fontWeightToken(t),token:v=>'[font-weight:'+v+']'},
  'line-height':{label:'Line height (px)',min:0,max:2000,matches:t=>inspector().lineHeightToken(t),token:v=>'[line-height:'+v+'px]'},
  'letter-spacing':{label:'Letter spacing (px)',min:-1000,max:1000,matches:t=>inspector().letterSpacingToken(t),token:v=>'[letter-spacing:'+v+'px]'},
  'text-align':{label:'Text alignment',matches:t=>inspector().textAlignToken(t),options:['left','center','right','justify','start','end'],token:v=>'[text-align:'+v+']'},
  'font-style':{label:'Font slant',matches:t=>inspector().fontStyleToken(t),options:['normal','italic','oblique'],token:v=>'[font-style:'+v+']'},
  'text-transform':{label:'Text case',matches:t=>inspector().caseToken(t),options:['none','uppercase','lowercase','capitalize'],token:v=>'[text-transform:'+v+']'}
 });
 function change(classes,scope,property,value,document=null,relative=false){
  if(relative&&(!['line-height','letter-spacing'].includes(property)||!Number.isFinite(value)||value<(property==='line-height'?0:-100)||value>1000))throw Error('Choose a supported relative typography value.');
  const field=fields[property];if(!field||value!==null&&!(property==='line-height'&&value==='normal')&&(field.valid?!field.valid(value):field.options?!field.options.includes(value):!Number.isFinite(value)||value<(field.min??0)||value>(field.max??100)||field.step===1&&!Number.isInteger(value)))throw Error('Choose a supported shared style value.');
  const I=root.RetouchInspector||require('./inspector.js'),R=root.RetouchResponsive||require('./responsive.js');
  const active=R.project(classes,scope).split(/\s+/).map(I.base).filter(Boolean);
  if(['font-family','font-size','font-weight','line-height','font-style'].includes(property)&&active.some(token=>/^\[font:/.test(token)))throw Error('A selected layer uses a font shorthand. Edit that shorthand before changing its typography.');
  let addition=value===null?'':relative?'['+property+':'+Math.round(value*1e6)/1e8+(property==='letter-spacing'?'em':'')+']':property==='line-height'&&value==='normal'?'[line-height:normal]':field.token(value);if(scope&&value!==null&&R.inherited(classes,scope,document).split(/\s+/).some(token=>I.base(token)!==null&&field.matches(I.base(token))&&/^!|!$/.test(token)))addition='!'+addition;
  if(addition&&document&&!['opacity','visibility','mix-blend-mode','isolation'].includes(property)&&I.catalog(document).some(name=>(classes||'').split(/\s+/).includes(name))&&!addition.startsWith('!'))addition='!'+addition;
  const projected=R.project(classes,scope),expanded=['font-size','line-height'].includes(property)?I.expandSizeLeading(projected):projected,next=I.replace(expanded,field.matches,addition);return next===projected?(classes||''):R.replaceScope(classes,next,scope);
 }
 function mount(infos,elements,scope,save,saveColor){
  const I=root.RetouchInspector,sec=I.section('Shared styles');
  if(elements.some(el=>!el?.isConnected)||infos.some(info=>info.classNameDynamic||info.svgPaint?.reason)){I.note(sec,'Shared styles need literal class names without spread props on every selected layer.','refused');return sec;}
  I.note(sec,'Shift-click a range in Layers; Cmd/Ctrl-click toggles layers. On the canvas, Shift-click toggles. Each edit updates these source layers and undoes together, including every rendered instance.');
  const computed=elements.map(el=>el.ownerDocument.defaultView.getComputedStyle(el));
  if(saveColor)for(const [property,label]of [['color','Text color'],['background-color','Background color'],['border-color','Border color'],...(elements.every(el=>el.namespaceURI==='http://www.w3.org/2000/svg')?[['fill','SVG fill'],['stroke','SVG stroke']]:[])]){
   const values=computed.map(css=>css.getPropertyValue(property)),mixed=values.some(value=>value!==values[0]),input=root.document.createElement('input');input.type='text';input.spellcheck=false;input.placeholder=mixed?'Mixed · enter hex with alpha':'#RRGGBB or #RRGGBBAA';input.disabled=elements.some(el=>el.style.getPropertyValue(property));
   I.field(sec,'Shared '+label+' with alpha',input);I.note(sec,mixed?'Mixed colors':values[0]);
   const clear=I.button('Clear selected '+label.toLowerCase(),()=>saveColor(property,null).catch(error=>I.note(sec,error.message,'refused')));clear.disabled=input.disabled;sec.append(clear);
   input.oninput=()=>input.setCustomValidity('');input.onchange=()=>{const value=input.value.trim();if(!root.RetouchPaletteValues.valid(value)){input.setCustomValidity('Enter a hex color or color(display-p3 r g b / alpha).');input.reportValidity();return;}saveColor(property,value).catch(error=>{input.setCustomValidity(error.message);input.reportValidity();});};
  }

  if(saveColor)I.note(sec,'Clear removes selected-scope paint to reveal inherited styles. Saved links stay attached; palette reset restores their definitions.');
  const relativeGroup=root.document.createElement('fieldset');relativeGroup.style.cssText='border:0;padding:0;margin:0;min-width:0';sec.append(relativeGroup);
  const relativeWrite=(property,value,relative=true)=>{try{save(Object.fromEntries(infos.map((info,i)=>[info.id,change(info.className,scope,property,value,elements[i].ownerDocument,relative)])));}catch(error){I.note(sec,error.message,'refused');}};
  for(const [property,label,min]of [['line-height','Shared Line height (%)',0],['letter-spacing','Shared Letter spacing (%)',-100]]){
   const values=computed.map(css=>{const raw=css.getPropertyValue(property);return raw==='normal'&&property==='line-height'?NaN:(parseFloat(raw)||0)/parseFloat(css.fontSize)*100;}),mixed=values.some(value=>!Number.isFinite(value)||Math.abs(value-values[0])>.0001),group=root.document.createElement('fieldset');group.style.cssText='border:0;padding:0;margin:0;min-width:0';relativeGroup.append(group);
   const input=I.relativeNumber(group,label,mixed?NaN:values[0],min,1000,value=>relativeWrite(property,value));if(mixed)input.placeholder='Mixed / automatic';input.title='Relative to each selected layer’s own font size.';group.disabled=elements.some(el=>el.style.getPropertyValue(property));
  }
  const automatic=I.button('Automatic shared line height',()=>relativeWrite('line-height','normal',false));automatic.disabled=elements.some(el=>el.style.getPropertyValue('line-height'));relativeGroup.append(automatic);
  I.note(relativeGroup,'Relative spacing follows each layer’s own font size. Pixel controls and resets are available below.');
  for(const [property,field]of Object.entries(fields)){
   if(field.picker){
    const values=elements.map(el=>el.ownerDocument.defaultView.getComputedStyle(el).fontFamily),mixed=values.some(value=>value!==values[0]),group=root.document.createElement('fieldset');group.style.cssText='border:0;padding:0;margin:0;min-width:0';sec.append(group);
    const write=value=>{try{save(Object.fromEntries(infos.map((info,i)=>[info.id,change(info.className,scope,property,value,elements[i].ownerDocument)])));}catch(error){I.note(sec,error.message,'refused');}};
    I.fontPicker(group,elements[0].ownerDocument,mixed?'':values[0],write,{mixed,label:'Shared Page font'});
    group.disabled=elements.some(el=>el.style.getPropertyValue('font-family'));if(group.disabled)I.note(sec,'An inline font family controls a selected layer. Edit that source style first.','refused');
    const reset=I.button('Reset shared font family',()=>write(null));try{reset.disabled=infos.every(info=>change(info.className,scope,property,null)===(info.className||''));}catch(error){reset.disabled=true;reset.title=error.message;}group.append(reset);continue;
   }

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
 const api={change,mount,changeRelative:(classes,scope,property,value,document=null)=>change(classes,scope,property,value,document,true)};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchReactSelection=api;
})(typeof window==='object'?window:globalThis);
