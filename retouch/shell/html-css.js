(function(){
 const I=RetouchInspector;
 const {options,fields,valid}=RetouchHTMLCSSValues;
 function mount(info,el,width,save){
  const sec=I.section('CSS properties');
  if(info.cssReason||!el||!Number.isInteger(width)){I.note(sec,info.cssReason||'Choose a pixel screen scope.','refused');return sec;}
  const css=el.ownerDocument.defaultView.getComputedStyle(el),own=info.cssRules?.[width]||{};
  for(const [property,label] of fields){
   const value=own[property]??css.getPropertyValue(property),input=document.createElement(options[property]?'select':'input');
   if(options[property])for(const item of new Set([value,...options[property]])){const option=document.createElement('option');option.value=item;option.textContent=item;input.append(option);}
   else input.type='text';
   input.value=value;input.oninput=()=>input.setCustomValidity('');
   input.onchange=()=>{const value=input.value.trim();if(!CSS.supports(property,value)||!valid(property,value)){input.setCustomValidity('Use simple CSS lengths with units, keywords, or colors. Spacing accepts up to four values; gap accepts two.');input.reportValidity();return;}save(property,value,width);};
   I.field(sec,label+' (CSS)',input);
   const reset=I.button('Reset '+label.toLowerCase(),()=>save(property,null,width));reset.disabled=!Object.hasOwn(own,property);sec.append(reset);
  }
  I.note(sec,'Values use CSS units. Reset removes this size’s override and restores the page’s styling.');
  return sec;
 }
 window.RetouchHTMLCSS={mount};
})();
