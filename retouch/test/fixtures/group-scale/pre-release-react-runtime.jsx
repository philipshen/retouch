'use client';
import {useLayoutEffect,useRef} from 'react';
const revision="9c9b92be3db6456196a3f8429636a120c52555e67741517287101fd800e41d93";
function install(host){
 const document=host.document,key=Symbol.for('retouch.group-scale.runtime');
 if(document[key]?.revision===revision&&document[key].register)return document[key];
 document[key]?.dispose();
 const scope={document,MutationObserver:host.MutationObserver,ResizeObserver:host.ResizeObserver};
 for(const name of ['requestAnimationFrame','cancelAnimationFrame','addEventListener','removeEventListener','matchMedia'])scope[name]=host[name].bind(host);
 const modules=Object.create(null),require=name=>{if(!modules[name])throw Error('Missing scale runtime dependency: '+name);return modules[name];};
 {const module={exports:{}};(function(window,globalThis,require,module){
(function(root){
 'use strict';
 const number='[+-]?(?:\\d*\\.)?\\d+',simple=new RegExp('^('+number+')(px|%)$'),sum=new RegExp('^calc\\(\\s*('+number+')(px|%)\\s+([+-])\\s+((?:\\d*\\.)?\\d+)(px|%)\\s*\\)$');
 const bounded=value=>Number.isFinite(value)&&Math.abs(value)<=100000;
 function axis(value){
  if(value==='0')return {percent:0,pixels:0};
  const match=simple.exec(value),calc=sum.exec(value),result={percent:0,pixels:0};
  if(match)result[match[2]==='%'?'percent':'pixels']=Number(match[1]);
  else if(calc){result[calc[2]==='%'?'percent':'pixels']+=Number(calc[1]);result[calc[5]==='%'?'percent':'pixels']+=(calc[3]==='-'?-1:1)*Number(calc[4]);}
  else throw Error('Group movement needs two-dimensional length or percentage translations.');
  if(!Object.values(result).every(bounded))throw Error('Keep group offsets within 100,000 pixels or percent.');return result;
 }
 function parse(value){
  if(!value||value==='none')return [axis('0'),axis('0')];
  if(typeof value!=='string'||value.length>150)throw Error('Invalid translation.');
  const parts=value.trim().match(/calc\([^()]*\)|[^\s]+/g)||[];
  if(parts.length<1||parts.length>2)throw Error('Group movement needs a two-dimensional translation.');
  return [axis(parts[0]),axis(parts[1]||'0')];
 }
 const round=n=>Math.round(n*1e6)/1e6;
 function format(values){return values.map(({percent,pixels})=>{if(![percent,pixels].every(bounded))throw Error('Keep group offsets within 100,000 pixels or percent.');percent=round(percent);pixels=round(pixels);return percent?(pixels?'calc('+percent+'% '+(pixels<0?'-':'+')+' '+Math.abs(pixels)+'px)':percent+'%'):pixels+'px';}).join(' ');}
 function add(value,delta){if(![delta.x,delta.y].every(Number.isFinite))throw Error('Use a finite group movement.');return format(parse(value).map((item,i)=>({...item,pixels:item.pixels+(i?delta.y:delta.x)})));}
 function valid(value){try{return typeof value==='string'&&format(parse(value))===value;}catch{return false;}}
 const api={parse,format,add,valid};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchTranslateValues=api;
})(typeof window==='object'?window:globalThis);

})(undefined,scope,require,module);modules["./translate-values.js"]=module.exports;}
{const module={exports:{}};(function(window,globalThis,require,module){
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchFlip=api;})(typeof window==='object'?window:globalThis,function(root){
 function parse(value){
  if(value==='none')return [1,1];
  if(typeof value!=='string')return null;
  const parts=value.trim().split(/\s+/);if(parts.length<1||parts.length>3)return null;
  if(parts.some(part=>!/^[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?%?$/i.test(part)))return null;
  const values=parts.map(part=>parseFloat(part)/(part.endsWith('%')?100:1));if(values.some(value=>!Number.isFinite(value)||Math.abs(value)>10000))return null;
  if(values.length===1)values.push(values[0]);return values;
 }
 function flip(value,axis){const values=parse(value);if(!values||!['x','y'].includes(axis))return null;values[axis==='x'?0:1]*=-1;return values.map(value=>Object.is(value,-0)?'0':String(value)).join(' ');}
 const token=word=>/^-?scale-(?:(?:x|y|z)-)?(?:\d+(?:\.\d+)?|\[[^\]]+\]|\([^)]*\)|none|3d)$|^\[scale:.+\]$/.test(word);
 function mount(el,save){
  const group=document.createElement('div');group.className='flip-controls';group.setAttribute('role','group');group.setAttribute('aria-label','Flip layer');
  for(const [axis,label,path]of [['x','Flip horizontally','M10 2v16 M7 5v10L2 10Z M13 5v10l5-5Z'],['y','Flip vertically','M2 10h16 M5 7h10l-5-5Z M5 13h10l-5 5Z']]){
   const button=document.createElement('button');button.type='button';button.className='control-button flip-action';button.dataset.flipAxis=axis;button.setAttribute('aria-keyshortcuts','Shift+'+(axis==='x'?'H':'V'));button.setAttribute('aria-label',label);button.title=label+' around the layer’s transform origin';button.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="'+path+'"/></svg>';
   const next=()=>el.isConnected&&el.style.getPropertyPriority('scale')!=='important'?flip(el.ownerDocument.defaultView.getComputedStyle(el).scale,axis):null;
   button.disabled=next()===null;if(button.disabled)button.title='Edit this layer’s important inline or unsupported scale in source first.';
   button.onclick=()=>{const value=next();if(value!==null){root.RetouchPanelFocus?.queue(button);save(value);}};group.append(button);
  }
  return group;
 }
 function selectionPlan(measured,axis){
  if(!['x','y'].includes(axis)||measured.length<2)throw Error('Choose at least two layers to reflect.');
  const horizontal=axis==='x',edge=horizontal?'left':'top',size=horizontal?'width':'height',start=Math.min(...measured.map(item=>item.rect[edge])),end=Math.max(...measured.map(item=>item.rect[edge]+item.rect[size]));
  const I=root.RetouchInspector||require('./inspector.js');
  return measured.map(({geometry:g,rect,scale,origin})=>{
   const nextScale=flip(scale,axis),values=parse(nextScale);if(!values||values.length!==2)throw Error('Selection reflection needs a two-dimensional scale.');
   const target={left:rect.left,top:rect.top};target[edge]=start+end-rect[edge]-rect[size];
   const layout=I.rotationLayoutRect(target,g.width,g.height,-g.rotation,origin,values),next={...g,x:g.x+layout.left-g.layoutLeft,y:g.y+layout.top-g.layoutTop,rotation:-g.rotation};
   if(!['x','y','width','height','rotation'].every(key=>Number.isFinite(next[key])&&Math.abs(next[key])<=100000))throw Error('Keep layer bounds within 100,000 pixels.');
   return {geometry:next,scale:nextScale};
  });
 }
 function mountSelection(infos,elements,width,save,strategy=null){
  const I=root.RetouchInspector,P=root.RetouchHTMLPosition,section=I.section('Flip selection');
  function measure(){
   strategy?.validate();
   if(!Number.isInteger(width)||elements.some(el=>!el?.isConnected)||infos.some(info=>info.cssReason))throw Error('Re-select the layers and choose a pixel screen scope.');
   if(width>elements[0].ownerDocument.defaultView.innerWidth)throw Error('Choose a screen where this style scope is active.');
   return elements.map(el=>{
    const css=el.ownerDocument.defaultView.getComputedStyle(el);
    if(el.namespaceURI!=='http://www.w3.org/1999/xhtml'||elements.some(other=>other!==el&&other.contains(el))||css.position!=='absolute'||css.visibility!=='visible'||!el.getClientRects().length)throw Error('Choose separate, visible absolute layers to reflect the selection.');
    if(['scale','rotate'].some(property=>el.style.getPropertyPriority(property)==='important'))throw Error('Edit important inline scale or rotation in source first.');
    for(let ancestor=el;ancestor;ancestor=ancestor.parentElement){const style=el.ownerDocument.defaultView.getComputedStyle(ancestor);if(ancestor.namespaceURI!=='http://www.w3.org/1999/xhtml'||style.perspective!=='none'||style.offsetPath&&style.offsetPath!=='none'||ancestor===el&&style.transformBox==='content-box')throw Error('Selection reflection for SVG, perspective, motion paths or content-box transforms is not available yet.');}
    const geometry=I.geometry(el,{allowRotation:true,allowScale:true}),origin=css.transformOrigin.split(/\s+/).slice(0,2).map(parseFloat);
    return {geometry,rect:el.getBoundingClientRect(),scale:css.scale||'none',origin};
   });
  }
  const group=mount(elements[0],()=>{});group.setAttribute('aria-label','Flip selection');section.append(group);
  for(const button of group.querySelectorAll('button')){
   const axis=button.dataset.flipAxis;button.title='Reflect all layers across the selection '+(axis==='x'?'horizontal':'vertical')+' center';
   try{selectionPlan(measure(),axis);button.disabled=false;}catch(error){button.disabled=true;button.title=error.message;}
   button.onclick=()=>{try{
    const planned=selectionPlan(measure(),axis);root.RetouchPanelFocus?.queue(button);
    if(strategy)return strategy.flip(planned);
    return save(Object.fromEntries(infos.map((info,i)=>{
     const el=elements[i],css=el.ownerDocument.defaultView.getComputedStyle(el),effective=Object.entries(info.cssRules||{}).filter(([w])=>Number(w)<=el.ownerDocument.defaultView.innerWidth).sort(([a],[b])=>Number(a)-Number(b)).reduce((all,[,values])=>Object.assign(all,values),{}),next=planned[i];
     return [info.id,{...root.RetouchSelectionLayout.preserveBox(P.placement(next.geometry,effective),next.geometry,css),scale:next.scale,rotate:next.geometry.rotation+'deg'}];
    })),width);
   }catch(error){I.note(section,error.message,'refused');}};
  }
  return section;
 }
 return {parse,flip,token,mount,selectionPlan,mountSelection};
});

})(undefined,scope,require,module);modules["./flip.js"]=module.exports;}
{const module={exports:{}};(function(window,globalThis,require,module){
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
 function scalePlan(members,factor,offset={x:0,y:0},memberFactors={},owns=()=>false){
  if(!Number.isFinite(factor)||factor<.01||factor>100)throw Error('Choose a scale from 1 to 10,000 percent.');
  if(!Number.isFinite(offset.x)||!Number.isFinite(offset.y))throw Error('Choose a finite scale anchor.');
  if(!Array.isArray(members)||!members.length||members.length>100)throw Error('Choose between 1 and 100 source layers to scale.');
  const parse=root.RetouchFlip?.parse||require('./flip.js').parse,left=Math.min(...members.map(item=>item.rect.x)),top=Math.min(...members.map(item=>item.rect.y));
  const entries=members.map(item=>{const individual=memberFactors[item.id]??1;if(!Number.isFinite(individual)||individual<=0||individual>10000)throw Error('Choose a finite layer scale from 1 to 10,000 percent.');const style=item.el.style,values=parse(item.el.ownerDocument.defaultView.getComputedStyle(item.el).scale||'none');if(!values||values.length!==2||values.some(value=>value===0||Math.abs(value*factor*individual)>10000)||style.getPropertyPriority('scale')==='important'&&!item.el.ownerDocument[Symbol.for('retouch.group-scale.runtime')]?.owns(item.el,'scale')&&!owns(item.el,'scale'))throw Error('Choose editable two-dimensional child scales.');return {item,scale:values.map(value=>String(value*factor*individual)).join(' '),value:style.getPropertyValue('scale'),priority:style.getPropertyPriority('scale'),hadStyle:item.el.hasAttribute('style')};});
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
 function scalePreview(members,{runtime=false,owns=()=>false}={}){
  const resume=runtime?null:members[0]?.el.ownerDocument[Symbol.for('retouch.group-scale.runtime')]?.pause(members.map(item=>item.el));
  const entries=members.map(item=>({item,hadStyle:item.el.hasAttribute('style'),properties:['scale','translate'].map(property=>({property,value:item.el.style.getPropertyValue(property),priority:item.el.style.getPropertyPriority(property),written:null}))}));let expected=members.map(item=>item.rect);
  const owned=(entry,property)=>property.written!==null&&entry.item.el.style.getPropertyValue(property.property)===property.written&&entry.item.el.style.getPropertyPriority(property.property)==='important';
  function current(){try{return entries.every((entry,i)=>{const {item}=entry,r=item.el.getBoundingClientRect();return item.el.isConnected&&entry.properties.every(property=>property.written===null?item.el.style.getPropertyValue(property.property)===property.value&&item.el.style.getPropertyPriority(property.property)===property.priority:owned(entry,property))&&parentMatrix(item.el).every((value,i)=>Math.abs(value-item.matrix[i])<1e-9)&&['x','y','width','height'].every(key=>Math.abs(r[key]-expected[i][key])<.1);});}catch{return false;}}
  function restore(){for(const entry of entries){for(const property of entry.properties){if(!owned(entry,property))continue;const style=entry.item.el.style;if(property.value)style.setProperty(property.property,property.value,property.priority);else style.removeProperty(property.property);property.written=null;}if(!entry.hadStyle&&!entry.item.el.getAttribute('style'))entry.item.el.removeAttribute('style');}expected=members.map(item=>item.rect);}
  return {current,owns(el,name){const entry=entries.find(item=>item.item.el===el),property=entry?.properties.find(item=>item.property===name);return !!property&&owned(entry,property);},restore(){restore();resume?.();},update:factor=>{if(!current())throw Error('The selection changed during scaling.');restore();const plan=typeof factor==='number'?scalePlan(members,factor,undefined,undefined,owns):scalePlan(members,factor.factor,factor.offset,factor.memberFactors,owns),values=members.map((item,i)=>{const shift=typeof factor==='object'?factor.movements?.[item.id]:null;if(shift){if(!Number.isFinite(shift.x)||!Number.isFinite(shift.y))throw Error('Choose finite layer movement.');plan.deltas[i].x+=shift.x;plan.deltas[i].y+=shift.y;plan.expected[i].x+=shift.x;plan.expected[i].y+=shift.y;}return {scale:plan.scales[item.id],translate:translation(item.translate,localDelta(item.matrix,plan.deltas[i]))};});for(const [i,entry]of entries.entries())for(const property of entry.properties){entry.item.el.style.setProperty(property.property,values[i][property.property],'important');property.written=entry.item.el.style.getPropertyValue(property.property);}expected=plan.expected;}};
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

})(undefined,scope,require,module);modules["./group-move.js"]=module.exports;}
{const module={exports:{}};(function(window,globalThis,require,module){
(function(root){
 'use strict';
 // The source adapter must persist this controller and its geometry dependencies
 // with the site. Loading it only into editor frames cannot fix authored output.
 function mount({roots,factor,media='',onError=()=>{},geometry=root.RetouchGroupMove,identity,offset=()=>[0,0],pixelOffset=()=>[0,0],steps=()=>[]}){
  if(!geometry)throw Error('Load group geometry before responsive scaling.');
  if(typeof roots!=='function'||typeof factor!=='function')throw Error('Provide live group roots and scale factor readers.');
  const document=root.document,query=media?root.matchMedia(media):null;
  let previews=[],pending=0,disposed=false,paused=0,managed=new Set();
  const observed=new Set(),sizes=new WeakMap();
  const schedule=()=>{if(!disposed&&!paused&&!pending)pending=root.requestAnimationFrame(()=>{pending=0;refresh();});};
  const mutation=new root.MutationObserver(schedule);
  const resize=new root.ResizeObserver(entries=>{
   let changed=false;
   for(const entry of entries){const value=entry.contentRect.width+','+entry.contentRect.height;if(sizes.get(entry.target)!==value){sizes.set(entry.target,value);changed=true;}}
   if(changed)schedule();
  });
  function observe(elements){
   const next=new Set([document.documentElement]);
   for(const element of elements)for(let node=element;node;node=node.parentElement)next.add(node);
   for(const node of observed)if(!next.has(node)){resize.unobserve(node);observed.delete(node);}
   for(const node of next)if(!observed.has(node)){observed.add(node);resize.observe(node);}
   mutation.observe(document.documentElement,{subtree:true,attributes:true,childList:true,characterData:true});
  }
  const owns=(el,property)=>previews.some(preview=>preview.owns(el,property));
  function restore(){for(let i=previews.length-1;i>=0;i--)previews[i].restore();previews=[];}
  function refresh(){
   if(disposed||paused)return;
   mutation.disconnect();
   let targets=[];
   try{
    // Restore only our own writes. A host change to either property becomes
    // part of the next baseline rather than being overwritten on cleanup.
    restore();managed.clear();
    const selected=roots();if(!Array.isArray(selected))throw Error('Resolve an array of group roots.');targets=selected.filter(el=>el?.nodeType===1&&el.ownerDocument===document).flatMap(el=>[el,...el.querySelectorAll('[data-rt-scale-member],[data-rt]')]);
    if(query&&!query.matches)return;
    const value=factor(),shift=offset(),pixels=pixelOffset();if([shift,pixels].some(pair=>!Array.isArray(pair)||pair.length!==2||pair.some(n=>!Number.isFinite(n))))throw Error('Resolve a finite scale offset.');
    const members=geometry.measureSelection(selected,()=>false,identity,{visibleOnly:true});targets=[...new Set([...targets,...members.map(item=>item.el)])];managed=new Set(members.map(item=>item.el));if(!members.length)return;
    function apply(value,shift=[0,0],pixels=[0,0],memberFactors={},movements={}){
     if(value===1&&Object.values(memberFactors).every(n=>n===1)&&[...shift,...pixels,...Object.values(movements).flatMap(value=>[value.x,value.y])].every(n=>n===0))return;
     const current=geometry.measureSelection(selected,()=>false,identity,{visibleOnly:true}),left=Math.min(...current.map(item=>item.rect.x)),top=Math.min(...current.map(item=>item.rect.y)),width=Math.max(...current.map(item=>item.rect.right))-left,height=Math.max(...current.map(item=>item.rect.bottom))-top;
     const preview=geometry.scalePreview(current,{runtime:true,owns});previews.push(preview);preview.update({factor:value,movements,memberFactors,offset:{x:shift[0]*width+pixels[0],y:shift[1]*height+pixels[1]}});
    }
    const read=(snapshot,id)=>{let value={factor:1,move:[0,0]};for(const [width,next]of Object.entries(Object.hasOwn(snapshot,id)?snapshot[id]:{}).sort(([a],[b])=>Number(a)-Number(b)))if(Number(width)<=document.defaultView.innerWidth)value=next;return value;};
    let consumed={};
    function styles(snapshot,live=false){
     const memberFactors=Object.create(null),movements=Object.create(null);for(const item of members){const prior=read(consumed,item.id),move=live?geometry.scaleMovement(item.el):null,next=live?{factor:geometry.memberScale(item.el),move:[move.x,move.y]}:read(snapshot,item.id);memberFactors[item.id]=next.factor/prior.factor;movements[item.id]={x:next.move[0]-prior.move[0],y:next.move[1]-prior.move[1]};}
     apply(1,[0,0],[0,0],memberFactors,movements);consumed=snapshot;
    }
    apply(value,shift,pixels);
    for(const step of steps())if(step.styles)styles(step.styles);else if(document.defaultView.innerWidth>=step.min&&(step.max===undefined||document.defaultView.innerWidth<step.max))apply(step.factor,step.offset,step.move);
    styles({},true);
   }catch(error){restore();onError(error);}
   finally{if(!disposed)observe(targets);}
  }
  const fontSet=document.fonts;
  root.addEventListener('resize',schedule);
  document.addEventListener('load',schedule,true);
  fontSet?.addEventListener('loadingdone',schedule);
  query?.addEventListener('change',schedule);
  refresh();
  return {refresh,manages:el=>managed.has(el),owns,pause(){paused++;root.cancelAnimationFrame(pending);pending=0;let released=false;return ()=>{if(released)return;released=true;paused--;schedule();};},dispose(){
   if(disposed)return;disposed=true;
   root.cancelAnimationFrame(pending);pending=0;mutation.disconnect();resize.disconnect();
   root.removeEventListener('resize',schedule);document.removeEventListener('load',schedule,true);
   fontSet?.removeEventListener('loadingdone',schedule);query?.removeEventListener('change',schedule);
   restore();
  }};
 }
 const api={mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchResponsiveGroupScale=api;
})(typeof window==='object'?window:globalThis);

})(undefined,scope,require,module);modules["./group-scale.js"]=module.exports;}
{const module={exports:{}};(function(window,globalThis,require,module){
(function(root){
 'use strict';
 function parse(value){
  const data=JSON.parse(value);
  if(!data||data.version!==1||Object.keys(data).some(key=>!['version','ranges','offsets','pixels','steps'].includes(key))||!data.ranges||Array.isArray(data.ranges)||typeof data.ranges!=='object')throw Error('Invalid responsive scale metadata.');
  const ranges=Object.entries(data.ranges).map(([width,factor])=>{
   if(!/^(0|[1-9][0-9]*)$/.test(width)||Number(width)>7680||typeof factor!=='number'||!Number.isFinite(factor)||factor<.01||factor>100)throw Error('Invalid responsive scale range.');
   return [Number(width),factor];
  }).sort((a,b)=>a[0]-b[0]);
  if(!ranges.length||ranges.length>100)throw Error('Provide 1–100 responsive scale ranges.');
  for(const stored of [data.offsets,data.pixels])if(stored!==undefined&&(!stored||Array.isArray(stored)||typeof stored!=='object'||Object.entries(stored).some(([width,pair])=>!Object.hasOwn(data.ranges,width)||!Array.isArray(pair)||pair.length!==2||pair.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>10000))))throw Error('Invalid responsive scale offsets.');
  if(data.steps!==undefined){
   if(!Array.isArray(data.steps)||data.steps.length>100)throw Error('Provide at most 100 transform steps.');
   const pair=value=>Array.isArray(value)&&value.length===2&&value.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=100000),width=n=>Number.isInteger(n)&&n>=0&&n<=7680;
   for(const step of data.steps){
    if(!step||typeof step!=='object'||Array.isArray(step))throw Error('Invalid transform step.');
    if(Object.hasOwn(step,'styles')){
     if(Object.keys(step).length!==1||!step.styles||typeof step.styles!=='object'||Array.isArray(step.styles)||Object.keys(step.styles).length>100)throw Error('Invalid member transform snapshot.');
     for(const [id,rules]of Object.entries(step.styles)){
      if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||!rules||typeof rules!=='object'||Array.isArray(rules)||Object.keys(rules).length>100)throw Error('Invalid member transform identity.');
      for(const [key,value]of Object.entries(rules))if(!/^(0|[1-9][0-9]*)$/.test(key)||!width(Number(key))||!value||Object.keys(value).some(key=>!['factor','move'].includes(key))||typeof value.factor!=='number'||!Number.isFinite(value.factor)||value.factor<.01||value.factor>100||!pair(value.move))throw Error('Invalid member transform values.');
     }
    }else if(Object.keys(step).some(key=>!['factor','min','max','offset','move'].includes(key))||!width(step.min)||step.max!==undefined&&(!width(step.max)||step.max<=step.min)||typeof step.factor!=='number'||!Number.isFinite(step.factor)||step.factor<.01||step.factor>100||!pair(step.offset)||!pair(step.move))throw Error('Invalid group transform step.');
   }
  }
  return ranges;
 }
 function members(value){
  const ids=JSON.parse(value);
  if(!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(id)))throw Error('Invalid released scale members.');
  return ids;
 }
 function mount({document=root.document,geometry,controller,eligible=()=>true}){
  const win=document.defaultView,active=new Map();let pending=0,disposed=false;
  const report=(el,error)=>el.dispatchEvent(new win.CustomEvent('retouch:scale-error',{bubbles:true,detail:{message:error.message}}));
  const overlaps=(a,b)=>a.some(left=>b.some(right=>left.contains(right)||right.contains(left)));
  function reconcile(){
   if(disposed)return;
   const candidates=new Map();
   for(const el of document.querySelectorAll('[data-rt-scale]'))try{
    if(!eligible(el))continue;
    const raw=el.getAttribute('data-rt-scale'),ranges=parse(raw),data=JSON.parse(raw);let roots=[el],signature=raw;
    if(el.hasAttribute('data-rt-scale-set')){
     if(el.tagName!=='SCRIPT'||el.type!=='application/json')throw Error('Released scale metadata must be inert JSON.');
     const ids=members(el.textContent),scope=el.getAttribute('data-rt-scale-scope');let nodes;
     if(scope===null)nodes=[...document.querySelectorAll('[data-rt-scale-member]')];
     else if(scope==='siblings'){nodes=[];for(let node=el.previousElementSibling;node&&ids.includes(node.getAttribute('data-rt-scale-member'));node=node.previousElementSibling)nodes.push(node);}
     else throw Error('Invalid released scale ownership scope.');
     signature+='|'+el.textContent+'|'+scope;
     roots=ids.flatMap(id=>{const matches=nodes.filter(node=>node.getAttribute('data-rt-scale-member')===id);if(matches.length>1)throw Error('A released scale member has multiple owners.');return matches;});
    }else if(!el.hasAttribute('data-rt-group'))throw Error('Responsive scaling requires a group.');
    if(roots.length)candidates.set(el,{signature,ranges,data,roots});
   }catch(error){report(el,error);}
   const conflicting=new Set();for(const [el,binding]of candidates)if([...candidates].some(([other,value])=>other!==el&&overlaps(binding.roots,value.roots)))conflicting.add(el);
   for(const el of conflicting){candidates.delete(el);report(el,Error('Overlapping responsive scale groups are not supported yet.'));}
   for(const [el,entry]of active){const next=candidates.get(el);if(!next||next.signature!==entry.signature||next.roots.length!==entry.roots.length||next.roots.some((node,i)=>node!==entry.roots[i])){entry.control.dispose();active.delete(el);}}
   for(const [el,binding]of candidates){
    if(active.has(el))continue;
    const {ranges,data,roots}=binding;
    const value=(map,fallback)=>{let result=fallback;for(const [width]of ranges){if(width>win.innerWidth)break;result=map[width]??fallback;}return result;};
    const control=controller.mount({geometry,steps:()=>data.steps||[],roots:()=>roots,identity:node=>node.getAttribute('data-rt-scale-member'),pixelOffset:()=>value(data.pixels||{},[0,0]),offset:()=>value(data.offsets||{},[0,0]),factor:()=>value(data.ranges,1),onError:error=>report(el,error)});
    active.set(el,{...binding,control});
   }
  }
  const observer=new win.MutationObserver(()=>{if(!disposed&&!pending)pending=win.requestAnimationFrame(()=>{pending=0;reconcile();});});
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-rt-scale','data-rt-group','data-rt-scale-set','data-rt-scale-scope','data-rt-scale-member']});reconcile();
  return {refresh(){reconcile();for(const entry of active.values())entry.control.refresh();},manages(el){return [...active.values()].some(entry=>entry.control.manages(el));},owns(el,property){return [...active.values()].some(entry=>entry.control.owns(el,property));},pause(elements){const releases=[...active.values()].filter(entry=>overlaps(entry.roots,elements)).map(entry=>entry.control.pause());return ()=>releases.forEach(release=>release());},dispose(){if(disposed)return;disposed=true;observer.disconnect();win.cancelAnimationFrame(pending);for(const entry of active.values())entry.control.dispose();active.clear();}};
 }
 const api={parse,members,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchGroupScaleBootstrap=api;
})(typeof window==='object'?window:globalThis);

})(undefined,scope,require,module);modules["./bootstrap.js"]=module.exports;}
 const registrations=new Map(),control=require('./bootstrap.js').mount({document,geometry:require('./group-move.js'),controller:require('./group-scale.js'),eligible:node=>registrations.has(node)});
 control.revision=revision;
 control.register=node=>{registrations.set(node,(registrations.get(node)||0)+1);control.refresh();let disposed=false;return ()=>{if(disposed)return;disposed=true;const count=registrations.get(node)||0;if(count<=1)registrations.delete(node);else registrations.set(node,count-1);control.refresh();};};
 document[key]=control;return control;
}
export default function RetouchScaleRuntime({warm=false}){
 const anchor=useRef(null);
 useLayoutEffect(()=>{const node=anchor.current,group=node?.parentElement;const release=group?.hasAttribute('data-rt-group')?install(group.ownerDocument.defaultView).register(group):null;node?.removeAttribute('data-rt-react-scale-pending');return ()=>{node?.setAttribute('data-rt-react-scale-pending','');release?.();};},[warm]);
 return warm?null:<script ref={anchor} type="application/json" data-rt-react-scale-anchor="" data-rt-react-scale-pending="" />;
}
