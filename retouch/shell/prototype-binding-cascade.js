(function(root){
 'use strict';
 const V=root.RetouchHTMLCSSValues;
 const namespace=Math.random().toString(36).slice(2);let serial=0;
 // Ask the browser's cascade to choose a linked declaration. Temporary custom-property
 // markers retain the original selectors, media/supports/container conditions,
 // layers, specificity, importance and order. All mutations are synchronous and
 // reverted before control returns; no authored declaration is replaced.
 function link(info,el,property,managed){
  const d=el.ownerDocument,w=d.defaultView,name='--rt-prototype-probe-'+namespace+'-'+(++serial),tokens=new Map(),scopes=new Map(),links=new Map(),styleId=el.getAttribute('data-rt-style');let count=0;
  for(const [scope,group]of Object.entries(info.variableLinks||{})){
   const link=group[property];if(!link)continue;
   const marker='rt'+(++count);
   if(info.classVariables){const token=scope+'!['+property+':'+link.value.replace(/_/g,'\\_').replace(/\s+/g,'_')+']';if(!el.classList.contains(token))continue;tokens.set('.'+w.CSS.escape(token),marker);}
   else if(styleId&&/^[a-f0-9]{10}$/.test(styleId))scopes.set(scope,marker);else continue;
   const normalized=d.createElement('span').style;normalized.setProperty(property,link.value);
   links.set(marker,{link,value:normalized.getPropertyValue(property),override:!!(link.override||info.variableOverrides?.[scope]?.includes(property))});
  }
  if(!links.size)return null;
  const changed=[],seen=new Set(),registration=d.createElement('style');
  registration.setAttribute('data-rt-prototype-probe','');
  registration.textContent='@property '+name+' { syntax: "*"; inherits: false; initial-value: none; }';
  const inlineBefore={value:el.style.getPropertyValue(name),priority:el.style.getPropertyPriority(name),hadStyle:el.hasAttribute('style')};
  function mark(style,marker){
   const declarations=[...style].filter(p=>V.overlaps(p,property));if(!declarations.length)return;
   if(!info.classVariables&&links.has(marker)&&style.getPropertyValue(property)!==links.get(marker).value)marker='blocked';
   const important=declarations.some(p=>style.getPropertyPriority(p)==='important');
   changed.push({style,value:style.getPropertyValue(name),priority:style.getPropertyPriority(name)});style.setProperty(name,marker,important?'important':'');
  }
  function rules(list,parentMarker='blocked',sheetMarker='blocked',numericScope='0'){
   for(const rule of list){
    let marker=parentMarker,scope=numericScope;
    if(rule.media?.mediaText&&rule.media.mediaText!=='all'){
     const minimum=/^\(\s*(?:min-width\s*:\s*|width\s*>=\s*)(\d+(?:\.\d+)?)px\s*\)$/.exec(rule.media.mediaText);
     scope=scope!==null&&minimum?String(Math.max(Number(scope),Number(minimum[1]))):null;
    }
    // Vue and other compilers may merge managed style blocks and discard their
    // owner attributes. The stable selector and authored minimum-width scope
    // still identify a binding; the browser supplies its actual precedence.
    const scopedMarker=sheetMarker!=='blocked'?sheetMarker:scopes.get(scope)||'blocked';
    if(rule.selectorText)marker=tokens.get(rule.selectorText)||(rule.selectorText.split(/\s*,\s*/).includes('[data-rt-style=\"'+styleId+'\"]')?scopedMarker:rule.selectorText==='&'?parentMarker:'blocked');
    if(rule.style&&rule.selectorText)mark(rule.style,marker);
    if(rule.styleSheet)scanSheet(rule.styleSheet);
    if(rule.cssRules)rules(rule.cssRules,marker,sheetMarker,scope);
   }
  }
  function scanSheet(sheet){
   if(!sheet||sheet.disabled||seen.has(sheet))return;seen.add(sheet);
   let list;try{list=sheet.cssRules;}catch{throw Error('A stylesheet is unreadable. Prototype variable bindings cannot determine the active screen scope.');}
   const owner=sheet.ownerNode,marker=!info.classVariables&&owner?.getAttribute('data-rt-css')===styleId?scopes.get(owner.getAttribute('data-rt-width')):'blocked';
   rules(list,'blocked',marker||'blocked');
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
 root.RetouchPrototypeBindingCascade={link,classLink:link,isProbeProperty:name=>name.startsWith('--rt-prototype-probe-'+namespace+'-')};
})(window);
