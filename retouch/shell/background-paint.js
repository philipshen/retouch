(function(root){
 'use strict';
 const V=typeof module==='object'&&module.exports?require('./html-css-values.js'):root.RetouchHTMLCSSValues,P=typeof module==='object'&&module.exports?require('./palette-values.js'):root.RetouchPaletteValues;
 const property=V.hiddenBackgroundProperty;
 const canonical=color=>P.fromComputed(color);
 const transparent=color=>{const paint=P.parse(canonical(color));return paint.space==='display-p3'?P.p3(paint.channels,0):P.srgb(paint.channels,0);};
 // The caller must supply metadata owned by this element, never an inherited custom property.
 function state(current,stored='none'){
  const saved=V.parseHiddenBackground(stored),color=canonical(current);
  if(saved===null)return {hidden:false,color};
  const actual=P.parse(color),expected=P.parse(saved);
  // CSSOM can round explicit color() channels when returning computed styles.
  if(actual.alpha!==0||actual.space!==expected.space||actual.channels.some((n,i)=>Math.abs(n-expected.channels[i])>1e-6))throw Error('The hidden background color changed outside Retouch. Restore or update its source settings first.');
  return {hidden:true,color:saved};
 }
 function toggle(current,stored,hidden){
  if(typeof hidden!=='boolean')throw Error('Choose whether to show the background color.');
  const before=state(current,stored);if(before.hidden===hidden)return {};
  return {'background-color':hidden?transparent(before.color):before.color,[property]:hidden?V.serializeHiddenBackground(before.color):'none'};
 }
 function edit(current,stored,value){
  const before=state(current,stored),color=canonical(value);
  return before.hidden?{'background-color':transparent(color),[property]:V.serializeHiddenBackground(color)}:{'background-color':color};
 }
 const clear=()=>({'background-color':'transparent',[property]:'none'}),reset=()=>({'background-color':null,[property]:null});
 const api={property,state,toggle,edit,clear,reset,transparent};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchBackgroundPaint=api;
})(typeof window==='object'?window:globalThis);
