(function(root){
 'use strict';
 const V=typeof module==='object'&&module.exports?require('./html-css-values.js'):root.RetouchHTMLCSSValues;
 const I=typeof module==='object'&&module.exports?require('./inspector.js'):root.RetouchInspector;
 function property(token){
  const base=I.base(token);if(base===null)return null;
  const arbitrary=/^\[(fill|stroke|stroke-width|stroke-linecap|stroke-linejoin|stroke-dasharray):(.+)\]$/.exec(base);if(arbitrary)return arbitrary[1];
  if(base.startsWith('fill-'))return 'fill';
  if(base.startsWith('stroke-')){const suffix=base.slice(7);if(suffix.startsWith('[length:')||suffix.startsWith('(length:')||/^\d+(?:\.\d+)?$/.test(suffix)||/^\[(?:length:)?(?:\d+\.?\d*|\.\d+)(?:px|%)?\]$/.test(suffix))return 'stroke-width';return 'stroke';}
  return null;
 }
 function value(classes,key){const token=(classes||'').split(/\s+/).filter(t=>property(t)===key).at(-1);if(!token)return null;const match=new RegExp('^\\['+key+':(.+)\\]$').exec(I.base(token));return match?match[1].replace(/_/g,' '):null;}
 function update(classes,key,next,inherited=''){
  if(!V.svgFields.some(([p])=>p===key)||!V.valid(key,next))throw Error('Use a supported SVG paint value.');
  if(next!==null&&/[\[\]"'`\\{};]/.test(next))throw Error('Use a literal SVG paint value.');
  const important=(inherited||'').split(/\s+/).some(token=>property(token)===key&&/^!|!$/.test(token));
  return I.replace(classes,t=>property(t)===key,next===null?'':`${important?'!':''}[${key}:${next.trim().replace(/\s+/g,'_')}]`);
 }
 function mount(info,el,save){
  const sec=I.section('SVG paint');if(!el)return sec;
  if(info.classNameDynamic||info.svgPaint?.reason){I.note(sec,info.svgPaint?.reason||'This layer has a dynamic class expression.','refused');return sec;}
  const css=el.ownerDocument.defaultView.getComputedStyle(el);
  for(const [key,label]of V.svgFields){
   const input=document.createElement(V.options[key]?'select':'input'),current=value(info.className,key)??css.getPropertyValue(key);
   if(V.options[key])for(const item of new Set([current,...V.options[key]])){const option=document.createElement('option');option.value=item;option.textContent=item;input.append(option);}else input.type='text';
   input.value=current;const locked=!!el.style.getPropertyValue(key);input.disabled=locked;if(locked)input.title='An inline style controls this property.';
   input.oninput=()=>input.setCustomValidity('');input.onchange=()=>{try{if(!CSS.supports(key,input.value))throw Error('Use a supported SVG paint value.');save(update(info.className,key,input.value,info.anchorInheritedClasses));}catch(error){input.setCustomValidity(error.message);input.reportValidity();}};
   I.field(sec,label,input);const reset=I.button('Reset '+label.toLowerCase(),()=>save(update(info.className,key,null)));reset.disabled=locked||!(info.className||'').split(/\s+/).some(t=>property(t)===key);sec.append(reset);
  }
  I.note(sec,'Paint follows the selected screen scope through Tailwind classes. Reset reveals inherited paint or the original SVG attribute.');return sec;
 }
 const api={property,value,update,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGPaint=api;
})(typeof window==='object'?window:globalThis);
