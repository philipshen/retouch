(function(root){
 'use strict';
 function translation(value,delta){return (root.RetouchTranslateValues||require('./translate-values.js')).add(value,delta);}
 // CSS individual transforms compose as translate, rotate, scale, transform.
 // Translation and transform origins do not affect a displacement vector.
 // https://www.w3.org/TR/css-transforms-2/#ctm
 function multiply(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3]];}
 function localDelta(matrix,delta){
  const [a,b,c,d]=matrix,det=a*d-b*c;
  if(!matrix.every(Number.isFinite)||!Number.isFinite(det)||Math.abs(det)<1e-8)throw Error('The group container has a singular or extreme transform.');
  return {x:(d*delta.x-c*delta.y)/det,y:(a*delta.y-b*delta.x)/det};
 }
 function parentMatrix(el){
  const w=el.ownerDocument.defaultView;let result=[1,0,0,1];
  const ownZoom=Number(w.getComputedStyle(el).zoom||1);if(!Number.isFinite(ownZoom)||ownZoom<=0)throw Error('Use a measurable CSS zoom.');result=[ownZoom,0,0,ownZoom];
  for(let parent=el.parentElement;parent;parent=parent.parentElement){
   const css=w.getComputedStyle(parent);if(css.display==='contents')continue;
   if(css.perspective&&css.perspective!=='none'||css.offsetPath&&css.offsetPath!=='none'||css.transformStyle==='preserve-3d')throw Error('Group movement inside perspective or motion-path containers is not available yet.');
   const transform=new w.DOMMatrixReadOnly(css.transform==='none'?undefined:css.transform);if(!transform.is2D)throw Error('Group movement needs two-dimensional container transforms.');
   let degrees=0;if(css.rotate&&css.rotate!=='none'){const angle=/^(?:z )?([-+]?(?:\d*\.)?\d+)(deg|rad|turn)$/.exec(css.rotate);if(!angle)throw Error('Group movement needs two-dimensional container rotations.');degrees=Number(angle[1])*(angle[2]==='rad'?180/Math.PI:angle[2]==='turn'?360:1);}
   let scale=[1,1];if(css.scale&&css.scale!=='none'){scale=css.scale.split(/\s+/).map(Number);if(scale.length===1)scale.push(scale[0]);if(scale.length!==2||!scale.every(Number.isFinite))throw Error('Group movement needs two-dimensional container scaling.');}
   const radians=degrees*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians),zoom=Number(css.zoom||1);
   if(!Number.isFinite(zoom)||zoom<=0)throw Error('Use a measurable CSS zoom.');
   const own=multiply([cos*scale[0]*zoom,sin*scale[0]*zoom,-sin*scale[1]*zoom,cos*scale[1]*zoom],[transform.a,transform.b,transform.c,transform.d]);result=multiply(own,result);
  }
  localDelta(result,{x:0,y:0});return result;
 }
 function measure(group,locked=()=>false){
  if(!group?.isConnected||!group.hasAttribute('data-rt-group'))throw Error('Select a group in the current screen.');
  const w=group.ownerDocument.defaultView,targets=[];
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
   const translate=css.translate||'none';translation(translate,{x:0,y:0});targets.push({el,id:el.getAttribute('data-rt'),translate,rect,matrix:parentMatrix(el)});
  }
  if(w.getComputedStyle(group).display!=='contents')throw Error('Choose a layout-transparent group.');
  visit(group);if(!targets.length||targets.length>100||new Set(targets.map(item=>item.id)).size!==targets.length)throw Error('Choose a group with 1–100 distinct source children.');return targets;
 }
 function classes(value,scope,translate){
  const R=root.RetouchResponsive||require('./responsive.js');
  const scoped=R.project(value,scope).split(/\s+/).filter(Boolean).filter(token=>!/^!?-?translate(?:-|\[)/.test(token)&&!/^!?\[translate:/.test(token));
  scoped.push('![translate:'+translate.replace(/ /g,'_')+']');return R.replaceScope(value,scoped.join(' '),scope);
 }
 const api={translation,measure,classes,multiply,localDelta,parentMatrix};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchGroupMove=api;
})(typeof window==='object'?window:globalThis);
