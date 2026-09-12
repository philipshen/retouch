(function(root){
 'use strict';
 const fields={opacity:{label:'Opacity (%)',matches:t=>/^opacity-|^\[opacity:/.test(t),token:v=>'opacity-['+v/100+']'},visibility:{label:'Visibility',matches:t=>/^(visible|invisible|collapse)$|^\[visibility:/.test(t),options:['visible','hidden','collapse'],token:v=>({visible:'visible',hidden:'invisible',collapse:'collapse'})[v]},'mix-blend-mode':{label:'Blend mode',matches:t=>/^mix-blend-|^\[mix-blend-mode:/.test(t),options:(root.RetouchHTMLCSSValues||require('./html-css-values.js')).options['mix-blend-mode'],token:v=>'mix-blend-'+v},isolation:{label:'Blend group',matches:t=>/^(isolate|isolation-auto)$|^\[isolation:/.test(t),options:['auto','isolate'],token:v=>v==='auto'?'isolation-auto':'isolate'}};
 const inspector=()=>root.RetouchInspector||require('./inspector.js');
 const dimensionKeywords=['auto','fit-content'],validDimension=value=>dimensionKeywords.includes(value)||Number.isFinite(value)&&value>=0&&value<=100000;
 const dimensionToken=(axis,value)=>axis+'-'+(value==='auto'?'auto':value==='fit-content'?'fit':'['+value+'px]');
 function gridSpanField(axis,prefix){const property='grid-'+axis,options=['auto','full',...Array.from({length:24},(_,i)=>String(i+1))],placement=new RegExp('^-?'+prefix+'-(?:auto|span-(?:full|\\d+|\\[.+\\])|(?:start|end)-(?:auto|\\d+|\\[.+\\])|\\d+|\\[.+\\])$');return {label:'Grid '+axis+' span',layoutItem:true,gridItem:true,gridPlacement:true,options,valid:value=>options.includes(String(value)),read:css=>(root.RetouchLayout||require('./layout.js')).spanValue(css.getPropertyValue(property+'-start'),css.getPropertyValue(property+'-end'))||css.getPropertyValue(property),matches:token=>placement.test(token)||new RegExp('^\\['+property+'(?:-start|-end)?:').test(token),token:value=>prefix+'-'+(value==='auto'?'auto':value==='full'?'span-full':'span-'+value)};}
 Object.assign(fields,{
  width:{label:'Width (px)',min:0,max:100000,valid:validDimension,matches:t=>/^w-|^\[width:/.test(t),token:v=>dimensionToken('w',v)},
  height:{label:'Height (px)',min:0,max:100000,valid:validDimension,matches:t=>/^h-|^\[height:/.test(t),token:v=>dimensionToken('h',v)},
  'flex-grow':{label:'Grow',flexItem:true,min:0,max:1000,matches:token=>/^grow(?:-|$)|^\[flex-grow:/.test(token),token:value=>'[flex-grow:'+value+']'},
  'flex-shrink':{label:'Shrink',flexItem:true,min:0,max:1000,matches:token=>/^shrink(?:-|$)|^\[flex-shrink:/.test(token),token:value=>'[flex-shrink:'+value+']'},
  'flex-basis':{label:'Flex basis',flexItem:true,text:true,valid:value=>['auto','content','min-content','max-content','fit-content'].includes(value)||typeof value==='string'&&(root.RetouchHTMLCSSValues||require('./html-css-values.js')).valid('flex-basis',value)&&Number.isFinite(parseFloat(value))&&parseFloat(value)<=100000,matches:token=>/^basis-|^\[flex-basis:/.test(token),token:value=>'[flex-basis:'+value+']'},
  'align-self':{label:'Item alignment',layoutItem:true,options:['auto','normal','start','end','center','stretch','flex-start','flex-end','self-start','self-end','baseline','first baseline','last baseline'],matches:token=>/^self-|^\[align-self:/.test(token),token:value=>'[align-self:'+value.replace(/ /g,'_')+']'},
  'justify-self':{label:'Grid inline alignment',layoutItem:true,gridItem:true,options:['auto','normal','start','end','center','stretch','self-start','self-end','left','right','baseline','first baseline','last baseline'],matches:token=>/^justify-self-|^\[justify-self:/.test(token),token:value=>'[justify-self:'+value.replace(/ /g,'_')+']'},
  'grid-column':gridSpanField('column','col'),
  'grid-row':gridSpanField('row','row'),
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
 const flexShorthand=token=>/^flex-(?:\d+(?:\/\d+)?|auto|initial|none|\[.*\]|\(.*\))$|^\[flex:/.test(token);
 function change(classes,scope,property,value,document=null,relative=false){
  if(relative&&(!['line-height','letter-spacing'].includes(property)||!Number.isFinite(value)||value<(property==='line-height'?0:-100)||value>1000))throw Error('Choose a supported relative typography value.');
  const field=fields[property];if(!field||value!==null&&!(property==='line-height'&&value==='normal')&&(field.valid?!field.valid(value):field.options?!field.options.includes(value):!Number.isFinite(value)||value<(field.min??0)||value>(field.max??100)||field.step===1&&!Number.isInteger(value)))throw Error('Choose a supported shared style value.');
  const I=root.RetouchInspector||require('./inspector.js'),R=root.RetouchResponsive||require('./responsive.js');
  const active=R.project(classes,scope).split(/\s+/).map(I.base).filter(Boolean);
  if(['font-family','font-size','font-weight','line-height','font-style'].includes(property)&&active.some(token=>/^\[font:/.test(token)))throw Error('A selected layer uses a font shorthand. Edit that shorthand before changing its typography.');
  const dimension=['width','height'].includes(property),sizing=dimension||field.constraint,shorthandMatch=token=>dimension&&/^size-/.test(token)||field.flexItem&&flexShorthand(token)||field.layoutItem&&(field.gridPlacement?/^\[grid-area:/.test(token):/^place-self-|^\[place-self:/.test(token)),priorityMatch=token=>field.matches(token)||shorthandMatch(token);
  if(sizing&&value!==null&&[...active,...R.inherited(classes,scope,document).split(/\s+/).map(I.base)].some(token=>/^\[(?:(?:min|max)-)?(inline|block)-size:/.test(token||'')))throw Error('A selected layer uses logical sizing. Edit its inline or block size before setting a physical width or height.');
  let addition=value===null?'':relative?'['+property+':'+Math.round(value*1e6)/1e8+(property==='letter-spacing'?'em':'')+']':property==='line-height'&&value==='normal'?'[line-height:normal]':field.token(value);if(scope&&value!==null&&R.inherited(classes,scope,document).split(/\s+/).some(token=>I.base(token)!==null&&priorityMatch(I.base(token))&&/^!|!$/.test(token)))addition='!'+addition;
  if(addition&&R.project(classes,scope).split(/\s+/).some(token=>I.base(token)!==null&&shorthandMatch(I.base(token))&&/^!|!$/.test(token)))addition='!'+addition.replace(/^!/,'');
  if(addition&&document&&!['opacity','visibility','mix-blend-mode','isolation'].includes(property)&&I.catalog(document).some(name=>(classes||'').split(/\s+/).includes(name))&&!addition.startsWith('!'))addition='!'+addition;
  const projected=R.project(classes,scope),expanded=['font-size','line-height'].includes(property)?I.expandSizeLeading(projected):projected,next=I.replace(expanded,field.matches,addition);return next===projected?(classes||''):R.replaceScope(classes,next,scope);
 }
 function changeRatio(classes,scope,value,document=null){const normalized=value===null?null:String(value).trim().replace(/\s*[:/]\s*/g,' / '),next=change(classes,scope,'aspect-ratio',normalized,document);return normalized===null||normalized==='auto'?next:change(next,scope,'height','auto',document);}
 function changeBlur(classes,scope,property,current,amount){
  const V=root.RetouchHTMLCSSValues||require('./html-css-values.js'),R=root.RetouchResponsive||require('./responsive.js'),next=V.withBlur(current,amount);
  if(next===null)throw Error('A selected filter cannot be adjusted with a single blur value.');
  return R.replaceScope(classes,inspector().filterClasses(R.project(classes,scope),property,next),scope);
 }
 function changePadding(classes,scope,edge,value,document=null,css={}){
  const R=root.RetouchResponsive||require('./responsive.js'),L=root.RetouchLayout||require('./layout.js');
  let active=R.project(classes,scope),inherited=R.inherited(classes,scope,document);
  if(edge==='all'&&value===null)active=L.resetPaddingClasses(active);
  else for(const side of edge==='all'?['top','right','bottom','left']:[edge])active=L.paddingClasses(active,side,value,inherited,css);
  return R.replaceScope(classes,active,scope);
 }
 function changeGap(classes,scope,axis,value,document=null,writingMode='horizontal-tb'){
  const R=root.RetouchResponsive||require('./responsive.js'),L=root.RetouchLayout||require('./layout.js');
  return R.replaceScope(classes,L.gapClasses(R.project(classes,scope),axis,value,writingMode,R.inherited(classes,scope,document)),scope);
 }
 const groupNames={size:'Size',layout:'Layout',typography:'Typography',appearance:'Appearance',effects:'Effects'};
 let groupState=null;
 function sharedGroups(parent){
  if(groupState===null){groupState={};try{const saved=JSON.parse(root.localStorage.getItem('retouch.shared-inspector-sections.v1')||'{}');for(const key of Object.keys(groupNames))if(typeof saved?.[key]==='boolean')groupState[key]=saved[key];}catch{}}
  return Object.fromEntries(Object.entries(groupNames).map(([key,title])=>{const details=root.document.createElement('details'),summary=root.document.createElement('summary'),body=root.document.createElement('div');details.className='advanced shared-inspector-group';details.dataset.sharedSection=key;details.setAttribute('aria-label','Shared '+title.toLowerCase()+' section');details.open=groupState[key]!==false;summary.textContent=title;body.className='shared-inspector-group-body';details.append(summary,body);parent.append(details);details.ontoggle=()=>{if(!details.isConnected)return;groupState[key]=details.open;try{root.localStorage.setItem('retouch.shared-inspector-sections.v1',JSON.stringify(groupState));}catch{}};return [key,body];}));
 }
 function mount(infos,elements,scope,save,saveColor,resolveElement){
  const I=root.RetouchInspector,sec=I.section('Shared styles');
  if(elements.some(el=>!el?.isConnected)||infos.some(info=>info.classNameDynamic||info.svgPaint?.reason)){I.note(sec,'Shared styles need literal class names without spread props on every selected layer.','refused');return sec;}
  I.note(sec,'Shift-click a range in Layers; Cmd/Ctrl-click toggles layers. On the canvas, Shift-click toggles. Each edit updates these source layers and undoes together, including every rendered instance.');
  const liveElement=i=>{const el=resolveElement?resolveElement(infos[i].id):elements[i];if(!el?.isConnected||!el.ownerDocument.defaultView)throw Error('The preview changed. Select the layers again.');return el;};
  const computed=elements.map(el=>el.ownerDocument.defaultView.getComputedStyle(el)),groups=sharedGroups(sec);
  {
   const sides=['top','right','bottom','left'],L=root.RetouchLayout;
   const inlinePadding=el=>Array.from(el.style).some(property=>property==='padding'||property.startsWith('padding-')),blocked=elements.some(inlinePadding);
   const write=(edge,value,input)=>{try{const changes=Object.fromEntries(infos.map((info,i)=>{const el=liveElement(i);if(inlinePadding(el))throw Error('A selected layer has inline padding. Edit that source style first.');return [info.id,changePadding(info.className,scope,edge,value,el.ownerDocument,el.ownerDocument.defaultView.getComputedStyle(el))];}));save(changes);}catch(error){input.setCustomValidity(error.message);input.reportValidity();}};
   const edges=root.document.createElement('div');edges.className='property-pair';
   for(const edge of ['all','top','bottom','left','right']){
    const values=computed.flatMap(css=>(edge==='all'?sides:[edge]).map(side=>css.getPropertyValue('padding-'+side).replace(/px$/,''))),mixed=values.some(value=>value!==values[0]),initial=mixed?'':values[0],input=root.document.createElement('input');
    input.type='text';input.value=initial;input.placeholder=mixed?'Mixed':'0';input.disabled=blocked;input.title=blocked?'A selected layer has inline padding. Edit that source style first.':'Nonnegative padding: px, %, rem, em, vw, vh or ch.';
    input.oninput=()=>input.setCustomValidity('');input.onchange=()=>{try{write(edge,L.paddingValue(input.value),input);}catch(error){input.setCustomValidity(error.message);input.reportValidity();}};
    input.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();input.value=initial;input.setCustomValidity('');input.blur();}else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();input.blur();}};
    const row=root.document.createElement('div');row.className='property-row';
    if(edge==='all')groups.layout.append(row);else{if(!edges.parentElement)groups.layout.append(edges);edges.append(row);}
    I.field(row,edge==='all'?'Shared Padding':'Shared Padding '+edge,input);input.parentElement.querySelector('span').textContent=edge==='all'?'Padding':edge[0].toUpperCase()+edge.slice(1);
    const reset=I.button(edge==='all'?'Reset selected padding':'Reset selected padding '+edge,()=>write(edge,null,input));reset.disabled=blocked||infos.every((info,i)=>changePadding(info.className,scope,edge,null,elements[i].ownerDocument,computed[i])===info.className);reset.setAttribute('aria-label',reset.textContent);reset.title=reset.textContent;reset.textContent='↺';reset.classList.add('property-reset');row.append(reset);
   }
  }
  {
   const L=root.RetouchLayout,inlineGap=el=>['gap','row-gap','column-gap'].some(property=>el.style.getPropertyValue(property)),blocked=elements.some(inlineGap),pair=root.document.createElement('div');pair.className='property-pair';groups.layout.prepend(pair);
   for(const [axis,label,icon]of [['width','Horizontal gap','↔'],['height','Vertical gap','↕']]){
    const values=computed.map(css=>css.getPropertyValue(L.layoutAxes({writingMode:css.writingMode}).inline===axis?'column-gap':'row-gap').replace(/px$/,'')),mixed=values.some(value=>value!==values[0]),initial=mixed?'':values[0],input=root.document.createElement('input');input.type='text';input.value=initial;input.placeholder=mixed?'Mixed':'normal';input.disabled=blocked;input.title=blocked?'A selected layer has an inline gap. Edit that source style first.':label+'; px, %, rem, em, vw, vh, ch or normal.';
    const write=value=>{try{save(Object.fromEntries(infos.map((info,i)=>{const el=liveElement(i);if(inlineGap(el))throw Error('A selected layer has an inline gap. Edit that source style first.');return [info.id,changeGap(info.className,scope,axis,value,el.ownerDocument,el.ownerDocument.defaultView.getComputedStyle(el).writingMode)];})));}catch(error){input.setCustomValidity(error.message);input.reportValidity();}};
    input.oninput=()=>input.setCustomValidity('');input.onchange=()=>write(input.value);input.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();input.value=initial;input.setCustomValidity('');input.blur();}else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();input.blur();}};
    const row=root.document.createElement('div');row.className='property-row';pair.append(row);I.field(row,'Shared '+label,input);input.parentElement.querySelector('span').textContent=icon;
    const reset=I.button('Reset selected '+label.toLowerCase(),()=>write(null));reset.disabled=blocked||infos.every((info,i)=>changeGap(info.className,scope,axis,null,elements[i].ownerDocument,computed[i].writingMode)===info.className);reset.setAttribute('aria-label',reset.textContent);reset.title=reset.textContent;reset.textContent='↺';reset.classList.add('property-reset');row.append(reset);
   }
   I.note(groups.layout,'Gaps space children in flex and grid layouts. Horizontal and vertical follow each container’s writing direction. Reset removes the selected axis override and reveals a shorthand or inherited gap.');
  }
  for(const [property,label]of [['filter','Shared Layer blur (px)'],['backdrop-filter','Shared Backdrop blur (px)']]){
   const sec=groups.effects;
   const values=computed.map(css=>css.getPropertyValue(property).trim()),parsed=values.map(value=>root.RetouchHTMLCSSValues.parseFilters(value)),blurs=parsed.map(stack=>stack?.filter(item=>item.name==='blur')),amounts=blurs.map(stack=>stack?.length===1?parseFloat(stack[0].arg):stack?.length===0?0:NaN),mixed=amounts.some(amount=>amount!==amounts[0]);
   const input=I.number(sec,label,mixed?NaN:amounts[0],0,1000,amount=>{try{const changes=Object.fromEntries(infos.map((info,i)=>[info.id,changeBlur(info.className,scope,property,values[i],amount)]));save(changes);}catch(error){I.note(sec,error.message,'refused');}});
   input.placeholder=mixed?'Mixed':'';input.disabled=parsed.some((stack,i)=>!stack||blurs[i].length>1||elements[i].style.getPropertyPriority(property)==='important');
   if(input.disabled)I.note(sec,'A selected filter cannot be adjusted with a single blur value.');
  }

  if(saveColor)for(const [property,label]of [['color','Text color'],['background-color','Background color'],['border-color','Border color'],...(elements.every(el=>el.namespaceURI==='http://www.w3.org/2000/svg')?[['fill','SVG fill'],['stroke','SVG stroke']]:[])]){
   const sec=groups.appearance;
   const values=computed.map(css=>css.getPropertyValue(property)),mixed=values.some(value=>value!==values[0]),input=root.document.createElement('input');input.type='text';input.spellcheck=false;input.placeholder=mixed?'Mixed · enter CSS color':'CSS color';input.disabled=elements.some(el=>el.style.getPropertyValue(property));
   input.value=mixed?'':values[0];I.field(sec,'Shared '+label+' with alpha',input);root.RetouchPaintPicker.mountSelectionField(input,elements,property);I.note(sec,mixed?'Mixed colors':values[0]);
   const clear=I.button('Clear selected '+label.toLowerCase(),()=>saveColor(property,null).catch(error=>I.note(sec,error.message,'refused')));clear.disabled=input.disabled;sec.append(clear);
   input.oninput=()=>input.setCustomValidity('');input.onchange=()=>{const value=input.value.trim();if(!root.RetouchHTMLCSSValues.valid('color',value,false)||!elements[0].ownerDocument.defaultView.CSS.supports('color',value)){input.setCustomValidity('Enter a supported literal CSS color.');input.reportValidity();return;}saveColor(property,value).catch(error=>{input.setCustomValidity(error.message);input.reportValidity();});};
  }

  if(saveColor)I.note(groups.appearance,'Clear removes selected-scope paint to reveal inherited styles. Saved links stay attached; palette reset restores their definitions.');
  const relativeGroup=root.document.createElement('fieldset');relativeGroup.style.cssText='border:0;padding:0;margin:0;min-width:0';groups.typography.append(relativeGroup);
  const relativeWrite=(property,value,relative=true)=>{try{save(Object.fromEntries(infos.map((info,i)=>[info.id,change(info.className,scope,property,value,liveElement(i).ownerDocument,relative)])));}catch(error){I.note(groups.typography,error.message,'refused');}};
  for(const [property,label,min]of [['line-height','Shared Line height (%)',0],['letter-spacing','Shared Letter spacing (%)',-100]]){
   const values=computed.map(css=>{const raw=css.getPropertyValue(property);return raw==='normal'&&property==='line-height'?NaN:(parseFloat(raw)||0)/parseFloat(css.fontSize)*100;}),mixed=values.some(value=>!Number.isFinite(value)||Math.abs(value-values[0])>.0001),group=root.document.createElement('fieldset');group.style.cssText='border:0;padding:0;margin:0;min-width:0';relativeGroup.append(group);
   const input=I.relativeNumber(group,label,mixed?NaN:values[0],min,1000,value=>relativeWrite(property,value));if(mixed)input.placeholder='Mixed / automatic';input.title='Relative to each selected layer’s own font size.';group.disabled=elements.some(el=>el.style.getPropertyValue(property));
  }
  const automatic=I.button('Automatic shared line height',()=>relativeWrite('line-height','normal',false));automatic.disabled=elements.some(el=>el.style.getPropertyValue('line-height'));relativeGroup.append(automatic);
  I.note(relativeGroup,'Relative spacing follows each layer’s own font size. Pixel controls and resets are available below.');
  for(const [property,field]of Object.entries(fields).filter(([,field])=>!field.constraint).flatMap(entry=>['width','height'].includes(entry[0])?[entry,...['min-','max-'].map(prefix=>[prefix+entry[0],fields[prefix+entry[0]]])]:[entry])){
   const sec=field.constraint||field.ratio||['width','height'].includes(property)?groups.size:field.flexItem||field.layoutItem?groups.layout:['opacity','visibility','mix-blend-mode','isolation'].includes(property)?groups.appearance:groups.typography;
   if(field.ratio){
    const values=computed.map(css=>css.getPropertyValue(property)),mixed=values.some(value=>value!==values[0]),input=root.document.createElement('input');input.type='text';input.value=mixed?'':values[0];input.placeholder=mixed?'Mixed':'auto, 1 / 1, 16 / 9';
    const blocked=elements.some((el,i)=>el.style.getPropertyValue(property)||el.style.getPropertyValue('height')||el.style.getPropertyValue('inline-size')||el.style.getPropertyValue('block-size')||['inline','contents'].includes(computed[i].display));input.disabled=blocked;
    const write=value=>{try{save(Object.fromEntries(infos.map((info,i)=>[info.id,changeRatio(info.className,scope,value,liveElement(i).ownerDocument)])));}catch(error){input.setCustomValidity(error.message);input.reportValidity();}};
    input.oninput=()=>input.setCustomValidity('');input.onchange=()=>write(input.value);input.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();input.value=mixed?'':values[0];input.setCustomValidity('');input.blur();}else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();input.blur();}};I.field(sec,'Shared Aspect ratio',input);
    const presets=root.document.createElement('div');presets.className='stack-presets';for(const [value,label]of [['1 / 1','Square'],['4 / 3','4:3'],['16 / 9','16:9'],['auto','Automatic']]){const button=I.button(label,()=>write(value));button.setAttribute('aria-label',label+' shared aspect ratio');button.disabled=blocked;presets.append(button);}sec.append(presets);
    const reset=I.button('Reset shared aspect ratio',()=>write(null));try{reset.disabled=infos.every(info=>changeRatio(info.className,scope,null)===(info.className||''));}catch{reset.disabled=true;}sec.append(reset);
    I.note(sec,'A ratio makes height automatic. It follows each layer’s box sizing: content-box ratios exclude padding and borders. Content, flex layout, and minimum/maximum sizes may change the result. Reset removes the ratio; Undo also restores the previous height.');continue;
   }
   if(field.picker){
    const values=elements.map(el=>el.ownerDocument.defaultView.getComputedStyle(el).fontFamily),mixed=values.some(value=>value!==values[0]),group=root.document.createElement('fieldset');group.style.cssText='border:0;padding:0;margin:0;min-width:0';sec.append(group);
    const write=value=>{try{save(Object.fromEntries(infos.map((info,i)=>[info.id,change(info.className,scope,property,value,liveElement(i).ownerDocument)])));}catch(error){I.note(sec,error.message,'refused');}};
    I.fontPicker(group,elements[0].ownerDocument,mixed?'':values[0],write,{mixed,label:'Shared Page font'});
    group.disabled=elements.some(el=>el.style.getPropertyValue('font-family'));if(group.disabled)I.note(sec,'An inline font family controls a selected layer. Edit that source style first.','refused');
    const reset=I.button('Reset shared font family',()=>write(null));try{reset.disabled=infos.every(info=>change(info.className,scope,property,null)===(info.className||''));}catch(error){reset.disabled=true;reset.title=error.message;}group.append(reset);continue;
   }

   const dimension=['width','height'].includes(property),sizing=dimension||field.constraint,values=elements.map(el=>{const css=el.ownerDocument.defaultView.getComputedStyle(el);return field.read?field.read(css):sizing&&Number.isFinite(dimensionSize(css,property))?dimensionSize(css,property)+'px':css.getPropertyValue(property);}),mixed=values.some(v=>v!==values[0]),input=root.document.createElement(field.options?'select':'input'),blocked=elements.some(el=>{const css=el.ownerDocument.defaultView.getComputedStyle(el);return el.style.getPropertyValue(property)||field.layoutItem&&((field.gridPlacement?['grid-area',property+'-start',property+'-end'].some(key=>el.style.getPropertyValue(key)):el.style.getPropertyValue('place-self'))||!el.parentElement||!(field.gridItem?['grid','inline-grid']:['flex','inline-flex','grid','inline-grid']).includes(el.ownerDocument.defaultView.getComputedStyle(el.parentElement).display)||['absolute','fixed'].includes(css.position))||field.flexItem&&(el.style.getPropertyValue('flex')||!el.parentElement||!['flex','inline-flex'].includes(el.ownerDocument.defaultView.getComputedStyle(el.parentElement).display)||['absolute','fixed'].includes(css.position))||sizing&&(['inline-size','block-size','min-inline-size','min-block-size','max-inline-size','max-block-size'].some(key=>el.style.getPropertyValue(key))||['inline','contents'].includes(css.display)||dimension&&!Number.isFinite(dimensionSize(css,property)));});
   if(field.options){if(mixed){const o=root.document.createElement('option');o.value='';o.textContent='Mixed';o.disabled=true;input.append(o);}else if(!field.options.includes(values[0])){const o=root.document.createElement('option');o.value=values[0];o.textContent=values[0]||'Custom';o.disabled=true;input.append(o);}for(const value of field.options){const o=root.document.createElement('option');o.value=value;o.textContent=value;input.append(o);}}
   else if(field.text){input.type='text';input.placeholder=mixed?'Mixed':'auto, 100px, 50%';}
   else{input.type='number';input.min=String(field.min??0);input.max=String(field.max??100);input.step=String(field.step??'any');input.placeholder=mixed?'Mixed':'';}
   const display=mixed?'':field.options||field.text?values[0]:property==='opacity'?String(Math.round(Number(values[0])*10000)/100):(!sizing||/px$/.test(values[0]))&&Number.isFinite(parseFloat(values[0]))?String(parseFloat(values[0])):'';
   if(field.constraint&&!mixed&&!display)input.placeholder=values[0]==='auto'?'Automatic':values[0]==='none'?'No limit':values[0];input.value=display;input.disabled=blocked;input.title=blocked?(field.layoutItem?'Select in-flow items in '+(field.gridItem?'a grid':'a flex or grid')+' layout without an inline alignment override.':field.flexItem?'Select in-flow items in a flex layout without an inline flex override.':'An inline style controls this property on a selected layer. Edit that source style first.'):'';
   const write=value=>{try{save(Object.fromEntries(infos.map((info,i)=>[info.id,change(info.className,scope,property,sizing?dimensionValue(liveElement(i).ownerDocument.defaultView.getComputedStyle(liveElement(i)),property,value):value,liveElement(i).ownerDocument)])));}catch(error){I.note(sec,error.message,'refused');}};
   input.oninput=()=>input.setCustomValidity('');input.onchange=()=>{if(field.text&&!field.valid(input.value.trim())){input.setCustomValidity('Enter auto, content, a positive length such as 100px, or a percentage such as 50%.');input.reportValidity();return;}if(input.value!==''&&input.checkValidity())write(field.options||field.text?input.value.trim():Number(input.value));};input.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();input.value=display;input.setCustomValidity('');input.blur();}else if(event.key==='Enter'){event.preventDefault();event.stopPropagation();input.blur();}};I.field(sec,'Shared '+field.label,input);
   if(dimension){const presets=root.document.createElement('div');presets.className='stack-presets';for(const [value,label]of [['auto','Automatic shared '+property],['fit-content','Fit shared '+property+' to content']]){const button=I.button(label,()=>write(value));button.disabled=blocked;presets.append(button);}sec.append(presets);}
   if(property==='grid-row')I.note(sec,'Spans replace start/end placement on that axis and let the grid position each item. Full spans the explicit grid; large spans can create extra tracks. Reset reveals inherited placement; Undo restores the previous placement.');
   if(property==='justify-self')I.note(sec,'Item alignment follows the flex cross axis or grid block axis. Grid inline alignment follows the text direction. Stretch needs an automatic size; auto margins can take precedence.');
   if(property==='flex-basis'){const presets=root.document.createElement('div');presets.className='stack-presets';for(const [value,label]of [['auto','Automatic shared flex basis'],['content','Content shared flex basis']]){const button=I.button(label,()=>write(value));button.disabled=blocked;presets.append(button);}sec.append(presets);I.note(sec,'Basis is the starting size along the flex direction, before Grow and Shrink. Percentages follow the parent’s size. Pixel values follow each layer’s box sizing.');}
   if(property==='flex-shrink')I.note(sec,'Grow shares extra space; Shrink distributes compression relative to each item’s basis. Zero prevents that behavior. These controls apply to items in a flex layout; minimum sizes may still limit shrinking.');
   if(field.constraint){const button=I.button((field.keyword==='auto'?'Automatic shared minimum ':'No shared maximum ')+(property.endsWith('width')?'width':'height'),()=>write(field.keyword));button.disabled=blocked;sec.append(button);}
   const reset=I.button('Reset shared '+field.label.toLowerCase(),()=>write(null));try{reset.disabled=infos.every(info=>change(info.className,scope,property,null)===(info.className||''));}catch(error){reset.disabled=true;reset.title=error.message;}sec.append(reset);
  }
  I.note(groups.size,'Pixel sizes include padding and borders. Automatic sizing follows the page layout; fit content follows each layer’s content within the available space. Minimum and maximum sizes bound the result; when they conflict, the minimum takes precedence.');
  for(const body of Object.values(groups)){
   const rows=[...body.querySelectorAll('.inspector-field')],control=row=>row.querySelector('input[aria-label],select[aria-label],textarea[aria-label]');
   for(const row of rows){const name=control(row)?.getAttribute('aria-label'),label=row.querySelector(':scope > span');if(!name?.startsWith('Shared ')||!label||row.parentElement.classList.contains('property-row'))continue;const short=name.slice(7);label.textContent=({'Page font':'Font','Font size (px)':'Size','Font weight (1–1000)':'Weight','Font family':'Font family','Flex basis':'Basis','Item alignment':'Alignment','Grid inline alignment':'Grid alignment','Grid column span':'Column span','Grid row span':'Row span','Text color with alpha':'Color','Background color with alpha':'Color','Border color with alpha':'Color','SVG fill with alpha':'Fill','SVG stroke with alpha':'Stroke'})[short]||short;row.title=name;}
   for(const reset of [...body.querySelectorAll('button.control-button')]){
    if(!reset.textContent.startsWith('Reset shared ')||reset.classList.contains('property-reset'))continue;
    const name=reset.textContent.slice(6).toLowerCase(),field=rows.find(row=>control(row)?.getAttribute('aria-label').toLowerCase()===name||name==='shared font family'&&control(row)?.getAttribute('aria-label')==='Shared Page font');if(!field)continue;
    let row=field.parentElement;if(!row.classList.contains('property-row')){row=root.document.createElement('div');row.className='property-row';field.before(row);row.append(field);}
    reset.setAttribute('aria-label',reset.textContent);reset.title=reset.textContent;reset.textContent='↺';reset.classList.add('property-reset');row.append(reset);
   }
  }
  for(const body of Object.values(groups)){
   const hints=[...body.children].filter(el=>el.classList.contains('hint')&&!el.classList.contains('refused')&&!el.hasAttribute('role'));
   if(hints.length){const details=root.document.createElement('details'),summary=root.document.createElement('summary');details.className='inspector-disclosure';summary.textContent='Details';details.append(summary,...hints);body.append(details);}
  }
  I.note(sec,'Values show the current preview. Edits follow the selected style scope; reset removes that scope’s matching classes.');return sec;
 }
 const api={changeGap,changePadding,change,changeRatio,changeBlur,dimensionSize,dimensionValue,mount,changeRelative:(classes,scope,property,value,document=null)=>change(classes,scope,property,value,document,true)};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchReactSelection=api;
})(typeof window==='object'?window:globalThis);
