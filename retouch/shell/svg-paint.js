(function(root){
 'use strict';
 const V=typeof module==='object'&&module.exports?require('./html-css-values.js'):root.RetouchHTMLCSSValues;
 const I=typeof module==='object'&&module.exports?require('./inspector.js'):root.RetouchInspector;
 function property(token){
  const base=I.base(token);if(base===null)return null;
  const arbitrary=/^\[(fill|stroke|stroke-width|stroke-linecap|stroke-linejoin|stroke-dasharray|stroke-dashoffset|stroke-miterlimit|vector-effect):(.+)\]$/.exec(base);if(arbitrary)return arbitrary[1];
  if(base.startsWith('fill-'))return 'fill';
  if(base.startsWith('stroke-')){const suffix=base.slice(7);if(suffix.startsWith('[length:')||suffix.startsWith('(length:')||/^\d+(?:\.\d+)?$/.test(suffix)||/^\[(?:length:)?(?:\d+\.?\d*|\.\d+)(?:px|%)?\]$/.test(suffix))return 'stroke-width';return 'stroke';}
  return null;
 }
 function value(classes,key){const token=(classes||'').split(/\s+/).filter(t=>property(t)===key).at(-1);if(!token)return null;const match=new RegExp('^\\['+key+':(.+)\\]$').exec(I.base(token));return match?match[1].replace(/_/g,' '):null;}
 function scopedValue(classes,scope,key){
  const R=root.RetouchResponsive||(typeof require==='function'?require('./responsive.js'):null),projected=R.project(classes,scope),matches=projected.split(/\s+/).filter(token=>property(token)===key);
  return matches.length===1?value(matches[0],key):null;
 }
 function update(classes,key,next,inherited=''){
  if(!V.svgFields.some(([p])=>p===key)||!V.valid(key,next))throw Error('Use a supported SVG paint value.');
  if(next!==null&&/[\[\]"'`\\{};]/.test(next))throw Error('Use a literal SVG paint value.');
  const important=(inherited||'').split(/\s+/).some(token=>property(token)===key&&/^!|!$/.test(token));
  return I.replace(classes,t=>property(t)===key,next===null?'':`${important?'!':''}[${key}:${next.trim().replace(/\s+/g,'_')}]`);
 }
 const dashLength=value=>typeof value==='string'&&value.length<=40&&/^(?:\d+\.?\d*|\.\d+)(?:px|%)?$/.test(value)&&parseFloat(value)<=100000;
 function pattern(value){
  if(!V.valid('stroke-dasharray',value)||value==null)return null;
  if(value==='none')return {type:'solid',parts:[]};
  const parts=value.trim().split(/[\s,]+/);return parts.every(dashLength)?{type:parts.length<=2?'dashed':'custom',parts}:null;
 }
 function dashPair(value,changes={}){
  const parsed=pattern(value),parts=parsed?.parts||[],dash=changes.dash??parts[0]??'4',gap=changes.gap??parts[1]??parts[0]??'4';
  if(!dashLength(dash)||!dashLength(gap))return null;
  return dash+' '+gap;
 }
 function attributeReason(el,paint,releaseInline=false){
  if(!el?.isConnected||!['fill','stroke'].includes(paint))return 'Select a visible SVG layer.';
  const w=el.ownerDocument.defaultView,css=w.getComputedStyle(el),transitions=css.transitionProperty.split(',').map(s=>s.trim());
  const durations=css.transitionDuration.split(','),animations=el.getAnimations?.();
  const animated=animations?animations.some(animation=>{try{const frames=animation.effect?.getKeyframes();return !frames||frames.some(frame=>Object.hasOwn(frame,paint)||Object.hasOwn(frame,'all'));}catch{return true;}}):css.animationName!=='none';
  if(animated||transitions.some((property,index)=>(property==='all'||property===paint)&&parseFloat(durations[index%durations.length])>0))return 'Pause paint animations or transitions before creating a gradient.';
  const original=el.getAttribute(paint),originalStyle=el.getAttribute('style');
  try{if(releaseInline)el.style.removeProperty(paint);for(const [value,expected]of [['#010203','rgb(1, 2, 3)'],['#040506','rgb(4, 5, 6)']]){el.setAttribute(paint,value);if(w.getComputedStyle(el).getPropertyValue(paint).trim()!==expected)return 'Page styles control this '+paint+'. Edit its paint styles instead.';}return null;}
  finally{if(releaseInline){if(originalStyle===null)el.removeAttribute('style');else el.setAttribute('style',originalStyle);}if(original===null)el.removeAttribute(paint);else el.setAttribute(paint,original);}
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
   if(['fill','stroke'].includes(key)){I.fieldDraft(input);input.dataset.paintProperty=key;input.retouchPaintPreview=()=>root.RetouchPaintPicker.propertyPreview({el,input,property:key});}
   I.field(sec,label,input);const reset=I.button('Reset '+label.toLowerCase(),()=>save(update(info.className,key,null)));reset.disabled=locked||!(info.className||'').split(/\s+/).some(t=>property(t)===key);sec.append(reset);
  }
  I.note(sec,'Paint follows the selected screen scope through Tailwind classes. Reset reveals inherited paint or the original SVG attribute.');return sec;
 }
 const api={property,value,scopedValue,update,pattern,dashPair,attributeReason,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGPaint=api;
})(typeof window==='object'?window:globalThis);
