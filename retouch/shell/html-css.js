(function(){
 const I=RetouchInspector;
 const options={display:['block','inline-block','flex','grid','none'],'flex-direction':['row','column','row-reverse','column-reverse'],'flex-wrap':['nowrap','wrap','wrap-reverse'],'text-align':['start','left','center','right','justify'],'border-style':['none','solid','dashed','dotted','double']};
 function mount(info,el,width,save){
  const sec=I.section('CSS properties');
  if(info.cssReason||!el||!Number.isInteger(width)){I.note(sec,info.cssReason||'Choose a pixel screen scope.','refused');return sec;}
  const css=el.ownerDocument.defaultView.getComputedStyle(el),own=info.cssRules?.[width]||{};
  const fields=[['width','Width'],['height','Height'],['min-width','Minimum width'],['max-width','Maximum width'],['display','Display'],['flex-direction','Direction'],['flex-wrap','Wrap'],['gap','Gap'],['padding','Padding'],['font-size','Font size'],['line-height','Line height'],['letter-spacing','Letter spacing'],['text-align','Text alignment'],['color','Text color'],['background-color','Background color'],['border-width','Border width'],['border-style','Border style'],['border-color','Border color'],['border-radius','Corner radius']];
  for(const [property,label] of fields){
   const value=own[property]??css.getPropertyValue(property),input=document.createElement(options[property]?'select':'input');
   if(options[property])for(const item of new Set([value,...options[property]])){const option=document.createElement('option');option.value=item;option.textContent=item;input.append(option);}
   else input.type='text';
   input.value=value;input.oninput=()=>input.setCustomValidity('');
   input.onchange=()=>{const value=input.value.trim();if(!CSS.supports(property,value)){input.setCustomValidity('Enter a valid CSS value, including units where needed.');input.reportValidity();return;}save(property,value,width);};
   I.field(sec,label+' (CSS)',input);
   const reset=I.button('Reset '+label.toLowerCase(),()=>save(property,null,width));reset.disabled=!Object.hasOwn(own,property);sec.append(reset);
  }
  I.note(sec,'Values use CSS units. Reset removes this size’s override and restores the page’s styling.');
  return sec;
 }
 window.RetouchHTMLCSS={mount};
})();
