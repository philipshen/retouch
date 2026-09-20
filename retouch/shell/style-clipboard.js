(function(root){
 'use strict';
 const groups={Appearance:['opacity','background-color','background-image','background-size','background-position','background-repeat','background-origin','background-clip','background-attachment','background-blend-mode','border-color','border-width','border-style','border-radius','box-shadow','filter','backdrop-filter','mix-blend-mode','isolation'],Typography:['color','font-family','font-size','font-weight','font-style','line-height','letter-spacing','text-align','text-decoration-line','text-transform'],Layout:['display','flex-direction','flex-wrap','justify-content','align-items','gap','padding','width','height']},names=Object.values(groups).flat(),format='retouch/layer-styles@1';
 const css=()=>root.RetouchHTMLCSSValues||(typeof require==='function'?require('./html-css-values.js'):null);
 function validate(input){
  if(typeof input==='string'){if(input.length>1000000)throw Error('Copied styles are too large.');try{input=JSON.parse(input);}catch{throw Error('Copy layer styles before pasting.');}}
  if(input?.format!==format||!Array.isArray(input.properties)||!input.properties.length||input.properties.length>names.length)throw Error('Copy layer styles before pasting.');
  const seen=new Set(),properties=input.properties.map(p=>{if(!p||!names.includes(p.name)||seen.has(p.name)||typeof p.value!=='string'||p.value.length>10000||!css().valid(p.name,p.value,false))throw Error('Unsupported copied style.');seen.add(p.name);return {name:p.name,value:p.value};});return {format,properties};
 }
 function snapshot(element){const computed=element.ownerDocument.defaultView.getComputedStyle(element);return validate({format,properties:names.map(name=>({name,value:computed.getPropertyValue(name).trim()})).filter(p=>p.value&&css().valid(p.name,p.value,false))});}
 const labels=Object.fromEntries(names.map(name=>[name,name.charAt(0).toUpperCase()+name.slice(1).replace(/-/g,' ')]));Object.assign(labels,{color:'Text color','background-color':'Fill color','background-image':'Fill image','background-size':'Image size','background-position':'Image position','background-repeat':'Image repeat','background-origin':'Image origin','background-clip':'Image clip','background-attachment':'Image attachment','background-blend-mode':'Fill blending','border-radius':'Corner radius','mix-blend-mode':'Blend mode'});
 function sourceChanges(properties,baseURL){
  const changes=Object.fromEntries(validate({format,properties}).properties.map(p=>[p.name,p.value]));
  if(baseURL&&Object.hasOwn(changes,'background-image')){const base=new URL(baseURL);changes['background-image']=css().imageLayers(changes['background-image']).map(layer=>{const match=/^url\("([^"\\]*)"\)$/.exec(layer);if(!match||!/^https?:\/\//i.test(match[1]))return layer;const url=new URL(match[1]);return url.origin===base.origin&&!url.username&&!url.password&&!url.pathname.startsWith('//')?'url("'+url.pathname+url.search+url.hash+'")':layer;}).join(', ');}
  return changes;
 }
 function cssChanges(properties,baseURL){const changes=sourceChanges(properties,baseURL);if(Object.hasOwn(changes,'background-image'))changes[css().paintVisibilityProperty]='none';if(Object.hasOwn(changes,'background-color'))changes[css().hiddenBackgroundProperty]='none';return changes;}
 const transport=root.RetouchComponentClipboard.createTransport(validate);
 function inlineKeys(name){
  const keys=[name,'all'];if(/^border-(color|width|style)$/.test(name)){const part=name.slice(7);for(const edge of ['top','right','bottom','left','inline-start','inline-end','block-start','block-end'])keys.push('border-'+edge+'-'+part);}
  if(name==='border-radius')for(const corner of ['top-left','top-right','bottom-left','bottom-right','start-start','start-end','end-start','end-end'])keys.push('border-'+corner+'-radius');
  if(name==='padding')for(const edge of ['top','right','bottom','left','inline-start','inline-end','block-start','block-end'])keys.push('padding-'+edge);
  if(name==='background-position')keys.push('background-position-x','background-position-y');if(name==='gap')keys.push('row-gap','column-gap');if(['width','height'].includes(name))keys.push('inline-size','block-size');if(name==='backdrop-filter')keys.push('-webkit-backdrop-filter');return keys;
 }
 function target(info,element){return {name:info.layerName||info.tag||'Layer',props:names.map(name=>({name,editor:{type:'string',editable:!inlineKeys(name).some(key=>element.style.getPropertyPriority(key)==='important')}}))};}
 root.RetouchStyleClipboard={groups,validate,snapshot,target,sourceChanges,cssChanges,copy:element=>transport.copy(snapshot(element)),open:({infos,elements,save,opener,scopeLabel})=>root.RetouchComponentClipboard.open({infos,components:infos.map((info,i)=>target(info,elements[i])),save,opener,readClipboard:()=>transport.read(),labels,hideExcluded:true,targetLabel:'layer',initialProperties:[...groups.Appearance,...groups.Typography],dialogLabel:'Paste layer styles',actionLabel:'Paste styles',hintText:'Only checked styles are pasted as local overrides. Other properties stay unchanged.',scopeLabel})};
})(typeof window==='undefined'?globalThis:window);
