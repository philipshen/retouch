(function(root){
 'use strict';
 const V=typeof module==='object'&&module.exports?require('./html-css-values.js'):root.RetouchHTMLCSSValues,I=typeof module==='object'&&module.exports?require('./inspector.js'):root.RetouchInspector;
 const defaults={'background-size':'auto','background-position':'0% 0%','background-repeat':'repeat','background-origin':'padding-box','background-clip':'border-box','background-attachment':'scroll','background-blend-mode':'normal'},properties=Object.keys(defaults);
 function reorder(layers,framing,order){
  if(!Array.isArray(layers)||!layers.length||layers.length>8||!Array.isArray(order)||!order.length||order.length>8||order.some(index=>!Number.isInteger(index)||index<0||index>=layers.length))throw Error('Choose a valid paint order.');
  const changes={'background-image':order.map(index=>layers[index]).join(', ')};
  for(const property of properties){const value=framing[property]||defaults[property],values=typeof value==='string'?V.splitLayers(value):null;if(!values?.length||values.length>8||!V.valid(property,value))throw Error('This paint stack uses unsupported '+property+' values.');changes[property]=order.map(index=>values[index%values.length]).join(', ');}
  return changes;
 }
 function frameClasses(before,changes){
  let next=before;
  for(const property of properties){if(!Object.hasOwn(changes,property))continue;const value=changes[property];if(!V.valid(property,value))throw Error('Choose supported paint framing.');const kind=property.slice(11),match=token=>token.startsWith('['+property+':')||({size:/^bg-(?:(?:cover|contain|auto)$|\[length:|size-\[)/,position:/^bg-(?:(?:center|top|bottom|left|right|(?:left|right)-(?:top|bottom))$|\[position:|position-\[)/,repeat:/^bg-(?:repeat(?:-x|-y|-round|-space)?|no-repeat)$/,origin:/^bg-origin-(?:border|padding|content)$/,clip:/^bg-clip-(?:border|padding|content|text)$/,attachment:/^bg-(?:fixed|local|scroll)$/, 'blend-mode':/^bg-blend-(?:normal|multiply|screen|overlay|darken|lighten|color-dodge|color-burn|hard-light|soft-light|difference|exclusion|hue|saturation|color|luminosity)$/}[kind]?.test(token));next=I.replace(next,match,value===null?'':'!['+property+':'+value.replace(/\s/g,'_')+']');}
  return next;
 }
 const api={properties,defaults,reorder,frameClasses};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchPaintOrder=api;
})(typeof window==='object'?window:globalThis);
