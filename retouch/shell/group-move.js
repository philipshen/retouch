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
 function measure(group,locked=()=>false){if(!group?.hasAttribute('data-rt-group'))throw Error('Select a group in the current screen.');return measureSelection([group],locked);}
 function measureSelection(roots,locked=()=>false,identity=el=>el.getAttribute('data-rt'),{visibleOnly=false}={}){
  if(!Array.isArray(roots)||!roots.length||roots.length>100||roots.some(el=>!el?.isConnected||el.ownerDocument!==roots[0].ownerDocument))throw Error('Select layers in one current document.');
  if(roots.some(locked))throw Error('Unlock the selected layers before moving them.');
  const w=roots[0].ownerDocument.defaultView,targets=[];
  function visit(el){
   if(locked(el))throw Error('Unlock the group contents before moving them.');
   const css=w.getComputedStyle(el);
   if(visibleOnly&&css.display==='none')return;
   if(el.hasAttribute('data-rt-group')&&css.display!=='contents')throw Error('Choose layout-transparent groups.');
   if(css.display==='contents'){
    if([...el.childNodes].some(node=>node.nodeType===3&&node.textContent.trim()))throw Error('Wrap the group’s direct text in a layer before moving it.');
    for(const child of el.children)visit(child);return;
   }
   if(css.display==='none')throw Error('Choose a screen where all group children are visible before moving them.');
   if(!identity(el)||el.namespaceURI!=='http://www.w3.org/1999/xhtml')throw Error('Group movement needs source-backed page layers.');
   if(css.display==='inline')throw Error('Use a box-producing display for inline group children before moving them.');
   if([...el.querySelectorAll('[data-rt]')].some(locked))throw Error('Unlock the group contents before moving them.');
   const rect=el.getBoundingClientRect();if(rect.width<=0||rect.height<=0)throw Error('Group movement needs visible child bounds.');
   const translate=css.translate||'none';translation(translate,{x:0,y:0});targets.push({el,id:identity(el),translate,rect,matrix:parentMatrix(el)});
  }
  for(const el of [...new Set(roots)].filter(el=>!roots.some(parent=>parent!==el&&parent.contains(el)))){let hidden=false;if(visibleOnly)for(let node=el;node;node=node.parentElement)if(w.getComputedStyle(node).display==='none'){hidden=true;break;}if(!hidden)visit(el);}if(!targets.length&&!visibleOnly||targets.length>100||new Set(targets.map(item=>item.id)).size!==targets.length)throw Error('Choose a group with 1–100 distinct source children.');return targets;
 }
 function selectionBounds(roots,members){
  const outer=[...new Set(roots)].filter(el=>!roots.some(parent=>parent!==el&&parent.contains(el)));
  return outer.map(el=>{const items=members.filter(item=>el.contains(item.el));if(!items.length)throw Error('Choose visible selection bounds.');const left=Math.min(...items.map(item=>item.rect.x)),top=Math.min(...items.map(item=>item.rect.y)),right=Math.max(...items.map(item=>item.rect.x+item.rect.width)),bottom=Math.max(...items.map(item=>item.rect.y+item.rect.height));return {el,left,top,width:right-left,height:bottom-top};});
 }
 function parentBounds(roots){
  const outer=[...new Set(roots)].filter(el=>!roots.some(parent=>parent!==el&&parent.contains(el))),parents=outer.map(el=>{let parent=el.parentElement;while(parent&&el.ownerDocument.defaultView.getComputedStyle(parent).display==='contents')parent=parent.parentElement;return parent;});
  const el=parents[0];if(!el?.isConnected||parents.some(parent=>parent!==el))return null;
  const rect=el.getBoundingClientRect();if(!['left','top','width','height'].every(key=>Number.isFinite(rect[key]))||rect.width<=0||rect.height<=0)return null;return {el,left:rect.left,top:rect.top,width:rect.width,height:rect.height};
 }
 function memberDeltas(bounds,members,deltas){
  if(bounds.length!==deltas.length||deltas.some(d=>!Number.isFinite(d.x)||!Number.isFinite(d.y)))throw Error('Choose finite selection offsets.');
  return members.map(item=>{const owners=bounds.map((bound,i)=>bound.el.contains(item.el)?i:-1).filter(i=>i>=0);if(owners.length!==1)throw Error('Resolve one selection root for each layer.');return deltas[owners[0]];});
 }
 function preview(members){
  const resume=members[0]?.el.ownerDocument[Symbol.for('retouch.group-scale.runtime')]?.pause(members.map(item=>item.el));
  const entries=members.map(member=>({...member,value:member.el.style.getPropertyValue('translate'),priority:member.el.style.getPropertyPriority('translate'),hadStyle:member.el.hasAttribute('style'),written:null}));
  const owned=item=>item.written!==null&&item.el.style.getPropertyValue('translate')===item.written&&item.el.style.getPropertyPriority('translate')==='important';
  return {current:()=>entries.every(item=>item.el.isConnected&&(item.written===null||owned(item))&&parentMatrix(item.el).every((value,i)=>Math.abs(value-item.matrix[i])<1e-9)),
   update:delta=>{const deltas=Array.isArray(delta)?delta:entries.map(()=>delta);if(deltas.length!==entries.length)throw Error('Resolve every preview offset.');const values=entries.map((item,i)=>translation(item.translate,localDelta(item.matrix,deltas[i])));for(const [i,item]of entries.entries()){item.el.style.setProperty('translate',values[i],'important');item.written=item.el.style.getPropertyValue('translate');}},
   restore:()=>{for(const item of entries){if(!owned(item))continue;if(item.value)item.el.style.setProperty('translate',item.value,item.priority);else item.el.style.removeProperty('translate');if(!item.hadStyle&&!item.el.getAttribute('style'))item.el.removeAttribute('style');}resume?.();}
  };
 }
 function scalePlan(members,factor,offset={x:0,y:0},memberFactors={}){
  if(!Number.isFinite(factor)||factor<.01||factor>100)throw Error('Choose a scale from 1 to 10,000 percent.');
  if(!Number.isFinite(offset.x)||!Number.isFinite(offset.y))throw Error('Choose a finite scale anchor.');
  if(!Array.isArray(members)||!members.length||members.length>100)throw Error('Choose between 1 and 100 source layers to scale.');
  const parse=root.RetouchFlip?.parse||require('./flip.js').parse,left=Math.min(...members.map(item=>item.rect.x)),top=Math.min(...members.map(item=>item.rect.y));
  const entries=members.map(item=>{const individual=memberFactors[item.id]??1;if(!Number.isFinite(individual)||individual<.01||individual>100)throw Error('Choose a finite layer scale from 1 to 10,000 percent.');const style=item.el.style,values=parse(item.el.ownerDocument.defaultView.getComputedStyle(item.el).scale||'none');if(!values||values.length!==2||values.some(value=>value===0||Math.abs(value*factor*individual)>10000)||style.getPropertyPriority('scale')==='important'&&!item.el.ownerDocument[Symbol.for('retouch.group-scale.runtime')]?.owns(item.el,'scale'))throw Error('Choose editable two-dimensional child scales.');return {item,scale:values.map(value=>String(value*factor*individual)).join(' '),value:style.getPropertyValue('scale'),priority:style.getPropertyPriority('scale'),hadStyle:item.el.hasAttribute('style')};});
  const expected=members.map(item=>({x:left+(item.rect.x-left)*factor+offset.x,y:top+(item.rect.y-top)*factor+offset.y,width:item.rect.width*factor*(memberFactors[item.id]??1),height:item.rect.height*factor*(memberFactors[item.id]??1)}));let deltas;
  try{for(const entry of entries)entry.item.el.style.setProperty('scale',entry.scale,'important');deltas=entries.map(({item},i)=>{const r=item.el.getBoundingClientRect(),next=expected[i];if(Math.abs(r.width-next.width)>.1||Math.abs(r.height-next.height)>.1)throw Error('Child transforms did not scale proportionally.');return {x:next.x-r.x,y:next.y-r.y};});}
  finally{for(const entry of entries){const style=entry.item.el.style;if(entry.value)style.setProperty('scale',entry.value,entry.priority);else style.removeProperty('scale');if(!entry.hadStyle&&!entry.item.el.getAttribute('style'))entry.item.el.removeAttribute('style');}}
  return {deltas,expected,scales:Object.fromEntries(entries.map(entry=>[entry.item.id,entry.scale]))};
 }
 function memberScale(el){const value=el.ownerDocument.defaultView.getComputedStyle(el).getPropertyValue('--rt-scale-factor').trim(),factor=value?Number(value):1;if(!Number.isFinite(factor)||factor<.01||factor>100)throw Error('Choose a layer scale from 1 to 10,000 percent.');return factor;}
 function scaleMovement(el){
  const css=el.ownerDocument.defaultView.getComputedStyle(el),result={};
  for(const axis of ['x','y']){const value=css.getPropertyValue('--rt-scale-move-'+axis).trim();if(value&&!/^[-+]?(?:\d*\.)?\d+px$/.test(value))throw Error('Resolve scaled layer movement in pixels.');const n=value?parseFloat(value):0;if(!Number.isFinite(n)||Math.abs(n)>100000)throw Error('Keep scaled layer movement within 100,000 pixels.');result[axis]=n;}
  return result;
 }
 function scalePreview(members,{runtime=false}={}){
  const resume=runtime?null:members[0]?.el.ownerDocument[Symbol.for('retouch.group-scale.runtime')]?.pause(members.map(item=>item.el));
  const entries=members.map(item=>({item,hadStyle:item.el.hasAttribute('style'),properties:['scale','translate'].map(property=>({property,value:item.el.style.getPropertyValue(property),priority:item.el.style.getPropertyPriority(property),written:null}))}));let expected=members.map(item=>item.rect);
  const owned=(entry,property)=>property.written!==null&&entry.item.el.style.getPropertyValue(property.property)===property.written&&entry.item.el.style.getPropertyPriority(property.property)==='important';
  function current(){try{return entries.every((entry,i)=>{const {item}=entry,r=item.el.getBoundingClientRect();return item.el.isConnected&&entry.properties.every(property=>property.written===null?item.el.style.getPropertyValue(property.property)===property.value&&item.el.style.getPropertyPriority(property.property)===property.priority:owned(entry,property))&&parentMatrix(item.el).every((value,i)=>Math.abs(value-item.matrix[i])<1e-9)&&['x','y','width','height'].every(key=>Math.abs(r[key]-expected[i][key])<.1);});}catch{return false;}}
  function restore(){for(const entry of entries){for(const property of entry.properties){if(!owned(entry,property))continue;const style=entry.item.el.style;if(property.value)style.setProperty(property.property,property.value,property.priority);else style.removeProperty(property.property);property.written=null;}if(!entry.hadStyle&&!entry.item.el.getAttribute('style'))entry.item.el.removeAttribute('style');}expected=members.map(item=>item.rect);}
  return {current,owns(el,name){const entry=entries.find(item=>item.item.el===el),property=entry?.properties.find(item=>item.property===name);return !!property&&owned(entry,property);},restore(){restore();resume?.();},update:factor=>{if(!current())throw Error('The selection changed during scaling.');restore();const plan=typeof factor==='number'?scalePlan(members,factor):scalePlan(members,factor.factor,factor.offset,factor.memberFactors),values=members.map((item,i)=>{const shift=typeof factor==='object'?factor.movements?.[item.id]:null;if(shift){if(!Number.isFinite(shift.x)||!Number.isFinite(shift.y))throw Error('Choose finite layer movement.');plan.deltas[i].x+=shift.x;plan.deltas[i].y+=shift.y;plan.expected[i].x+=shift.x;plan.expected[i].y+=shift.y;}return {scale:plan.scales[item.id],translate:translation(item.translate,localDelta(item.matrix,plan.deltas[i]))};});for(const [i,entry]of entries.entries())for(const property of entry.properties){entry.item.el.style.setProperty(property.property,values[i][property.property],'important');property.written=entry.item.el.style.getPropertyValue(property.property);}expected=plan.expected;}};
 }
 function scaleClasses(value,scope,scale){
  const R=root.RetouchResponsive||require('./responsive.js'),token=root.RetouchFlip?.token||require('./flip.js').token;
  const active=R.project(value,scope).split(/\s+/).filter(Boolean).filter(word=>!token(word.replace(/^!/,'')));active.push('![scale:'+scale.replace(/ /g,'_')+']');return R.replaceScope(value,active.join(' '),scope);
 }
 function classes(value,scope,translate){
  const R=root.RetouchResponsive||require('./responsive.js');
  const scoped=R.project(value,scope).split(/\s+/).filter(Boolean).filter(token=>!/^!?-?translate(?:-|\[)/.test(token)&&!/^!?\[translate:/.test(token));
  scoped.push('![translate:'+translate.replace(/ /g,'_')+']');return R.replaceScope(value,scoped.join(' '),scope);
 }
 const api={memberScale,scaleMovement,translation,measure,measureSelection,selectionBounds,parentBounds,memberDeltas,scalePlan,scalePreview,scaleClasses,classes,multiply,localDelta,parentMatrix,preview};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchGroupMove=api;
})(typeof window==='object'?window:globalThis);
