(function(root){
 'use strict';
 function delta(x,y,shift){return shift?(Math.abs(x)>=Math.abs(y)?{x,y:0}:{x:0,y}):{x,y};}
 // All geometry is in iframe viewport CSS pixels; tolerance is supplied in the
 // same units so the attraction distance stays constant at every canvas zoom.
 function equalSpacing(rect,movement,targets,axis,tolerance){
  const position=axis==='x'?'left':'top',size=axis==='x'?'width':'height',cross=axis==='x'?'top':'left',extent=axis==='x'?'height':'width',other=axis==='x'?'y':'x';
  const start=rect[position]+movement[axis],crossStart=rect[cross]+movement[other],crossEnd=crossStart+rect[extent];
  // Only compare adjacent, non-overlapping siblings in the same row or column.
  // The container is an alignment target, never an equal-spacing neighbor.
  const siblings=targets.filter(t=>!t.container&&Math.min(crossEnd,t[cross]+t[extent])-Math.max(crossStart,t[cross])>0).sort((a,b)=>a[position]-b[position]);let best=null;
  for(let i=0;i<siblings.length-1;i++){
   const a=siblings[i],b=siblings[i+1],aEnd=a[position]+a[size],bEnd=b[position]+b[size],gap=b[position]-aEnd;if(gap<0)continue;
   const middle=(aEnd+b[position]-rect[size])/2;
   for(const [destination,segments]of [
    [middle,[[aEnd,middle],[middle+rect[size],b[position]]]],
    [bEnd+gap,[[aEnd,b[position]],[bEnd,bEnd+gap]]],
    [a[position]-gap-rect[size],[[a[position]-gap,a[position]],[aEnd,b[position]]]]
   ]){
    const distance=Math.abs(destination-start);if(distance>tolerance||segments.some(([from,to])=>to<from))continue;
    if(siblings.some(t=>Math.min(destination+rect[size],t[position]+t[size])-Math.max(destination,t[position])>1e-6))continue;
    if(!best||distance<best.distance)best={destination,distance,segments:segments.map(([from,to])=>({axis,start:from,end:to,cross:crossStart+rect[extent]/2,gap:to-from}))};
   }
  }
  return best;
 }
 function snap(rect,movement,targets,{tolerance=6,lock=null}={}){
  const result={...movement,guides:[]};
  for(const axis of ['x','y']){
   if(lock&&axis!==lock)continue;
   const position=axis==='x'?'left':'top',dimension=axis==='x'?'width':'height',cross=axis==='x'?'top':'left',extent=axis==='x'?'height':'width';let best=null;
   for(const target of targets)for(const fraction of [0,.5,1])for(const other of [0,.5,1]){
    const value=target[position]+target[dimension]*other,adjustment=value-(rect[position]+movement[axis]+rect[dimension]*fraction);
    if(Math.abs(adjustment)<=tolerance&&(!best||Math.abs(adjustment)<Math.abs(best.adjustment)))best={adjustment,value,target};
   }
   if(best){result[axis]+=best.adjustment;result.guides.push({axis,value:best.value,start:Math.min(rect[cross]+movement[axis==='x'?'y':'x'],best.target[cross]),end:Math.max(rect[cross]+movement[axis==='x'?'y':'x']+rect[extent],best.target[cross]+best.target[extent])});}
  }
  result.spacing=[];
  for(const axis of ['x','y']){
   if(lock&&axis!==lock)continue;
   const other=axis==='x'?'y':'x',candidate=equalSpacing(rect,{...movement,[other]:result[other]},targets,axis,tolerance),aligned=result.guides.some(g=>g.axis===axis);
   if(candidate&&(!aligned||candidate.distance<Math.abs(result[axis]-movement[axis]))){result[axis]=candidate.destination-rect[axis==='x'?'left':'top'];result.guides=result.guides.filter(g=>g.axis!==axis);result.spacing.push(...candidate.segments);}
  }
  if(!result.spacing.length)delete result.spacing;
  return result;
 }
 function union(rects){
  if(!rects.length||rects.some(r=>!['left','top','width','height'].every(p=>Number.isFinite(r[p]))||r.width<=0||r.height<=0))throw Error('Select visible layers with nonzero sizes.');
  const left=Math.min(...rects.map(r=>r.left)),top=Math.min(...rects.map(r=>r.top)),right=Math.max(...rects.map(r=>r.left+r.width)),bottom=Math.max(...rects.map(r=>r.top+r.height));return {left,top,right,bottom,width:right-left,height:bottom-top};
 }
 function snapTargets(target,selected=[target]){
  const d=target.ownerDocument,w=d.defaultView,targets=[],parents=new Set(),siblings=new Set();
  for(const el of selected){const parent=el.offsetParent,viewport=!parent||parent===d.body&&w.getComputedStyle(parent).position==='static';parents.add(viewport?d:parent);for(const sibling of el.parentElement?.children||[])siblings.add(sibling);}
  for(const parent of parents){if(parent===d)targets.push({container:true,left:0,top:0,width:d.documentElement.clientWidth,height:w.innerHeight});else{const r=parent.getBoundingClientRect();targets.push({container:true,left:r.left+parent.clientLeft,top:r.top+parent.clientTop,width:parent.clientWidth,height:parent.clientHeight});}}
  for(const sibling of siblings){
   if(selected.some(el=>sibling===el||sibling.contains(el)))continue;const css=w.getComputedStyle(sibling),r=sibling.getBoundingClientRect();
   if(css.visibility!=='visible'||css.display==='none'||r.width<=0||r.height<=0||r.right<=0||r.bottom<=0||r.left>=w.innerWidth||r.top>=w.innerHeight)continue;
   targets.push(r);
  }
  return targets;
 }
 function resize(width,height,handle,dx,dy,{shiftKey=false,altKey=false,minWidth=1,minHeight=1,maxWidth=Infinity,maxHeight=Infinity}={}){
  if(!['n','s','e','w','ne','nw','se','sw'].includes(handle)||![width,height,dx,dy,minWidth,minHeight].every(Number.isFinite)||width<=0||height<=0)throw Error('Invalid resize geometry.');
  const hx=handle.includes('w')?-1:handle.includes('e')?1:0,hy=handle.includes('n')?-1:handle.includes('s')?1:0,m=altKey?2:1;
  let w=width+hx*dx*m,h=height+hy*dy*m;
  if(shiftKey){const ratio=hx&&(!hy||Math.abs((w-width)/width)>=Math.abs((h-height)/height))?w/width:h/height,low=Math.max(minWidth/width,minHeight/height),high=Math.min(Math.max(minWidth,maxWidth)/width,Math.max(minHeight,maxHeight)/height);if(low>high)throw Error('The size bounds do not allow this aspect ratio.');const f=Math.min(high,Math.max(low,ratio));w=width*f;h=height*f;}
  else{w=Math.max(minWidth,Math.min(maxWidth,w));h=Math.max(minHeight,Math.min(maxHeight,h));}
  return {x:altKey||!hx?(width-w)/2:hx<0?width-w:0,y:altKey||!hy?(height-h)/2:hy<0?height-h:0,width:w,height:h};
 }
 function snapResize(rect,handle,dx,dy,targets,options={}){
  const {tolerance=6,shiftKey=false,altKey=false}=options,m=altKey?2:1;
  const directions={x:handle.includes('w')?-1:handle.includes('e')?1:0,y:handle.includes('n')?-1:handle.includes('s')?1:0};
  const dimension={x:'width',y:'height'},position={x:'left',y:'top'},edge=(result,axis)=>rect[position[axis]]+result[axis]+(directions[axis]>0?result[dimension[axis]]:0);
  const raw=resize(rect.width,rect.height,handle,dx,dy,options),best={};let closest=null;
  // Solve a candidate size, then run it through the normal resize constraints.
  // A clamped result must actually reach the line before it can count as a snap.
  for(const axis of ['x','y']){
   const sign=directions[axis],size=dimension[axis],initial=rect[position[axis]]+(sign>0?rect[size]:0);
   if(!sign||Math.abs(edge(raw,axis)-initial)<1e-6)continue;
   for(const target of targets)for(const fraction of [0,.5,1]){
    const value=target[position[axis]]+target[size]*fraction,distance=Math.abs(value-edge(raw,axis));if(distance>tolerance)continue;
    const desired=rect[size]+sign*(value-initial)*m;
    let x=dx,y=dy;
    if(shiftKey){const factor=desired/rect[size];x=directions.x*(rect.width*factor-rect.width)/m;y=directions.y*(rect.height*factor-rect.height)/m;}
    else if(axis==='x')x=sign*(desired-rect[size])/m;else y=sign*(desired-rect[size])/m;
    const result=resize(rect.width,rect.height,handle,x,y,options);if(Math.abs(edge(result,axis)-value)>1e-4)continue;
    const candidate={x,y,result,distance};if(!best[axis]||distance<best[axis].distance)best[axis]=candidate;if(!closest||distance<closest.distance)closest=candidate;
   }
  }
  const result=shiftKey?(closest?.result||raw):resize(rect.width,rect.height,handle,best.x?.x??dx,best.y?.y??dy,options),guides=[];
  for(const axis of ['x','y']){
   if(!best[axis])continue;const cross=axis==='x'?'y':'x';
   for(const target of targets){const value=edge(result,axis);if(![0,.5,1].some(f=>Math.abs(value-target[position[axis]]-target[dimension[axis]]*f)<1e-4))continue;
    guides.push({axis,value,start:Math.min(rect[position[cross]]+result[cross],target[position[cross]]),end:Math.max(rect[position[cross]]+result[cross]+result[dimension[cross]],target[position[cross]]+target[dimension[cross]])});break;
   }
  }
  return {...result,guides};
 }
 function limits(target){
  const d=target.ownerDocument,window=d.defaultView,css=window.getComputedStyle(target),parent=target.offsetParent,viewport=!parent||parent===d.body&&window.getComputedStyle(parent).position==='static',w=viewport?d.documentElement.clientWidth:parent.clientWidth,h=viewport?window.innerHeight:parent.clientHeight;
  const number=p=>parseFloat(css.getPropertyValue(p))||0,borderX=number('padding-left')+number('padding-right')+number('border-left-width')+number('border-right-width'),borderY=number('padding-top')+number('padding-bottom')+number('border-top-width')+number('border-bottom-width');
  function value(raw,dimension,fallback){if(['auto','none'].includes(raw))return fallback;const match=/^(\d+(?:\.\d+)?|\.\d+)(px|%)$/.exec(raw);if(!match)throw Error('Use fixed or percentage size bounds before resizing on canvas.');return Number(match[1])*(match[2]==='%'?dimension/100:1);}
  // Placement writes border-box sizing; apply bounds in that resulting box model.
  return {minWidth:Math.max(1,borderX,value(css.minWidth,w,0)),minHeight:Math.max(1,borderY,value(css.minHeight,h,0)),maxWidth:value(css.maxWidth,w,Infinity),maxHeight:value(css.maxHeight,h,Infinity)};
 }
 function mount({target,targets=[target],selectionId=target.getAttribute('data-rt'),frame,canvas,mode='move',opener=root.document.activeElement,onCommit,onEnd,onError}){
  if(!targets.length||targets.length>100||new Set(targets).size!==targets.length||!targets.includes(target)||targets.some(el=>!el.isConnected||el.ownerDocument!==target.ownerDocument)){onError('Re-select the layers in one document.');return null;}
  if(targets.length>1&&mode!=='move'){onError('Resize layers individually for now.');return null;}
  const snapshots=targets.map(el=>({el,rect:el.getBoundingClientRect(),parent:el.offsetParent,parentWidth:el.offsetParent?.clientWidth,parentHeight:el.offsetParent?.clientHeight}));let r;try{r=union(snapshots.map(item=>item.rect));}catch(error){onError(error.message);return null;}
  const w=target.ownerDocument.defaultView,f=frame.getBoundingClientRect(),c=canvas.getBoundingClientRect(),scale=f.width/w.innerWidth;
  let bounds={};if(mode==='resize')try{bounds=limits(target);}catch(error){onError(error.message);return null;}
  const left=Math.max(f.left,c.left),top=Math.max(f.top,c.top),right=Math.min(f.right,c.right),bottom=Math.min(f.bottom,c.bottom);
  if(!Number.isFinite(scale)||scale<=0||right<=left||bottom<=top){onError('Bring the layer into view before moving it.');return null;}
  const surface=root.document.createElement('div');surface.className='canvas-move-surface';surface.tabIndex=0;surface.setAttribute('aria-label',(mode==='resize'?'Resize':'Move')+' layer on canvas');
  Object.assign(surface.style,{position:'fixed',left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px',zIndex:40,overflow:'hidden',touchAction:'none'});
  const preview=root.document.createElement('div');preview.className='canvas-move-preview';preview.setAttribute('aria-label','Drag selected layer');
  const x=f.left+r.left*scale-left,y=f.top+r.top*scale-top;
  Object.assign(preview.style,{position:'absolute',left:x+'px',top:y+'px',width:r.width*scale+'px',height:r.height*scale+'px',border:'0',outline:'2px solid #6366f1',outlineOffset:'-2px',boxSizing:'border-box',background:'rgba(99,102,241,.12)',cursor:'move'});surface.append(preview);
  if(targets.length>1)for(const {rect}of snapshots){const ghost=root.document.createElement('div');ghost.className='canvas-group-layer';ghost.setAttribute('aria-hidden','true');Object.assign(ghost.style,{position:'absolute',pointerEvents:'none',left:(rect.left-r.left)*scale+'px',top:(rect.top-r.top)*scale+'px',width:rect.width*scale+'px',height:rect.height*scale+'px',outline:'1px solid #6366f1',outlineOffset:'-1px',background:'rgba(99,102,241,.12)'});preview.append(ghost);}
  const guides=root.document.createElement('div');guides.className='canvas-snap-guides';guides.setAttribute('aria-hidden','true');guides.style.pointerEvents='none';surface.append(guides);
  {const hint=root.document.createElement('div');hint.textContent=mode==='move'?'Drag to align or match spacing · Shift locks an axis · Option / Alt disables snapping · Escape cancels':'Drag handles to align · Shift keeps proportions · Option / Alt resizes from center · ⌘ / Ctrl disables snapping · Escape cancels';Object.assign(hint.style,{position:'absolute',bottom:'8px',left:'8px',right:'8px',padding:'6px 8px',background:'#1e293b',color:'white',fontSize:'12px',borderRadius:'4px',pointerEvents:'none'});surface.append(hint);}
  function paintGuides(items){guides.replaceChildren();for(const item of items){const line=root.document.createElement('div');line.dataset.snapAxis=item.axis;Object.assign(line.style,{position:'absolute',background:'#e11d48',left:(item.axis==='x'?f.left+item.value*scale-left:f.left+item.start*scale-left)+'px',top:(item.axis==='y'?f.top+item.value*scale-top:f.top+item.start*scale-top)+'px',width:item.axis==='x'?'1px':Math.max(1,(item.end-item.start)*scale)+'px',height:item.axis==='y'?'1px':Math.max(1,(item.end-item.start)*scale)+'px'});guides.append(line);}}
  function paintSpacing(items=[]){for(const item of items){const line=root.document.createElement('div');line.dataset.spacingAxis=item.axis;line.dataset.spacingGap=String(Math.round(item.gap*100)/100);Object.assign(line.style,{position:'absolute',background:'#a21caf',left:(f.left+(item.axis==='x'?item.start:item.cross)*scale-left)+'px',top:(f.top+(item.axis==='y'?item.start:item.cross)*scale-top)+'px',width:item.axis==='x'?Math.max(1,(item.end-item.start)*scale)+'px':'1px',height:item.axis==='y'?Math.max(1,(item.end-item.start)*scale)+'px':'1px'});
   for(const end of [0,100]){const tick=root.document.createElement('span');Object.assign(tick.style,{position:'absolute',background:'#a21caf',left:item.axis==='x'?end+'%':'-3px',top:item.axis==='y'?end+'%':'-3px',width:item.axis==='x'?'1px':'7px',height:item.axis==='y'?'1px':'7px'});line.append(tick);}
   const label=root.document.createElement('span');label.textContent=(Math.round(item.gap*100)/100)+' px';Object.assign(label.style,{position:'absolute',whiteSpace:'nowrap',background:'#a21caf',color:'white',padding:'1px 3px',borderRadius:'2px',fontSize:'11px',lineHeight:'14px',left:item.axis==='x'?'50%':'6px',top:item.axis==='y'?'50%':'-20px',transform:item.axis==='x'?'translateX(-50%)':'translateY(-50%)'});line.append(label);guides.append(line);
  }}
  if(mode==='resize')for(const handle of ['nw','n','ne','e','se','s','sw','w']){const button=root.document.createElement('button');button.type='button';button.dataset.resizeHandle=handle;const name={n:'top',s:'bottom',e:'right',w:'left',ne:'top right',nw:'top left',se:'bottom right',sw:'bottom left'}[handle];button.setAttribute('aria-label','Resize '+name);button.title='Resize '+name+'. Arrow keys adjust; Enter applies; Escape cancels.';Object.assign(button.style,{position:'absolute',padding:'0',width:'10px',height:'10px',minWidth:'0',border:'1px solid #6366f1',borderRadius:'1px',background:'white',left:handle.includes('w')?'0%':handle.includes('e')?'100%':'50%',top:handle.includes('n')?'0%':handle.includes('s')?'100%':'50%',transform:'translate(-50%,-50%)',cursor:handle+'-resize'});preview.append(button);}
  if(x+r.width*scale<=0||y+r.height*scale<=0||x>=right-left||y>=bottom-top){onError('Bring the layer into view before moving it.');return null;}
  let state=null,ended=false;const cleanups=[];
  function listen(el,name,fn,options){el.addEventListener(name,fn,options);cleanups.push(()=>el.removeEventListener(name,fn,options));}
  function cancel(restoreFocus=false){if(ended)return;ended=true;surface.remove();cleanups.forEach(fn=>fn());onEnd();if(restoreFocus===true)(opener?.isConnected?opener:root.document.querySelector('[data-canvas-tool='+mode+']'))?.focus({preventScroll:true});}
  function paint(modifiers){
   if(mode==='resize'){const base=state.base||{x:0,y:0,width:r.width,height:r.height};const resized=!state.keyboard&&!modifiers.metaKey&&!modifiers.ctrlKey?snapResize(r,state.handle,state.rawX/scale,state.rawY/scale,snapTargets(target,targets),{...bounds,...modifiers,tolerance:6/scale}):{...resize(base.width,base.height,state.handle,state.rawX/scale,state.rawY/scale,{...bounds,...modifiers}),guides:[]};paintGuides(resized.guides);state.delta={x:resized.x,y:resized.y,width:resized.width,height:resized.height};state.delta.x+=base.x;state.delta.y+=base.y;preview.style.width=state.delta.width*scale+'px';preview.style.height=state.delta.height*scale+'px';preview.style.transform=`translate(${state.delta.x*scale}px,${state.delta.y*scale}px)`;}
   else{const locked=!state.keyboard&&modifiers.shiftKey,d=delta(state.rawX,state.rawY,locked),movement={x:d.x/scale,y:d.y/scale},snapped=!state.keyboard&&!modifiers.altKey&&!modifiers.metaKey&&!modifiers.ctrlKey?snap(r,movement,snapTargets(target,targets),{tolerance:6/scale,lock:locked?(Math.abs(state.rawX)>=Math.abs(state.rawY)?'x':'y'):state.rawX===0?'y':state.rawY===0?'x':null}):{...movement,guides:[]};state.delta={x:snapped.x,y:snapped.y};paintGuides(snapped.guides);paintSpacing(snapped.spacing);preview.style.transform=`translate(${state.delta.x*scale}px,${state.delta.y*scale}px)`;}
  }
  function move(e){if(!state||e.pointerId!==state.id)return;state.rawX=e.clientX-state.x;state.rawY=e.clientY-state.y;try{paint({shiftKey:e.shiftKey,altKey:e.altKey,metaKey:e.metaKey,ctrlKey:e.ctrlKey});}catch(error){cancel();onError(error.message);}}
  listen(surface,'pointerdown',e=>{if(e.button!==0||state)return;e.preventDefault();e.stopImmediatePropagation();const handle=e.target.dataset.resizeHandle;if(mode==='resize'?!handle:e.target!==preview){cancel();return;}state={id:e.pointerId,handle,x:e.clientX,y:e.clientY,rawX:0,rawY:0,delta:{x:0,y:0}};surface.setPointerCapture(e.pointerId);});
  listen(surface,'focusin',e=>{if(state?.keyboard&&mode==='resize'&&e.target.dataset.resizeHandle&&e.target.dataset.resizeHandle!==state.handle){state={keyboard:true,handle:e.target.dataset.resizeHandle,id:null,rawX:0,rawY:0,base:state.delta,delta:state.delta};}});
  listen(surface,'pointermove',move);
  listen(surface,'pointerup',e=>{if(!state||e.pointerId!==state.id)return;e.preventDefault();move(e);if(ended)return;const result=state.delta,distance=Math.hypot(state.rawX,state.rawY);cancel();const changed=Math.abs(result.x)+Math.abs(result.y)+(mode==='resize'?Math.abs(result.width-r.width)+Math.abs(result.height-r.height):0)>1e-6;if(distance>=4&&changed&&targets.every(el=>el.isConnected))onCommit(result);});
  for(const event of ['pointercancel','lostpointercapture'])listen(surface,event,cancel);
  listen(root,'keydown',e=>{
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel(true);return;}
   if(!surface.contains(e.target)||e.metaKey||e.ctrlKey)return;
   if(e.key==='Enter'&&state?.keyboard){e.preventDefault();e.stopImmediatePropagation();const result=state.delta,changed=Math.abs(result.x)+Math.abs(result.y)+(mode==='resize'?Math.abs(result.width-r.width)+Math.abs(result.height-r.height):0)>1e-6;cancel(true);if(changed&&targets.every(el=>el.isConnected))onCommit(result,{keyboard:true});return;}
   const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!direction||state&&!state.keyboard)return;
   const handle=e.target.dataset.resizeHandle;if(mode==='resize'&&!handle)return;e.preventDefault();e.stopImmediatePropagation();
   if(!state||state.handle!==handle)state={keyboard:true,handle,id:null,rawX:0,rawY:0,delta:{x:0,y:0}};
   const step=mode==='move'&&e.shiftKey?10:1;state.rawX+=direction[0]*step*scale;state.rawY+=direction[1]*step*scale;
   try{paint({shiftKey:e.shiftKey,altKey:e.altKey,metaKey:e.metaKey,ctrlKey:e.ctrlKey});}catch(error){cancel(true);onError(error.message);}
  },true);
  for(const event of ['keydown','keyup'])listen(root,event,e=>{if(state&&(!state.keyboard||surface.contains(e.target))&&['Shift','Alt','Meta','Control'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();try{paint({shiftKey:e.shiftKey,altKey:e.altKey,metaKey:e.metaKey,ctrlKey:e.ctrlKey});}catch(error){cancel();onError(error.message);}}},true);
  for(const event of ['retouch:before-zoom','retouch:screen','retouch:viewport','resize','blur','pagehide'])listen(root,event,cancel);
  listen(root,'retouch:selection',e=>{if(e.detail!==selectionId)cancel();});
  listen(frame,'load',cancel);listen(w,'scroll',cancel,true);listen(w,'resize',cancel);listen(canvas,'scroll',cancel);
  let tick;const observe=()=>{if(ended)return;if(snapshots.some(({el,rect,parent,parentWidth,parentHeight})=>{const current=el.getBoundingClientRect();return !el.isConnected||el.offsetParent!==parent||parent?.clientWidth!==parentWidth||parent?.clientHeight!==parentHeight||['left','top','width','height'].some(key=>Math.abs(current[key]-rect[key])>.5);})){cancel();return;}tick=root.requestAnimationFrame(observe);};tick=root.requestAnimationFrame(observe);cleanups.push(()=>root.cancelAnimationFrame(tick));
  root.document.body.append(surface);(mode==='resize'?preview.querySelector('[data-resize-handle=se]'):surface).focus({preventScroll:true});return cancel;
 }
 const api={delta,union,snap,resize,snapResize,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchCanvasMove=api;
})(typeof window==='object'?window:globalThis);
