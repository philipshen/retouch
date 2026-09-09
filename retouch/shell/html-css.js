(function(){
 const I=RetouchInspector;
 const {options,fields,valid,parseShadows,serializeShadows}=RetouchHTMLCSSValues;
 function mount(info,el,width,save){
  const sec=I.section('CSS properties');
  if(info.cssReason||!el||!Number.isInteger(width)){I.note(sec,info.cssReason||'Choose a pixel screen scope.','refused');return sec;}
  const css=el.ownerDocument.defaultView.getComputedStyle(el),own=info.cssRules?.[width]||{};
  const appearance=I.section('Appearance'),typography=I.section('Typography');
  for(const [property,label,min,max,unit]of [['opacity','Opacity (%)',0,100,''],['rotate','Rotation (°)',-360,360,'deg']]){
   const raw=own[property]??css.getPropertyValue(property),input=document.createElement('input');input.type='number';input.min=min;input.max=max;input.step='any';
   const value=property==='opacity'?Number(raw)*100:raw==='none'?0:/^-?[\d.]+deg$/.test(raw)?parseFloat(raw):NaN;
   input.value=Number.isFinite(value)?value:'';input.placeholder=raw;
   input.onchange=()=>{if(input.value!==''&&input.checkValidity()){const value=property==='opacity'?String(Number(input.value)/100):input.value+unit;if(valid(property,value)&&CSS.supports(property,value))save(property,value,width);}};
   I.field(appearance,label,input);
   const reset=I.button('Reset '+property,()=>save(property,null,width));reset.disabled=!Object.hasOwn(own,property);appearance.append(reset);
  }
  if(css.transform!=='none')I.note(appearance,'Rotation combines with the page’s existing transform.');
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
     input.onchange=()=>{if(input.value!==''&&input.checkValidity())update(key,Number(input.value));};I.field(group,label+' (px)',input).setAttribute('aria-label','Shadow '+(index+1)+' '+label+' (px)');
    }
    const color=document.createElement('input');color.value=shadow.color;color.oninput=()=>color.setCustomValidity('');color.onchange=()=>{const value=color.value.trim();if(!valid('color',value)||!CSS.supports('color',value)){color.setCustomValidity('Use a CSS color, such as #00000040 or rgba(0, 0, 0, 0.25).');color.reportValidity();return;}update('color',value);};I.field(group,'Color',color).setAttribute('aria-label','Shadow '+(index+1)+' color');
    group.append(I.button('Remove shadow '+(index+1),()=>writeShadows(shadows.filter((_,i)=>i!==index))));
    if(index>0)group.append(I.button('Move shadow '+(index+1)+' up',()=>{const next=[...shadows];[next[index-1],next[index]]=[next[index],next[index-1]];writeShadows(next);}));effects.append(group);
   });
   const add=I.button('Add shadow',()=>writeShadows([...shadows,{x:0,y:4,blur:8,spread:0,color:'rgba(0, 0, 0, 0.25)',inset:false}]));add.disabled=shadows.length>=16;effects.append(add);
  }
  const clear=I.button('Clear shadows',()=>save('box-shadow','none',width));clear.disabled=shadows?.length===0;effects.append(clear);
  const resetShadows=I.button('Reset shadows',()=>save('box-shadow',null,width));resetShadows.disabled=!Object.hasOwn(own,'box-shadow');effects.append(resetShadows);
  I.note(effects,'Shadows are stacked from front to back. Reset restores this screen size’s inherited styling.');
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
  const gridFields=[...(isGrid?[['grid-template-columns','Grid columns'],['grid-template-rows','Grid rows']]:[]),...(parentGrid?[['grid-column','Column span'],['grid-row','Row span']]:[])];
  for(const [property,label]of gridFields){
   const tracks=property.startsWith('grid-template'),raw=own[property]??css.getPropertyValue(property),match=(tracks?/^repeat\((\d+),/:/^span (\d+)/).exec(raw);
   const input=document.createElement('input');input.type='number';input.min=1;input.max=24;input.step=1;
   input.value=match?match[1]:!tracks&&raw==='auto'?'1':'';input.placeholder='Auto / authored';input.title=raw;
   input.onchange=()=>{if(input.value!==''&&input.checkValidity()){const count=Number(input.value);save(property,tracks?`repeat(${count}, minmax(0, 1fr))`:`span ${count} / span ${count}`,width);}};
   I.field(grid,label,input);const reset=I.button('Reset '+label.toLowerCase(),()=>save(property,null,width));reset.disabled=!Object.hasOwn(own,property);grid.append(reset);
  }
  if(gridFields.length)I.note(grid,'Track counts create equal-sized tracks. Reset restores the page’s authored layout.');
  for(const [property,label] of fields){
   const value=own[property]??css.getPropertyValue(property),input=document.createElement(options[property]?'select':'input');
   if(options[property])for(const item of new Set([value,...options[property]])){const option=document.createElement('option');option.value=item;option.textContent=item;input.append(option);}
   else input.type='text';
   if(property==='font-family'){input.placeholder='Inter, sans-serif';input.title='Use a font loaded by this page or installed on your computer.';}
   if(property==='font-weight'){input.placeholder='400';input.inputMode='decimal';}
   input.value=value;input.oninput=()=>input.setCustomValidity('');
   input.onchange=()=>{const value=input.value.trim();if(!CSS.supports(property,value)||!valid(property,value)){input.setCustomValidity('Use simple CSS lengths with units, keywords, or colors. Spacing accepts up to four values; gap accepts two.');input.reportValidity();return;}save(property,value,width);};
   const target=/^(font-|line-height|letter-spacing|text-)/.test(property)||property==='color'?typography:sec;
   I.field(target,label+' (CSS)',input);
   const reset=I.button('Reset '+label.toLowerCase(),()=>save(property,null,width));reset.disabled=!Object.hasOwn(own,property);target.append(reset);
  }
  I.note(sec,'Values use CSS units. Reset removes this size’s override and restores the page’s styling.');
  const container=document.createElement('div');container.append(appearance,effects);if(isFlexItem)container.append(flex);if(gridFields.length)container.append(grid);container.append(typography,sec);return container;
 }
 window.RetouchHTMLCSS={mount};
})();
