(function(root){
 'use strict';
 const inspector=()=>root.RetouchInspector||require('./inspector.js'),values=()=>root.RetouchHTMLCSSValues||require('./html-css-values.js');
 function compose(current,property,value){
  if(![...values().fields,...values().svgFields].some(([name])=>name===property)||!values().valid(property,value))throw Error('Unsupported variable target or value.');
  const kept=[];
  for(const token of (current||'').split(/\s+/).filter(Boolean)){
   const plain=inspector().base(token);
   if(plain?.startsWith('['+property+':'))continue;
   if(value!==null&&plain!==null&&/^!|!$/.test(token))throw Error('Resolve important utilities in this screen scope before binding a site variable.');
   kept.push(token);
  }
  if(value!==null)kept.push('!['+property+':'+value.replace(/\s+/g,'_')+']');
  return kept.join(' ');
 }
 function bindings(classes){
  const rules={};for(const token of (classes||'').split(/\s+/)){const match=/^\[([a-z-]+):(var\(--[a-zA-Z_][a-zA-Z0-9_-]{0,127}\))\]$/.exec(inspector().base(token)||'');if(match)rules[match[1]]=match[2];}return rules;
 }
 function mount(info,element,save,notify){
  const panel=root.RetouchSiteVariables.mount(element,0,(property,value)=>{
   try{if(value!==null&&[...element.style].some(name=>element.style.getPropertyPriority(name)==='important'))throw Error('Resolve inline important styles before binding a site variable.');return save(compose(info.className,property,value));}catch(error){notify(error.message);}
  },bindings(info.className));return panel;
 }
 const api={compose,bindings,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchClassSiteVariables=api;
})(typeof window==='object'?window:globalThis);
