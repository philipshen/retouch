(function(root){
 'use strict';
 function state(info){
  if(info.tag!=='rect')return null;
  const fields=info.svgGeometry?.fields,rx=fields?.find(f=>f.name==='rx'),ry=fields?.find(f=>f.name==='ry');if(!rx||!ry)return null;
  const x=rx.value??ry.value??'0',y=ry.value??rx.value??'0',normalize=v=>/^(?:\d+\.?\d*|\.\d+)(?:px|%)?$/.test(v)?String(parseFloat(v))+(v.endsWith('%')?'%':''):v;
  return {value:normalize(x)===normalize(y)?normalize(x):'',mixed:normalize(x)!==normalize(y),editable:rx.editable!==false&&ry.editable!==false,reset:rx.value!==null||ry.value!==null,reason:rx.reason||ry.reason};
 }
 function cssReason(target){
  if(!target?.isConnected)return 'Select a visible rectangle.';
  if(target.querySelector('animate,set')||target.getAnimations?.().length)return 'Pause the shape animation before changing its radius.';
  const probe=target.cloneNode(false);probe.style.setProperty('visibility','hidden','important');probe.setAttribute('rx','0.173');probe.setAttribute('ry','0.271');
  try{target.after(probe);const style=target.ownerDocument.defaultView.getComputedStyle(probe);for(const [key,value]of [['rx',.173],['ry',.271]]){const actual=style.getPropertyValue(key).trim();if(actual&&(!/^(?:0?\.\d+|\d+(?:\.\d+)?)px$/.test(actual)||Math.abs(parseFloat(actual)-value)>1e-6))return 'CSS controls this rectangle’s corners. Edit its radius styles before changing the shape geometry.';}return null;}finally{probe.remove();}
 }
 function mount(section,info,target,save,onCanvas){
  const model=state(info);if(!model)return;
  const I=root.RetouchInspector,input=document.createElement('input');input.type='text';input.value=model.value;input.placeholder=model.mixed?'Mixed':'0';
  const reason=!model.editable?model.reason||'A dynamic value controls this rectangle’s corners.':cssReason(target);input.disabled=!!reason;input.retouchRadiusTarget=target;if(reason)input.title=reason;
  input.oninput=()=>input.setCustomValidity('');
  const update=value=>{const current=cssReason(target);if(current){input.setCustomValidity(current);input.reportValidity();return;}save({rx:value,ry:value});};
  input.onchange=()=>{const value=input.value.trim();if(value&&!root.RetouchHTMLCSSValues.valid('stroke-width',value)){input.setCustomValidity('Use a non-negative radius in SVG units, px or %.');input.reportValidity();return;}update(value||null);};
  I.field(section,'Rectangle corner radius',input);const reset=I.button('Reset rectangle corner radius',()=>update(null));reset.disabled=!!reason||!model.reset;section.append(reset);
  if(onCanvas){const canvas=I.button('Edit corner radius on canvas',()=>onCanvas(input));canvas.disabled=!!reason;canvas.dataset.canvasTool='radius';canvas.setAttribute('aria-label','Edit corner radius on canvas');canvas.title='Edit corner radius on canvas';canvas.classList.add('property-reset');canvas.innerHTML='<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 16V9a5 5 0 0 1 5-5h7"/><circle cx="9" cy="9" r="2"/></svg>';section.append(canvas);}
 }
 const api={state,cssReason,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGRadius=api;
})(typeof window==='object'?window:globalThis);
