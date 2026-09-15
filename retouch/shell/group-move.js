(function(root){
 'use strict';
 function translation(value,delta){
  const parts=(!value||value==='none'?['0px','0px']:value.trim().split(/\s+/));if(parts.length===1)parts.push('0px');
  if(parts.length!==2||parts.some(part=>!/^[-+]?(?:\d*\.)?\d+px$/.test(part)))throw Error('Group movement needs two-dimensional pixel translations.');
  if(![delta.x,delta.y].every(Number.isFinite))throw Error('Use a finite group movement.');
  return parts.map((part,i)=>{const value=parseFloat(part)+(i?delta.y:delta.x);if(Math.abs(value)>100000)throw Error('Keep group offsets within 100,000 pixels.');return Math.round(value*1e6)/1e6+'px';}).join(' ');
 }
 function measure(group,locked=()=>false){
  if(!group?.isConnected||!group.hasAttribute('data-rt-group'))throw Error('Select a group in the current screen.');
  const w=group.ownerDocument.defaultView,targets=[];
  for(let el=group;el;el=el.parentElement){const s=w.getComputedStyle(el);if(s.transform!=='none'||s.rotate&&!['none','0deg'].includes(s.rotate)||s.scale&&!['none','1','1 1'].includes(s.scale)||s.translate&&s.translate!=='none'||s.zoom&&Number(s.zoom)!==1)throw Error('Group movement inside transformed containers is not available yet.');}
  function visit(el){
   if(locked(el))throw Error('Unlock the group contents before moving them.');
   const css=w.getComputedStyle(el);
   if(css.display==='contents'){
    if([...el.childNodes].some(node=>node.nodeType===3&&node.textContent.trim()))throw Error('Wrap the group’s direct text in a layer before moving it.');
    for(const child of el.children)visit(child);return;
   }
   if(css.display==='none')throw Error('Choose a screen where all group children are visible before moving them.');
   if(!el.getAttribute('data-rt')||el.namespaceURI!=='http://www.w3.org/1999/xhtml')throw Error('Group movement needs source-backed page layers.');
   if(css.display==='inline')throw Error('Use a box-producing display for inline group children before moving them.');
   if([...el.querySelectorAll('[data-rt]')].some(locked))throw Error('Unlock the group contents before moving them.');
   const rect=el.getBoundingClientRect();if(rect.width<=0||rect.height<=0)throw Error('Group movement needs visible child bounds.');
   const translate=css.translate||'none';translation(translate,{x:0,y:0});targets.push({el,id:el.getAttribute('data-rt'),translate,rect});
  }
  if(w.getComputedStyle(group).display!=='contents')throw Error('Choose a layout-transparent group.');
  visit(group);if(!targets.length||targets.length>100||new Set(targets.map(item=>item.id)).size!==targets.length)throw Error('Choose a group with 1–100 distinct source children.');return targets;
 }
 function classes(value,scope,translate){
  const R=root.RetouchResponsive||require('./responsive.js');
  const scoped=R.project(value,scope).split(/\s+/).filter(Boolean).filter(token=>!/^!?-?translate(?:-|\[)/.test(token)&&!/^!?\[translate:/.test(token));
  scoped.push('[translate:'+translate.replace(/ /g,'_')+']');return R.replaceScope(value,scoped.join(' '),scope);
 }
 const api={translation,measure,classes};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchGroupMove=api;
})(typeof window==='object'?window:globalThis);
