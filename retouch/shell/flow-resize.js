(function(root){
 'use strict';
 function centeredAxes(parent={},child={}){
  const vertical=/^(vertical|sideways)-/.test(parent.writingMode||''),inline=vertical?'y':'x',block=vertical?'x':'y',axes={x:false,y:false},alignment=(value,fallback)=>!value||value==='auto'?fallback:value;
  if(/grid/.test(parent.display||'')){axes[inline]=alignment(child.justifySelf,parent.justifyItems)==='center';axes[block]=alignment(child.alignSelf,parent.alignItems)==='center';}
  else if(/flex/.test(parent.display||'')){const cross=/^column/.test(parent.flexDirection||'row')?inline:block;axes[cross]=alignment(child.alignSelf,parent.alignItems)==='center';}
  return axes;
 }
 function flowHandles(parent={},child={}){
  const vertical=/^(vertical|sideways)-/.test(parent.writingMode||''),inline=vertical?'y':'x',block=vertical?'x':'y',signs={};
  signs[inline]=(parent.direction==='rtl'?-1:1)*(parent.writingMode==='sideways-lr'?-1:1);signs[block]=vertical&&parent.writingMode.endsWith('-rl')?-1:1;
  const end=value=>['end','self-end','flex-end'].includes(value),alignment=(value,fallback)=>!value||value==='auto'?fallback:value;
  if(/flex/.test(parent.display||'')){
   const row=!/^column/.test(parent.flexDirection||'row'),main=row?inline:block,cross=row?block:inline;
   if((parent.flexDirection||'').endsWith('-reverse'))signs[main]*=-1;
   if(parent.flexWrap==='wrap-reverse')signs[cross]*=-1;
   if(end(alignment(child.alignSelf,parent.alignItems)))signs[cross]*=-1;
  }else if(/grid/.test(parent.display||'')){
   if(end(alignment(child.justifySelf,parent.justifyItems)))signs[inline]*=-1;
   if(end(alignment(child.alignSelf,parent.alignItems)))signs[block]*=-1;
  }
  const horizontal=signs.x<0?'w':'e',height=signs.y<0?'n':'s',center=centeredAxes(parent,child),xs=center.x?['e','w']:[horizontal],ys=center.y?['s','n']:[height];return [...xs,...ys,...ys.flatMap(y=>xs.map(x=>y+x))];
 }
 function centersFor(el){const parent=root.RetouchInspector.layoutParent(el),w=el.ownerDocument.defaultView;return centeredAxes(parent?w.getComputedStyle(parent):{},w.getComputedStyle(el));}
 function handlesFor(el){const parent=root.RetouchInspector.layoutParent(el),w=el.ownerDocument.defaultView;return flowHandles(parent?w.getComputedStyle(parent):{},w.getComputedStyle(el));}
 function ratioCorrection(base,requested,actual){
  const axes=['width','height'];if(axes.some(axis=>![base[axis],requested[axis],actual[axis]].every(value=>Number.isFinite(value)&&value>0)))throw Error('Use positive layer dimensions for proportional resizing.');
  const tolerance=.04,unit=Math.min(base.width,base.height);
  if(Math.abs(actual.width/base.width-actual.height/base.height)*unit<=tolerance)return null;
  let lower=0,upper=Infinity;
  for(const axis of axes){if(actual[axis]>requested[axis]+tolerance)lower=Math.max(lower,actual[axis]/base[axis]);if(actual[axis]<requested[axis]-tolerance)upper=Math.min(upper,actual[axis]/base[axis]);}
  if(lower>upper+tolerance/unit)throw Error('The layout’s size bounds do not allow this aspect ratio.');
  const factor=Math.max(lower,Math.min(upper,requested.width/base.width)),next={width:base.width*factor,height:base.height*factor};
  if(!Number.isFinite(factor)||axes.every(axis=>Math.abs(next[axis]-requested[axis])<=tolerance))throw Error('The layout’s size rules prevent proportional resizing.');return next;
 }
 function available(el){const css=el.ownerDocument.defaultView.getComputedStyle(el);return !['absolute','fixed'].includes(css.position)&&!['inline','contents','none'].includes(css.display)&&!['width','height','inline-size','block-size','flex','flex-grow','flex-shrink','flex-basis'].some(p=>el.style.getPropertyValue(p));}
 function changes(el,sizes){const css=el.ownerDocument.defaultView.getComputedStyle(el),parent=root.RetouchInspector.layoutParent(el),p=parent&&el.ownerDocument.defaultView.getComputedStyle(parent),result={};for(const [axis,value]of Object.entries(sizes))result[axis]=root.RetouchReactSelection.dimensionValue(css,axis,value)+'px';if(p&&/flex/.test(p.display)&&Object.hasOwn(sizes,root.RetouchLayout.layoutAxes({direction:p.flexDirection,writingMode:p.writingMode}).main))Object.assign(result,{'flex-grow':'0','flex-shrink':'0','flex-basis':'auto'});return result;}
 function control(el,save){if(!available(el))return null;const button=root.RetouchInspector.canvasTool('resize',(opener,initial)=>root.resizeFlowOnCanvas(el,opener,save,initial));button.dataset.flowResize='true';button.retouchFlowHandles=()=>handlesFor(el);return button;}
 function mount({target,frame,canvas,control,save,current,onEnd,onError,initial=null}){
  let g;const measure=()=>root.RetouchInspector.geometry(target,{allowRotation:true,layoutOnly:true});try{if(!available(target))throw Error('Choose a layer whose flow size can be edited.');g=measure();}catch(error){onError(error.message);return null;}
  const doc=root.document,w=target.ownerDocument.defaultView,f=frame.getBoundingClientRect(),c=canvas.getBoundingClientRect(),scale=f.width/w.innerWidth,left=Math.max(f.left,c.left),top=Math.max(f.top,c.top),right=Math.min(f.right,c.right),bottom=Math.min(f.bottom,c.bottom);
  if(!Number.isFinite(scale)||scale<=0||right<=left||bottom<=top||g.width<=0||g.height<=0){onError('Bring a visible layer into view before resizing.');return null;}
  const surface=doc.createElement('div');surface.className='canvas-flow-resize-surface';surface.tabIndex=0;surface.setAttribute('aria-label','Resize layer in flow');Object.assign(surface.style,{position:'fixed',left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px',overflow:'hidden',zIndex:40,touchAction:'none'});
  const directions=handlesFor(target),center=centersFor(target),names={e:'right',w:'left',n:'top',s:'bottom',ne:'top right',nw:'top left',se:'bottom right',sw:'bottom left'};const handles=directions.map(handle=>{const b=doc.createElement('button');b.type='button';b.dataset.flowHandle=handle;b.className='canvas-selection-resize';b.setAttribute('aria-label','Resize flow '+names[handle]);surface.append(b);return b;});
  const hint=doc.createElement('div');Object.assign(hint.style,{position:'fixed',bottom:'76px',left:'50%',transform:'translateX(-50%)',padding:'8px 12px',background:'var(--panel)',color:'var(--ink)',border:'1px solid var(--line)',borderRadius:'6px',fontSize:'11px',pointerEvents:'none'});hint.textContent='Drag to resize in layout · Shift keeps proportions · Arrows: 1px · Enter applies · Escape cancels';surface.append(hint);
  const readouts=[...doc.querySelectorAll('input')].filter(input=>input.retouchDimension?.target===target).map(input=>({input,original:input.value,last:null,...input.retouchDimension}));
  let state=null,ended=false,raf,sizes=null,expectedStyle=target.getAttribute('style');const previews=new Map(),cleanups=[];
  const listen=(el,name,fn,options)=>{el.addEventListener(name,fn,options);cleanups.push(()=>el.removeEventListener(name,fn,options));};
  function valid(){return target.isConnected&&control.isConnected&&target.getAttribute('style')===expectedStyle&&handlesFor(target).join(',')===directions.join(',')&&current();}
  function finish(commit=false){if(ended)return;const next=commit&&valid()?sizes:null;ended=true;root.cancelAnimationFrame(raf);surface.remove();cleanups.forEach(fn=>fn());[...previews.values()].reverse().forEach(p=>p.restore());for(const field of readouts)if(field.last!==null&&field.input.value===field.last)field.input.value=field.original;onEnd();if(next&&Object.entries(next).some(([axis,value])=>Math.abs(value-g[axis])>.01))save(next);}
  function paint(){const next=measure();if(sizes){const css=w.getComputedStyle(target);for(const field of readouts){if(!field.input.isConnected)continue;field.last=field.box==='css'?css.getPropertyValue(field.axis):String(Math.round(next[field.axis]*100)/100);field.input.value=field.last;}}hint.textContent=Math.round(next.width*100)/100+' × '+Math.round(next.height*100)/100+' px · Resize in layout · Shift keeps proportions · Arrows: 1px · Enter applies · Escape cancels';const points=root.RetouchCanvasRotate.resizeHandles(next,scale);for(const b of handles){const p=points.find(p=>p.handle===b.dataset.flowHandle);Object.assign(b.style,{left:f.left+p.x-left+'px',top:f.top+p.y-top+'px',rotate:next.rotation+'deg',cursor:root.RetouchCanvasRotate.resizeCursor(p.handle,next.rotation)});}}
  function applyPreview(requested){
   const css=w.getComputedStyle(target),safe={...requested};
   for(const axis of Object.keys(safe)){const edges=axis==='width'?['left','right']:['top','bottom'],minimum=edges.reduce((sum,edge)=>sum+(parseFloat(css.getPropertyValue('padding-'+edge))||0)+(parseFloat(css.getPropertyValue('border-'+edge+'-width'))||0),0);safe[axis]=Math.max(minimum,safe[axis]);}
   const values=changes(target,safe);
   for(const [property,preview]of previews)if(!Object.hasOwn(values,property)){preview.restore();previews.delete(property);}
   for(const property of Object.keys(values))if(!previews.has(property))previews.set(property,root.RetouchPaintPicker.propertyPreview({el:target,input:control,property,respectScope:true}));
   for(const [property,value]of Object.entries(values))previews.get(property).update(value);
   expectedStyle=target.getAttribute('style');return measure();
  }
  function update(e){
   if(!state||!valid()){finish();return;}
   try{
    const base=state.base||g,delta=state.keyboard?{x:state.dx,y:state.dy}:root.RetouchCanvasMove.rotateVector(state.dx/scale,state.dy/scale,-g.rotation),r=root.RetouchCanvasMove.resize(base.width,base.height,state.handle,delta.x*(!state.keyboard&&center.x?2:1),delta.y*(!state.keyboard&&center.y?2:1),{shiftKey:e.shiftKey});let requested={...state.previous};
    if(/[ew]/.test(state.handle)||e.shiftKey)requested.width=r.width;if(/[ns]/.test(state.handle)||e.shiftKey)requested.height=r.height;
    let actual=applyPreview(requested);
    if(e.shiftKey){for(let attempt=0;attempt<4;attempt++){const corrected=ratioCorrection(base,requested,actual);if(!corrected)break;requested=corrected;actual=applyPreview(requested);}if(ratioCorrection(base,requested,actual))throw Error('The layout’s size rules did not settle at this aspect ratio.');}
    sizes=Object.fromEntries(Object.keys(requested).map(axis=>[axis,actual[axis]]));paint();
   }catch(error){finish();onError(error.message);}
  }
  function begin(e,handle){if(e.button!==0||!directions.includes(handle))return;e.preventDefault();e.stopPropagation();state={id:e.pointerId,handle,x:e.clientX,y:e.clientY,dx:0,dy:0};surface.setPointerCapture(e.pointerId);}
  listen(surface,'pointerdown',e=>begin(e,e.target.dataset.flowHandle));listen(surface,'pointermove',e=>{if(state?.id!==e.pointerId)return;state.dx=e.clientX-state.x;state.dy=e.clientY-state.y;update(e);});listen(surface,'pointerup',e=>{if(state?.id===e.pointerId)finish(Math.hypot(state.dx,state.dy)>=4);});listen(surface,'pointercancel',()=>finish());listen(surface,'lostpointercapture',()=>finish());listen(root,'pointerdown',e=>{if(!surface.contains(e.target))finish();},true);
  listen(surface,'keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish();return;}if(e.key==='Enter'){e.preventDefault();finish(true);return;}const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},d=directions[e.key],handle=e.target.dataset.flowHandle;if(!d||!handle||state&&!state.keyboard)return;e.preventDefault();e.stopPropagation();if(!state||state.handle!==handle)state={keyboard:true,handle,dx:0,dy:0,base:{...g,...sizes},previous:sizes};state.dx+=d[0];state.dy+=d[1];update(e);},true);
  for(const event of ['keydown','keyup'])listen(root,event,e=>{if(e.key==='Shift'&&state){e.preventDefault();update(e);}},true);
  for(const event of ['blur','resize','retouch:screen','retouch:viewport','retouch:before-zoom'])listen(root,event,()=>finish());listen(w,'scroll',()=>finish(),true);listen(canvas,'scroll',()=>finish(),true);listen(frame,'load',()=>finish());
  function tick(){if(!valid()){finish();return;}try{paint();}catch{finish();return;}raf=root.requestAnimationFrame(tick);}
  doc.body.append(surface);paint();handles.at(-1).focus({preventScroll:true});if(initial)begin(initial.event,initial.handle);raf=root.requestAnimationFrame(tick);return ()=>finish();
 }
 const api={centeredAxes,ratioCorrection,flowHandles,available,changes,control,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchFlowResize=api;
})(typeof window==='object'?window:globalThis);
