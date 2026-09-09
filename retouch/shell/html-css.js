(function(){
 const I=RetouchInspector;
 const {options,fields,valid}=RetouchHTMLCSSValues;
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
  const container=document.createElement('div');container.append(appearance);if(gridFields.length)container.append(grid);container.append(typography,sec);return container;
 }
 window.RetouchHTMLCSS={mount};
})();
