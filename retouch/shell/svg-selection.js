(function(root){
 'use strict';
 let rotatingSelection=false;
 const individualGapSelections=new Set(),alignmentTargets=new Map(),sizeLocks=new Set(),selectionKey=infos=>JSON.stringify(infos.map(i=>[i.file,i.id]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 const A=()=>root.RetouchSVGAffine||require('./svg-affine.js'),array=m=>[m.a,m.b,m.c,m.d,m.e,m.f];
 function inverse(m){const d=m[0]*m[3]-m[1]*m[2];return Math.abs(d)<1e-9?null:[m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];}
 function transform(parent,global,own){const inv=inverse(parent);return inv&&A().multiply(A().multiply(A().multiply(inv,global),parent),own);}
 function matricesFor(members,global){return Object.fromEntries(members.map(m=>[m.info.id,m.covered?m.info.svgTransform.matrix:transform(m.parent,global,m.info.svgTransform.matrix)]));}
 function alignmentMatrices(members,mode,target=null,asGroup=false){
  const outer=members.filter(m=>!m.covered),layout=root.RetouchSelectionLayout||require('./selection-layout.js'),rects=outer.map(m=>m.rect),left=Math.min(...rects.map(r=>r.left)),top=Math.min(...rects.map(r=>r.top)),bounds={left,top,width:Math.max(...rects.map(r=>r.left+r.width))-left,height:Math.max(...rects.map(r=>r.top+r.height))-top},deltas=asGroup?outer.map(()=>layout.arrange([bounds],mode,target,{allowDegenerate:true})[0]):layout.arrange(rects,mode,target,{allowDegenerate:true}),moves=new Map(outer.map((m,i)=>[m,deltas[i]]));
  const result=Object.fromEntries(members.map(m=>{const delta=moves.get(m);return [m.info.id,delta?transform(m.parent,[1,0,0,1,delta.x,delta.y],m.info.svgTransform.matrix):m.info.svgTransform.matrix];}));
  if(Object.values(result).some(m=>!A().valid(m)))throw Error('Keep every aligned vector within the supported range.');return result;
 }
 function spacingMatrices(members,axis,gap,start=null,index=null){
  const outer=members.filter(m=>!m.covered),layout=root.RetouchSelectionLayout||require('./selection-layout.js'),rects=outer.map(m=>m.rect),values=layout.gaps(rects,axis).values;if(index!==null){if(!Number.isInteger(index)||index<0||index>=values.length)throw Error('Choose an existing gap.');values[index]=gap;}
  const deltas=index===null?layout.setSpacing(rects,axis,gap,{start,allowDegenerate:true}):layout.setGaps(rects,axis,values,{start,allowDegenerate:true}),moves=new Map(outer.map((m,i)=>[m,deltas[i]]));
  const result=Object.fromEntries(members.map(m=>{const delta=moves.get(m);return [m.info.id,delta?transform(m.parent,[1,0,0,1,delta.x,delta.y],m.info.svgTransform.matrix):m.info.svgTransform.matrix];}));
  if(Object.values(result).some(m=>!A().valid(m)))throw Error('Keep every spaced vector within the supported range.');return result;
 }
 function resizeBounds(box,axis,value,locked=false){
  if(!['width','height'].includes(axis)||!Number.isFinite(value)||value<=0||value>100000||!box[axis]||(locked&&(!box.width||!box.height)))return null;
  const scale=value/box[axis],sx=axis==='width'||locked?scale:1,sy=axis==='height'||locked?scale:1;
  if(box.width*sx>100000||box.height*sy>100000)return null;
  return [sx,0,0,sy,box.left*(1-sx),box.top*(1-sy)];
 }
 function capture(infos,elements,probe=true){
  if(infos.length!==elements.length||elements.some(el=>!el?.isConnected)||new Set(infos.map(i=>i.file)).size!==1)throw Error('Select visible vectors from one source file.');
  const members=infos.map((info,i)=>{const el=elements[i],reason=root.RetouchSVGResize.reason(el,info,probe);if(reason)throw Error(reason);if(el.getAttribute('transform')!==info.svgTransform.value)throw Error('The vector changed. Re-select it.');const data=root.RetouchSVGResize.measure(el),parent=A().multiply(array(data.m),inverse(info.svgTransform.matrix));return {info,el,parent,covered:elements.some(ancestor=>ancestor!==el&&ancestor.contains(el)),rect:el.getBoundingClientRect()};});
  const outer=members.filter(m=>!m.covered);const left=Math.min(...outer.map(m=>m.rect.left)),top=Math.min(...outer.map(m=>m.rect.top)),right=Math.max(...outer.map(m=>m.rect.right)),bottom=Math.max(...outer.map(m=>m.rect.bottom));return {members,box:{left,top,width:right-left,height:bottom-top},w:elements[0].ownerDocument.defaultView};
 }
 const handles=['nw','n','ne','e','se','s','sw','w'],handleNames=['top left','top','top right','right','bottom right','bottom','bottom left','left'];
 function handleButton(i){
  const b=root.document.createElement('button');b.type='button';b.tabIndex=-1;b.setAttribute('aria-label','Resize selection from '+handleNames[i]);b.title='Resize selection · Shift: proportions · Control: unlock / no snapping · Option / Alt: center';
  Object.assign(b.style,{position:'absolute',zIndex:2,width:'10px',height:'10px',padding:'0',border:'1px solid var(--accent)',background:'white',pointerEvents:'auto',touchAction:'none',transform:'translate(-50%,-50%)',cursor:['nwse-resize','ns-resize','nesw-resize','ew-resize','nwse-resize','ns-resize','nesw-resize','ew-resize'][i]});return b;
 }
 function points(box){return [[0,0],[.5,0],[1,0],[1,.5],[1,1],[.5,1],[0,1],[0,.5]].map(([x,y])=>({x:box.left+x*box.width,y:box.top+y*box.height}));}
 function rotationPoints(box,scale){const cx=box.left+box.width/2,cy=box.top+box.height/2;return [0,2,4,6].map(i=>{const p=points(box)[i],dx=p.x-cx,dy=p.y-cy,length=Math.hypot(dx,dy)||1;return {x:p.x+dx/length*18/scale,y:p.y+dy/length*18/scale};});}
 function rotationButton(i){const b=handleButton(i);b.setAttribute('aria-label','Rotate selection from '+handleNames[i]);b.title='Rotate selection · Shift: snap to 15°';Object.assign(b.style,{zIndex:1,width:'24px',height:'24px',background:'transparent',border:'0',cursor:'grab'});return b;}
 function canvasRotation(box,start,point,snap=false){const cx=box.left+box.width/2,cy=box.top+box.height/2;let angle=(Math.atan2(point.y-cy,point.x-cx)-Math.atan2(start.y-cy,start.x-cx))*180/Math.PI;angle=((angle+180)%360+360)%360-180;if(snap)angle=Math.round(angle/15)*15;return {angle,matrix:A().parse('rotate('+angle+' '+cx+' '+cy+')')};}
 function controls({frame,canvas,onStart,onRotate}){
  const host=root.document.createElement('div');Object.assign(host.style,{position:'fixed',pointerEvents:'none',overflow:'hidden',zIndex:30});host.hidden=true;root.document.body.append(host);let active=null;
  const buttons=handles.map((key,i)=>{const b=handleButton(i);b.onpointerdown=e=>{if(!active||e.button!==0)return;e.preventDefault();e.stopPropagation();onStart(e,key);};host.append(b);return b;});
  const rotations=[0,2,4,6].map(i=>{const b=rotationButton(i);b.onpointerdown=e=>{if(!active||e.button!==0)return;e.preventDefault();e.stopPropagation();onRotate(e,handles[i]);};host.append(b);return b;});
  return {update(infos,elements){active=null;host.hidden=true;if(!infos?.length)return;try{const {box}=capture(infos,elements,false);if(!box.width||!box.height)return;const f=frame.getBoundingClientRect(),c=canvas.getBoundingClientRect(),scale=f.width/frame.contentWindow.innerWidth,left=Math.max(f.left,c.left),top=Math.max(f.top,c.top),right=Math.min(f.right,c.right),bottom=Math.min(f.bottom,c.bottom);Object.assign(host.style,{left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px'});const seen=[];points(box).forEach((p,i)=>{const x=f.left+p.x*scale-left,y=f.top+p.y*scale-top,b=buttons[i];b.hidden=x<6||y<6||x>right-left-6||y>bottom-top-6||seen.some(p=>Math.hypot(x-p.x,y-p.y)<9);if(!b.hidden)seen.push({x,y});b.style.left=x+'px';b.style.top=y+'px';});rotationPoints(box,scale).forEach((p,i)=>{const b=rotations[i],x=f.left+p.x*scale-left,y=f.top+p.y*scale-top;b.hidden=x<12||y<12||x>right-left-12||y>bottom-top-12;b.style.left=x+'px';b.style.top=y+'px';});active=infos;host.hidden=false;}catch{}}};
 }
 function resizeSelection(box,handle,dx,dy,modifiers={},locked=false,targets=[],tolerance=6){
  if(!box.width||!box.height)return null;
  const C=root.RetouchCanvasMove||require('./canvas-move.js'),ratio=!modifiers.ctrlKey&&(locked||modifiers.shiftKey),options={shiftKey:!!ratio,altKey:!!modifiers.altKey,minWidth:1,minHeight:1,maxWidth:100000,maxHeight:100000,tolerance},d=modifiers.ctrlKey?C.resize(box.width,box.height,handle,dx,dy,options):C.snapResize(box,handle,dx,dy,targets,options),sx=d.width/box.width,sy=d.height/box.height;
  return {matrix:[sx,0,0,sy,box.left+d.x-box.left*sx,box.top+d.y-box.top*sy],guides:d.guides||[]};
 }
 function canvasResize(...args){return resizeSelection(...args)?.matrix||null;}

 function nudge(infos,elements,{initialKey,initialPointer,initialMove,pointerTarget,frame,handle,rotating=false,current,onCommit,onEnd,onError,canvas}){
  let state;try{state=capture(infos,elements);}catch(error){onError(error.message);return null;}
  rotatingSelection=rotating;
  const members=state.members,w=state.w,cleanup=[],held=new Set(),original=members.map(m=>m.el.getAttribute('transform')),screens=members.map(m=>array(m.el.getScreenCTM())),geometry=members.map(m=>{const g=m.el.getBBox();return [g.x,g.y,g.width,g.height];});
  let ended=false,raf,x=0,y=0,global=A().identity(),next=matricesFor(members,A().identity()),last=original.slice();
  const surface=root.document.createElement('div');surface.setAttribute('aria-label',rotating?'Rotate SVG selection on canvas':handle?'Resize SVG selection on canvas':initialPointer?'Drag SVG selection on canvas':'Move SVG selection on canvas');Object.assign(surface.style,{position:'fixed',bottom:'116px',left:'50%',transform:'translateX(-50%)',zIndex:40});
  const button=root.document.createElement('button');button.type='button';Object.assign(button.style,{padding:'8px 12px',border:'1px solid var(--line)',borderRadius:'6px',background:'var(--panel)',color:'var(--ink)',fontSize:'11px',fontFamily:'inherit'});button.textContent=rotating?'Rotate selection · Shift: snap to 15° · Escape cancels':handle?'Resize selection · Shift: proportions · Control: unlock / no snapping · Option / Alt: center · Escape cancels':initialPointer?'Move selection · Shift: lock axis · Control: no snapping · Release applies · Escape cancels':'Move selection · Arrows: 1 · Shift: 10 · Release applies · Escape cancels';surface.append(button);root.document.body.append(surface);
  const guideSurface=initialPointer&&!rotating?root.document.createElement('div'):null,f=frame?.getBoundingClientRect(),scale=f?f.width/w.innerWidth:1;let paintGuides=()=>{},lastPointer=initialMove;
  if(guideSurface){const c=canvas.getBoundingClientRect();Object.assign(guideSurface.style,{position:'fixed',left:c.left+'px',top:c.top+'px',width:c.width+'px',height:c.height+'px',overflow:'hidden',pointerEvents:'none',zIndex:39});root.document.body.append(guideSurface);paintGuides=root.RetouchSVGSnapping.mount(guideSurface,{f,scale,left:c.left,top:c.top});}
  const activeHandle=handle?(rotating?rotationButton:handleButton)(handles.indexOf(handle)):null;
  const outline=rotating?root.document.createElementNS('http://www.w3.org/2000/svg','svg'):null;let polygon,clip;
  if(outline){clip=canvas.getBoundingClientRect();Object.assign(outline.style,{position:'fixed',left:clip.left+'px',top:clip.top+'px',width:clip.width+'px',height:clip.height+'px',pointerEvents:'none',zIndex:39,overflow:'hidden'});polygon=root.document.createElementNS(outline.namespaceURI,'polygon');polygon.setAttribute('fill','none');polygon.setAttribute('stroke','var(--accent)');polygon.setAttribute('stroke-width','1');outline.append(polygon);root.document.body.append(outline);}
  function paintHandle(){if(!activeHandle)return;const p=rotating?rotationPoints(state.box,scale)[[0,2,4,6].indexOf(handles.indexOf(handle))]:points(state.box)[handles.indexOf(handle)],project=p=>({x:f.left+(global[0]*p.x+global[2]*p.y+global[4])*scale,y:f.top+(global[1]*p.x+global[3]*p.y+global[5])*scale}),position=project(p);activeHandle.style.left=position.x+'px';activeHandle.style.top=position.y+'px';if(polygon)polygon.setAttribute('points',[0,2,4,6].map(i=>{const p=project(points(state.box)[i]);return (p.x-clip.left)+','+(p.y-clip.top);}).join(' '));}
  if(activeHandle){Object.assign(activeHandle.style,{position:'fixed',zIndex:41});root.document.body.append(activeHandle);pointerTarget=activeHandle;paintHandle();}
  function listen(el,type,fn,capture=false){el.addEventListener(type,fn,capture);cleanup.push(()=>el.removeEventListener(type,fn,capture));}
  function valid(){
   if(!current())return false;
   try{return members.every((m,i)=>{if(!m.el.isConnected||m.el.getAttribute('transform')!==last[i])return false;const screen=array(m.el.getScreenCTM()),expected=A().multiply(global,screens[i]);const g=m.el.getBBox();return screen.every((v,j)=>Math.abs(v-expected[j])<.1)&&[g.x,g.y,g.width,g.height].every((v,j)=>Math.abs(v-geometry[i][j])<.75);});}catch{return false;}
  }
  function end(commit=false){if(ended)return;const save=commit&&valid()&&!A().equivalent(global,A().identity());ended=true;rotatingSelection=false;root.cancelAnimationFrame(raf);cleanup.forEach(fn=>fn());surface.remove();outline?.remove();guideSurface?.remove();activeHandle?.remove();if(initialPointer&&pointerTarget?.hasPointerCapture(initialPointer.pointerId))pointerTarget.releasePointerCapture(initialPointer.pointerId);members.forEach((m,i)=>{if(m.el.getAttribute('transform')!==last[i])return;if(original[i]===null)m.el.removeAttribute('transform');else m.el.setAttribute('transform',original[i]);});onEnd();if(save)onCommit(next);}
  function keyDown(e){
   if(e.isComposing||(e.key!=='Escape'&&(e.ctrlKey||e.metaKey||e.altKey))||!['Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
   e.preventDefault();e.stopImmediatePropagation();if(e.key==='Escape'){end();return;}if(initialPointer)return;if(!valid()){end();return;}
   held.add(e.key);const step=e.shiftKey?10:1,dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;
   translate(x+dx,y+dy);
  }
  function translate(dx,dy){
   applyGlobal([1,0,0,1,dx,dy]);
  }
  function applyGlobal(matrix){
   if(!matrix){end();return;}const matrices=matricesFor(members,matrix);if(Object.values(matrices).some(m=>!A().valid(m))){end();onError('Keep every transformed vector within the supported range.');return;}
   global=matrix;x=matrix[4];y=matrix[5];next=matrices;members.forEach((m,i)=>{if(m.covered)return;last[i]=A().format(next[m.info.id]);m.el.setAttribute('transform',last[i]);});paintHandle();
  }
  function pointerMove(e,modifiers=e){
   if(e.pointerId!==initialPointer.pointerId||ended)return;if(!valid()){end();return;}lastPointer=e;e.preventDefault();e.stopImmediatePropagation();
   if(rotating){const toPoint=e=>({x:(e.clientX-f.left)/scale,y:(e.clientY-f.top)/scale}),result=canvasRotation(state.box,toPoint(initialPointer),toPoint(e),modifiers.shiftKey);applyGlobal(result.matrix);button.textContent=Math.round(-result.angle*100)/100+'° · Shift: snap to 15° · Escape cancels';return;}
   if(handle){const targets=members.filter(m=>!m.covered).flatMap(m=>root.RetouchSVGSnapping.targets(m.el,elements)),result=resizeSelection(state.box,handle,(e.clientX-initialPointer.clientX)/scale,(e.clientY-initialPointer.clientY)/scale,modifiers,sizeLocks.has(selectionKey(infos)),targets,6/scale);paintGuides(result||{});applyGlobal(result?.matrix);return;}
   const movement=root.RetouchSVGSnapping.movement(A().identity(),e.clientX-initialPointer.clientX,e.clientY-initialPointer.clientY,modifiers.shiftKey),targets=members.filter(m=>!m.covered).flatMap(m=>root.RetouchSVGSnapping.targets(m.el,elements)),unique=[...new Map(targets.map(t=>[JSON.stringify(t),t])).values()],result=modifiers.ctrlKey?movement:root.RetouchCanvasMove.snap(state.box,movement,unique,{tolerance:6/scale,lock:movement.lock});paintGuides(result);translate(result.x,result.y);
  }
  if(initialPointer){
   listen(handle?root:w,'pointermove',pointerMove,true);listen(handle?root:w,'pointerup',e=>{if(e.pointerId!==initialPointer.pointerId)return;e.preventDefault();e.stopImmediatePropagation();end(true);},true);
   for(const event of ['pointercancel','lostpointercapture'])listen(handle?root:w,event,e=>{if(e.pointerId===initialPointer.pointerId)end();},true);
   for(const event of ['keydown','keyup'])listen(root,event,e=>{if(['Shift','Control','Alt'].includes(e.key)&&lastPointer)pointerMove(lastPointer,e);},true);
  }
  listen(surface,'keydown',keyDown,true);listen(root,'keyup',e=>{if(!held.delete(e.key))return;e.preventDefault();e.stopImmediatePropagation();if(!held.size)end(true);},true);
  for(const event of ['blur','resize','retouch:screen','retouch:viewport','retouch:before-zoom'])listen(root,event,()=>end());
  listen(w,'scroll',()=>end(),true);listen(w,'pagehide',()=>end());listen(w,'pointerdown',()=>end(),true);listen(canvas,'scroll',()=>end(),true);listen(root.document,'pointerdown',()=>end(),true);
  const tick=()=>{if(!valid()){end();return;}raf=root.requestAnimationFrame(tick);};button.focus({preventScroll:true});if(initialKey)keyDown(initialKey);if(initialPointer){try{pointerTarget.setPointerCapture(initialPointer.pointerId);if(initialMove)pointerMove(initialMove);}catch(error){end();onError(error.message);}}if(!ended)raf=root.requestAnimationFrame(tick);return ended?null:()=>end();
 }
 function mount(infos,elements,{save,current}){
  const I=root.RetouchInspector,section=I.section('Selection transform'),key=selectionKey(infos);let locked=sizeLocks.has(key);let initial;try{initial=capture(infos,elements);}catch(error){I.note(section,error.message,'refused').setAttribute('role','alert');return section;}
  function fieldMatrix(box,w,kind,value){const cx=box.left+box.width/2,cy=box.top+box.height/2;let g;
   if(kind==='x'||kind==='y'){if(!Number.isFinite(value)||Math.abs(value)>100000)throw Error('Enter a position within 100000 pixels.');g=[1,0,0,1,kind==='x'?value-box.left-w.scrollX:0,kind==='y'?value-box.top-w.scrollY:0];}
   else if(kind==='width'||kind==='height'){g=resizeBounds(box,kind,value,locked);if(!g)throw Error('Keep both selection dimensions positive and at most 100000 pixels when proportions are locked.');}
   else if(kind==='rotation'){if(!Number.isFinite(value)||Math.abs(value)>360)throw Error('Enter an angle from -360 to 360 degrees.');g=A().parse('rotate('+(-value)+' '+cx+' '+cy+')');}
   else {const sx=kind==='flip-x'?-1:1,sy=kind==='flip-y'?-1:1;g=[sx,0,0,sy,cx*(1-sx),cy*(1-sy)];}
   return g;
  }
  function apply(kind,value){if(!current())throw Error('Re-select these vectors before transforming.');const {members,box,w}=capture(infos,elements),g=fieldMatrix(box,w,kind,value);
   const matrices=matricesFor(members,g);if(Object.values(matrices).some(m=>!A().valid(m)))throw Error('Keep every transformed vector within the supported range.');if(members.some(m=>!A().equivalent(matrices[m.info.id],m.info.svgTransform.matrix)))save(matrices);
  }
  const viewport=()=>{const owners=initial.members.filter(m=>!m.covered).map(m=>m.el.ownerSVGElement);return owners[0]&&owners.every(el=>el===owners[0])?owners[0]:null;};let alignTarget=viewport()&&alignmentTargets.get(key)==='viewport'?'viewport':'selection';
  const toolbar=root.RetouchSelectionLayout.alignmentToolbar((mode,event,button)=>{try{if(!current())throw Error('Re-select these vectors before aligning.');const {members}=capture(infos,elements),asGroup=event.shiftKey&&!mode.startsWith('gap-'),owner=viewport(),target=alignTarget==='viewport'||asGroup?owner?.getBoundingClientRect():null;if((alignTarget==='viewport'||asGroup)&&!target)throw Error('Select vectors in the same SVG viewport.');const matrices=alignmentMatrices(members,mode,target,asGroup);if(members.some(m=>!A().equivalent(matrices[m.info.id],m.info.svgTransform.matrix))){root.RetouchPanelFocus?.queue(button);save(matrices);}}catch(error){I.note(section,error.message,'refused');}},true);
  const count=initial.members.filter(m=>!m.covered).length,updateAlignment=()=>{for(const button of toolbar.querySelectorAll('button'))button.disabled=count<(button.dataset.distribution?3:alignTarget==='viewport'?1:2);};for(const button of toolbar.querySelectorAll('button'))button.title=button.title.replace('containing frame','SVG viewport');section.append(toolbar);
  const targetChoice=I.select(section,'Align to',[['selection','Selection'],['viewport','SVG viewport']],alignTarget,value=>{alignTarget=value;alignmentTargets.set(key,value);updateAlignment();});if(!viewport())targetChoice.querySelector('[value=viewport]').disabled=true;updateAlignment();
  const inputs={},individualInputs=[],rounded=value=>String(Math.round(value*10000)/10000);
  function scrub(input,kind,custom=null){
   I.numericLabelDrag(input,raw=>({value:root.RetouchNumericExpression.evaluate(raw),min:kind==='rotation'?-360:(['width','height'].includes(kind)?0.0001:-100000),max:kind==='rotation'?360:100000}));
   input.retouchNumericPreview=()=>{
    if(!current())throw Error('Re-select these vectors before transforming.');
    const {members,box,w}=capture(infos,elements),originals=members.map(m=>m.el.getAttribute('transform')),last=[...originals],values=Object.fromEntries(Object.entries(inputs).map(([k,el])=>[k,el.value]));
    const screens=members.map(m=>array(m.el.getScreenCTM())),geometry=members.map(m=>{const g=m.el.getBBox();return [g.x,g.y,g.width,g.height];});let expectedScreens=screens;
    const valid=()=>{if(!current())return false;try{return members.every((m,i)=>{if(!m.el.isConnected||m.el.getAttribute('transform')!==last[i])return false;const screen=array(m.el.getScreenCTM()),expected=expectedScreens[i],g=m.el.getBBox();return screen.every((v,j)=>Math.abs(v-expected[j])<.1)&&[g.x,g.y,g.width,g.height].every((v,j)=>Math.abs(v-geometry[i][j])<.01);});}catch{return false;}};
    return {current:valid,update(value){
     if(!valid())throw Error('The selection changed. Re-select it.');
     const matrices=custom?custom(members,value):matricesFor(members,fieldMatrix(box,w,kind,value));
     if(Object.values(matrices).some(m=>!A().valid(m)))throw Error('Keep every transformed vector within the supported range.');
     expectedScreens=members.map((m,i)=>{const owner=members.find(o=>!o.covered&&(o===m||o.el.contains(m.el))),before=A().multiply(owner.parent,owner.info.svgTransform.matrix),after=A().multiply(owner.parent,matrices[owner.info.id]),delta=A().multiply(after,inverse(before));return A().multiply(delta,screens[i]);});members.forEach((m,i)=>{if(!m.covered){last[i]=A().format(matrices[m.info.id]);m.el.setAttribute('transform',last[i]);}});
     const rects=members.filter(m=>!m.covered).map(m=>m.el.getBoundingClientRect()),left=Math.min(...rects.map(r=>r.left)),top=Math.min(...rects.map(r=>r.top)),right=Math.max(...rects.map(r=>r.right)),bottom=Math.max(...rects.map(r=>r.bottom));
     for(const item of individualInputs){if(item.key!==kind){const gaps=root.RetouchSelectionLayout.gaps(rects,item.axis).values;item.input.value=rounded(gaps[item.index]);}}
     for(const axis of ['x','y']){const key='gap-'+axis;if(inputs[key]&&key!==kind){const gaps=root.RetouchSelectionLayout.gaps(rects,axis).values;inputs[key].value=gaps.length&&!gaps.some(v=>Math.abs(v-gaps[0])>=.001)?rounded(gaps[0]):'';}}
     for(const [k,v]of Object.entries({x:left+w.scrollX,y:top+w.scrollY,width:right-left,height:bottom-top}))if(k!==kind)inputs[k].value=rounded(v);
    },restore(){members.forEach((m,i)=>{if(m.el.getAttribute('transform')===last[i]){if(originals[i]===null)m.el.removeAttribute('transform');else m.el.setAttribute('transform',originals[i]);}});for(const [k,v]of Object.entries(values))if(k!==kind)inputs[k].value=v;}};
   };
  }
  for(const [kind,label,value]of [['x','Selection X',initial.box.left+initial.w.scrollX],['y','Selection Y',initial.box.top+initial.w.scrollY],['width','Selection width',initial.box.width],['height','Selection height',initial.box.height],['rotation','Rotate selection (°)',0]]){const input=root.document.createElement('input');input.type='text';input.inputMode='decimal';input.value=String(Math.round(value*10000)/10000);input.oninput=()=>input.setCustomValidity('');input.onchange=()=>{try{const value=root.RetouchNumericExpression.evaluate(input.value);apply(kind,value);input.value=String(Math.round(value*10000)/10000);}catch(error){input.setCustomValidity(error.message);input.reportValidity();}};root.RetouchNumericExpression.field(input);I.field(section,label,input);inputs[kind]=input;scrub(input,kind);}
  const spacing=root.document.createElement('div');spacing.className='property-pair';section.append(spacing);
  for(const [axis,label]of [['x','Horizontal gap (px)'],['y','Vertical gap (px)']]){
   const gaps=root.RetouchSelectionLayout.gaps(initial.members.filter(m=>!m.covered).map(m=>m.rect),axis).values,mixed=gaps.some(v=>Math.abs(v-gaps[0])>=.001),input=root.document.createElement('input');input.type='text';input.inputMode='decimal';input.value=mixed||!gaps.length?'':rounded(gaps[0]);input.placeholder=mixed?'Mixed':'';input.disabled=count<2;input.oninput=()=>input.setCustomValidity('');
   const calculate=(members,value)=>{const owner=viewport();if(alignTarget==='viewport'&&!owner)throw Error('Select vectors in the same SVG viewport.');return spacingMatrices(members,axis,value,alignTarget==='viewport'?owner.getBoundingClientRect()[axis==='x'?'left':'top']:null);};
   input.onchange=()=>{try{if(!current())throw Error('Re-select these vectors before changing spacing.');const value=root.RetouchNumericExpression.evaluate(input.value),{members}=capture(infos,elements),matrices=calculate(members,value);if(members.some(m=>!A().equivalent(matrices[m.info.id],m.info.svgTransform.matrix)))save(matrices);input.value=rounded(value);}catch(error){input.setCustomValidity(error.message);input.reportValidity();}};
   root.RetouchNumericExpression.field(input);I.field(spacing,label,input);input.parentElement.querySelector('span').textContent=axis==='x'?'H gap':'V gap';inputs['gap-'+axis]=input;scrub(input,'gap-'+axis,calculate);
  }
  if(count>2){
   const individual=root.document.createElement('details'),summary=root.document.createElement('summary');summary.textContent='Individual gaps';individual.append(summary);individual.open=individualGapSelections.has(key);individual.addEventListener('toggle',()=>{if(individual.isConnected){if(individual.open)individualGapSelections.add(key);else individualGapSelections.delete(key);}});section.append(individual);I.note(individual,'Individual gap edits keep the first layer fixed and preserve the other gaps.');
   for(const axis of ['x','y']){const outer=initial.members.filter(m=>!m.covered),{sorted,values}=root.RetouchSelectionLayout.gaps(outer.map(m=>m.rect),axis);values.forEach((gap,index)=>{
    const input=root.document.createElement('input'),fieldKey='gap-'+axis+'-'+index;input.type='text';input.inputMode='decimal';input.value=rounded(gap);input.title=[sorted[index],sorted[index+1]].map(item=>outer[item.i].el.getAttribute('aria-label')||outer[item.i].el.localName).join(' → ');input.oninput=()=>input.setCustomValidity('');
    const calculate=(members,value)=>spacingMatrices(members,axis,value,null,index);
    input.onchange=()=>{try{if(!current())throw Error('Re-select these vectors before changing a gap.');const value=root.RetouchNumericExpression.evaluate(input.value),{members}=capture(infos,elements),matrices=calculate(members,value);if(members.some(m=>!A().equivalent(matrices[m.info.id],m.info.svgTransform.matrix)))save(matrices);input.value=rounded(value);}catch(error){input.setCustomValidity(error.message);input.reportValidity();}};
    root.RetouchNumericExpression.field(input);I.field(individual,(axis==='x'?'Horizontal':'Vertical')+' gap '+(index+1),input);inputs[fieldKey]=input;individualInputs.push({key:fieldKey,input,axis,index});scrub(input,fieldKey,calculate);
   });}
  }
  const lock=I.button('Lock selection proportions',()=>{locked=!locked;if(locked)sizeLocks.add(key);else sizeLocks.delete(key);lock.setAttribute('aria-pressed',String(locked));});lock.setAttribute('aria-pressed',String(locked));lock.setAttribute('aria-label','Lock selection proportions');lock.title='Lock selection proportions';lock.innerHTML='<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" aria-hidden="true"><path d="M8 6V4a3 3 0 0 1 6 0v4a3 3 0 0 1-3 3M12 14v2a3 3 0 0 1-6 0v-4a3 3 0 0 1 3-3M10 6v8"/></svg>';lock.disabled=!initial.box.width||!initial.box.height;section.append(lock);
  const flips=root.RetouchFlip.mount(elements[0],()=>{});for(const button of flips.querySelectorAll('button')){button.disabled=false;button.onclick=()=>{try{apply('flip-'+button.dataset.flipAxis);}catch(error){I.note(section,error.message,'refused');}};}section.append(flips);I.note(section,'Bounds in document pixels. Rotation and flips use the selection center. Changes apply to all screen sizes.');return section;
 }
 const api={inverse,transform,matricesFor,alignmentMatrices,spacingMatrices,resizeBounds,selectionKey,capture,controls,canvasResize,resizeSelection,canvasRotation,rotationPoints,isRotating:()=>rotatingSelection,nudge,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGSelection=api;
})(typeof window==='object'?window:globalThis);
