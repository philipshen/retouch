(function(root){
 'use strict';
 const groups={Appearance:['opacity','background-color','background-image','border-color','border-width','border-style','border-radius','box-shadow','filter','backdrop-filter','mix-blend-mode','isolation'],Typography:['color','font-family','font-size','font-weight','font-style','line-height','letter-spacing','text-align','text-decoration-line','text-transform'],Layout:['display','flex-direction','flex-wrap','justify-content','align-items','gap','padding','width','height']},names=Object.values(groups).flat(),format='retouch/layer-styles@1';
 const css=()=>root.RetouchHTMLCSSValues||(typeof require==='function'?require('./html-css-values.js'):null);
 function validate(input){
  if(typeof input==='string'){if(input.length>1000000)throw Error('Copied styles are too large.');try{input=JSON.parse(input);}catch{throw Error('Copy layer styles before pasting.');}}
  if(input?.format!==format||!Array.isArray(input.properties)||!input.properties.length||input.properties.length>names.length)throw Error('Copy layer styles before pasting.');
  const seen=new Set(),properties=input.properties.map(p=>{if(!p||!names.includes(p.name)||seen.has(p.name)||typeof p.value!=='string'||p.value.length>10000||!css().valid(p.name,p.value,false))throw Error('Unsupported copied style.');seen.add(p.name);return {name:p.name,value:p.value};});return {format,properties};
 }
 function snapshot(element){const computed=element.ownerDocument.defaultView.getComputedStyle(element);return validate({format,properties:names.map(name=>({name,value:computed.getPropertyValue(name).trim()})).filter(p=>p.value&&css().valid(p.name,p.value,false))});}
 const labels=Object.fromEntries(names.map(name=>[name,name.charAt(0).toUpperCase()+name.slice(1).replace(/-/g,' ')]));Object.assign(labels,{color:'Text color','background-color':'Fill color','background-image':'Fill image','border-radius':'Corner radius','mix-blend-mode':'Blend mode'});
 const transport=root.RetouchComponentClipboard.createTransport(validate);
 function target(info,element){return {name:info.layerName||info.tag||'Layer',props:names.map(name=>({name,editor:{type:'string',editable:!element.style.getPropertyPriority(name)}}))};}
 root.RetouchStyleClipboard={groups,validate,snapshot,target,copy:element=>transport.copy(snapshot(element)),open:({infos,elements,save,opener,scopeLabel})=>root.RetouchComponentClipboard.open({infos,components:infos.map((info,i)=>target(info,elements[i])),save,opener,readClipboard:()=>transport.read(),labels,hideExcluded:true,targetLabel:'layer',initialProperties:[...groups.Appearance,...groups.Typography],dialogLabel:'Paste layer styles',actionLabel:'Paste styles',hintText:'Only checked styles are pasted as local overrides. Other properties stay unchanged.',scopeLabel})};
})(typeof window==='undefined'?globalThis:window);
