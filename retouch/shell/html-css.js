(function(){
 const I=RetouchInspector;
 const openGridSections=new Set();
 const {options,fields,svgFields,adaptiveColumns,parseAdaptiveColumns,stackLayout,flexAlignment,valid,parseShadows,serializeShadows,parseFilters,withBlur,parseGradients,serializeGradients}=RetouchHTMLCSSValues;
 const stopRail=RetouchGradientStopRail;
 function inheritedVariables(info,width){return Object.entries(info.cssRules||{}).filter(([scope])=>Number(scope)<width).sort(([a],[b])=>Number(a)-Number(b)).reduce((all,[,rules])=>Object.assign(all,rules),{});}
 function mount(info,el,width,save,position=null,textStyleAction=null){
  const sec=I.section('CSS properties');
  if(info.cssReason||!el||!Number.isInteger(width)){I.note(sec,info.cssReason||'Choose a pixel screen scope.','refused');return sec;}
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
    if(['fill','stroke'].includes(property)){I.fieldDraft(input);input.dataset.paintProperty=property;input.retouchPaintPreview=()=>RetouchPaintPicker.propertyPreview({el,input,property});}
    const reset=I.button('Reset '+label.toLowerCase(),()=>save(property,null,width));reset.disabled=!Object.hasOwn(own,property);paint.append(reset);
   }
   I.note(paint,'Paint follows the selected screen scope. Use none for no fill or stroke. Stroke width and dashes accept SVG units, px or %. Reset reveals the inherited CSS or original attribute.');
  }
  const layout=I.section('Layout');
  if(info.structure?.canInsert){
   const stacks=document.createElement('div');stacks.className='stack-presets';
   for(const [axis,label]of [['horizontal','Horizontal stack'],['vertical','Vertical stack']]){const changes=stackLayout(axis,css.writingMode),button=I.button(label,()=>save(changes,null,width));button.setAttribute('aria-pressed',String(['flex','inline-flex'].includes(css.display)&&css.flexDirection===changes['flex-direction']&&css.flexWrap==='nowrap'));stacks.append(button);}layout.append(stacks);
   const inheritedColumns=Object.entries(info.cssRules||{}).filter(([size])=>Number(size)<=el.ownerDocument.defaultView.innerWidth).sort(([a],[b])=>Number(a)-Number(b)).reduce((value,[,rules])=>rules['grid-template-columns']??value,'');
   const adaptiveSize=parseAdaptiveColumns(own['grid-template-columns']??inheritedColumns),isAdaptive=['grid','inline-grid'].includes(css.display)&&adaptiveSize!==null;
   const adaptive=I.button('Adaptive grid',()=>save({display:'grid','grid-template-columns':adaptiveColumns(adaptiveSize||240),'grid-template-rows':'none'},null,width));adaptive.setAttribute('aria-pressed',String(isAdaptive));stacks.append(adaptive);
   if(isAdaptive){const minimum=document.createElement('input');minimum.type='number';minimum.min=1;minimum.max=2000;minimum.step=1;minimum.value=adaptiveSize;minimum.onchange=()=>{const value=adaptiveColumns(Number(minimum.value));if(value&&minimum.checkValidity())save('grid-template-columns',value,width);};I.field(layout,'Minimum column size (px)',minimum);I.note(layout,'Columns fit the available space automatically. Below this minimum, a single column shrinks to fit. Child sizes and spans can still affect the result.');}
   if(['flex','inline-flex'].includes(css.display)){
    const wrapping=document.createElement('select');for(const [value,label]of [['nowrap','Single line'],['wrap','Wrap to new lines'],['wrap-reverse','Wrap in reverse']]){const option=document.createElement('option');option.value=value;option.textContent=label;wrapping.append(option);}wrapping.value=css.flexWrap;wrapping.onchange=()=>save('flex-wrap',wrapping.value,width);I.field(layout,'Child wrapping',wrapping);
    const align=document.createElement('div');align.className='layout-alignment';align.setAttribute('role','group');align.setAttribute('aria-label','Align children');
    for(let y=0;y<3;y++)for(let x=0;x<3;x++){
     const label='Align children '+['top','middle','bottom'][y]+' '+['left','center','right'][x],changes=flexAlignment(x,y,css),button=I.button('•',()=>save(changes,null,width));button.setAttribute('aria-label',label);button.title=label;button.setAttribute('aria-pressed',String(css.justifyContent===changes['justify-content']&&css.alignItems===changes['align-items']&&(!changes['align-content']||css.alignContent===changes['align-content'])));align.append(button);
    }
    layout.append(align);
   }
   const ratio=document.createElement('input');ratio.type='text';ratio.value=own['aspect-ratio']??css.aspectRatio;ratio.placeholder='auto, 1 / 1, 16 / 9';ratio.oninput=()=>ratio.setCustomValidity('');ratio.onchange=()=>{const value=ratio.value.trim().replace(/\s*[:/]\s*/g,' / ');if(!valid('aspect-ratio',value)||!CSS.supports('aspect-ratio',value)){ratio.setCustomValidity('Use auto or a positive ratio such as 16 / 9.');ratio.reportValidity();return;}save(value==='auto'?{'aspect-ratio':'auto'}:{'aspect-ratio':value,height:'auto'},null,width);};I.field(layout,'Frame aspect ratio',ratio);
   const resetRatio=I.button('Reset aspect ratio',()=>save('aspect-ratio',null,width));resetRatio.disabled=!Object.hasOwn(own,'aspect-ratio');layout.append(resetRatio);
   I.note(layout,'Setting a ratio makes height automatic. Content and minimum sizes can still make the frame taller. Undo restores both settings.');
   const clipping=document.createElement('input');clipping.type='checkbox';clipping.checked=['hidden','clip'].includes(css.overflowX)&&['hidden','clip'].includes(css.overflowY);clipping.indeterminate=!clipping.checked&&!(css.overflowX==='visible'&&css.overflowY==='visible');clipping.onchange=()=>save({overflow:clipping.checked?'clip':'visible','overflow-x':null,'overflow-y':null},null,width);I.field(layout,'Clip content',clipping);
   const resetClipping=I.button('Reset clipping',()=>save({overflow:null,'overflow-x':null,'overflow-y':null},null,width));resetClipping.disabled=!['overflow','overflow-x','overflow-y'].some(p=>Object.hasOwn(own,p));layout.append(resetClipping);
   I.note(layout,'Arrange children at this screen size. Alignment uses the available space inside the container. Each action is one undo step.');
  }
  const corners=I.section('Corners'),appearance=I.section('Appearance'),typography=I.section('Typography');
  const inheritedWidth=Object.keys(info.textStyleLinks||{}).map(Number).filter(value=>value<width).sort((a,b)=>b-a)[0];
  const inheritedLink=!info.textStyleLinks?.[width]&&inheritedWidth!==undefined?{link:info.textStyleLinks[inheritedWidth],label:inheritedWidth===0?'All sizes':inheritedWidth+'px and larger'}:null;
  window.RetouchTextStyles?.mount(typography,el,textStyleAction?{inherited:inheritedLink,link:info.textStyleLinks?.[width],overrides:info.textStyleOverrides?.[width]||[],reset:(styleId,libraryRevision)=>textStyleAction('resetTextStyle',width,{styleId,libraryRevision}),apply:(styleId,libraryRevision)=>textStyleAction('applyTextStyle',width,{styleId,libraryRevision}),update:(styleId,libraryRevision,name,properties)=>textStyleAction('updateTextStyle',width,{styleId,libraryRevision,name,properties}),detach:()=>textStyleAction('detachTextStyle',width)}:{});
  I.fontPicker(typography,el.ownerDocument,css.fontFamily,value=>save('font-family',value,width));
  const relativeLineHeight=I.relativeNumber(typography,'Line height (%)',parseFloat(css.lineHeight)/parseFloat(css.fontSize)*100,0,1000,value=>save('line-height',String(Math.round(value*1e6)/1e8),width));relativeLineHeight.title='Relative to this layer’s font size.';if(css.lineHeight==='normal')relativeLineHeight.placeholder='Automatic';
  I.relativeNumber(typography,'Letter spacing (%)',(parseFloat(css.letterSpacing)||0)/parseFloat(css.fontSize)*100,-100,1000,value=>save('letter-spacing',`${Math.round(value*1e6)/1e8}em`,width)).title='Relative to this layer’s font size.';
  I.opticalTypography(typography,css,value=>save('font-optical-sizing',value,width),()=>save('font-optical-sizing',null,width),Object.hasOwn(own,'font-optical-sizing'));
  I.variationTypography(typography,css,value=>save('font-variation-settings',value,width),()=>save('font-variation-settings',null,width),Object.hasOwn(own,'font-variation-settings'),el);
  I.numericTypography(typography,css.fontVariantNumeric,value=>save('font-variant-numeric',value,width),()=>save('font-variant-numeric',null,width),Object.hasOwn(own,'font-variant-numeric'));
  const visible=document.createElement('input');visible.type='checkbox';visible.checked=(own.visibility??css.visibility)==='visible';visible.onchange=()=>save('visibility',visible.checked?'visible':'hidden',width);I.field(appearance,'Visible layer',visible);
  const resetVisibility=I.button('Reset visibility',()=>save('visibility',null,width));resetVisibility.disabled=!Object.hasOwn(own,'visibility');appearance.append(resetVisibility);I.note(appearance,'Hidden layers keep their layout space. Select them in Layers to show them again.');

  for(const [property,label,min,max,unit]of [['opacity','Opacity (%)',0,100,''],['rotate','Rotation (°)',-360,360,'deg']]){
   const raw=own[property]??css.getPropertyValue(property),input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step='any';
   const value=property==='opacity'?Number(raw)*100:raw==='none'?0:/^-?[\d.]+deg$/.test(raw)?parseFloat(raw):NaN;
   input.value=Number.isFinite(value)?value:'';input.placeholder=raw;
   input.onchange=()=>{if(input.value!==''&&input.checkValidity()){const value=property==='opacity'?String(Number(input.value)/100):input.value+unit;if(valid(property,value)&&CSS.supports(property,value))save(property,value,width);}};
   I.numericLabelDrag(I.field(appearance,label,input));I.numericPreview(input,el,property,value=>property==='opacity'?String(value/100):value+unit);
   const reset=I.button('Reset '+property,()=>save(property,null,width));reset.disabled=!Object.hasOwn(own,property);appearance.append(reset);
  }
  if(css.transform!=='none')I.note(appearance,'Rotation combines with the page’s existing transform.');
  for(const [property,label]of [['mix-blend-mode','Blend mode'],['isolation','Blend group']]){
   const current=own[property]??css.getPropertyValue(property),input=document.createElement('select');
   for(const value of new Set([current,...options[property]])){if(!CSS.supports(property,value))continue;const option=document.createElement('option');option.value=value;option.textContent=property==='isolation'?(value==='isolate'?'Isolate children':'Blend with surroundings'):value;input.append(option);}
   input.value=current;input.onchange=()=>save(property,input.value,width);I.field(appearance,label,input);
   const reset=I.button('Reset '+label.toLowerCase(),()=>save(property,null,width));reset.disabled=!Object.hasOwn(own,property);appearance.append(reset);
  }
  const blur=I.section('Blur');
  for(const [property,label]of [['filter','Layer blur'],['backdrop-filter','Background blur']]){
   const raw=own[property]??(css.getPropertyValue(property)||'none'),filters=parseFilters(raw),blurFilters=filters?.filter(f=>f.name==='blur');
   const input=document.createElement('input');input.type='number';input.min=0;input.max=1000;input.step='any';
   input.disabled=!CSS.supports(property,'blur(1px)')||!filters||blurFilters.length>1;input.value=input.disabled?'':blurFilters.length?parseFloat(blurFilters[0].arg):0;
   input.onchange=()=>{if(input.value!==''&&input.checkValidity()){const value=withBlur(raw,Number(input.value));if(value!==null&&CSS.supports(property,value))save(property,value,width);}};
   I.numericLabelDrag(I.field(blur,label+' (px)',input));I.numericPreview(input,el,property,value=>withBlur(raw,value));
   if(input.disabled)I.note(blur,label+' cannot be adjusted with this browser or filter stack.');
   const reset=I.button('Reset '+label.toLowerCase(),()=>save(property,null,width));reset.disabled=!Object.hasOwn(own,property);blur.append(reset);
   const clear=I.button('Clear '+(property==='filter'?'layer':'background')+' filters',()=>save(property,'none',width));clear.disabled=raw==='none';blur.append(clear);
  }
  for(const property of ['filter','backdrop-filter'])RetouchFilterStack.mount(blur,property,own[property]??css.getPropertyValue(property),value=>save(property,value,width),{reset:Object.hasOwn(own,property)});
  I.note(blur,'Layer blur affects the layer and its children. Background blur affects content behind transparent areas. Existing color filters stay in order.');
  const effects=I.section('Shadows'),shadows=parseShadows(own['box-shadow']??css.boxShadow);
  const writeShadows=next=>{const value=serializeShadows(next);if(valid('box-shadow',value)&&CSS.supports('box-shadow',value))save('box-shadow',value,width);};
  if(shadows===null)I.note(effects,'This shadow uses values these controls cannot represent. Clear it to create a new shadow, or Reset to restore the page’s styling.');
  else {
   shadows.forEach((shadow,index)=>{
    const group=document.createElement('fieldset'),legend=document.createElement('legend');group.className='shadow-controls';legend.textContent='Shadow '+(index+1);group.append(legend);
    const update=(key,value)=>writeShadows(shadows.map((item,i)=>i===index?{...item,[key]:value}:item));
    const type=document.createElement('select');for(const [value,label]of [['drop','Drop shadow'],['inner','Inner shadow']]){const option=document.createElement('option');option.value=value;option.textContent=label;type.append(option);}type.value=shadow.inset?'inner':'drop';type.onchange=()=>update('inset',type.value==='inner');I.field(group,'Type',type).setAttribute('aria-label','Shadow '+(index+1)+' type');
    for(const [key,label]of [['x','X'],['y','Y'],['blur','Blur'],['spread','Spread']]){
     const input=document.createElement('input');input.type='number';input.step='any';input.min=key==='blur'?0:-10000;input.max=10000;input.value=shadow[key];
     input.onchange=()=>{if(input.value!==''&&input.checkValidity())update(key,Number(input.value));};I.numericLabelDrag(I.field(group,label+' (px)',input)).setAttribute('aria-label','Shadow '+(index+1)+' '+label+' (px)');I.numericPreview(input,el,'box-shadow',value=>serializeShadows(shadows.map((item,i)=>i===index?{...item,[key]:value}:item)));
    }
    const color=document.createElement('input');color.value=shadow.color;color.retouchPaintPreview=()=>RetouchPaintPicker.shadowPreview({el,group,shadows,index});color.oninput=()=>color.setCustomValidity('');color.onchange=()=>{const value=color.value.trim();if(!valid('color',value)||!CSS.supports('color',value)){color.setCustomValidity('Use a CSS color, such as #00000040 or rgba(0, 0, 0, 0.25).');color.reportValidity();return;}update('color',value);};I.field(group,'Color',color).setAttribute('aria-label','Shadow '+(index+1)+' color');
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
  if(gradients===null)I.note(fills,'The existing background image cannot be represented by these gradient controls. Clear background images to start a new fill.');
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
  const parentCSS=el.parentElement&&el.ownerDocument.defaultView.getComputedStyle(el.parentElement),isFlexItem=parentCSS&&['flex','inline-flex'].includes(parentCSS.display);
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
  const isGrid=['grid','inline-grid'].includes(css.display),parentGrid=el.parentElement&&['grid','inline-grid'].includes(el.ownerDocument.defaultView.getComputedStyle(el.parentElement).display);
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
    input.onchange=()=>{const value=input.value.trim();if(value===initial)return;if(!valid(property,value)||!CSS.supports(property,value)){input.setCustomValidity(title==='Custom grid tracks'?'Enter track sizes such as 160px 1fr or repeat(3, minmax(0, 1fr)).':'Enter grid lines such as 2 / 4, 2 / span 2, or content_start / content_end.');input.reportValidity();return;}save(property,value,width);};I.field(row,label,input);if(title==='Custom grid placement'){input.parentElement.querySelector('span').textContent=label.replace(' placement','');I.suggestGridPlacement(input,el.ownerDocument.defaultView.getComputedStyle(el.parentElement).getPropertyValue(property==='grid-column'?'grid-template-columns':'grid-template-rows'));}
    input.title='Enter saves. Escape cancels.';
    input.onkeydown=event=>{if(event.isComposing||!['Enter','Escape'].includes(event.key))return;event.preventDefault();event.stopPropagation();if(event.key==='Escape'){input.value=initial;input.setCustomValidity('');}input.blur();};
    const reset=I.button('↺',()=>save(property,null,width));reset.classList.add('property-reset');reset.setAttribute('aria-label','Reset '+label.toLowerCase());reset.title='Reset '+label.toLowerCase();reset.disabled=!Object.hasOwn(own,property);row.append(reset);
   }
   I.note(custom,title==='Custom grid tracks'?'Separate sizes with spaces. 160px 1fr makes a fixed track and a flexible track.':'Choose a start and end line: 2 / 4 spans two tracks. Named lines work too.');grid.append(custom);
  }

  for(const [property,label] of fields){
   const value=own[property]??css.getPropertyValue(property),input=document.createElement(options[property]?'select':'input');
   if(options[property])for(const item of new Set([value,...options[property]])){const option=document.createElement('option');option.value=item;option.textContent=item;input.append(option);}
   else input.type='text';
   if(property==='font-family'){input.placeholder='Inter, sans-serif';input.title='Use a font loaded by this page or installed on your computer.';}
   if(property==='font-weight'){input.placeholder='400';input.inputMode='decimal';}
   input.value=value;input.oninput=()=>input.setCustomValidity('');
   input.onchange=()=>{const value=input.value.trim();if(!CSS.supports(property,value)||!valid(property,value)){input.setCustomValidity('Use simple CSS lengths with units, keywords, or colors. Spacing accepts up to four values; gap accepts two.');input.reportValidity();return;}save(property,value,width);};
   const target=property.endsWith('radius')?corners:/^(font-|line-height|letter-spacing|text-)/.test(property)||property==='color'?typography:sec;
   I.field(target,label+' (CSS)',input);
   if(input.tagName==='INPUT'&&/^(?:font-size|font-weight|line-height|letter-spacing|(?:min-|max-)?(?:width|height)|gap|(?:padding|margin)(?:-(?:top|right|bottom|left))?|border-width|border-(?:(?:top|bottom)-(?:left|right)-)?radius)$/.test(property)){
    let unit='';I.numericLabelDrag(input,raw=>{const match=/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(px|em|rem|%|ex|ch|vw|vh|vmin|vmax|pt|pc|in|cm|mm)?$/i.exec(raw.trim());if(!match||!CSS.supports(property,raw)||!valid(property,raw)||!match[2]&&!['font-weight','line-height'].includes(property))return null;unit=match[2]||'';return {value:Number(match[1]),format:value=>value+unit,min:property==='font-weight'?1:property==='letter-spacing'||/^margin(?:-|$)/.test(property)?-100000:0,max:property==='font-weight'?1000:100000};});
    I.numericPreview(input,el,property,value=>value+unit);
   }

   if(['color','background-color','border-color'].includes(property)){I.fieldDraft(input);input.dataset.paintProperty=property;input.retouchPaintPreview=()=>RetouchPaintPicker.propertyPreview({el,input,property});}
   if(property==='line-height')target.append(I.button('Automatic line height',()=>save(property,'normal',width)));
   const reset=I.button('Reset '+label.toLowerCase(),()=>save(property,null,width));reset.disabled=!Object.hasOwn(own,property);target.append(reset);
  }
  I.note(sec,'Values use CSS units. Reset removes this size’s override and restores the page’s styling.');
  const container=document.createElement('div'),textLayer=I.isTextLayer(info.tag);
  container.append(RetouchSiteVariables.mount(el,width,save,own,null,[inheritedVariables(info,width)]));
  if(textLayer)container.append(typography);
  if(position)container.append(position);
  if(paint)container.append(paint);if(info.structure?.canInsert)container.append(layout);
  container.append(appearance,corners,fills,blur,effects);if(isFlexItem)container.append(flex);if(gridFields.length)container.append(grid);
  if(!textLayer)container.append(typography);container.append(sec);return container;
 }
 function mountSelection(infos,elements,width,save){
  const section=I.section('Shared styles');
  if(!Number.isInteger(width)||elements.some(el=>!el)||infos.some(info=>info.cssReason)){I.note(section,'Re-select the layers and choose a pixel screen scope.','refused');return section;}
  I.note(section,'Shift-click a range in Layers; Cmd/Ctrl-click toggles layers. On the canvas, Shift-click toggles. Mixed values stay unchanged until edited. Each shared edit is one undo step.');
  section.append(RetouchSiteVariables.mount(elements,width,save,infos.map(info=>info.cssRules?.[width]||{}),changes=>save(null,null,width,Object.fromEntries(infos.map((info,index)=>[info.id,changes[index]]))),infos.map(info=>inheritedVariables(info,width))));
  const computed=elements.map(el=>el.ownerDocument.defaultView.getComputedStyle(el));
  const typography=I.section('Shared typography'),families=computed.map(css=>css.fontFamily),mixedFamilies=families.some(value=>value!==families[0]);section.append(typography);
  I.fontPicker(typography,elements[0].ownerDocument,mixedFamilies?'':families[0],value=>save('font-family',value,width),{mixed:mixedFamilies,label:'Shared Page font'});
  for(const [property,label,min,max]of [['line-height','Shared Line height (%)',0,1000],['letter-spacing','Shared Letter spacing (%)',-100,1000]]){
   const values=computed.map(css=>{const size=parseFloat(css.fontSize),raw=css.getPropertyValue(property);return raw==='normal'&&property==='line-height'?NaN:(parseFloat(raw)||0)/size*100;}),mixed=values.some(value=>!Number.isFinite(value)||Math.abs(value-values[0])>.0001);
   const input=I.relativeNumber(typography,label,mixed?NaN:values[0],min,max,value=>save(property,String(Math.round(value*1e6)/1e8)+(property==='letter-spacing'?'em':''),width));
   if(mixed)input.placeholder='Mixed / automatic';input.title='Relative to each selected layer’s own font size.';
  }
  typography.append(I.button('Automatic shared line height',()=>save('line-height','normal',width)));
  I.note(typography,'Relative spacing follows each layer’s own font size. Raw CSS values and property resets are available below.');
  const sharedFields=[['visibility','Visibility'],['opacity','Opacity (%)'],['rotate','Rotation (°)'],['mix-blend-mode','Blend mode'],['isolation','Blend group'],...fields,...(elements.every(el=>el.namespaceURI==='http://www.w3.org/2000/svg')?svgFields.filter(([property])=>['fill','stroke'].includes(property)):[])];
  for(const [property,label]of sharedFields){
   const values=infos.map((info,i)=>info.cssRules?.[width]?.[property]??computed[i].getPropertyValue(property)),mixed=values.some(value=>value!==values[0]),numeric=['opacity','rotate'].includes(property);
   const input=document.createElement(options[property]?'select':'input');
   if(options[property]){if(mixed){const option=document.createElement('option');option.value='';option.textContent='Mixed';option.disabled=true;input.append(option);}for(const value of new Set([...values,...options[property]])){const option=document.createElement('option');option.value=value;option.textContent=value;input.append(option);}}
   else {input.type=numeric?'number':'text';input.placeholder=mixed?'Mixed':'';if(numeric){input.min=property==='opacity'?0:-360;input.max=property==='opacity'?100:360;input.step='any';}}
   input.value=mixed?'':property==='opacity'?Number(values[0])*100:property==='rotate'?(values[0]==='none'?0:parseFloat(values[0])):values[0];
   input.oninput=()=>input.setCustomValidity('');input.onchange=()=>{if(!input.value.trim()||!input.checkValidity())return;const value=property==='opacity'?String(Number(input.value)/100):property==='rotate'?input.value+'deg':input.value.trim();if(!valid(property,value)||!CSS.supports(property,value)){input.setCustomValidity('Enter a supported CSS value.');input.reportValidity();return;}save(property,value,width);};
   I.field(section,'Shared '+label,input);if(['color','background-color','border-color','fill','stroke'].includes(property))RetouchPaintPicker.mountSelectionField(input,elements,property);
   const reset=I.button('Reset shared '+label.toLowerCase(),()=>save(property,null,width));reset.disabled=infos.every(info=>!Object.hasOwn(info.cssRules?.[width]||{},property));section.append(reset);
  }
  return section;
 }
 window.RetouchHTMLCSS={mount,mountSelection};
})();
