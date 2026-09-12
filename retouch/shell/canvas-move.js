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
 function memberBounds(rects,next){
  const group=union(rects);if(!['x','y','width','height'].every(p=>Number.isFinite(next[p]))||next.width<=0||next.height<=0)throw Error('Use positive selection dimensions.');
  const sx=next.width/group.width,sy=next.height/group.height;
  return rects.map(r=>({x:next.x+(r.left-group.left)*(sx-1),y:next.y+(r.top-group.top)*(sy-1),width:r.width*sx,height:r.height*sy}));
 }
 function groupLimits(rects,limits){
  const group=union(rects);if(limits.length!==rects.length)throw Error('Measure every layer’s size bounds.');const result={};
  for(const [size,min,max]of [['width','minWidth','maxWidth'],['height','minHeight','maxHeight']]){
   const low=Math.max(...rects.map((r,i)=>limits[i][min]/r[size])),high=Math.min(...rects.map((r,i)=>Math.max(limits[i][min],limits[i][max])/r[size]));
   if(!Number.isFinite(low)||low<=0||Number.isNaN(high)||low>high)throw Error('The layer size bounds do not allow resizing together.');result[min]=group[size]*low;result[max]=group[size]*high;
  }
  return result;
 }
 function snapTargets(target,selected=[target]){
  const d=target.ownerDocument,w=d.defaultView,targets=[],parents=new Set(),siblings=new Set();
  for(const el of selected){const parent=el.offsetParent,viewport=!parent||parent===d.body&&w.getComputedStyle(parent).position==='static'&&['none',''].includes(w.getComputedStyle(parent).rotate||'');parents.add(viewport?d:parent);for(const sibling of el.parentElement?.children||[])siblings.add(sibling);}
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
 function limits(target,preserveBox=false){
  const d=target.ownerDocument,window=d.defaultView,css=window.getComputedStyle(target),parent=target.offsetParent,viewport=!parent||parent===d.body&&window.getComputedStyle(parent).position==='static'&&['none',''].includes(window.getComputedStyle(parent).rotate||''),w=viewport?d.documentElement.clientWidth:parent.clientWidth,h=viewport?window.innerHeight:parent.clientHeight;
  const number=p=>parseFloat(css.getPropertyValue(p))||0,borderX=number('padding-left')+number('padding-right')+number('border-left-width')+number('border-right-width'),borderY=number('padding-top')+number('padding-bottom')+number('border-top-width')+number('border-bottom-width');
  function value(raw,dimension,fallback){if(['auto','none'].includes(raw))return fallback;const match=/^(\d+(?:\.\d+)?|\.\d+)(px|%)$/.exec(raw);if(!match)throw Error('Use fixed or percentage size bounds before resizing on canvas.');return Number(match[1])*(match[2]==='%'?dimension/100:1);}
  // Convert authored content-box limits when the writer retains that box model.
  const extra=preserveBox&&css.boxSizing==='content-box',result={minWidth:Math.max(1,borderX,value(css.minWidth,w,0)+(extra?borderX:0)),minHeight:Math.max(1,borderY,value(css.minHeight,h,0)+(extra?borderY:0)),maxWidth:value(css.maxWidth,w,Infinity)+(extra?borderX:0),maxHeight:value(css.maxHeight,h,Infinity)+(extra?borderY:0)};
  if(preserveBox){const r=target.getBoundingClientRect();for(const [key,size]of [['minWidth','width'],['maxWidth','width'],['minHeight','height'],['maxHeight','height']])if(Math.abs(result[key]-r[size])<1/32)result[key]=r[size];}return result;
 }
 function mount({target,targets=[target],selectionId=target.getAttribute('data-rt'),frame,canvas,mode='move',spacing=null,preserveBox=targets.length>1,opener=root.document.activeElement,onCommit,onEnd,onError}){
  if(!targets.length||targets.length>100||new Set(targets).size!==targets.length||!targets.includes(target)||targets.some(el=>!el.isConnected||el.ownerDocument!==target.ownerDocument)){onError('Re-select the layers in one document.');return null;}
  const snapshots=targets.map(el=>({el,rect:el.getBoundingClientRect(),parent:el.offsetParent,parentWidth:el.offsetParent?.clientWidth,parentHeight:el.offsetParent?.clientHeight}));let r;try{r=union(snapshots.map(item=>item.rect));}catch(error){onError(error.message);return null;}
  const isSpacing=mode==='spacing-x'||mode==='spacing-y',axis=mode==='spacing-y'?'y':'x',rects=snapshots.map(item=>item.rect);let gapInfo;
  const spacingHint=spacing?.independent?'Drag a gap label to adjust just that gap':'Drag a gap label to set equal spacing';
  if(isSpacing)try{if(!spacing||spacing.axis!==axis)throw Error('Choose a spacing direction.');gapInfo=root.RetouchSelectionLayout.gaps(rects,axis);root.RetouchSelectionLayout.setSpacing(rects,axis,0,spacing);}catch(error){onError(error.message);return null;}
  const w=target.ownerDocument.defaultView,f=frame.getBoundingClientRect(),c=canvas.getBoundingClientRect(),scale=f.width/w.innerWidth;
  let bounds={};if(mode==='resize')try{for(const item of snapshots)item.sizeLimits=limits(item.el,preserveBox);bounds=targets.length>1?groupLimits(snapshots.map(item=>item.rect),snapshots.map(item=>item.sizeLimits)):snapshots[0].sizeLimits;}catch(error){onError(error.message);return null;}
  const left=Math.max(f.left,c.left),top=Math.max(f.top,c.top),right=Math.min(f.right,c.right),bottom=Math.min(f.bottom,c.bottom);
  if(!Number.isFinite(scale)||scale<=0||right<=left||bottom<=top){onError('Bring the layer into view before moving it.');return null;}
  const surface=root.document.createElement('div');surface.className='canvas-move-surface';surface.tabIndex=0;surface.setAttribute('aria-label',isSpacing?'Adjust '+(axis==='x'?'horizontal':'vertical')+' selection gaps on canvas':(mode==='resize'?'Resize':'Move')+(targets.length>1?' selection':' layer')+' on canvas');
  Object.assign(surface.style,{position:'fixed',left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px',zIndex:40,overflow:'hidden',touchAction:'none'});
  const preview=root.document.createElement('div');preview.className='canvas-move-preview';preview.setAttribute('aria-label',targets.length>1?'Drag selected layers':'Drag selected layer');
  const x=f.left+r.left*scale-left,y=f.top+r.top*scale-top;
  Object.assign(preview.style,{position:'absolute',left:x+'px',top:y+'px',width:r.width*scale+'px',height:r.height*scale+'px',border:'0',outline:'2px solid #6366f1',outlineOffset:'-2px',boxSizing:'border-box',background:'rgba(99,102,241,.12)',cursor:'move'});surface.append(preview);if(isSpacing){preview.style.pointerEvents='none';preview.style.background='transparent';}
  if(targets.length>1)for(const {rect}of snapshots){const ghost=root.document.createElement('div');ghost.className='canvas-group-layer';ghost.setAttribute('aria-hidden','true');Object.assign(ghost.style,{position:'absolute',pointerEvents:'none',left:(rect.left-r.left)*scale+'px',top:(rect.top-r.top)*scale+'px',width:rect.width*scale+'px',height:rect.height*scale+'px',outline:'1px solid #6366f1',outlineOffset:'-1px',background:'rgba(99,102,241,.12)'});preview.append(ghost);}
  const guides=root.document.createElement('div');guides.className='canvas-snap-guides';guides.setAttribute('aria-hidden','true');guides.style.pointerEvents='none';surface.append(guides);
  {const hint=root.document.createElement('div');hint.textContent=isSpacing?spacingHint+' · Arrow keys: 1px · Shift: 10px · Enter applies · Escape cancels':mode==='move'?'Drag to align or match spacing · Shift locks an axis · Option / Alt disables snapping · Escape cancels':'Drag handles to align · Shift keeps proportions · Option / Alt resizes from center · ⌘ / Ctrl disables snapping · Escape cancels';Object.assign(hint.style,{position:'absolute',bottom:'8px',left:'8px',right:'8px',padding:'6px 8px',background:'#1e293b',color:'white',fontSize:'12px',borderRadius:'4px',pointerEvents:'none'});surface.append(hint);}
  function paintGuides(items){guides.replaceChildren();for(const item of items){const line=root.document.createElement('div');line.dataset.snapAxis=item.axis;Object.assign(line.style,{position:'absolute',background:'#e11d48',left:(item.axis==='x'?f.left+item.value*scale-left:f.left+item.start*scale-left)+'px',top:(item.axis==='y'?f.top+item.value*scale-top:f.top+item.start*scale-top)+'px',width:item.axis==='x'?'1px':Math.max(1,(item.end-item.start)*scale)+'px',height:item.axis==='y'?'1px':Math.max(1,(item.end-item.start)*scale)+'px'});guides.append(line);}}
  function paintSpacing(items=[],labels=true){for(const item of items){const line=root.document.createElement('div');line.dataset.spacingAxis=item.axis;line.dataset.spacingGap=String(Math.round(item.gap*100)/100);Object.assign(line.style,{position:'absolute',background:'#a21caf',left:(f.left+(item.axis==='x'?item.start:item.cross)*scale-left)+'px',top:(f.top+(item.axis==='y'?item.start:item.cross)*scale-top)+'px',width:item.axis==='x'?Math.max(1,(item.end-item.start)*scale)+'px':'1px',height:item.axis==='y'?Math.max(1,(item.end-item.start)*scale)+'px':'1px'});
   for(const end of [0,100]){const tick=root.document.createElement('span');Object.assign(tick.style,{position:'absolute',background:'#a21caf',left:item.axis==='x'?end+'%':'-3px',top:item.axis==='y'?end+'%':'-3px',width:item.axis==='x'?'1px':'7px',height:item.axis==='y'?'1px':'7px'});line.append(tick);}
   if(labels){const label=root.document.createElement('span');label.textContent=(Math.round(item.gap*100)/100)+' px';Object.assign(label.style,{position:'absolute',whiteSpace:'nowrap',background:'#a21caf',color:'white',padding:'1px 3px',borderRadius:'2px',fontSize:'11px',lineHeight:'14px',left:item.axis==='x'?'50%':'6px',top:item.axis==='y'?'50%':'-20px',transform:item.axis==='x'?'translateX(-50%)':'translateY(-50%)'});line.append(label);}guides.append(line);
  }}
  const gapHandles=[];
  function paintGaps(deltas=rects.map(()=>({x:0,y:0}))){
   const position=axis==='x'?'left':'top',size=axis==='x'?'width':'height',cross=axis==='x'?'top':'left',extent=axis==='x'?'height':'width',other=axis==='x'?'y':'x',segments=[];
   gapHandles.forEach((button,i)=>{const a=gapInfo.sorted[i].i,b=gapInfo.sorted[i+1].i,from=rects[a][position]+deltas[a][axis]+rects[a][size],to=rects[b][position]+deltas[b][axis],middle=(from+to)/2,crossValue=(rects[a][cross]+deltas[a][other]+rects[a][extent]/2+rects[b][cross]+deltas[b][other]+rects[b][extent]/2)/2,gap=Math.round((to-from)*100)/100;segments.push({axis,start:Math.min(from,to),end:Math.max(from,to),cross:crossValue,gap});button.textContent=gap+' px';button.setAttribute('aria-label',(axis==='x'?'Horizontal':'Vertical')+' gap '+(i+1)+': '+gap+' pixels');Object.assign(button.style,{left:(f.left+(axis==='x'?middle:crossValue)*scale-left)+'px',top:(f.top+(axis==='y'?middle:crossValue)*scale-top)+'px'});});paintGuides([]);paintSpacing(segments,false);
  }
  if(isSpacing){for(let i=0;i<gapInfo.values.length;i++){const button=root.document.createElement('button');button.type='button';button.dataset.spacingIndex=String(i);button.className='canvas-gap-handle';button.title=spacingHint+'. Arrow keys adjust; Shift: 10px; Enter applies; Escape cancels.';Object.assign(button.style,{position:'absolute',transform:'translate(-50%,-50%)',padding:'3px 5px',minWidth:'36px',height:'24px',border:'1px solid white',borderRadius:'4px',background:'#a21caf',color:'white',fontSize:'11px',whiteSpace:'nowrap',cursor:axis==='x'?'ew-resize':'ns-resize'});surface.append(button);gapHandles.push(button);}paintGaps();}
  function changed(result){return isSpacing?result.deltas?.some(d=>Math.abs(d.x)+Math.abs(d.y)>=1/32):Math.abs(result.x)+Math.abs(result.y)+(mode==='resize'?Math.abs(result.width-r.width)+Math.abs(result.height-r.height):0)>1e-6;}
  if(mode==='resize')for(const handle of ['nw','n','ne','e','se','s','sw','w']){const button=root.document.createElement('button');button.type='button';button.dataset.resizeHandle=handle;const name={n:'top',s:'bottom',e:'right',w:'left',ne:'top right',nw:'top left',se:'bottom right',sw:'bottom left'}[handle];button.setAttribute('aria-label','Resize '+name);button.title='Resize '+name+'. Arrow keys adjust; Enter applies; Escape cancels.';Object.assign(button.style,{position:'absolute',padding:'0',width:'10px',height:'10px',minWidth:'0',border:'1px solid #6366f1',borderRadius:'1px',background:'white',left:handle.includes('w')?'0%':handle.includes('e')?'100%':'50%',top:handle.includes('n')?'0%':handle.includes('s')?'100%':'50%',transform:'translate(-50%,-50%)',cursor:handle+'-resize'});preview.append(button);}
  if(x+r.width*scale<=0||y+r.height*scale<=0||x>=right-left||y>=bottom-top){onError('Bring the layer into view before moving it.');return null;}
  let state=null,ended=false;const cleanups=[];
  function listen(el,name,fn,options){el.addEventListener(name,fn,options);cleanups.push(()=>el.removeEventListener(name,fn,options));}
  function cancel(restoreFocus=false){if(ended)return;ended=true;surface.remove();cleanups.forEach(fn=>fn());onEnd();if(restoreFocus===true)(opener?.isConnected?opener:root.document.querySelector('[data-canvas-tool='+mode+']'))?.focus({preventScroll:true});}
  function paint(modifiers){
   if(isSpacing){
    const amount=(axis==='x'?state.rawX:state.rawY)/scale,index=Number(state.handle),minimum=1/32-(spacing.independent?gapInfo.sorted[index].size:Math.min(...gapInfo.sorted.slice(0,-1).map(item=>item.size))),gap=amount===0?state.gapStart:Math.max(minimum,Math.min(100000,state.gapStart+amount)),values=[...(state.baseGaps||gapInfo.values)];
    if(spacing.independent)values[index]=gap;else values.fill(gap);
    const untouched=amount===0&&!state.baseGaps||values.every((value,i)=>value===gapInfo.values[i]),deltas=untouched?rects.map(()=>({x:0,y:0})):root.RetouchSelectionLayout.setGaps(rects,axis,values,spacing),next=rects.map((rect,i)=>({left:rect.left+deltas[i].x,top:rect.top+deltas[i].y,width:rect.width,height:rect.height})),box=union(next);state.delta={x:0,y:0,gap,values:untouched?gapInfo.values:values,deltas};Object.assign(preview.style,{left:(x+(box.left-r.left)*scale)+'px',top:(y+(box.top-r.top)*scale)+'px',width:box.width*scale+'px',height:box.height*scale+'px'});preview.querySelectorAll('.canvas-group-layer').forEach((ghost,i)=>Object.assign(ghost.style,{left:(next[i].left-box.left)*scale+'px',top:(next[i].top-box.top)*scale+'px'}));paintGaps(deltas);
   }
   else if(mode==='resize'){const base=state.base||{x:0,y:0,width:r.width,height:r.height};const resized=!state.keyboard&&!modifiers.metaKey&&!modifiers.ctrlKey?snapResize(r,state.handle,state.rawX/scale,state.rawY/scale,snapTargets(target,targets),{...bounds,...modifiers,tolerance:6/scale}):{...resize(base.width,base.height,state.handle,state.rawX/scale,state.rawY/scale,{...bounds,...modifiers}),guides:[]};paintGuides(resized.guides);state.delta={x:resized.x,y:resized.y,width:resized.width,height:resized.height};state.delta.x+=base.x;state.delta.y+=base.y;preview.style.width=state.delta.width*scale+'px';preview.style.height=state.delta.height*scale+'px';preview.style.transform=`translate(${state.delta.x*scale}px,${state.delta.y*scale}px)`;if(targets.length>1){const sx=state.delta.width/r.width,sy=state.delta.height/r.height;preview.querySelectorAll('.canvas-group-layer').forEach((ghost,i)=>{const rect=snapshots[i].rect;Object.assign(ghost.style,{left:(rect.left-r.left)*sx*scale+'px',top:(rect.top-r.top)*sy*scale+'px',width:rect.width*sx*scale+'px',height:rect.height*sy*scale+'px'});});}}
   else{const locked=!state.keyboard&&modifiers.shiftKey,d=delta(state.rawX,state.rawY,locked),movement={x:d.x/scale,y:d.y/scale},snapped=!state.keyboard&&!modifiers.altKey&&!modifiers.metaKey&&!modifiers.ctrlKey?snap(r,movement,snapTargets(target,targets),{tolerance:6/scale,lock:locked?(Math.abs(state.rawX)>=Math.abs(state.rawY)?'x':'y'):state.rawX===0?'y':state.rawY===0?'x':null}):{...movement,guides:[]};state.delta={x:snapped.x,y:snapped.y};paintGuides(snapped.guides);paintSpacing(snapped.spacing);preview.style.transform=`translate(${state.delta.x*scale}px,${state.delta.y*scale}px)`;}
  }
  function move(e){if(!state||e.pointerId!==state.id)return;state.rawX=e.clientX-state.x;state.rawY=e.clientY-state.y;try{paint({shiftKey:e.shiftKey,altKey:e.altKey,metaKey:e.metaKey,ctrlKey:e.ctrlKey});}catch(error){cancel();onError(error.message);}}
  listen(surface,'contextmenu',e=>{e.preventDefault();e.stopPropagation();});
  listen(surface,'pointerdown',e=>{if(e.button!==0||state)return;e.preventDefault();e.stopImmediatePropagation();const handle=isSpacing?e.target.dataset.spacingIndex:e.target.dataset.resizeHandle;if(isSpacing?handle===undefined:mode==='resize'?!handle:e.target!==preview){cancel();return;}state={id:e.pointerId,handle,gapStart:isSpacing?gapInfo.values[Number(handle)]:null,x:e.clientX,y:e.clientY,rawX:0,rawY:0,delta:{x:0,y:0}};surface.setPointerCapture(e.pointerId);});
  listen(surface,'focusin',e=>{if(state?.keyboard&&isSpacing&&spacing.independent&&e.target.dataset.spacingIndex!==undefined&&e.target.dataset.spacingIndex!==state.handle){const handle=e.target.dataset.spacingIndex;state={keyboard:true,handle,id:null,gapStart:state.delta.values[Number(handle)],baseGaps:state.delta.values,rawX:0,rawY:0,delta:state.delta};}});
  listen(surface,'focusin',e=>{if(state?.keyboard&&mode==='resize'&&e.target.dataset.resizeHandle&&e.target.dataset.resizeHandle!==state.handle){state={keyboard:true,handle:e.target.dataset.resizeHandle,id:null,rawX:0,rawY:0,base:state.delta,delta:state.delta};}});
  listen(surface,'pointermove',move);
  listen(surface,'pointerup',e=>{if(!state||e.pointerId!==state.id)return;e.preventDefault();move(e);if(ended)return;const result=state.delta,distance=isSpacing?Math.abs(axis==='x'?state.rawX:state.rawY):Math.hypot(state.rawX,state.rawY);cancel();if(distance>=4&&changed(result)&&targets.every(el=>el.isConnected))onCommit(result);});
  for(const event of ['pointercancel','lostpointercapture'])listen(surface,event,cancel);
  listen(root,'keydown',e=>{
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel(true);return;}
   if(!surface.contains(e.target)||e.metaKey||e.ctrlKey)return;
   if(e.key==='Enter'&&state?.keyboard){e.preventDefault();e.stopImmediatePropagation();const result=state.delta;cancel(true);if(changed(result)&&targets.every(el=>el.isConnected))onCommit(result,{keyboard:true});return;}
   const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!direction||state&&!state.keyboard)return;
   const handle=isSpacing?e.target.dataset.spacingIndex:e.target.dataset.resizeHandle;if(isSpacing?(handle===undefined||direction[axis==='x'?0:1]===0):mode==='resize'&&!handle)return;e.preventDefault();e.stopImmediatePropagation();
   if(!state||!isSpacing&&state.handle!==handle)state={keyboard:true,handle,gapStart:isSpacing?gapInfo.values[Number(handle)]:null,id:null,rawX:0,rawY:0,delta:{x:0,y:0}};
   const step=(mode==='move'||isSpacing)&&e.shiftKey?10:1;state.rawX+=direction[0]*step*scale;state.rawY+=direction[1]*step*scale;
   try{paint({shiftKey:e.shiftKey,altKey:e.altKey,metaKey:e.metaKey,ctrlKey:e.ctrlKey});}catch(error){cancel(true);onError(error.message);}
  },true);
  for(const event of ['keydown','keyup'])listen(root,event,e=>{if(state&&(!state.keyboard||surface.contains(e.target))&&['Shift','Alt','Meta','Control'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();try{paint({shiftKey:e.shiftKey,altKey:e.altKey,metaKey:e.metaKey,ctrlKey:e.ctrlKey});}catch(error){cancel();onError(error.message);}}},true);
  for(const event of ['retouch:selection-layout','retouch:before-zoom','retouch:screen','retouch:viewport','resize','blur','pagehide'])listen(root,event,cancel);
  listen(root,'retouch:selection',e=>{if(e.detail!==selectionId)cancel();});
  listen(frame,'load',cancel);listen(w,'scroll',cancel,true);listen(w,'resize',cancel);listen(canvas,'scroll',cancel);
  let tick;const observe=()=>{if(ended)return;if(snapshots.some(({el,rect,parent,parentWidth,parentHeight,sizeLimits})=>{const current=el.getBoundingClientRect();if(sizeLimits)try{const next=limits(el,preserveBox);if(Object.keys(sizeLimits).some(key=>next[key]!==sizeLimits[key]))return true;}catch{return true;}return !el.isConnected||el.offsetParent!==parent||parent?.clientWidth!==parentWidth||parent?.clientHeight!==parentHeight||['left','top','width','height'].some(key=>Math.abs(current[key]-rect[key])>.5);})){cancel();return;}tick=root.requestAnimationFrame(observe);};tick=root.requestAnimationFrame(observe);cleanups.push(()=>root.cancelAnimationFrame(tick));
  root.document.body.append(surface);(isSpacing?gapHandles[0]:mode==='resize'?preview.querySelector('[data-resize-handle=se]'):surface).focus({preventScroll:true});return cancel;
 }
 const api={delta,union,memberBounds,groupLimits,snap,resize,snapResize,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchCanvasMove=api;
})(typeof window==='object'?window:globalThis);
