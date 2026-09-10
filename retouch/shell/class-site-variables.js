(function(root){
 'use strict';
 const inspector=()=>root.RetouchInspector||require('./inspector.js'),values=()=>root.RetouchHTMLCSSValues||require('./html-css-values.js');
 function compose(current,property,value){
  if((!values().variableName(property)&&![...values().fields,...values().svgFields].some(([name])=>name===property))||!values().valid(property,value))throw Error('Unsupported variable target or value.');
  const kept=[];
  for(const token of (current||'').split(/\s+/).filter(Boolean)){
   const plain=inspector().base(token);
   if(plain?.startsWith('['+property+':'))continue;
   if(value!==null&&plain!==null&&!(values().variableName(property)&&/^\[[a-z-]+:/.test(plain))&&!/^\[--[a-zA-Z_][a-zA-Z0-9_-]*:/.test(plain)&&/^!|!$/.test(token))throw Error('Resolve important utilities in this screen scope before binding a site variable.');
   kept.push(token);
  }
  if(value!==null)kept.push('!['+property+':'+value.replace(/\s+/g,'_')+']');
  return kept.join(' ');
 }
 function bindings(classes){
  const rules={};for(const token of (classes||'').split(/\s+/)){const match=/^\[([a-z-]+):(var\(--[a-zA-Z_][a-zA-Z0-9_-]{0,127}\))\]$/.exec(inspector().base(token)||'');if(match)rules[match[1]]=match[2];const definition=/^\[(--[a-zA-Z_][a-zA-Z0-9_-]{0,127}):([^\]]+)\]$/.exec(inspector().base(token)||'');if(definition)rules[definition[1]]=definition[2].startsWith('var(')?definition[2]:definition[2].replace(/_/g,' ');}return rules;
 }
 function mount(info,element,save,notify){
  const panel=root.RetouchSiteVariables.mount(element,0,(property,value)=>{
   try{if(value!==null&&[...element.style].some(name=>element.style.getPropertyPriority(name)==='important'))throw Error('Resolve inline important styles before binding a site variable.');return save(compose(info.className,property,value));}catch(error){notify(error.message);}
  },bindings(info.className));return panel;
 }
 function selectionClasses(infos,scope,changes){
  const responsive=root.RetouchResponsive||require('./responsive.js');
  if(changes.length!==infos.length)throw Error('Re-select the layers before binding variables.');
  return Object.fromEntries(infos.map((info,index)=>{
   let projected=responsive.project(info.className,scope);
   for(const [property,value]of Object.entries(changes[index]))projected=compose(projected,property,value);
   return [info.id,responsive.replaceScope(info.className,projected,scope)];
  }));
 }
 function mountSelection(infos,elements,scope,save,notify){
  if(elements.some(element=>!element)){const panel=document.createElement('div');inspector().note(panel,'Re-select the layers to bind site variables.');return panel;}
  const write=changes=>{try{
   for(let index=0;index<elements.length;index++)if(Object.values(changes[index]).some(value=>value!==null)&&[...elements[index].style].some(name=>elements[index].style.getPropertyPriority(name)==='important'))throw Error('Resolve inline important styles before binding a site variable.');
   return save(selectionClasses(infos,scope,changes));
  }catch(error){notify(error.message);}};
  return root.RetouchSiteVariables.mount(elements,0,(property,value)=>write(infos.map(()=>({[property]:value}))),infos.map(info=>bindings(root.RetouchResponsive.project(info.className,scope))),write);
 }
 const api={compose,bindings,mount,selectionClasses,mountSelection};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchClassSiteVariables=api;
})(typeof window==='object'?window:globalThis);
