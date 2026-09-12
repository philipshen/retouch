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
 function movingHandles(handles,rotation,scale,originRates){
  const xs=handles.filter(h=>h==='e'||h==='w'),ys=handles.filter(h=>h==='s'||h==='n'),a=rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const choose=(edges,index)=>{const end=index===0?'e':'s',other=index===0?'w':'n',anchor=edges.length===2?-.5:edges[0]===end?0:-1;
   const response=edge=>Math.max(...originRates[index].map(origin=>{const transformed=((edge===end?1:0)-origin)*scale[index];return index===0?Math.hypot(anchor+origin+c*transformed,s*transformed):Math.hypot(-s*transformed,anchor+origin+c*transformed);}));
   return [...new Set(edges.map(edge=>response(edge)<1e-3&&response(edge===end?other:end)>=1e-3?(edge===end?other:end):edge))];
  };
  const x=choose(xs,0),y=choose(ys,1);return [...x,...y,...y.flatMap(v=>x.map(h=>v+h))];
 }
 // Typed OM preserves percentages that resolved getComputedStyle pixels lose.
 // Check both sides of piecewise origins without mutating the page element.
 function originRates(value,dimensions,Numeric){
  const tokens=[];let depth=0,start=0;for(let i=0;i<=value.length;i++){const char=value[i];if(char==='(')depth++;if(char===')')depth--;if(i===value.length||/\s/.test(char)&&depth===0){if(i>start)tokens.push(value.slice(start,i));start=i+1;}}
  if(tokens.length<2)throw Error('Unresolved transform origin.');
  const evaluate=(node,size)=>{if(node.unit)return node.unit==='percent'?node.value*size/100:node.unit==='number'?node.value:node.to('px').value;
   const values=node.values&&[...node.values].map(v=>evaluate(v,size));switch(node.operator){case 'sum':return values.reduce((a,b)=>a+b,0);case 'product':return values.reduce((a,b)=>a*b,1);case 'negate':return -evaluate(node.value,size);case 'invert':return 1/evaluate(node.value,size);case 'min':return Math.min(...values);case 'max':return Math.max(...values);case 'clamp':return Math.max(evaluate(node.lower,size),Math.min(evaluate(node.upper,size),evaluate(node.value,size)));default:throw Error('Unsupported origin expression.');}
  };
  return tokens.slice(0,2).map((token,i)=>{const node=Numeric.parse(token),size=dimensions[i],base=evaluate(node,size),rates=[base-evaluate(node,size-1),evaluate(node,size+1)-base];if(!rates.every(Number.isFinite))throw Error('Unresolved origin rate.');return rates;});
 }
 function handlesFor(el){
  const parent=root.RetouchInspector.layoutParent(el),w=el.ownerDocument.defaultView,css=w.getComputedStyle(el),handles=flowHandles(parent?w.getComputedStyle(parent):{},css),scale=root.RetouchFlip.parse(css.scale||'none'),rotation=root.RetouchReactSelection.rotationDegrees(css.rotate);
  if(!scale||scale.length!==2||!Number.isFinite(rotation)||rotation===0&&scale.every(n=>n===1))return handles;
  try{const raw=el.computedStyleMap().get('transform-origin').toString(),dimensions=['width','height'].map(axis=>root.RetouchReactSelection.dimensionSize(css,axis));return movingHandles(handles,rotation,scale,originRates(raw,dimensions,w.CSSNumericValue));}catch{return handles;}
 }
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
 // Solve the measured handle response. One degree of freedom projects onto its
 // allowed direction; a singular two-axis response retains the movable axis.
 function pointerCorrection(columns,error){
  const dot=(a,b)=>a.x*b.x+a.y*b.y,norm=columns.map(c=>dot(c,c));
  if(columns.length===2){const [a,b]=columns,det=a.x*b.y-a.y*b.x;if(Math.abs(det)>1e-8*Math.max(1,Math.sqrt(norm[0]*norm[1])))return [(error.x*b.y-error.y*b.x)/det,(a.x*error.y-a.y*error.x)/det];}
  const index=norm.indexOf(Math.max(...norm));return columns.map((c,i)=>i===index&&norm[i]>1e-8?dot(c,error)/norm[i]:0);
 }
 function available(el){const css=el.ownerDocument.defaultView.getComputedStyle(el);return !['absolute','fixed'].includes(css.position)&&!['inline','contents','none'].includes(css.display)&&!['width','height','inline-size','block-size','flex','flex-grow','flex-shrink','flex-basis'].some(p=>el.style.getPropertyValue(p));}
 function changes(el,sizes){const css=el.ownerDocument.defaultView.getComputedStyle(el),parent=root.RetouchInspector.layoutParent(el),p=parent&&el.ownerDocument.defaultView.getComputedStyle(parent),result={};for(const [axis,value]of Object.entries(sizes))result[axis]=root.RetouchReactSelection.dimensionValue(css,axis,value)+'px';if(p&&/flex/.test(p.display)&&Object.hasOwn(sizes,root.RetouchLayout.layoutAxes({direction:p.flexDirection,writingMode:p.writingMode}).main))Object.assign(result,{'flex-grow':'0','flex-shrink':'0','flex-basis':'auto'});return result;}
 function control(el,save){if(!available(el))return null;const button=root.RetouchInspector.canvasTool('resize',(opener,initial)=>root.resizeFlowOnCanvas(el,opener,save,initial));button.dataset.flowResize='true';button.retouchFlowHandles=()=>handlesFor(el);return button;}
 function mount({target,frame,canvas,control,save,current,onEnd,onError,initial=null}){
  let g;const measure=()=>root.RetouchInspector.geometry(target,{allowRotation:true,allowScale:true,layoutOnly:true});try{if(!available(target))throw Error('Choose a layer whose flow size can be edited.');g=measure();}catch(error){onError(error.message);return null;}
  const doc=root.document,w=target.ownerDocument.defaultView,f=frame.getBoundingClientRect(),c=canvas.getBoundingClientRect(),scale=f.width/w.innerWidth,left=Math.max(f.left,c.left),top=Math.max(f.top,c.top),right=Math.min(f.right,c.right),bottom=Math.min(f.bottom,c.bottom);
  if(!Number.isFinite(scale)||scale<=0||right<=left||bottom<=top||g.width<=0||g.height<=0){onError('Bring a visible layer into view before resizing.');return null;}
  const surface=doc.createElement('div');surface.className='canvas-flow-resize-surface';surface.tabIndex=0;surface.setAttribute('aria-label','Resize layer in flow');Object.assign(surface.style,{position:'fixed',left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px',overflow:'hidden',zIndex:40,touchAction:'none'});
  const directions=handlesFor(target),center=centersFor(target),names={e:'right',w:'left',n:'top',s:'bottom',ne:'top right',nw:'top left',se:'bottom right',sw:'bottom left'};const handles=directions.map(handle=>{const b=doc.createElement('button');b.type='button';b.dataset.flowHandle=handle;b.className='canvas-selection-resize';b.setAttribute('aria-label','Resize flow '+names[handle]);surface.append(b);return b;});
  const hint=doc.createElement('div');Object.assign(hint.style,{position:'fixed',bottom:'76px',left:'50%',transform:'translateX(-50%)',padding:'8px 12px',background:'var(--panel)',color:'var(--ink)',border:'1px solid var(--line)',borderRadius:'6px',fontSize:'11px',pointerEvents:'none'});hint.textContent='Drag to resize in layout · Shift keeps proportions · Arrows: 1px · Enter applies · Escape cancels';surface.append(hint);
  const readouts=[...doc.querySelectorAll('input')].filter(input=>input.retouchDimension?.target===target).map(input=>({input,original:input.value,last:null,...input.retouchDimension}));
  const originalStyle=target.getAttribute('style');let state=null,ended=false,raf,sizes=null,expectedStyle=originalStyle;const previews=new Map(),cleanups=[];
  const listen=(el,name,fn,options)=>{el.addEventListener(name,fn,options);cleanups.push(()=>el.removeEventListener(name,fn,options));};
  function valid(){if(!target.isConnected||!control.isConnected)return false;const css=w.getComputedStyle(target),signed=(root.RetouchFlip.parse(css.scale||'none'));return signed?.length===2&&signed[0]===g.scaleX&&signed[1]===g.scaleY&&root.RetouchReactSelection.rotationDegrees(css.rotate)===g.rotation&&target.isConnected&&control.isConnected&&target.getAttribute('style')===expectedStyle&&handlesFor(target).join(',')===directions.join(',')&&current();}
  function finish(commit=false){if(ended)return;const next=commit&&valid()?sizes:null,ownStyle=target.getAttribute('style')===expectedStyle;ended=true;root.cancelAnimationFrame(raf);surface.remove();cleanups.forEach(fn=>fn());[...previews.values()].reverse().forEach(p=>p.restore());if(ownStyle&&originalStyle===null&&target.getAttribute('style')==='')target.removeAttribute('style');for(const field of readouts)if(field.last!==null&&field.input.value===field.last)field.input.value=field.original;onEnd();if(next&&Object.entries(next).some(([axis,value])=>Math.abs(value-g[axis])>.01))save(next);}
  function paint(){const next=measure();if(sizes){const css=w.getComputedStyle(target);for(const field of readouts){if(!field.input.isConnected)continue;field.last=field.box==='css'?css.getPropertyValue(field.axis):String(Math.round(next[field.axis]*100)/100);field.input.value=field.last;}}hint.textContent=Math.round(next.width*100)/100+' × '+Math.round(next.height*100)/100+' px · Resize in layout · Shift keeps proportions · Arrows: 1px · Enter applies · Escape cancels';const points=root.RetouchCanvasRotate.resizeHandles(next,scale);for(const b of handles){const p=points.find(p=>p.handle===b.dataset.flowHandle);Object.assign(b.style,{left:f.left+p.x-left+'px',top:f.top+p.y-top+'px',rotate:next.rotation+'deg',cursor:root.RetouchCanvasRotate.resizeCursor(p.handle,next.rotation,next.scaleX,next.scaleY)});}}
  function applyPreview(requested){
   const css=w.getComputedStyle(target),safe={...requested};
   for(const axis of Object.keys(safe)){const edges=axis==='width'?['left','right']:['top','bottom'],minimum=edges.reduce((sum,edge)=>sum+(parseFloat(css.getPropertyValue('padding-'+edge))||0)+(parseFloat(css.getPropertyValue('border-'+edge+'-width'))||0),0);safe[axis]=Math.max(minimum,safe[axis]);}
   const values=changes(target,safe);
   for(const [property,preview]of previews)if(!Object.hasOwn(values,property)){preview.restore();previews.delete(property);}
   for(const property of Object.keys(values))if(!previews.has(property))previews.set(property,root.RetouchPaintPicker.propertyPreview({el:target,input:control,property,respectScope:true}));
   for(const [property,value]of Object.entries(values))previews.get(property).update(value);
   expectedStyle=target.getAttribute('style');return measure();
  }
  function followPointer(requested,actual,base,proportional){
   const point=g=>root.RetouchCanvasRotate.resizeHandles(g).find(p=>p.handle===state.handle),start=point(g),goal={x:start.x+state.dx/scale,y:start.y+state.dy/scale},axes=proportional?['width']:Object.keys(requested),ratio=base.height/base.width;
   for(let attempt=0;attempt<4;attempt++){
    const here=point(actual),error={x:goal.x-here.x,y:goal.y-here.y},columns=[];
    if(Math.hypot(error.x,error.y)<.04)break;
    for(const axis of axes){let column;
     for(const step of [4,-4]){const probe={...requested,[axis]:Math.max(1,requested[axis]+step)};if(proportional)probe.height=probe.width*ratio;const p=point(applyPreview(probe)),distance=probe[axis]-requested[axis];column=distance?{x:(p.x-here.x)/distance,y:(p.y-here.y)/distance}:{x:0,y:0};if(Math.hypot(column.x,column.y)>1e-5)break;}
     columns.push(column);
    }
    const correction=pointerCorrection(columns,error);if(correction.every(n=>Math.abs(n)<.01)){actual=applyPreview(requested);break;}
    axes.forEach((axis,i)=>requested[axis]=Math.max(1,Math.min(100000,requested[axis]+correction[i])));if(proportional)requested.height=requested.width*ratio;actual=applyPreview(requested);
   }
   // The last probe may have changed the page even when the correction is zero.
   return {requested,actual:applyPreview(requested)};
  }
  function update(e){
   if(!state||!valid()){finish();return;}
   try{
    const base=state.base||g,delta=state.keyboard?{x:state.dx,y:state.dy}:root.RetouchCanvasMove.rotateVector(state.dx/scale,state.dy/scale,-g.rotation),r=root.RetouchCanvasMove.resize(base.width,base.height,state.handle,delta.x*(!state.keyboard&&center.x?2:1)/(state.keyboard?1:g.scaleX),delta.y*(!state.keyboard&&center.y?2:1)/(state.keyboard?1:g.scaleY),{shiftKey:e.shiftKey});let requested={...state.previous};
    if(/[ew]/.test(state.handle)||e.shiftKey)requested.width=r.width;if(/[ns]/.test(state.handle)||e.shiftKey)requested.height=r.height;
    let actual=applyPreview(requested);
    if(!state.keyboard&&(g.rotation||g.scaleX!==1||g.scaleY!==1))({requested,actual}=followPointer(requested,actual,base,e.shiftKey));
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
 const api={movingHandles,originRates,pointerCorrection,centeredAxes,ratioCorrection,flowHandles,available,changes,control,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchFlowResize=api;
})(typeof window==='object'?window:globalThis);
