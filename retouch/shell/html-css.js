(function(){
 const I=RetouchInspector;
 const openGridSections=new Set();
 const {options,fields,svgFields,adaptiveColumns,parseAdaptiveColumns,stackLayout,childAlignment,alignmentProperties,valid,parseShadows,serializeShadows,parseFilters,withBlur,parseGradients,serializeGradients}=RetouchHTMLCSSValues;
 const stopRail=RetouchGradientStopRail;
 const coreTypography=['font-family','font-size','font-weight','font-style','line-height','letter-spacing','text-decoration-line','text-decoration-style','text-decoration-thickness','text-underline-offset','text-decoration-skip-ink','text-decoration-color','text-indent','text-wrap','font-variant-caps','font-variant-position','font-variant-numeric','font-variant-ligatures','font-variation-settings','font-optical-sizing','text-box'];
 function typographyReady(elements,width,property,reset=false){return elements.every(el=>el.isConnected&&width<=el.ownerDocument.defaultView.innerWidth&&(reset||!(property==='text-wrap'?['text-wrap','text-wrap-mode','text-wrap-style']:property==='text-box'?['text-box','text-box-trim','text-box-edge']:[property]).some(key=>el.style.getPropertyPriority(key)==='important')));}
 function typographyHint(elements,width){return elements.some(el=>width>el.ownerDocument.defaultView.innerWidth)?'Switch to a screen inside the selected edit range.':'An important inline rule controls this typography property.';}
 function typographySave(save,infos,elements,width){return (...args)=>{
  const [property,value,,perElement]=args,common=typeof property==='string'?{[property]:value}:property;
  for(let i=0;i<elements.length;i++)for(const [key,next]of Object.entries(perElement?.[infos[i].id]??common??{}))if(coreTypography.includes(key)&&!typographyReady([elements[i]],width,key,next===null))return;
  return save(...args);
 };}
 function inheritedVariables(info,width){return Object.entries(info.cssRules||{}).filter(([scope])=>Number(scope)<width).sort(([a],[b])=>Number(a)-Number(b)).reduce((all,[,rules])=>Object.assign(all,rules),{});}
 function effectiveSpacingPercent(info,el,width,property){
  const inline=el.style.getPropertyValue(property),authored=info.cssRules?.[width]?.[property]??inheritedVariables(info,width)[property],raw=el.style.getPropertyPriority(property)==='important'?inline:authored??inline,percent=I.spacingPercent(property,raw),css=el.ownerDocument.defaultView.getComputedStyle(el);
  return percent!==null&&Math.abs(percent/100*parseFloat(css.fontSize)-parseFloat(css.getPropertyValue(property)))<.02?percent:null;
 }
 function mount(info,el,width,save,position=null,textStyleAction=null){
  const sec=I.section('CSS properties');
  if(info.cssReason||!el||!Number.isInteger(width)){I.note(sec,info.cssReason||'Choose a pixel screen scope.','refused');return sec;}
  save=typographySave(save,[info],[el],width);
  const css=el.ownerDocument.defaultView.getComputedStyle(el),own=info.cssRules?.[width]||{};
  let paint=null;
  if(el.namespaceURI==='http://www.w3.org/2000/svg'){
   paint=I.section('SVG paint');
   for(const [property,label]of svgFields){
    const input=document.createElement(options[property]?'select':'input');
    if(options[property])for(const value of new Set([own[property]??css.getPropertyValue(property),...options[property]])){const option=document.createElement('option');option.value=value;option.textContent=value;input.append(option);}else input.type='text';
    input.value=own[property]??css.getPropertyValue(property);
    input.oninput=()=>input.setCustomValidity('');
    input.onchange=()=>{const value=input.value.trim();if(!valid(property,value)||!CSS.supports(property,value)){input.setCustomValidity('Use a supported SVG paint value.');input.reportValidity();return;}save(property,value,width);};
    I.field(paint,label,input);
    if(['fill','stroke'].includes(property)){I.fieldDraft(input);input.dataset.paintProperty=property;RetouchBackgroundPaintUI.bindSource(input,info,width?'min-['+width+'px]:':'',property,el);input.retouchPaintPreview=()=>RetouchPaintPicker.propertyPreview({el,input,property});}
    const reset=I.button('Reset '+label.toLowerCase(),()=>save(property,null,width));reset.disabled=!Object.hasOwn(own,property);paint.append(reset);
   }
   I.note(paint,'Paint follows the selected screen scope. Use none for no fill or stroke. Stroke width and dashes accept SVG units, px or %. Reset reveals the inherited CSS or original attribute.');
  }
  const layout=I.section('Layout');const flowControl=RetouchFlowResize.control(el,sizes=>save(RetouchFlowResize.changes(el,sizes),null,width));if(flowControl)layout.append(flowControl);
  if(info.structure?.canInsert){
   const layoutActive=()=>el.isConnected&&width<=el.ownerDocument.defaultView.innerWidth;
   const stacks=document.createElement('div');stacks.className='stack-presets';
   const normal=I.button('Normal flow',()=>{if(layoutActive())save('display','block',width);});normal.disabled=!layoutActive();normal.setAttribute('aria-pressed',String(['block','inline','inline-block','flow-root','list-item'].includes(css.display)));stacks.append(normal);
   for(const [axis,label]of [['vertical','Vertical stack'],['horizontal','Horizontal stack']]){const changes=stackLayout(axis,css.writingMode),button=I.button(label,()=>{if(layoutActive())save(stackLayout(axis,el.ownerDocument.defaultView.getComputedStyle(el).writingMode),null,width);});button.disabled=!layoutActive();button.setAttribute('aria-pressed',String(['flex','inline-flex'].includes(css.display)&&css.flexDirection===changes['flex-direction']&&css.flexWrap==='nowrap'));stacks.append(button);}layout.append(stacks);
   const inheritedColumns=Object.entries(info.cssRules||{}).filter(([size])=>Number(size)<=el.ownerDocument.defaultView.innerWidth).sort(([a],[b])=>Number(a)-Number(b)).reduce((value,[,rules])=>rules['grid-template-columns']??value,'');
   const adaptiveSize=parseAdaptiveColumns(own['grid-template-columns']??inheritedColumns),isAdaptive=['grid','inline-grid'].includes(css.display)&&adaptiveSize!==null;
   const adaptive=I.button('Adaptive grid',()=>{if(layoutActive())save({display:'grid','grid-template-columns':adaptiveColumns(adaptiveSize||240),'grid-template-rows':'none'},null,width);});adaptive.disabled=!layoutActive();adaptive.setAttribute('aria-pressed',String(isAdaptive));stacks.append(adaptive);
   if(isAdaptive){const minimum=document.createElement('input');minimum.type='number';minimum.min=1;minimum.max=2000;minimum.step=1;minimum.value=adaptiveSize;minimum.disabled=!layoutActive();minimum.onchange=()=>{const value=adaptiveColumns(Number(minimum.value));if(value&&minimum.checkValidity()&&layoutActive())save('grid-template-columns',value,width);};I.field(layout,'Minimum column size (px)',minimum);I.note(layout,'Columns fit the available space automatically. Below this minimum, a single column shrinks to fit. Child sizes and spans can still affect the result.');}
   if(['flex','inline-flex'].includes(css.display)){
    const wrapping=document.createElement('select');for(const [value,label]of [['nowrap','Single line'],['wrap','Wrap to new lines'],['wrap-reverse','Wrap in reverse']]){const option=document.createElement('option');option.value=value;option.textContent=label;wrapping.append(option);}wrapping.value=css.flexWrap;wrapping.onchange=()=>save('flex-wrap',wrapping.value,width);I.field(layout,'Child wrapping',wrapping);
   }
   if(['flex','inline-flex','grid','inline-grid'].includes(css.display)){
    const align=document.createElement('div');align.className='layout-alignment';align.setAttribute('role','group');align.setAttribute('aria-label','Align children');
    for(let y=0;y<3;y++)for(let x=0;x<3;x++){
     const label='Align children '+['top','middle','bottom'][y]+' '+['left','center','right'][x],changes=childAlignment(x,y,css),button=I.button('•',()=>{if(!el.isConnected||width>el.ownerDocument.defaultView.innerWidth)return;const current=el.ownerDocument.defaultView.getComputedStyle(el);if(['flex','inline-flex','grid','inline-grid'].includes(current.display))save(childAlignment(x,y,current),null,width);});button.setAttribute('aria-label',label);button.disabled=width>el.ownerDocument.defaultView.innerWidth;button.title=button.disabled?'Preview the selected edit range before aligning children.':label;button.setAttribute('aria-pressed',String(Object.entries(changes).every(([property,value])=>css.getPropertyValue(property)===value)));align.append(button);
    }
    layout.append(align);const properties=alignmentProperties(css),reset=I.button('Reset child alignment',()=>{if(layoutActive())save(Object.fromEntries(properties.map(property=>[property,null])),null,width);});reset.dataset.alignmentReset='true';reset.setAttribute('aria-label',reset.textContent);reset.title=reset.textContent;reset.textContent='↺';reset.classList.add('property-reset');reset.disabled=!layoutActive()||properties.every(property=>!Object.hasOwn(own,property));layout.append(reset);
   }
   const clipping=document.createElement('input');clipping.type='checkbox';clipping.checked=['hidden','clip'].includes(css.overflowX)&&['hidden','clip'].includes(css.overflowY);clipping.indeterminate=!clipping.checked&&!(css.overflowX==='visible'&&css.overflowY==='visible');clipping.onchange=()=>save({overflow:clipping.checked?'clip':'visible','overflow-x':null,'overflow-y':null},null,width);I.field(layout,'Clip content',clipping);
   const resetClipping=I.button('Reset clipping',()=>save({overflow:null,'overflow-x':null,'overflow-y':null},null,width));resetClipping.disabled=!['overflow','overflow-x','overflow-y'].some(p=>Object.hasOwn(own,p));layout.append(resetClipping);
   I.note(layout,'Arrange children at this screen size. Alignment uses the available space inside the container. Each action is one undo step.');
  }
  if(el.namespaceURI==='http://www.w3.org/1999/xhtml'){
   const ratioReady=(reset=false)=>el.isConnected&&width<=el.ownerDocument.defaultView.innerWidth&&(reset||!['aspect-ratio','height','inline-size','block-size'].some(key=>el.style.getPropertyPriority(key)==='important')&&!['inline','contents','none'].includes(el.ownerDocument.defaultView.getComputedStyle(el).display));
   const ratio=document.createElement('input');ratio.type='text';ratio.value=own['aspect-ratio']??css.aspectRatio;ratio.placeholder='auto, 1 / 1, 16 / 9';ratio.disabled=!ratioReady();ratio.oninput=()=>ratio.setCustomValidity('');ratio.onchange=()=>{if(!ratioReady())return;const value=ratio.value.trim().replace(/\s*[:/]\s*/g,' / ');if(!valid('aspect-ratio',value)||!CSS.supports('aspect-ratio',value)){ratio.setCustomValidity('Use auto or a positive ratio such as 16 / 9.');ratio.reportValidity();return;}save(value==='auto'?{'aspect-ratio':'auto'}:{'aspect-ratio':value,height:'auto'},null,width);};
   const ratioRow=document.createElement('div');ratioRow.className='property-row';layout.append(ratioRow);I.field(ratioRow,'Frame aspect ratio',ratio);ratio.closest('.inspector-field').querySelector('span').textContent='Aspect ratio';
   ratio.onkeydown=event=>{if(event.isComposing||!['Enter','Escape'].includes(event.key))return;event.preventDefault();event.stopPropagation();if(event.key==='Escape'){ratio.value=own['aspect-ratio']??css.aspectRatio;ratio.setCustomValidity('');}ratio.blur();};
   const resetRatio=I.button('Reset aspect ratio',()=>{if(ratioReady(true))save('aspect-ratio',null,width);});resetRatio.setAttribute('aria-label','Reset aspect ratio');resetRatio.title='Reset aspect ratio';resetRatio.textContent='↺';resetRatio.classList.add('property-reset');resetRatio.disabled=!ratioReady(true)||!Object.hasOwn(own,'aspect-ratio');ratioRow.append(resetRatio);
   I.note(layout,'Setting a ratio makes height automatic. Content and minimum sizes can still make the frame taller. Undo restores both settings.');
  }
  const corners=I.section('Corners'),appearance=I.section('Appearance'),typography=I.section('Typography');
  const inheritedWidth=Object.keys(info.textStyleLinks||{}).map(Number).filter(value=>value<width).sort((a,b)=>b-a)[0];
  const inheritedLink=!info.textStyleLinks?.[width]&&inheritedWidth!==undefined?{link:info.textStyleLinks[inheritedWidth],label:inheritedWidth===0?'All sizes':inheritedWidth+'px and larger'}:null;
  window.RetouchTextStyles?.mount(typography,el,textStyleAction?{inherited:inheritedLink,link:info.textStyleLinks?.[width],overrides:info.textStyleOverrides?.[width]||[],reset:(styleId,libraryRevision)=>textStyleAction('resetTextStyle',width,{styleId,libraryRevision}),apply:(styleId,libraryRevision)=>textStyleAction('applyTextStyle',width,{styleId,libraryRevision}),update:(styleId,libraryRevision,name,properties)=>textStyleAction('updateTextStyle',width,{styleId,libraryRevision,name,properties}),detach:()=>textStyleAction('detachTextStyle',width)}:{});
  I.typographyPreview(typography,el);
  I.textResizing(typography,el,changes=>save(changes,null,width),()=>el.isConnected&&width<=el.ownerDocument.defaultView.innerWidth);
  const family=I.fontPicker(typography,el.ownerDocument,css.fontFamily,value=>save('font-family',value,width),{disabled:!typographyReady([el],width,'font-family')});if(family.disabled)family.title=typographyHint([el],width);
  const relativeLineHeight=I.relativeNumber(typography,'Line height (%)',parseFloat(css.lineHeight)/parseFloat(css.fontSize)*100,0,1000,value=>save('line-height',String(Math.round(value*1e6)/1e8),width));relativeLineHeight.disabled=!typographyReady([el],width,'line-height');relativeLineHeight.title=relativeLineHeight.disabled?typographyHint([el],width):'Relative to this layer’s font size.';if(css.lineHeight==='normal')relativeLineHeight.placeholder='Automatic';
  const relativeTracking=I.relativeNumber(typography,'Letter spacing (%)',(parseFloat(css.letterSpacing)||0)/parseFloat(css.fontSize)*100,-100,1000,value=>save('letter-spacing',`${Math.round(value*1e6)/1e8}em`,width));relativeTracking.disabled=!typographyReady([el],width,'letter-spacing');relativeTracking.title=relativeTracking.disabled?typographyHint([el],width):'Relative to this layer’s font size.';
  I.opticalTypography(typography,css,value=>save('font-optical-sizing',value,width),()=>save('font-optical-sizing',null,width),Object.hasOwn(own,'font-optical-sizing'));
  I.variationTypography(typography,css,value=>save('font-variation-settings',value,width),()=>save('font-variation-settings',null,width),Object.hasOwn(own,'font-variation-settings'),el);
  I.fontPositionTypography(typography,css.fontVariantPosition,value=>save('font-variant-position',value,width),()=>save('font-variant-position',null,width),Object.hasOwn(own,'font-variant-position'));
  I.capsTypography(typography,css.fontVariantCaps,value=>save('font-variant-caps',value,width),()=>save('font-variant-caps',null,width),Object.hasOwn(own,'font-variant-caps'));
  I.ligatureTypography(typography,css.fontVariantLigatures,value=>save('font-variant-ligatures',value,width),()=>save('font-variant-ligatures',null,width),Object.hasOwn(own,'font-variant-ligatures'));
  I.verticalAlignmentTypography(typography,css,(property,value)=>save(property,value,width),property=>save(property,null,width),property=>Object.hasOwn(own,property));
  I.wrapTypography(typography,css,value=>save('text-wrap',value,width),()=>save('text-wrap',null,width),Object.hasOwn(own,'text-wrap'));
  I.verticalTrimTypography(typography,css,value=>save('text-box',value,width),()=>save('text-box',null,width),Object.hasOwn(own,'text-box'));
  I.truncationTypography(typography,el,()=>el.isConnected&&width<=el.ownerDocument.defaultView.innerWidth,value=>save('line-clamp',value===null?null:String(value),width),Object.hasOwn(own,'line-clamp'));
  I.underlineTypography(typography,css,(property,value)=>save(property,value,width),property=>save(property,null,width),property=>Object.hasOwn(own,property),el);
  I.numericTypography(typography,css.fontVariantNumeric,value=>save('font-variant-numeric',value,width),()=>save('font-variant-numeric',null,width),Object.hasOwn(own,'font-variant-numeric'));
  const visible=document.createElement('input');visible.type='checkbox';visible.checked=(own.visibility??css.visibility)==='visible';visible.onchange=()=>save('visibility',visible.checked?'visible':'hidden',width);I.field(appearance,'Visible layer',visible);
  const resetVisibility=I.button('Reset visibility',()=>save('visibility',null,width));resetVisibility.disabled=!Object.hasOwn(own,'visibility');appearance.append(resetVisibility);I.note(appearance,'Hidden layers keep their layout space. Select them in Layers to show them again.');

  for(const [property,label,min,max,unit]of [['opacity','Opacity (%)',0,100,''],['rotate','Rotation (°)',-360,360,'deg']]){
   const raw=own[property]??css.getPropertyValue(property),input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step='any';
   const value=property==='opacity'?Number(raw)*100:RetouchReactSelection.rotationDegrees(raw),host=property==='rotate'&&position?position:appearance;
   input.value=Number.isFinite(value)?value:'';input.placeholder=raw;
   input.onchange=()=>{if(input.value!==''&&input.checkValidity()){const value=property==='opacity'?String(Number(input.value)/100):input.value+unit;if(valid(property,value)&&CSS.supports(property,value))save(property,value,width);}};
   I.numericLabelDrag(I.field(host,label,input));I.fieldDraft(input);I.numericPreview(input,el,property,value=>property==='opacity'?String(value/100):value+unit);
   const reset=I.button('Reset '+property,()=>save(property,null,width));reset.disabled=!Object.hasOwn(own,property);host.append(reset);
   if(property==='rotate'&&(el.style.getPropertyPriority('rotate')==='important'||!Number.isFinite(value))){input.disabled=true;input.title='Edit this layer’s important inline or 3D rotation in its source first.';}
  }
  if(position&&el)position.append(RetouchFlip.mount(el,value=>save('scale',value,width)));
  if(css.transform!=='none')I.note(appearance,'Rotation combines with the page’s existing transform.');
  for(const [property,label]of [['mix-blend-mode','Blend mode'],['isolation','Blend group']]){
   const current=own[property]??css.getPropertyValue(property),input=document.createElement('select');
   for(const value of new Set([current,...options[property]])){if(!CSS.supports(property,value))continue;const option=document.createElement('option');option.value=value;option.textContent=property==='isolation'?(value==='isolate'?'Isolate children':'Blend with surroundings'):value;input.append(option);}
   input.value=current;input.onchange=()=>save(property,input.value,width);I.field(appearance,label,input);
   const reset=I.button('Reset '+label.toLowerCase(),()=>save(property,null,width));reset.disabled=!Object.hasOwn(own,property);appearance.append(reset);
  }
  const filterStates=Object.fromEntries(['filter','backdrop-filter'].map(property=>[property,RetouchBackgroundPaintUI.filterState(info,width?'min-['+width+'px]:':'',el,property)]));
  const blur=I.section('Blur');blur.dataset.emptyEffects=String(['filter','backdrop-filter','box-shadow'].every(property=>((filterStates[property]?.value??own[property]??css.getPropertyValue(property))||'none').trim()==='none'));
  for(const [property,label]of [['filter','Layer blur'],['backdrop-filter','Background blur']]){
   const state=filterStates[property],raw=state.value,filters=state.model?parseFilters(raw):null,blurFilters=filters?.filter(f=>f.name==='blur');
   const input=document.createElement('input');input.type='number';input.min=0;input.max=1000;input.step='any';
   input.disabled=!CSS.supports(property,'blur(1px)')||!filters||blurFilters.length>1;input.value=input.disabled?'':blurFilters.length?parseFloat(blurFilters[0].arg):0;
   input.onchange=()=>{if(input.value!==''&&input.checkValidity()){const changes=RetouchBackgroundPaintUI.filterChanges(property,RetouchFilterVisibility.withBlur(state.model,Number(input.value)),info);if(CSS.supports(property,changes[property]))save(changes,null,width);}};
   I.numericLabelDrag(I.field(blur,label+' (px)',input));I.numericPreview(input,el,property,value=>state.model?RetouchBackgroundPaintUI.filterChanges(property,RetouchFilterVisibility.withBlur(state.model,value),info)[property]:null);
   if(input.disabled)I.note(blur,label+' cannot be adjusted with this browser or filter stack.');
   const reset=I.button('Reset '+label.toLowerCase(),()=>save(property,null,width));reset.disabled=!Object.hasOwn(own,property);blur.append(reset);
   const clear=I.button('Clear '+(property==='filter'?'layer':'background')+' filters',()=>save(property,'none',width));clear.disabled=raw==='none';blur.append(clear);
  }
  for(const property of ['filter','backdrop-filter'])RetouchFilterStack.mount(blur,property,own[property]??css.getPropertyValue(property),value=>save(property,value,width),{reset:Object.hasOwn(own,property),element:el,active:()=>filterStates[property].source||RetouchBackgroundPaintUI.rangeActive(blur,el),model:filterStates[property].model,saveModel:next=>save(RetouchBackgroundPaintUI.filterChanges(property,next,info),null,width)});
  I.note(blur,'Layer blur affects the layer and its children. Background blur affects content behind transparent areas. Existing color filters stay in order.');
  const effects=I.section('Shadows'),shadows=RetouchBackgroundPaintUI.sourceShadows(info,width?'min-['+width+'px]:':'')??RetouchBackgroundPaintUI.readShadows(info,el);
  const writeShadows=next=>{const changes=RetouchBackgroundPaintUI.shadowChanges(next,info);if(valid('box-shadow',changes['box-shadow'])&&CSS.supports('box-shadow',changes['box-shadow']))save(changes,null,width);};
  if(shadows===null)I.note(effects,'This shadow uses values these controls cannot represent. Clear it to create a new shadow, or Reset to restore the page’s styling.');
  else {
   shadows.forEach((shadow,index)=>{
    const group=document.createElement('fieldset'),legend=document.createElement('legend');group.className='shadow-controls';legend.textContent='Shadow '+(index+1);group.append(legend);
    const update=(key,value)=>writeShadows(shadows.map((item,i)=>i===index?{...item,[key]:value}:item));
    const type=document.createElement('select');for(const [value,label]of [['drop','Drop shadow'],['inner','Inner shadow']]){const option=document.createElement('option');option.value=value;option.textContent=label;type.append(option);}type.value=shadow.inset?'inner':'drop';type.onchange=()=>update('inset',type.value==='inner');I.field(group,'Type',type).setAttribute('aria-label','Shadow '+(index+1)+' type');
    for(const [key,label]of [['x','X'],['y','Y'],['blur','Blur'],['spread','Spread']]){
     const input=document.createElement('input');input.type='number';input.step='any';input.min=key==='blur'?0:-10000;input.max=10000;input.value=shadow[key];
     input.onchange=()=>{if(input.value!==''&&input.checkValidity())update(key,Number(input.value));};I.numericLabelDrag(I.field(group,label+' (px)',input)).setAttribute('aria-label','Shadow '+(index+1)+' '+label+' (px)');I.numericPreview(input,el,'box-shadow',value=>RetouchBackgroundPaintUI.shadowChanges(shadows.map((item,i)=>i===index?{...item,[key]:value}:item),info)['box-shadow']);
    }
    const color=document.createElement('input');color.value=shadow.color;color.retouchPaintPreview=()=>RetouchPaintPicker.shadowPreview({el,group,shadows,index});color.oninput=()=>color.setCustomValidity('');color.onchange=()=>{const value=color.value.trim();if(!valid('color',value)||!CSS.supports('color',value)){color.setCustomValidity('Use a CSS color, such as #00000040 or rgba(0, 0, 0, 0.25).');color.reportValidity();return;}update('color',value);};I.field(group,'Color',color).setAttribute('aria-label','Shadow '+(index+1)+' color');
    RetouchBackgroundPaintUI.shadowEye(color,()=>[shadow],hidden=>update('hidden',hidden),()=>RetouchBackgroundPaintUI.rangeActive(color,el)||RetouchBackgroundPaintUI.sourceShadows(info,width?'min-['+width+'px]:':'')!==null,el,'Shadow '+(index+1));
    group.append(I.button('Remove shadow '+(index+1),()=>writeShadows(shadows.filter((_,i)=>i!==index))));
    if(index>0)group.append(I.button('Move shadow '+(index+1)+' up',()=>{const next=[...shadows];[next[index-1],next[index]]=[next[index],next[index-1]];writeShadows(next);}));
        if(index<shadows.length-1)group.append(I.button('Move shadow '+(index+1)+' down',()=>{const next=[...shadows];[next[index],next[index+1]]=[next[index+1],next[index]];writeShadows(next);}));
        const duplicate=I.button('Duplicate shadow '+(index+1),()=>writeShadows([...shadows.slice(0,index+1),{...shadow},...shadows.slice(index+1)]));duplicate.disabled=shadows.length>=16;group.append(duplicate);effects.append(group);
   });
   const add=I.button('Add shadow',()=>writeShadows([...shadows,{x:0,y:4,blur:8,spread:0,color:'rgba(0, 0, 0, 0.25)',inset:false}]));add.disabled=shadows.length>=16;effects.append(add);
  }
  const clear=I.button('Clear shadows',()=>save('box-shadow','none',width));clear.disabled=shadows?.length===0;effects.append(clear);
  const resetShadows=I.button('Reset shadows',()=>save('box-shadow',null,width));resetShadows.disabled=!Object.hasOwn(own,'box-shadow');effects.append(resetShadows);
  I.note(effects,'Shadows are stacked from front to back. Reset restores this screen size’s inherited styling.');
  const fills=I.section('Gradient fills'),gradients=parseGradients(own['background-image']??css.backgroundImage);
  const writeGradients=next=>{const value=serializeGradients(next);if(valid('background-image',value)&&CSS.supports('background-image',value))return save('background-image',value,width);};
  if(gradients===null)I.note(fills,RetouchHTMLCSSValues.imageLayers(css.backgroundImage)?.some(RetouchHTMLCSSValues.imageURL)?'Use Image fill to edit image paints in this stack.':'The existing background image cannot be represented by these gradient controls.');
  else {
   gradients.forEach((gradient,index)=>{
    const group=document.createElement('fieldset');group.className='gradient-controls';const legend=document.createElement('legend');legend.textContent='Fill '+(index+1);group.append(legend);
    const preview=document.createElement('div');preview.className='gradient-preview';preview.style.backgroundImage=serializeGradients([gradient]);preview.setAttribute('aria-label','Fill '+(index+1)+' preview');group.append(preview);
    const update=next=>writeGradients(gradients.map((g,i)=>i===index?next:g));
    const paintGeometry=RetouchGradientGeometry({gradient,index,el,preview,gradients,update}),bind=RetouchGradientNumeric({element:el,group,preview,gradient,gradients,index,paintGeometry});
    group.append(stopRail({gradient,index,info,el,preview,gradients,update}));
    const type=document.createElement('select');for(const value of ['linear','radial','conic']){const option=document.createElement('option');option.value=value;option.textContent=value==='linear'?'Linear':value==='radial'?'Radial':'Angular';type.append(option);}type.value=gradient.type;type.onchange=()=>update({...gradient,type:type.value});I.field(group,'Type',type).setAttribute('aria-label','Fill '+(index+1)+' type');
    I.select(group,'Fill '+(index+1)+' Color blending',[['','Browser default'],...RetouchHTMLCSSValues.gradientColorSpaces.filter(space=>CSS.supports('background-image',serializeGradients([{...gradient,colorSpace:space,hue:undefined}]))).map(space=>[space,space])],gradient.colorSpace||'',colorSpace=>update({...gradient,colorSpace,hue:undefined}));
    if(['hsl','hwb','lch','oklch'].includes(gradient.colorSpace))I.select(group,'Fill '+(index+1)+' Hue direction',[['','Default'],['shorter','Shorter'],['longer','Longer'],['increasing','Increasing'],['decreasing','Decreasing']],gradient.hue||'',hue=>update({...gradient,hue}));
    const repeat=document.createElement('input');repeat.type='checkbox';repeat.checked=!!gradient.repeat;I.field(group,'Repeat',repeat).setAttribute('aria-label','Fill '+(index+1)+' Repeat');repeat.onchange=()=>update({...gradient,repeat:repeat.checked});if(gradient.repeat)I.note(group,'The pattern repeats between the first and last stop. Bring them closer for more repeats.');
    RetouchRadialGradient(group,gradient,'Fill '+(index+1),update);
    for(const [key,label,max]of [...(gradient.type!=='radial'?[['angle','Angle (°)',360]]:[]),...(gradient.type!=='linear'?[['x','Center X (%)',100],['y','Center Y (%)',100]]:[])]){
     const input=I.number(group,'Fill '+(index+1)+' '+label,gradient[key],key==='angle'?-360:0,max,value=>update({...gradient,[key]:value}));input.value=String(gradient[key]);input.parentElement.querySelector('span').textContent=label;bind(input,value=>({...gradient,[key]:value}));
    }
    gradient.stops.forEach((stop,stopIndex)=>{
     const row=document.createElement('div');row.className='gradient-stop-row';group.append(row);
     const prefix='Fill '+(index+1)+' stop '+(stopIndex+1),color=document.createElement('input');color.value=stop.color;color.retouchPaintPreview=()=>RetouchPaintPicker.gradientPreview({el,group,preview,gradient,gradients,index,stopIndex});color.oninput=()=>color.setCustomValidity('');color.onchange=()=>{const value=color.value.trim();if(!valid('color',value)||!CSS.supports('color',value)){color.setCustomValidity('Enter a CSS color.');color.reportValidity();return;}update({...gradient,stops:gradient.stops.map((s,i)=>i===stopIndex?{...s,color:value}:s)});};I.field(row,'Stop '+(stopIndex+1)+' color',color).setAttribute('aria-label',prefix+' color');
     const changed=position=>({...gradient,stops:gradient.stops.map((s,i)=>i===stopIndex?{...s,position}:s).sort((a,b)=>a.position-b.position)}),position=I.number(row,prefix+' position (%)',stop.position,0,100,value=>update(changed(value)));position.value=String(stop.position);position.parentElement.classList.add('gradient-stop-position');position.parentElement.querySelector('[data-numeric-scrub]').textContent='%';bind(position,changed,stopIndex);I.fieldDraft(color);I.fieldDraft(position);row.insertBefore(position.parentElement,color.parentElement);
     const remove=I.button('Remove stop '+(stopIndex+1),()=>update({...gradient,stops:gradient.stops.filter((_,i)=>i!==stopIndex)}));remove.setAttribute('aria-label','Remove '+prefix.toLowerCase());remove.title='Remove stop';remove.textContent='−';remove.disabled=gradient.stops.length<=2;row.append(remove);
    });
    const addStop=I.button('Add stop',()=>{let gap=0;for(let i=1;i<gradient.stops.length-1;i++)if(gradient.stops[i+1].position-gradient.stops[i].position>gradient.stops[gap+1].position-gradient.stops[gap].position)gap=i;const stops=[...gradient.stops];stops.splice(gap+1,0,{color:'#ffffff',position:(stops[gap].position+stops[gap+1].position)/2});update({...gradient,stops});});addStop.setAttribute('aria-label','Add stop to fill '+(index+1));addStop.disabled=gradient.stops.length>=16;group.append(addStop);
    group.append(I.button('Reverse fill '+(index+1)+' stops',()=>update({...gradient,stops:gradient.stops.map(stop=>({...stop,position:100-stop.position})).reverse()})));
    const duplicate=I.button('Duplicate fill '+(index+1),()=>{const next=[...gradients];next.splice(index+1,0,gradient);writeGradients(next);});duplicate.disabled=gradients.length>=8;group.append(duplicate);
    group.append(I.button('Remove fill '+(index+1),()=>writeGradients(gradients.filter((_,i)=>i!==index))));
    if(index>0)group.append(I.button('Move fill '+(index+1)+' up',()=>{const next=[...gradients];[next[index-1],next[index]]=[next[index],next[index-1]];writeGradients(next);}));if(index<gradients.length-1)group.append(I.button('Move fill '+(index+1)+' down',()=>{const next=[...gradients];[next[index],next[index+1]]=[next[index+1],next[index]];writeGradients(next);}));fills.append(group);
   });
   const add=I.button('Add gradient',()=>writeGradients([...gradients,{type:'linear',angle:90,x:50,y:50,shape:'ellipse',stops:[{color:'#6366f1',position:0},{color:'#ec4899',position:100}]}]));add.disabled=gradients.length>=8;fills.append(add);
  }
  const clearFills=I.button('Clear background images',()=>save('background-image','none',width));clearFills.disabled=gradients?.length===0;fills.append(clearFills);
  const resetFills=I.button('Reset gradient fills',()=>save('background-image',null,width));resetFills.disabled=!Object.hasOwn(own,'background-image');fills.append(resetFills);
  I.note(fills,'Fills stack from front to back over the background color. Drag stops on the rail, or enter percentages. Escape cancels a drag.');
  const parentElement=I.layoutParent(el),parentCSS=parentElement&&el.ownerDocument.defaultView.getComputedStyle(parentElement),inFlow=!['absolute','fixed'].includes(css.position),isFlexItem=inFlow&&parentCSS&&['flex','inline-flex'].includes(parentCSS.display);
  const flex=I.section('Flex sizing');
  if(isFlexItem){
   const inlineAxis=/^(vertical|sideways)/.test(parentCSS.writingMode)?'height':'width';
   const axis=parentCSS.flexDirection.startsWith('column')?(inlineAxis==='width'?'height':'width'):inlineAxis,minimum='min-'+axis;
   flex.append(I.button('Fill available space',()=>save({'flex-grow':'1','flex-shrink':'1','flex-basis':'0%',[axis]:'auto',[minimum]:'0px'},null,width)));
   flex.append(I.button('Hug contents',()=>save({'flex-grow':'0','flex-shrink':'0','flex-basis':'auto',[axis]:'max-content',[minimum]:'0px'},null,width)));
   for(const [property,label]of [['flex-grow','Grow'],['flex-shrink','Shrink'],['flex-basis','Flex basis']]){
    const input=document.createElement('input');input.type=property==='flex-basis'?'text':'number';if(input.type==='number'){input.min=0;input.max=1000;input.step='any';}input.value=own[property]??css.getPropertyValue(property);
    input.onchange=()=>{const value=input.value.trim();if(input.checkValidity()&&valid(property,value))save(property,value,width);};I.field(flex,label,input);
    const reset=I.button('Reset '+label.toLowerCase(),()=>save(property,null,width));reset.disabled=!Object.hasOwn(own,property);flex.append(reset);
   }
   I.note(flex,'Fill and Hug change '+axis+' sizing along the parent’s flex direction. Each action is one undo step.');
  }
  const grid=I.section('Grid');
  const isGrid=['grid','inline-grid'].includes(css.display),parentGrid=inFlow&&parentCSS&&['grid','inline-grid'].includes(parentCSS.display);
  if(isGrid||parentGrid)I.gridGuideControl(grid);
  const gridFields=[...(isGrid?[['grid-template-columns','Grid columns'],['grid-template-rows','Grid rows']]:[]),...(parentGrid?[['grid-column','Column span'],['grid-row','Row span']]:[])];
  for(const [property,label]of gridFields){
   const tracks=property.startsWith('grid-template'),raw=own[property]??css.getPropertyValue(property),match=(tracks?/^repeat\((\d+),/:/^span (\d+)/).exec(raw);
   const input=document.createElement('input');input.type='number';input.min=1;input.max=24;input.step=1;
   input.value=match?match[1]:!tracks&&raw==='auto'?'1':'';input.placeholder='Auto / authored';input.title=raw;
   input.onchange=()=>{if(input.value!==''&&input.checkValidity()){const count=Number(input.value);save(property,tracks?`repeat(${count}, minmax(0, 1fr))`:`span ${count} / span ${count}`,width);}};
   I.field(grid,label,input);const reset=I.button('Reset '+label.toLowerCase(),()=>save(property,null,width));reset.disabled=!Object.hasOwn(own,property);grid.append(reset);
  }
  if(gridFields.length)I.note(grid,'Track counts create equal-sized tracks. Reset restores the page’s authored layout.');
  for(const [enabled,title,properties] of [[isGrid,'Custom grid tracks',[['grid-template-columns','Column sizes'],['grid-template-rows','Row sizes']]],[parentGrid,'Custom grid placement',[['grid-column','Column placement'],['grid-row','Row placement']]]])if(enabled){
   const custom=document.createElement('details'),summary=document.createElement('summary');custom.className='inspector-disclosure';summary.textContent=title;custom.append(summary);custom.open=openGridSections.has(title);custom.ontoggle=()=>{custom.open?openGridSections.add(title):openGridSections.delete(title);};
   for(const [property,label] of properties){
    const row=document.createElement('div');row.className='property-row';custom.append(row);
    const input=document.createElement('input');input.type='text';input.value=own[property]??css.getPropertyValue(property);const initial=input.value;input.oninput=()=>input.setCustomValidity('');
    input.onchange=()=>{const value=input.value.trim();if(value===initial)return;if(!valid(property,value)||!CSS.supports(property,value)){input.setCustomValidity(title==='Custom grid tracks'?'Enter track sizes such as 160px 1fr or repeat(3, minmax(0, 1fr)).':'Enter grid lines such as 2 / 4, 2 / span 2, or content_start / content_end.');input.reportValidity();return;}save(property,value,width);};I.field(row,label,input);if(title==='Custom grid placement'){input.parentElement.querySelector('span').textContent=label.replace(' placement','');I.suggestGridPlacement(input,parentCSS.getPropertyValue(property==='grid-column'?'grid-template-columns':'grid-template-rows'));}
    input.title='Enter saves. Escape cancels.';
    input.onkeydown=event=>{if(event.isComposing||!['Enter','Escape'].includes(event.key))return;event.preventDefault();event.stopPropagation();if(event.key==='Escape'){input.value=initial;input.setCustomValidity('');}input.blur();};
    const reset=I.button('↺',()=>save(property,null,width));reset.classList.add('property-reset');reset.setAttribute('aria-label','Reset '+label.toLowerCase());reset.title='Reset '+label.toLowerCase();reset.disabled=!Object.hasOwn(own,property);row.append(reset);
   }
   I.note(custom,title==='Custom grid tracks'?'Separate sizes with spaces. 160px 1fr makes a fixed track and a flexible track.':'Choose a start and end line: 2 / 4 spans two tracks. Named lines work too.');grid.append(custom);
  }

  for(const [property,label] of [...fields,...(isGrid?[['justify-items','Align columns']]:[])]){
   const value=own[property]??css.getPropertyValue(property),input=document.createElement(options[property]?'select':'input');
   const spacing=/^(?:gap|padding(?:-(?:top|right|bottom|left))?)$/.test(property),rangeGuarded=coreTypography.includes(property)||spacing||/^(?:min-|max-)?(?:width|height)$/.test(property)||['display','flex-direction','flex-wrap','align-items','align-content','justify-content','justify-items','grid-auto-flow'].includes(property),spacingActive=()=>el.isConnected&&width<=el.ownerDocument.defaultView.innerWidth;
   if(options[property])for(const item of new Set([value,...options[property]])){const option=document.createElement('option');option.value=item;option.textContent=item;input.append(option);}
   else input.type='text';
   if(property==='font-family'){input.placeholder='Inter, sans-serif';input.title='Use a font loaded by this page or installed on your computer.';}
   if(property==='text-align')input.dataset.textDirection=css.direction;
   if(property==='font-weight'){input.placeholder='400';input.inputMode='decimal';}
   input.value=value;input.oninput=()=>input.setCustomValidity('');
   if(property==='border-width'&&new Set(['top','right','bottom','left'].map(side=>css.getPropertyValue('border-'+side+'-width'))).size>1){input.value='';input.placeholder='Mixed';}
   if(property==='border-style'&&new Set(['top','right','bottom','left'].map(side=>css.getPropertyValue('border-'+side+'-style'))).size>1){const mixed=document.createElement('option');mixed.value='';mixed.textContent='Mixed';mixed.disabled=true;input.prepend(mixed);input.value='';for(const option of [...input.options])if(/\s/.test(option.value))option.remove();}
   input.onchange=()=>{if(rangeGuarded&&!spacingActive())return;const value=input.value.trim();if(!CSS.supports(property,value)||!valid(property,value)){input.setCustomValidity('Use simple CSS lengths with units, keywords, or colors. Spacing accepts up to four values; gap accepts two.');input.reportValidity();return;}if(/^border(?:-(?:top|right|bottom|left))?-width$/.test(property)){
     const changes={[property]:value},sides=['top','right','bottom','left'],[a,b=a,c=a,d=b]=value.split(/\s+/),widths=[a,b,c,d];
     for(const [i,side]of sides.entries())if((property==='border-width'||property==='border-'+side+'-width')&&parseFloat(property==='border-width'?widths[i]:value)>0&&css.getPropertyValue('border-'+side+'-style')==='none')changes['border-'+side+'-style']='solid';
     save(changes,null,width);
    }else save(property,value,width);};
   const target=property.endsWith('radius')?corners:/^(font-|line-height|letter-spacing|text-)/.test(property)||property==='color'?typography:sec;
   if(['line-height','letter-spacing'].includes(property)){
    const percent=effectiveSpacingPercent(info,el,width,property);
    if(percent!==null)input.retouchSpacingPercent=percent;
   }
   I.field(target,label+' (CSS)',input);if(spacing)I.fieldDraft(input);if(rangeGuarded){input.disabled=!spacingActive()||coreTypography.includes(property)&&!typographyReady([el],width,property);if(input.disabled)input.title=typographyHint([el],width);}
   if(['width','height'].includes(property))input.retouchDimension={target:el,axis:property,box:'css'};
   if(input.tagName==='INPUT'&&/^(?:font-size|font-weight|line-height|letter-spacing|text-indent|(?:min-|max-)?(?:width|height)|gap|(?:padding|margin)(?:-(?:top|right|bottom|left))?|border(?:-(?:top|right|bottom|left))?-width|border-(?:(?:top|bottom)-(?:left|right)-)?radius)$/.test(property)){
    let unit='';I.numericLabelDrag(input,raw=>{if(property==='gap'&&raw.trim()==='normal'){unit='px';return {value:0,min:0,max:100000,format:value=>value+'px'};}const match=/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(px|em|rem|%|ex|ch|vw|vh|vmin|vmax|pt|pc|in|cm|mm)?$/i.exec(raw.trim());if(!match||!CSS.supports(property,raw)||!valid(property,raw)||!match[2]&&!['font-weight','line-height'].includes(property))return null;unit=match[2]||'';return {value:Number(match[1]),format:value=>value+unit,min:property==='font-weight'?1:['letter-spacing','text-indent'].includes(property)||/^margin(?:-|$)/.test(property)?-100000:0,max:property==='font-weight'?1000:100000};});
    if(spacing)input.retouchNumericPreview=()=>{const preview=RetouchPaintPicker.propertyPreview({el,input,property,respectScope:true}),writingMode=el.ownerDocument.defaultView.getComputedStyle(el).writingMode;return {current:()=>spacingActive()&&el.ownerDocument.defaultView.getComputedStyle(el).writingMode===writingMode&&preview.current(),update:value=>preview.update(value+unit),restore:()=>preview.restore()};};else I.numericPreview(input,el,property,value=>value+unit);
   }

   if(property==='background-color')RetouchBackgroundPaintUI.bind(info,el,input,changes=>save(changes,null,width),()=>RetouchBackgroundPaintUI.sourceState(info,width?'min-['+width+'px]:':''));
   if(['color','background-color','border-color'].includes(property)){I.fieldDraft(input);input.dataset.paintProperty=property;RetouchBackgroundPaintUI.bindSource(input,info,width?'min-['+width+'px]:':'',property,el);input.retouchPaintPreview??=()=>RetouchPaintPicker.propertyPreview({el,input,property});}
   if(property==='line-height'){const automatic=I.button('Automatic line height',()=>save(property,'normal',width));automatic.disabled=!typographyReady([el],width,property);target.append(automatic);}
   const reset=I.button('Reset '+label.toLowerCase(),()=>{if(!rangeGuarded||spacingActive())save(property,null,width);});reset.disabled=rangeGuarded&&!spacingActive()||!Object.hasOwn(own,property);target.append(reset);
  }
  I.note(sec,'Values use CSS units. Reset removes this size’s override and restores the page’s styling.');
  const container=document.createElement('div'),textLayer=I.isTextLayer(info.tag);
  container.append(RetouchSiteVariables.mount(el,width,save,own,null,[inheritedVariables(info,width)]));
  if(textLayer)container.append(typography);
  if(position)container.append(position);
  if(paint)container.append(paint);if(info.structure?.canInsert||flowControl||el.namespaceURI==='http://www.w3.org/1999/xhtml')container.append(layout);
  container.append(appearance,corners,fills,blur,effects);if(isFlexItem)container.append(flex);if(gridFields.length)container.append(grid);
  if(!textLayer)container.append(typography);container.append(sec);return container;
 }
 const sharedDetailsOpen=new Set();
 function mountSelection(infos,elements,width,save){
  const section=I.section('Shared styles');
  if(!Number.isInteger(width)||elements.some(el=>!el)||infos.some(info=>info.cssReason)){I.note(section,'Re-select the layers and choose a pixel screen scope.','refused');return section;}
  save=typographySave(save,infos,elements,width);
  I.note(section,'Shift-click a range in Layers; Cmd/Ctrl-click toggles layers. On the canvas, Shift-click toggles. Mixed values stay unchanged until edited. Each shared edit is one undo step.');
  section.append(RetouchSiteVariables.mount(elements,width,save,infos.map(info=>info.cssRules?.[width]||{}),changes=>save(null,null,width,Object.fromEntries(infos.map((info,index)=>[info.id,changes[index]]))),infos.map(info=>inheritedVariables(info,width))));
  const computed=elements.map(el=>el.ownerDocument.defaultView.getComputedStyle(el));
  const displays=infos.map((info,i)=>info.cssRules?.[width]?.display??computed[i].display),hasFlex=displays.some(value=>/^(inline-)?flex$/.test(value)),hasGrid=displays.some(value=>/^(inline-)?grid$/.test(value));
  const groups=RetouchReactSelection.sharedGroups(section,elements),typography=groups.typography,disclosures=new Map(),rows=new Map();
  const details=(parent,key,title)=>{if(disclosures.has(key))return disclosures.get(key);const group=document.createElement('details'),summary=document.createElement('summary');group.className='inspector-disclosure';group.setAttribute('aria-label','Shared '+title.toLowerCase());group.open=sharedDetailsOpen.has(key);summary.textContent=title;group.append(summary);group.ontoggle=()=>{if(group.isConnected){if(group.open)sharedDetailsOpen.add(key);else sharedDetailsOpen.delete(key);}};parent.append(group);disclosures.set(key,group);return group;};
  const adaptiveMinimums=infos.map(info=>parseAdaptiveColumns(info.cssRules?.[width]?.['grid-template-columns']??Object.entries(info.cssRules||{}).filter(([scope])=>Number(scope)<=elements[0].ownerDocument.defaultView.innerWidth).sort(([a],[b])=>Number(a)-Number(b)).reduce((value,[,rules])=>rules['grid-template-columns']??value,'')));
  const stackPresets=document.createElement('div');stackPresets.className='layout-mode-segments shared-layout-presets';groups.layout.append(stackPresets);
  for(const [axis,label,path]of [['flow','Shared Normal flow','M3 3h5v5H3z M12 3h5v5h-5z M3 12h5v5H3z M12 12h5v5h-5z'],['vertical','Shared Vertical stack','M4 3h12v4H4z M4 12h12v4H4z'],['horizontal','Shared Horizontal stack','M3 4h4v12H3z M12 4h4v12h-4z'],['grid','Shared Adaptive grid','M3 3h14v14H3z M3 10h14 M10 3v14']]){
   const button=I.button('',()=>{try{const changes=Object.fromEntries(infos.map((info,i)=>{const el=elements[i];if(!el?.isConnected||width>el.ownerDocument.defaultView.innerWidth)throw Error('Preview the selected edit range before arranging these layers.');return [info.id,axis==='flow'?{display:'block'}:axis==='grid'?{display:'grid','grid-template-columns':adaptiveColumns(adaptiveMinimums[i]||240),'grid-template-rows':'none'}:stackLayout(axis,el.ownerDocument.defaultView.getComputedStyle(el).writingMode)];}));save(null,null,width,changes);}catch(error){I.note(groups.layout,error.message,'refused');}});
   button.setAttribute('aria-label',label);button.disabled=width>elements[0].ownerDocument.defaultView.innerWidth;button.title=button.disabled?'Preview the selected edit range before arranging these layers.':label.replace('Shared ','');button.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="'+path+'"/></svg>';button.setAttribute('aria-pressed',String(computed.every((css,i)=>axis==='grid'?['grid','inline-grid'].includes(css.display)&&adaptiveMinimums[i]!==null:axis==='flow'?['block','inline','inline-block','flow-root','list-item'].includes(css.display):Object.entries(stackLayout(axis,css.writingMode)).every(([property,value])=>css.getPropertyValue(property)===value))));stackPresets.append(button);
  }
  window.RetouchInspectorUI?.keyboardToolbar(stackPresets,'Shared layout mode buttons');
  if(computed.every((css,i)=>['grid','inline-grid'].includes(css.display)&&adaptiveMinimums[i]!==null)){
   const mixed=adaptiveMinimums.some(value=>value!==adaptiveMinimums[0]),minimum=I.number(groups.layout,'Shared Minimum column size (px)',mixed?NaN:adaptiveMinimums[0],1,2000,value=>{const columns=adaptiveColumns(value);if(!columns||elements.some(el=>!el.isConnected||width>el.ownerDocument.defaultView.innerWidth||!['grid','inline-grid'].includes(el.ownerDocument.defaultView.getComputedStyle(el).display)))return;save(null,null,width,Object.fromEntries(infos.map(info=>[info.id,{'grid-template-columns':columns}])));});minimum.disabled=width>elements[0].ownerDocument.defaultView.innerWidth;minimum.placeholder=mixed?'Mixed':'';minimum.closest('.inspector-field').querySelector(':scope > span').textContent='Min column';minimum.title='Columns fit the available space automatically and shrink below this minimum on narrow screens.';I.fieldDraft(minimum);
  }

  I.sharedTypographyPreview(typography,elements);
  I.sharedTextResizing(groups.layout,()=>elements,()=>elements.every(el=>el.isConnected&&width<=el.ownerDocument.defaultView.innerWidth),changes=>save(null,null,width,Object.fromEntries(infos.map((info,index)=>[info.id,changes[index]]))));
  if(elements.every(el=>el.namespaceURI==='http://www.w3.org/1999/xhtml')){
   const values=computed.map(css=>css.aspectRatio),mixed=values.some(value=>value!==values[0]),ratio=document.createElement('input');ratio.type='text';ratio.value=mixed?'':values[0];ratio.placeholder=mixed?'Mixed':'auto, 1 / 1, 16 / 9';
   const ready=()=>elements.every(el=>el.isConnected&&width<=el.ownerDocument.defaultView.innerWidth),available=()=>ready()&&elements.every(el=>!['inline','contents','none'].includes(el.ownerDocument.defaultView.getComputedStyle(el).display)&&['aspect-ratio','height'].every(key=>el.style.getPropertyPriority(key)!=='important'));
   ratio.disabled=!available();ratio.title='Set a shared ratio and make height automatic. Auto follows page layout.';
   ratio.oninput=()=>ratio.setCustomValidity('');ratio.onchange=async()=>{
    if(!available())return;const value=ratio.value.trim().replace(/\s*[:/]\s*/g,' / ');if(!valid('aspect-ratio',value)||!CSS.supports('aspect-ratio',value)){ratio.setCustomValidity('Use auto or a positive ratio such as 16 / 9.');ratio.reportValidity();return;}
    try{window.RetouchPanelFocus?.queue(ratio);await save(null,null,width,Object.fromEntries(infos.map(info=>[info.id,value==='auto'?{'aspect-ratio':value}:{'aspect-ratio':value,height:'auto'}])));}catch(error){ratio.setCustomValidity(error.message);ratio.reportValidity();}
   };
   ratio.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();ratio.blur();}else if(event.key==='Escape'){event.preventDefault();ratio.value=mixed?'':values[0];ratio.setCustomValidity('');ratio.blur();}};
   I.field(groups.layout,'Shared Aspect ratio',ratio);const field=ratio.closest('.inspector-field'),reset=I.button('↺',()=>{if(ready())save('aspect-ratio',null,width);});reset.setAttribute('aria-label','Reset shared aspect ratio');reset.title='Reset shared aspect ratio';reset.classList.add('property-reset');reset.disabled=!ready()||infos.every(info=>!Object.hasOwn(info.cssRules?.[width]||{},'aspect-ratio'));const row=document.createElement('div');row.className='property-row';field.before(row);row.append(field,reset);field.querySelector(':scope > span').textContent='Aspect ratio';
  }

  I.sharedTruncationTypography(typography,()=>elements,()=>elements.every(el=>el.isConnected&&width<=el.ownerDocument.defaultView.innerWidth),value=>save('line-clamp',value===null?null:String(value),width),infos.some(info=>Object.hasOwn(info.cssRules?.[width]||{},'line-clamp')));
  I.sharedVerticalAlignment(typography,()=>elements,(layouts,reset)=>elements.every((el,index)=>el.isConnected&&width<=el.ownerDocument.defaultView.innerWidth&&(reset||!RetouchLayout.inlineAlignment(el,layouts[index].property,true))),changes=>save(null,null,width,Object.fromEntries(infos.map((info,index)=>[info.id,{[changes[index].property]:changes[index].value}]))),(index,property)=>Object.hasOwn(infos[index].cssRules?.[width]||{},property));

  const families=computed.map(css=>css.fontFamily),mixedFamilies=families.some(value=>value!==families[0]);
  I.fontPicker(typography,elements[0].ownerDocument,mixedFamilies?'':families[0],value=>save('font-family',value,width),{mixed:mixedFamilies,label:'Shared Page font',disabled:!typographyReady(elements,width,'font-family')});
  typography.querySelector('[aria-label="Shared Page font"]').closest('.inspector-field').querySelector(':scope > span').textContent='Font';
  if(!typographyReady(elements,width,'font-family'))typography.querySelector('[aria-label="Shared Page font"]').title=typographyHint(elements,width);
  const typeRangeReady=property=>elements.every(el=>el.isConnected&&width<=el.ownerDocument.defaultView.innerWidth&&el.style.getPropertyPriority(property)!=='important');
  for(const [property,label,min,max]of [['line-height','Shared Line height (%)',0,1000],['letter-spacing','Shared Letter spacing (%)',-100,1000]]){
   const values=computed.map(css=>{const size=parseFloat(css.fontSize),raw=css.getPropertyValue(property);return raw==='normal'&&property==='line-height'?NaN:(parseFloat(raw)||0)/size*100;}),mixed=values.some(value=>!Number.isFinite(value)||Math.abs(value-values[0])>.0001);
   const input=I.relativeNumber(typography,label,mixed?NaN:values[0],min,max,value=>{if(typeRangeReady(property))save(property,String(Math.round(value*1e6)/1e8)+(property==='letter-spacing'?'em':''),width);});input.disabled=!typeRangeReady(property);
   if(mixed)input.placeholder='Mixed';input.closest('.inspector-field').querySelector(':scope > span').textContent=property==='line-height'?'Line height %':'Spacing %';input.title='Relative to each selected layer’s own font size.';
  }
  const automaticLineHeight=I.button('Automatic shared line height',()=>{if(typeRangeReady('line-height'))save('line-height','normal',width);});automaticLineHeight.disabled=!typeRangeReady('line-height');typography.append(automaticLineHeight);
  I.note(details(typography,'type-options','Typography options'),'Percentages follow each layer’s font size. Use the CSS fields below for fixed spacing.');
  {const property='font-variation-settings';I.sharedVariationTypography(typography,()=>elements,reset=>typographyReady(elements,width,property,reset),values=>save(null,null,width,Object.fromEntries(infos.map((info,i)=>[info.id,{[property]:values[i]}]))),()=>save(property,null,width),infos.some(info=>Object.hasOwn(info.cssRules?.[width]||{},property)));}
  for(const kind of ['numeric','ligature']){const property='font-variant-'+(kind==='numeric'?'numeric':'ligatures');I.sharedFeatureTypography(typography,kind,()=>elements,reset=>typographyReady(elements,width,property,reset),values=>save(null,null,width,Object.fromEntries(infos.map((info,i)=>[info.id,{[property]:values[i]}]))),()=>save(property,null,width),infos.some(info=>Object.hasOwn(info.cssRules?.[width]||{},property)));}
  const sharedFields=[['visibility','Visibility'],['opacity','Opacity (%)'],['rotate','Rotation (°)'],['mix-blend-mode','Blend mode'],['isolation','Blend group'],...fields,['text-wrap','Wrap style'],['text-box','Vertical trim'],['font-optical-sizing','Optical sizing'],['font-variant-caps','Capital forms'],['font-variant-position','Number position'],...[['text-decoration-style','Underline style'],['text-decoration-thickness','Underline thickness'],['text-underline-offset','Underline offset'],['text-decoration-skip-ink','Underline skip ink'],['text-decoration-color','Underline color']],...(hasGrid?[['justify-items','Align columns']]:[]),...(elements.every(el=>el.namespaceURI==='http://www.w3.org/2000/svg')?svgFields:[])];
  for(const [property,label]of sharedFields){
   if(property==='text-box'&&!elements.every(el=>el.ownerDocument.defaultView.CSS.supports('text-box','trim-both cap alphabetic')))continue;
   let target=/^(?:min-|max-)?(?:width|height)$/.test(property)?groups.size:/^margin/.test(property)?groups.item:/^(?:font-|text-|line-height|letter-spacing|color$)/.test(property)?groups.typography:['background-color','fill'].includes(property)?groups.fill:/^border.*radius$/.test(property)||['visibility','opacity','rotate','mix-blend-mode','isolation'].includes(property)?groups.appearance:/^border|^stroke/.test(property)||property==='vector-effect'?groups.stroke:groups.layout;
   if(/^(?:min-|max-)/.test(property))target=details(groups.size,'size-limits','Size limits');
   else if(/^padding-/.test(property))target=details(groups.layout,'padding','Individual padding');
   else if(/^margin-/.test(property))target=details(groups.item,'margin','Individual margins');
   else if(/^border-(?:top|right|bottom|left)-(?:width|style)$/.test(property))target=details(groups.stroke,'borders','Individual borders');
   else if(/^border-.+-radius$/.test(property))target=details(groups.appearance,'corners','Individual corners');
   else if(['font-family','line-height','letter-spacing','text-indent'].includes(property))target=details(groups.typography,'type-options','Typography options');
   else if(['display','flex-direction','flex-wrap'].includes(property)||!hasFlex&&!hasGrid&&['align-items','align-content','justify-content','gap'].includes(property))target=details(groups.layout,'layout-options','Layout options');

   const values=infos.map((info,i)=>{const raw=info.cssRules?.[width]?.[property]??computed[i].getPropertyValue(property);return property==='rotate'?String(RetouchReactSelection.rotationDegrees(raw)):raw;}),mixed=values.some(value=>value!==values[0]),numeric=['opacity','rotate'].includes(property);
   const spacing=/^(?:gap|padding(?:-(?:top|right|bottom|left))?)$/.test(property),rangeGuarded=coreTypography.includes(property)||spacing||/^(?:min-|max-)?(?:width|height)$/.test(property)||['display','flex-direction','flex-wrap','align-items','align-content','justify-content','justify-items','grid-auto-flow'].includes(property),spacingActive=()=>elements.every(el=>el.isConnected&&width<=el.ownerDocument.defaultView.innerWidth);
   const input=document.createElement(options[property]?'select':'input');
   if(options[property]){if(mixed){const option=document.createElement('option');option.value='';option.textContent='Mixed';option.disabled=true;input.append(option);}for(const value of new Set([...values,...(property==='text-wrap'?['wrap','balance','pretty','nowrap'].filter(value=>CSS.supports(property,value)):options[property])])){const option=document.createElement('option');option.value=value;option.textContent=property==='text-box'?({normal:'None','trim-both cap alphabetic':'Cap height'})[value]||value:property==='font-optical-sizing'?({auto:'Automatic',none:'Off'})[value]||value:property==='text-wrap'?({wrap:'Auto',balance:'Balance',pretty:'Pretty',nowrap:'No wrap'})[value]||value:property==='font-variant-position'?({normal:'Normal',super:'Superscript',sub:'Subscript'})[value]||value:property==='font-variant-caps'?value[0].toUpperCase()+value.slice(1).replace(/-/g,' '):value;input.append(option);}}
   else {input.type=numeric?'number':'text';input.placeholder=mixed?'Mixed':'';if(numeric){input.min=property==='opacity'?0:-360;input.max=property==='opacity'?100:360;input.step='any';}}
   input.value=mixed?'':property==='opacity'?Number(values[0])*100:property==='rotate'?(values[0]==='none'?0:parseFloat(values[0])):values[0];
   input.oninput=()=>input.setCustomValidity('');input.onchange=()=>{if(rangeGuarded&&!spacingActive()||!input.value.trim()||!input.checkValidity())return;const value=property==='opacity'?String(Number(input.value)/100):property==='rotate'?input.value+'deg':input.value.trim();if(!valid(property,value)||!CSS.supports(property,value)){input.setCustomValidity('Enter a supported CSS value.');input.reportValidity();return;}save(property,value,width);};
   I.field(target,'Shared '+label,input);if(property==='text-align')input.retouchTextAlignments=()=>elements.map(el=>{const css=el.ownerDocument.defaultView.getComputedStyle(el);return ({start:css.direction==='rtl'?'right':'left',end:css.direction==='rtl'?'left':'right'})[css.textAlign]||css.textAlign;});if(svgFields.some(([key])=>key===property)&&!['fill','stroke'].includes(property)){input.dataset.svgStroke=property;I.fieldDraft(input);if(property==='stroke-dasharray'){input.retouchPreviewDocument=elements[0].ownerDocument;input.retouchHasScopedValues=()=>infos.every(info=>info.cssRules?.[width]?.[property]!=null);input.retouchDashValues=()=>elements.map((el,i)=>infos[i].cssRules?.[width]?.[property]??el.ownerDocument.defaultView.getComputedStyle(el).strokeDasharray);input.retouchSetDashValues=values=>save(null,null,width,Object.fromEntries(infos.map((info,i)=>[info.id,{[property]:values[i]}])));}}const field=input.closest('.inspector-field');field.querySelector(':scope > span').textContent=({'font-size':'Size','font-weight':'Weight','font-style':'Style','text-decoration-line':'Decoration','text-transform':'Case','text-align':'Alignment','background-color':'Color','border-color':'Color','border-width':'Width','border-style':'Style','border-radius':'Radius','mix-blend-mode':'Blend mode','isolation':'Blend group','opacity':'Opacity','rotate':'Rotation'})[property]||label;field.title='Shared '+label;
   if(['font-size','line-height','letter-spacing'].includes(property)){
    const relative=['line-height','letter-spacing'].includes(property),percentages=relative?infos.map((info,i)=>effectiveSpacingPercent(info,elements[i],width,property)):[],percentDisplay=relative&&percentages.every(value=>value!==null),mixedPercent=percentDisplay&&percentages.some(value=>Math.abs(value-percentages[0])>=.0001),ready=()=>spacingActive()&&elements.every(el=>el.style.getPropertyPriority(property)!=='important');
    if(percentDisplay)input.value=mixedPercent?'':RetouchNumericExpression.decimal(percentages[0])+'%';if(mixedPercent){input.placeholder='Mixed';input.retouchNumericInitialValue=()=>input.value===''?String(percentages[0])+'%':input.value;}
    const initial=input.value,relativeValue=value=>String(Math.round(value*1e6)/1e8)+(property==='letter-spacing'?'em':'');
    if(relative){
     input.disabled=!ready();
     input.addEventListener('change',event=>{
      if(input.disabled||!ready()){event.stopImmediatePropagation();return;}if(input.value===initial)return;
      try{const quantity=RetouchNumericExpression.quantity(input.value,percentDisplay?'%':property==='line-height'?'':'px');if(quantity?.unit!=='%')return;event.stopImmediatePropagation();const min=property==='line-height'?0:-100;if(quantity.value<min||quantity.value>1000)throw Error('Enter a percentage from '+min+' to 1000.');if(!ready())return;input.setCustomValidity('');save(property,relativeValue(quantity.value),width);}catch(error){event.stopImmediatePropagation();input.setCustomValidity(error.message);input.reportValidity();}
     },true);
    }
    RetouchNumericExpression.calculation(input,{unit:percentDisplay?'%':property==='line-height'?'':'px'});I.fieldDraft(input);
    if(relative){
     input.title+=' Use px or %; percentages follow each selected layer’s font size.';
     const pixelValues=!percentDisplay?elements.map(el=>{const css=el.ownerDocument.defaultView.getComputedStyle(el);return property==='letter-spacing'&&css.letterSpacing==='normal'?0:parseFloat(css.getPropertyValue(property));}):[],mixedPixels=!percentDisplay&&input.value===''&&pixelValues.every(Number.isFinite);
     if(mixedPixels)input.retouchNumericInitialValue=()=>input.value===''?String(pixelValues[0])+'px':input.value;
     let unit=percentDisplay?'%':mixedPixels?'px':property==='line-height'?'':'px';
     I.numericLabelDrag(input,raw=>{try{const quantity=RetouchNumericExpression.quantity(raw,unit);if(!quantity)return null;unit=quantity.unit;const css=unit==='%'?relativeValue(quantity.value):RetouchNumericExpression.decimal(quantity.value)+unit;if(!valid(property,css)||!CSS.supports(property,css))return null;return {value:quantity.value,min:(property==='line-height'?0:unit==='%'?-100:-100000)+(input.value===''?(mixedPercent?percentages[0]-Math.min(...percentages):mixedPixels?pixelValues[0]-Math.min(...pixelValues):0):0),max:(unit==='%'?1000:100000)+(input.value===''?(mixedPercent?percentages[0]-Math.max(...percentages):mixedPixels?pixelValues[0]-Math.max(...pixelValues):0):0),format:value=>RetouchNumericExpression.decimal(value)+unit};}catch{return null;}});
     if(mixedPixels)input.parentElement.querySelector('span').title='Drag to change each selected spacing by the same number of pixels. Escape cancels.';
     if(mixedPercent)input.parentElement.querySelector('span').title='Drag to change each selected spacing by the same number of percentage points. Escape cancels.';
     input.retouchNumericPreview=()=>{const relativeSizes=mixedPercent&&input.value===''?percentages:null,pixelSizes=mixedPixels&&input.value===''?pixelValues:null,previews=elements.map(el=>RetouchPaintPicker.propertyPreview({el,input,property,respectScope:true}));return {current:()=>spacingActive()&&previews.every(preview=>preview.current()),update:value=>previews.forEach((preview,i)=>preview.update(unit==='%'?relativeValue(relativeSizes?relativeSizes[i]+value-relativeSizes[0]:value):RetouchNumericExpression.decimal(pixelSizes?pixelSizes[i]+value-pixelSizes[0]:value)+unit)),...(pixelSizes?{commit:value=>{if(value===pixelSizes[0]){input.value='';return;}if(ready())save(null,null,width,Object.fromEntries(infos.map((info,i)=>[info.id,{[property]:RetouchNumericExpression.decimal(pixelSizes[i]+value-pixelSizes[0])+'px'}])));}}:{}),...(relativeSizes?{commit:value=>{if(value===relativeSizes[0]){input.value='';return;}if(ready())save(null,null,width,Object.fromEntries(infos.map((info,i)=>[info.id,{[property]:relativeValue(relativeSizes[i]+value-relativeSizes[0])}])));}}:{}),restore:()=>previews.forEach(preview=>preview.restore())};};
    }
   }
   if(rangeGuarded){input.disabled=!spacingActive()||coreTypography.includes(property)&&!typographyReady(elements,width,property);if(input.disabled)input.title=typographyHint(elements,width);}
   if(spacing){
    I.fieldDraft(input);input.disabled=!spacingActive();
    if(input.disabled)input.title='Switch to a screen inside the selected edit range.';
    const parse=raw=>{if(property==='gap'&&raw.trim()==='normal')return {value:0,min:0,max:100000,format:value=>value+'px'};const match=/^(\d+(?:\.\d*)?|\.\d+)(px|em|rem|%|ex|ch|vw|vh|vmin|vmax|pt|pc|in|cm|mm)$/i.exec(raw.trim());return match&&CSS.supports(property,raw)&&valid(property,raw)?{value:Number(match[1]),min:0,max:100000,format:value=>value+match[2]}:null;};
    I.numericLabelDrag(input,parse);input.retouchNumericPreview=()=>{const parsed=parse(input.value),previews=elements.map(el=>RetouchPaintPicker.propertyPreview({el,input,property,respectScope:true})),writingModes=elements.map(el=>el.ownerDocument.defaultView.getComputedStyle(el).writingMode);return {current:()=>spacingActive()&&elements.every((el,i)=>el.ownerDocument.defaultView.getComputedStyle(el).writingMode===writingModes[i])&&previews.every(preview=>preview.current()),update:value=>previews.forEach(preview=>preview.update(parsed.format(value))),restore:()=>previews.forEach(preview=>preview.restore())};};
   }
   if(['text-decoration-thickness','text-underline-offset','text-indent'].includes(property))I.sharedLengthDrag(input,()=>elements,property,()=>spacingActive()&&elements.every(el=>el.style.getPropertyPriority(property)!=='important'),values=>save(null,null,width,Object.fromEntries(infos.map((info,i)=>[info.id,{[property]:values[i]}]))));
   if(property==='font-size'){
    const sizes=()=>elements.map(el=>parseFloat(el.ownerDocument.defaultView.getComputedStyle(el).fontSize)),ready=()=>spacingActive()&&elements.every(el=>el.style.getPropertyPriority('font-size')!=='important');
    input.retouchNumericInitialValue=()=>ready()?sizes()[0]:'';
    I.numericLabelDrag(input,()=>{const initial=sizes(),base=initial[0];return {value:base,min:base-Math.min(...initial),max:base+2000-Math.max(...initial),format:value=>value+'px'};});
    input.parentElement.querySelector('span').title='Drag to change each selected font size by the same amount. Escape cancels.';
    input.retouchNumericPreview=()=>{
     const initial=sizes(),previews=elements.map(el=>RetouchPaintPicker.propertyPreview({el,input,property,respectScope:true}));
     return {current:()=>spacingActive()&&previews.every(preview=>preview.current()),update:value=>previews.forEach((preview,i)=>preview.update((initial[i]+value-initial[0])+'px')),restore:()=>previews.forEach(preview=>preview.restore()),commit:value=>{if(value===initial[0]){input.value=mixed?'':values[0];return;}if(ready())save(null,null,width,Object.fromEntries(infos.map((info,i)=>[info.id,{[property]:(initial[i]+value-initial[0])+'px'}])));}};
    };
   }
   if(['width','height'].includes(property)){
    const measurable=()=>spacingActive()&&elements.every(el=>{const css=el.ownerDocument.defaultView.getComputedStyle(el);return !['inline','contents','none'].includes(css.display)&&Number.isFinite(RetouchReactSelection.dimensionSize(css,property))&&!['width','height','inline-size','block-size','flex','flex-grow','flex-shrink','flex-basis'].some(key=>el.style.getPropertyPriority(key)==='important');});
    const sizes=()=>elements.map(el=>RetouchReactSelection.dimensionSize(el.ownerDocument.defaultView.getComputedStyle(el),property));
    input.retouchNumericInitialValue=()=>measurable()?sizes()[0]:'';
    I.numericLabelDrag(input,()=>{const initial=sizes(),base=initial[0],floors=elements.map(el=>{const css=el.ownerDocument.defaultView.getComputedStyle(el);return (property==='width'?['left','right']:['top','bottom']).reduce((sum,edge)=>sum+(parseFloat(css.getPropertyValue('padding-'+edge))||0)+(parseFloat(css.getPropertyValue('border-'+edge+'-width'))||0),0);});return {value:base,min:base+Math.max(...initial.map((size,i)=>floors[i]-size)),max:base+100000-Math.max(...initial),format:value=>value+'px'};});
    input.parentElement.querySelector('span').title='Drag to change each selected size by the same amount. Escape cancels.';
    input.retouchNumericPreview=()=>{
     const initial=sizes(),originalStyles=elements.map(el=>el.getAttribute('style')),expectedStyles=[...originalStyles],previews=elements.map(el=>Object.keys(RetouchFlowResize.changes(el,{[property]:initial[0]})).sort((a,b)=>(a===property)-(b===property)).map(key=>({key,preview:RetouchPaintPicker.propertyPreview({el,input,property:key,respectScope:true})}))),changes=value=>elements.map((el,i)=>RetouchFlowResize.changes(el,{[property]:initial[i]+value-initial[0]}));
     return {current:()=>spacingActive()&&previews.flat().every(({preview})=>preview.current()),update:value=>{const next=changes(value);previews.forEach((list,i)=>{list.forEach(({key,preview})=>preview.update(next[i][key]));expectedStyles[i]=elements[i].getAttribute('style');});},restore:()=>previews.forEach((list,i)=>{const owned=elements[i].getAttribute('style')===expectedStyles[i]&&list.every(({preview})=>preview.current());list.slice().reverse().forEach(({preview})=>preview.restore());if(owned){elements[i].setAttribute('style',originalStyles[i]||'');if(originalStyles[i]===null)elements[i].removeAttribute('style');}}),commit:value=>{if(value===initial[0]){input.value=mixed?'':values[0];return;}if(!measurable())return;const next=changes(value);save(null,null,width,Object.fromEntries(infos.map((info,i)=>[info.id,next[i]])));}};
    };
   }
   if(numeric){
    I.fieldDraft(input);I.numericLabelDrag(input);
    input.retouchNumericPreview=()=>{const previews=elements.map(el=>RetouchPaintPicker.propertyPreview({el,input,property,respectScope:true}));return {current:()=>elements.every(el=>el.isConnected),update:value=>previews.forEach(preview=>preview.update(property==='rotate'?value+'deg':String(value/100))),restore:()=>previews.forEach(preview=>preview.restore())};};
    if(elements.some(el=>property==='rotate'?el.style.getPropertyPriority(property)==='important':el.style.getPropertyValue(property))||property==='rotate'&&values.some(value=>!Number.isFinite(Number(value)))){input.disabled=true;input.title='Edit the selected layer’s inline or 3D property in its source first.';}
   }
   if(property==='text-decoration-color')RetouchPaintPicker.mountSelectionField(input,elements,property,undefined,values=>save(null,null,width,Object.fromEntries(infos.map((info,i)=>[info.id,{[property]:values[i]}]))));
   if(['color','background-color','border-color','fill','stroke'].includes(property))RetouchPaintPicker.mountSelectionField(input,elements,property,changes=>save(null,null,width,Object.fromEntries(infos.map((info,i)=>[info.id,changes[i]]))),values=>save(null,null,width,Object.fromEntries(infos.map((info,i)=>[info.id,{[property]:values[i]}]))),i=>RetouchBackgroundPaintUI.sourceColor(infos[i],width?'min-['+width+'px]:':'',property),i=>RetouchBackgroundPaintUI.sourceState(infos[i],width?'min-['+width+'px]:':''));
   const reset=I.button('Reset shared '+label.toLowerCase(),()=>{if(!rangeGuarded||spacingActive())save(property,null,width);});reset.disabled=rangeGuarded&&!spacingActive()||infos.every(info=>!Object.hasOwn(info.cssRules?.[width]||{},property));reset.setAttribute('aria-label','Reset shared '+label.toLowerCase());reset.title=reset.getAttribute('aria-label');reset.textContent='↺';reset.classList.add('property-reset');const row=document.createElement('div');row.className='property-row';field.before(row);row.append(field,reset);rows.set(property,row);
  }
  if(computed.every(css=>['flex','inline-flex','grid','inline-grid'].includes(css.display))){
   const picker=document.createElement('div');picker.className='layout-alignment';picker.setAttribute('role','group');picker.setAttribute('aria-label','Shared child alignment');
   const alignmentRow=document.createElement('div'),gap=document.createElement('div');alignmentRow.className='layout-alignment-spacing';gap.className='property-pair';gap.append(rows.get('gap'));alignmentRow.append(picker,gap);stackPresets.after(alignmentRow);
   const advanced=details(groups.layout,'layout-options','Layout options');for(const property of ['align-items','align-content','justify-content','justify-items'])if(rows.has(property))advanced.append(rows.get(property));
   for(let y=0;y<3;y++)for(let x=0;x<3;x++){
    const label='Shared Align children '+['top','middle','bottom'][y]+' '+['left','center','right'][x],button=I.button('•',()=>{try{const changes=Object.fromEntries(infos.map((info,i)=>{const el=elements[i];if(!el?.isConnected)throw Error('Re-select the current containers.');if(width>el.ownerDocument.defaultView.innerWidth)throw Error('Preview the selected edit range before aligning children.');const css=el.ownerDocument.defaultView.getComputedStyle(el);if(!['flex','inline-flex','grid','inline-grid'].includes(css.display))throw Error('Select flex or grid containers to align their children.');return [info.id,childAlignment(x,y,css)];}));save(null,null,width,changes);}catch(error){I.note(groups.layout,error.message,'refused');}});
    button.setAttribute('aria-label',label);button.disabled=width>elements[0].ownerDocument.defaultView.innerWidth;button.title=button.disabled?'Preview the selected edit range before aligning children.':label;button.setAttribute('aria-pressed',String(computed.every(css=>Object.entries(childAlignment(x,y,css)).every(([property,value])=>css.getPropertyValue(property)===value))));picker.append(button);
   }
   const reset=I.button('Reset shared child alignment',()=>{if(elements.some(el=>!el.isConnected||width>el.ownerDocument.defaultView.innerWidth))return;save(null,null,width,Object.fromEntries(infos.map((info,i)=>[info.id,Object.fromEntries(alignmentProperties(computed[i]).map(property=>[property,null]))])));});reset.dataset.alignmentReset='true';reset.setAttribute('aria-label',reset.textContent);reset.title=reset.textContent;reset.textContent='↺';reset.classList.add('property-reset');reset.disabled=width>elements[0].ownerDocument.defaultView.innerWidth||infos.every((info,i)=>alignmentProperties(computed[i]).every(property=>!Object.hasOwn(info.cssRules?.[width]||{},property)));alignmentRow.append(reset);
  }
  for(const [a,b]of [['width','height'],['min-width','min-height'],['max-width','max-height']]){const first=rows.get(a),second=rows.get(b);if(!first||!second)continue;const pair=document.createElement('div');pair.className='property-pair';first.before(pair);pair.append(first,second);for(const [property,row]of [[a,first],[b,second]])row.querySelector('.inspector-field > span').textContent=property.replace('min-','Min ').replace('max-','Max ').replace('width','W').replace('height','H');}
  for(const property of ['filter','backdrop-filter'])for(const mount of ['mountSharedBlur','mountSharedFilters'])RetouchFilterStack[mount](groups.effects,infos,elements,width?'min-['+width+'px]:':'',property,values=>save(null,null,width,Object.fromEntries(infos.map((info,i)=>[info.id,values[i]===undefined?{}:values[i]]))));
  RetouchFilterStack.mountSharedShadows(groups.effects,infos,elements,width?'min-['+width+'px]:':'',values=>save(null,null,width,Object.fromEntries(infos.map((info,i)=>[info.id,values[i]===undefined?{}:values[i]]))));
  if(disclosures.has('layout-options'))groups.layout.append(disclosures.get('layout-options'));
  for(const body of Object.values(groups))if(!body.querySelector('.inspector-field'))body.parentElement.remove();
  return section;
 }
 window.RetouchHTMLCSS={mount,mountSelection};
})();
