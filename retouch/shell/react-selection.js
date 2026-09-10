(function(root){
 'use strict';
 const fields={opacity:{label:'Opacity (%)',matches:t=>/^opacity-|^\[opacity:/.test(t),token:v=>'opacity-['+v/100+']'},visibility:{label:'Visibility',matches:t=>/^(visible|invisible|collapse)$|^\[visibility:/.test(t),options:['visible','hidden','collapse'],token:v=>({visible:'visible',hidden:'invisible',collapse:'collapse'})[v]},'mix-blend-mode':{label:'Blend mode',matches:t=>/^mix-blend-|^\[mix-blend-mode:/.test(t),options:['normal','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','hard-light','soft-light','difference','exclusion','hue','saturation','color','luminosity'],token:v=>'mix-blend-'+v},isolation:{label:'Blend group',matches:t=>/^(isolate|isolation-auto)$|^\[isolation:/.test(t),options:['auto','isolate'],token:v=>v==='auto'?'isolation-auto':'isolate'}};
 const inspector=()=>root.RetouchInspector||require('./inspector.js');
 const dimensionKeywords=['auto','fit-content'],validDimension=value=>dimensionKeywords.includes(value)||Number.isFinite(value)&&value>=0&&value<=100000;
 const dimensionToken=(axis,value)=>axis+'-'+(value==='auto'?'auto':value==='fit-content'?'fit':'['+value+'px]');
 Object.assign(fields,{
  width:{label:'Width (px)',min:0,max:100000,valid:validDimension,matches:t=>/^w-|^\[width:/.test(t),token:v=>dimensionToken('w',v)},
  height:{label:'Height (px)',min:0,max:100000,valid:validDimension,matches:t=>/^h-|^\[height:/.test(t),token:v=>dimensionToken('h',v)},
  'aspect-ratio':{label:'Aspect ratio',ratio:true,valid:value=>(root.RetouchHTMLCSSValues||require('./html-css-values.js')).valid('aspect-ratio',value),matches:token=>/^aspect-|^\[aspect-ratio:/.test(token),token:value=>'[aspect-ratio:'+value.replace(/ /g,'_')+']'},
  'font-family':{label:'Font family',picker:true,valid:v=>!!inspector().fontFamilyClass(v),matches:t=>inspector().fontFamilyToken(t),token:v=>inspector().fontFamilyClass(v)},
  'font-size':{label:'Font size (px)',min:0,max:2000,matches:t=>inspector().fontSizeToken(t),token:v=>'[font-size:'+v+'px]'},
  'font-weight':{label:'Font weight (1–1000)',min:1,max:1000,step:1,matches:t=>inspector().fontWeightToken(t),token:v=>'[font-weight:'+v+']'},
  'line-height':{label:'Line height (px)',min:0,max:2000,matches:t=>inspector().lineHeightToken(t),token:v=>'[line-height:'+v+'px]'},
  'letter-spacing':{label:'Letter spacing (px)',min:-1000,max:1000,matches:t=>inspector().letterSpacingToken(t),token:v=>'[letter-spacing:'+v+'px]'},
  'text-align':{label:'Text alignment',matches:t=>inspector().textAlignToken(t),options:['left','center','right','justify','start','end'],token:v=>'[text-align:'+v+']'},
  'font-style':{label:'Font slant',matches:t=>inspector().fontStyleToken(t),options:['normal','italic','oblique'],token:v=>'[font-style:'+v+']'},
  'text-transform':{label:'Text case',matches:t=>inspector().caseToken(t),options:['none','uppercase','lowercase','capitalize'],token:v=>'[text-transform:'+v+']'}
 });
 for(const bound of ['min','max'])for(const [axis,name]of [['w','width'],['h','height']]){const property=bound+'-'+name,keyword=bound==='min'?'auto':'none';fields[property]={label:(bound==='min'?'Minimum ':'Maximum ')+name+' (px)',min:0,max:100000,constraint:true,keyword,valid:value=>value===keyword||Number.isFinite(value)&&value>=0&&value<=100000,matches:token=>token.startsWith(bound+'-'+axis+'-')||token.startsWith('['+property+':'),token:value=>'['+property+':'+(value===keyword?keyword:value+'px')+']'};}
 function decoration(css,property){return (property.endsWith('width')?['left','right']:['top','bottom']).reduce((sum,side)=>sum+(parseFloat(css.getPropertyValue('padding-'+side))||0)+(parseFloat(css.getPropertyValue('border-'+side+'-width'))||0),0);}
 function dimensionSize(css,property){const raw=css.getPropertyValue(property).trim(),value=/^-?(?:\d+(?:\.\d*)?|\.\d+)px$/.test(raw)?parseFloat(raw):NaN;return Number.isFinite(value)?value+(css.boxSizing==='content-box'?decoration(css,property):0):NaN;}
 function dimensionValue(css,property,value){if(value===null||typeof value==='string'&&fields[property]?.valid?.(value))return value;const extra=decoration(css,property);if(value<extra)throw Error('The requested size is smaller than a selected layer’s padding and borders.');return Math.round((value-(css.boxSizing==='content-box'?extra:0))*1e6)/1e6;}
 function change(classes,scope,property,value,document=null,relative=false){
  if(relative&&(!['line-height','letter-spacing'].includes(property)||!Number.isFinite(value)||value<(property==='line-height'?0:-100)||value>1000))throw Error('Choose a supported relative typography value.');
  const field=fields[property];if(!field||value!==null&&!(property==='line-height'&&value==='normal')&&(field.valid?!field.valid(value):field.options?!field.options.includes(value):!Number.isFinite(value)||value<(field.min??0)||value>(field.max??100)||field.step===1&&!Number.isInteger(value)))throw Error('Choose a supported shared style value.');
  const I=root.RetouchInspector||require('./inspector.js'),R=root.RetouchResponsive||require('./responsive.js');
  const active=R.project(classes,scope).split(/\s+/).map(I.base).filter(Boolean);
  if(['font-family','font-size','font-weight','line-height','font-style'].includes(property)&&active.some(token=>/^\[font:/.test(token)))throw Error('A selected layer uses a font shorthand. Edit that shorthand before changing its typography.');
  const dimension=['width','height'].includes(property),sizing=dimension||field.constraint,priorityMatch=token=>field.matches(token)||dimension&&/^size-/.test(token);
  if(sizing&&value!==null&&[...active,...R.inherited(classes,scope,document).split(/\s+/).map(I.base)].some(token=>/^\[(?:(?:min|max)-)?(inline|block)-size:/.test(token||'')))throw Error('A selected layer uses logical sizing. Edit its inline or block size before setting a physical width or height.');
  let addition=value===null?'':relative?'['+property+':'+Math.round(value*1e6)/1e8+(property==='letter-spacing'?'em':'')+']':property==='line-height'&&value==='normal'?'[line-height:normal]':field.token(value);if(scope&&value!==null&&R.inherited(classes,scope,document).split(/\s+/).some(token=>I.base(token)!==null&&priorityMatch(I.base(token))&&/^!|!$/.test(token)))addition='!'+addition;
  if(dimension&&addition&&R.project(classes,scope).split(/\s+/).some(token=>I.base(token)!==null&&/^size-/.test(I.base(token))&&/^!|!$/.test(token)))addition='!'+addition.replace(/^!/,'');
  if(addition&&document&&!['opacity','visibility','mix-blend-mode','isolation'].includes(property)&&I.catalog(document).some(name=>(classes||'').split(/\s+/).includes(name))&&!addition.startsWith('!'))addition='!'+addition;
  const projected=R.project(classes,scope),expanded=['font-size','line-height'].includes(property)?I.expandSizeLeading(projected):projected,next=I.replace(expanded,field.matches,addition);return next===projected?(classes||''):R.replaceScope(classes,next,scope);
 }
 function changeRatio(classes,scope,value,document=null){const normalized=value===null?null:String(value).trim().replace(/\s*[:/]\s*/g,' / '),next=change(classes,scope,'aspect-ratio',normalized,document);return normalized===null||normalized==='auto'?next:change(next,scope,'height','auto',document);}
 function changeBlur(classes,scope,property,current,amount){
  const V=root.RetouchHTMLCSSValues||require('./html-css-values.js'),R=root.RetouchResponsive||require('./responsive.js'),next=V.withBlur(current,amount);
  if(next===null)throw Error('A selected filter cannot be adjusted with a single blur value.');
  return R.replaceScope(classes,inspector().filterClasses(R.project(classes,scope),property,next),scope);
 }
 function mount(infos,elements,scope,save,saveColor){
  const I=root.RetouchInspector,sec=I.section('Shared styles');
  if(elements.some(el=>!el?.isConnected)||infos.some(info=>info.classNameDynamic||info.svgPaint?.reason)){I.note(sec,'Shared styles need literal class names without spread props on every selected layer.','refused');return sec;}
  I.note(sec,'Shift-click a range in Layers; Cmd/Ctrl-click toggles layers. On the canvas, Shift-click toggles. Each edit updates these source layers and undoes together, including every rendered instance.');
  const computed=elements.map(el=>el.ownerDocument.defaultView.getComputedStyle(el));
  for(const [property,label]of [['filter','Shared Layer blur (px)'],['backdrop-filter','Shared Backdrop blur (px)']]){
   const values=computed.map(css=>css.getPropertyValue(property).trim()),parsed=values.map(value=>root.RetouchHTMLCSSValues.parseFilters(value)),blurs=parsed.map(stack=>stack?.filter(item=>item.name==='blur')),amounts=blurs.map(stack=>stack?.length===1?parseFloat(stack[0].arg):stack?.length===0?0:NaN),mixed=amounts.some(amount=>amount!==amounts[0]);
   const input=I.number(sec,label,mixed?NaN:amounts[0],0,1000,amount=>{try{const changes=Object.fromEntries(infos.map((info,i)=>[info.id,changeBlur(info.className,scope,property,values[i],amount)]));save(changes);}catch(error){I.note(sec,error.message,'refused');}});
   input.placeholder=mixed?'Mixed':'';input.disabled=parsed.some((stack,i)=>!stack||blurs[i].length>1||elements[i].style.getPropertyPriority(property)==='important');
   if(input.disabled)I.note(sec,'A selected filter cannot be adjusted with a single blur value.');
  }

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
  for(const [property,field]of Object.entries(fields).filter(([,field])=>!field.constraint).flatMap(entry=>['width','height'].includes(entry[0])?[entry,...['min-','max-'].map(prefix=>[prefix+entry[0],fields[prefix+entry[0]]])]:[entry])){
   if(field.ratio){
    const values=computed.map(css=>css.getPropertyValue(property)),mixed=values.some(value=>value!==values[0]),input=root.document.createElement('input');input.type='text';input.value=mixed?'':values[0];input.placeholder=mixed?'Mixed':'auto, 1 / 1, 16 / 9';
    const blocked=elements.some((el,i)=>el.style.getPropertyValue(property)||el.style.getPropertyValue('height')||el.style.getPropertyValue('inline-size')||el.style.getPropertyValue('block-size')||['inline','contents'].includes(computed[i].display));input.disabled=blocked;
    const write=value=>{try{save(Object.fromEntries(infos.map((info,i)=>[info.id,changeRatio(info.className,scope,value,elements[i].ownerDocument)])));}catch(error){input.setCustomValidity(error.message);input.reportValidity();}};
    input.oninput=()=>input.setCustomValidity('');input.onchange=()=>write(input.value);input.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();input.value=mixed?'':values[0];input.setCustomValidity('');input.blur();}else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();input.blur();}};I.field(sec,'Shared Aspect ratio',input);
    const presets=root.document.createElement('div');presets.className='stack-presets';for(const [value,label]of [['1 / 1','Square'],['4 / 3','4:3'],['16 / 9','16:9'],['auto','Automatic']]){const button=I.button(label,()=>write(value));button.setAttribute('aria-label',label+' shared aspect ratio');button.disabled=blocked;presets.append(button);}sec.append(presets);
    const reset=I.button('Reset shared aspect ratio',()=>write(null));try{reset.disabled=infos.every(info=>changeRatio(info.className,scope,null)===(info.className||''));}catch{reset.disabled=true;}sec.append(reset);
    I.note(sec,'A ratio makes height automatic. It follows each layer’s box sizing: content-box ratios exclude padding and borders. Content, flex layout, and minimum/maximum sizes may change the result. Reset removes the ratio; Undo also restores the previous height.');continue;
   }
   if(field.picker){
    const values=elements.map(el=>el.ownerDocument.defaultView.getComputedStyle(el).fontFamily),mixed=values.some(value=>value!==values[0]),group=root.document.createElement('fieldset');group.style.cssText='border:0;padding:0;margin:0;min-width:0';sec.append(group);
    const write=value=>{try{save(Object.fromEntries(infos.map((info,i)=>[info.id,change(info.className,scope,property,value,elements[i].ownerDocument)])));}catch(error){I.note(sec,error.message,'refused');}};
    I.fontPicker(group,elements[0].ownerDocument,mixed?'':values[0],write,{mixed,label:'Shared Page font'});
    group.disabled=elements.some(el=>el.style.getPropertyValue('font-family'));if(group.disabled)I.note(sec,'An inline font family controls a selected layer. Edit that source style first.','refused');
    const reset=I.button('Reset shared font family',()=>write(null));try{reset.disabled=infos.every(info=>change(info.className,scope,property,null)===(info.className||''));}catch(error){reset.disabled=true;reset.title=error.message;}group.append(reset);continue;
   }

   const dimension=['width','height'].includes(property),sizing=dimension||field.constraint,values=elements.map(el=>{const css=el.ownerDocument.defaultView.getComputedStyle(el);return sizing&&Number.isFinite(dimensionSize(css,property))?dimensionSize(css,property)+'px':css.getPropertyValue(property);}),mixed=values.some(v=>v!==values[0]),input=root.document.createElement(field.options?'select':'input'),blocked=elements.some(el=>{const css=el.ownerDocument.defaultView.getComputedStyle(el);return el.style.getPropertyValue(property)||sizing&&(['inline-size','block-size','min-inline-size','min-block-size','max-inline-size','max-block-size'].some(key=>el.style.getPropertyValue(key))||['inline','contents'].includes(css.display)||dimension&&!Number.isFinite(dimensionSize(css,property)));});
   if(field.options){if(mixed){const o=root.document.createElement('option');o.value='';o.textContent='Mixed';o.disabled=true;input.append(o);}for(const value of field.options){const o=root.document.createElement('option');o.value=value;o.textContent=value;input.append(o);}}
   else{input.type='number';input.min=String(field.min??0);input.max=String(field.max??100);input.step=String(field.step??'any');input.placeholder=mixed?'Mixed':'';}
   const display=mixed?'':field.options?values[0]:property==='opacity'?String(Math.round(Number(values[0])*10000)/100):(!sizing||/px$/.test(values[0]))&&Number.isFinite(parseFloat(values[0]))?String(parseFloat(values[0])):'';
   if(field.constraint&&!mixed&&!display)input.placeholder=values[0]==='auto'?'Automatic':values[0]==='none'?'No limit':values[0];input.value=display;input.disabled=blocked;input.title=blocked?'An inline style controls this property on a selected layer. Edit that source style first.':'';
   const write=value=>{try{save(Object.fromEntries(infos.map((info,i)=>[info.id,change(info.className,scope,property,sizing?dimensionValue(elements[i].ownerDocument.defaultView.getComputedStyle(elements[i]),property,value):value,elements[i].ownerDocument)])));}catch(error){I.note(sec,error.message,'refused');}};
   input.onchange=()=>{if(input.value!==''&&input.checkValidity())write(field.options?input.value:Number(input.value));};input.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();input.value=display;input.blur();}else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();input.blur();}};I.field(sec,'Shared '+field.label,input);
   if(dimension){const presets=root.document.createElement('div');presets.className='stack-presets';for(const [value,label]of [['auto','Automatic shared '+property],['fit-content','Fit shared '+property+' to content']]){const button=I.button(label,()=>write(value));button.disabled=blocked;presets.append(button);}sec.append(presets);}
   if(field.constraint){const button=I.button((field.keyword==='auto'?'Automatic shared minimum ':'No shared maximum ')+(property.endsWith('width')?'width':'height'),()=>write(field.keyword));button.disabled=blocked;sec.append(button);}
   const reset=I.button('Reset shared '+field.label.toLowerCase(),()=>write(null));try{reset.disabled=infos.every(info=>change(info.className,scope,property,null)===(info.className||''));}catch(error){reset.disabled=true;reset.title=error.message;}sec.append(reset);
  }
  I.note(sec,'Pixel sizes include padding and borders. Automatic sizing follows the page layout; fit content follows each layer’s content within the available space. Minimum and maximum sizes bound the result; when they conflict, the minimum takes precedence.');
  I.note(sec,'Values show the current preview. Edits follow the selected style scope; reset removes that scope’s matching classes.');return sec;
 }
 const api={change,changeRatio,changeBlur,dimensionSize,dimensionValue,mount,changeRelative:(classes,scope,property,value,document=null)=>change(classes,scope,property,value,document,true)};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchReactSelection=api;
})(typeof window==='object'?window:globalThis);
