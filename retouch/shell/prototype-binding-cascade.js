(function(root){
 'use strict';
 const V=root.RetouchHTMLCSSValues;
 const namespace=Math.random().toString(36).slice(2);let serial=0;
 // Ask the browser's cascade to choose a linked class. Temporary custom-property
 // markers retain the original selectors, media/supports/container conditions,
 // layers, specificity, importance and order. All mutations are synchronous and
 // reverted before control returns; no authored declaration is replaced.
 function classLink(info,el,property,managed){
  const d=el.ownerDocument,w=d.defaultView,name='--rt-prototype-probe-'+namespace+'-'+(++serial),tokens=new Map(),links=new Map();let count=0;
  for(const [scope,group]of Object.entries(info.variableLinks||{})){
   const link=group[property];if(!link)continue;
   const token=scope+'!['+property+':'+link.value.replace(/_/g,'\\_').replace(/\s+/g,'_')+']',marker='rt'+(++count);
   if(!el.classList.contains(token))continue;
   tokens.set('.'+w.CSS.escape(token),marker);links.set(marker,{link,override:!!(link.override||info.variableOverrides?.[scope]?.includes(property))});
  }
  if(!tokens.size)return null;
  const changed=[],seen=new Set(),registration=d.createElement('style');
  registration.textContent='@property '+name+' { syntax: "*"; inherits: false; initial-value: none; }';
  const inlineBefore={value:el.style.getPropertyValue(name),priority:el.style.getPropertyPriority(name),hadStyle:el.hasAttribute('style')};
  function mark(style,marker){
   const declarations=[...style].filter(p=>V.overlaps(p,property));if(!declarations.length)return;
   const important=declarations.some(p=>style.getPropertyPriority(p)==='important');
   changed.push({style,value:style.getPropertyValue(name),priority:style.getPropertyPriority(name)});style.setProperty(name,marker,important?'important':'');
  }
  function rules(list,parentMarker='blocked'){
   for(const rule of list){
    let marker=parentMarker;
    if(rule.selectorText)marker=tokens.get(rule.selectorText)||(rule.selectorText==='&'?parentMarker:'blocked');
    if(rule.style&&rule.selectorText)mark(rule.style,marker);
    if(rule.styleSheet)scanSheet(rule.styleSheet);
    if(rule.cssRules)rules(rule.cssRules,marker);
   }
  }
  function scanSheet(sheet){
   if(!sheet||sheet.disabled||seen.has(sheet))return;seen.add(sheet);
   let list;try{list=sheet.cssRules;}catch{throw Error('A stylesheet is unreadable. Prototype variable bindings cannot determine the active screen scope.');}
   rules(list);
  }
  try{
   (d.head||d.documentElement).append(registration);
   for(const sheet of [...d.styleSheets,...(d.adoptedStyleSheets||[])])if(sheet!==registration.sheet)scanSheet(sheet);
   // Ignore only the exact inline declaration owned by this presentation.
   // Real application inline overrides must continue to win.
   const inline=[...el.style].filter(p=>V.overlaps(p,property)).filter(p=>!(p===property&&managed&&el.style.getPropertyValue(p)===managed.applied&&el.style.getPropertyPriority(p)==='important'));
   if(inline.length||managed?.value)el.style.setProperty(name,'blocked',inline.some(p=>el.style.getPropertyPriority(p)==='important')||managed?.priority==='important'?'important':'');
   return links.get(w.getComputedStyle(el).getPropertyValue(name).trim())||null;
  }finally{
   for(const entry of changed.reverse()){if(entry.value)entry.style.setProperty(name,entry.value,entry.priority);else entry.style.removeProperty(name);}
   if(inlineBefore.value)el.style.setProperty(name,inlineBefore.value,inlineBefore.priority);else el.style.removeProperty(name);
   if(!inlineBefore.hadStyle&&!el.getAttribute('style'))el.removeAttribute('style');registration.remove();
  }
 }
 root.RetouchPrototypeBindingCascade={classLink};
})(window);
