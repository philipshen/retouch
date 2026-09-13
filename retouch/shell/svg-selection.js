(function(root){
 'use strict';
 const sizeLocks=new Set(),selectionKey=infos=>JSON.stringify(infos.map(i=>[i.file,i.id]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
 const A=()=>root.RetouchSVGAffine||require('./svg-affine.js'),array=m=>[m.a,m.b,m.c,m.d,m.e,m.f];
 function inverse(m){const d=m[0]*m[3]-m[1]*m[2];return Math.abs(d)<1e-9?null:[m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];}
 function transform(parent,global,own){const inv=inverse(parent);return inv&&A().multiply(A().multiply(A().multiply(inv,global),parent),own);}
 function matricesFor(members,global){return Object.fromEntries(members.map(m=>[m.info.id,m.covered?m.info.svgTransform.matrix:transform(m.parent,global,m.info.svgTransform.matrix)]));}
 function resizeBounds(box,axis,value,locked=false){
  if(!['width','height'].includes(axis)||!Number.isFinite(value)||value<=0||value>100000||!box[axis]||(locked&&(!box.width||!box.height)))return null;
  const scale=value/box[axis],sx=axis==='width'||locked?scale:1,sy=axis==='height'||locked?scale:1;
  if(box.width*sx>100000||box.height*sy>100000)return null;
  return [sx,0,0,sy,box.left*(1-sx),box.top*(1-sy)];
 }
 function capture(infos,elements){
  if(infos.length!==elements.length||elements.some(el=>!el?.isConnected)||new Set(infos.map(i=>i.file)).size!==1)throw Error('Select visible vectors from one source file.');
  const members=infos.map((info,i)=>{const el=elements[i],reason=root.RetouchSVGResize.reason(el,info,true);if(reason)throw Error(reason);if(el.getAttribute('transform')!==info.svgTransform.value)throw Error('The vector changed. Re-select it.');const data=root.RetouchSVGResize.measure(el),parent=A().multiply(array(data.m),inverse(info.svgTransform.matrix));return {info,el,parent,covered:elements.some(ancestor=>ancestor!==el&&ancestor.contains(el)),rect:el.getBoundingClientRect()};});
  const outer=members.filter(m=>!m.covered);const left=Math.min(...outer.map(m=>m.rect.left)),top=Math.min(...outer.map(m=>m.rect.top)),right=Math.max(...outer.map(m=>m.rect.right)),bottom=Math.max(...outer.map(m=>m.rect.bottom));return {members,box:{left,top,width:right-left,height:bottom-top},w:elements[0].ownerDocument.defaultView};
 }
 function nudge(infos,elements,{initialKey,current,onCommit,onEnd,onError,canvas}){
  let state;try{state=capture(infos,elements);}catch(error){onError(error.message);return null;}
  const members=state.members,w=state.w,cleanup=[],held=new Set(),original=members.map(m=>m.el.getAttribute('transform')),screens=members.map(m=>array(m.el.getScreenCTM())),geometry=members.map(m=>{const g=m.el.getBBox();return [g.x,g.y,g.width,g.height];});
  let ended=false,raf,x=0,y=0,next=matricesFor(members,A().identity()),last=original.slice();
  const surface=root.document.createElement('div');surface.setAttribute('aria-label','Move SVG selection on canvas');Object.assign(surface.style,{position:'fixed',bottom:'116px',left:'50%',transform:'translateX(-50%)',zIndex:40});
  const button=root.document.createElement('button');button.type='button';Object.assign(button.style,{padding:'8px 12px',border:'1px solid var(--line)',borderRadius:'6px',background:'var(--panel)',color:'var(--ink)',fontSize:'11px',fontFamily:'inherit'});button.textContent='Move selection · Arrows: 1 · Shift: 10 · Release applies · Escape cancels';surface.append(button);root.document.body.append(surface);
  function listen(el,type,fn,capture=false){el.addEventListener(type,fn,capture);cleanup.push(()=>el.removeEventListener(type,fn,capture));}
  function valid(){
   if(!current())return false;
   try{return members.every((m,i)=>{if(!m.el.isConnected||m.el.getAttribute('transform')!==last[i])return false;const screen=array(m.el.getScreenCTM()),expected=screens[i].slice();expected[4]+=x;expected[5]+=y;const g=m.el.getBBox();return screen.every((v,j)=>Math.abs(v-expected[j])<.1)&&[g.x,g.y,g.width,g.height].every((v,j)=>Math.abs(v-geometry[i][j])<.75);});}catch{return false;}
  }
  function end(commit=false){if(ended)return;const save=commit&&valid()&&(x!==0||y!==0);ended=true;root.cancelAnimationFrame(raf);cleanup.forEach(fn=>fn());surface.remove();members.forEach((m,i)=>{if(m.el.getAttribute('transform')!==last[i])return;if(original[i]===null)m.el.removeAttribute('transform');else m.el.setAttribute('transform',original[i]);});onEnd();if(save)onCommit(next);}
  function keyDown(e){
   if(e.isComposing||e.ctrlKey||e.metaKey||e.altKey||!['Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
   e.preventDefault();e.stopImmediatePropagation();if(e.key==='Escape'){end();return;}if(!valid()){end();return;}
   held.add(e.key);const step=e.shiftKey?10:1,dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;
   const matrices=matricesFor(members,[1,0,0,1,x+dx,y+dy]);if(Object.values(matrices).some(m=>!A().valid(m))){end();onError('Keep every transformed vector within the supported range.');return;}
   x+=dx;y+=dy;next=matrices;members.forEach((m,i)=>{if(m.covered)return;last[i]=A().format(next[m.info.id]);m.el.setAttribute('transform',last[i]);});
  }
  listen(surface,'keydown',keyDown,true);listen(root,'keyup',e=>{if(!held.delete(e.key))return;e.preventDefault();e.stopImmediatePropagation();if(!held.size)end(true);},true);
  for(const event of ['blur','resize','retouch:screen','retouch:viewport','retouch:before-zoom'])listen(root,event,()=>end());
  listen(w,'scroll',()=>end(),true);listen(w,'pagehide',()=>end());listen(w,'pointerdown',()=>end(),true);listen(canvas,'scroll',()=>end(),true);listen(root.document,'pointerdown',()=>end(),true);
  const tick=()=>{if(!valid()){end();return;}raf=root.requestAnimationFrame(tick);};button.focus({preventScroll:true});keyDown(initialKey);if(!ended)raf=root.requestAnimationFrame(tick);return ended?null:()=>end();
 }
 function mount(infos,elements,{save,current}){
  const I=root.RetouchInspector,section=I.section('Selection transform'),key=selectionKey(infos);let locked=sizeLocks.has(key);let initial;try{initial=capture(infos,elements);}catch(error){I.note(section,error.message,'refused').setAttribute('role','alert');return section;}
  function apply(kind,value){if(!current())throw Error('Re-select these vectors before transforming.');const {members,box,w}=capture(infos,elements),cx=box.left+box.width/2,cy=box.top+box.height/2;let g;
   if(kind==='x'||kind==='y'){if(!Number.isFinite(value)||Math.abs(value)>100000)throw Error('Enter a position within 100000 pixels.');g=[1,0,0,1,kind==='x'?value-box.left-w.scrollX:0,kind==='y'?value-box.top-w.scrollY:0];}
   else if(kind==='width'||kind==='height'){g=resizeBounds(box,kind,value,locked);if(!g)throw Error('Keep both selection dimensions positive and at most 100000 pixels when proportions are locked.');}
   else if(kind==='rotation'){if(!Number.isFinite(value)||Math.abs(value)>360)throw Error('Enter an angle from -360 to 360 degrees.');g=A().parse('rotate('+(-value)+' '+cx+' '+cy+')');}
   else {const sx=kind==='flip-x'?-1:1,sy=kind==='flip-y'?-1:1;g=[sx,0,0,sy,cx*(1-sx),cy*(1-sy)];}
   const matrices=matricesFor(members,g);if(Object.values(matrices).some(m=>!A().valid(m)))throw Error('Keep every transformed vector within the supported range.');if(members.some(m=>!A().equivalent(matrices[m.info.id],m.info.svgTransform.matrix)))save(matrices);
  }
  for(const [kind,label,value]of [['x','Selection X',initial.box.left+initial.w.scrollX],['y','Selection Y',initial.box.top+initial.w.scrollY],['width','Selection width',initial.box.width],['height','Selection height',initial.box.height],['rotation','Rotate selection (°)',0]]){const input=root.document.createElement('input');input.type='text';input.inputMode='decimal';input.value=String(Math.round(value*10000)/10000);input.oninput=()=>input.setCustomValidity('');input.onchange=()=>{try{const value=root.RetouchNumericExpression.evaluate(input.value);apply(kind,value);input.value=String(Math.round(value*10000)/10000);}catch(error){input.setCustomValidity(error.message);input.reportValidity();}};root.RetouchNumericExpression.field(input);I.field(section,label,input);}
  const lock=I.button('Lock selection proportions',()=>{locked=!locked;if(locked)sizeLocks.add(key);else sizeLocks.delete(key);lock.setAttribute('aria-pressed',String(locked));});lock.setAttribute('aria-pressed',String(locked));lock.setAttribute('aria-label','Lock selection proportions');lock.title='Lock selection proportions';lock.innerHTML='<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" aria-hidden="true"><path d="M8 6V4a3 3 0 0 1 6 0v4a3 3 0 0 1-3 3M12 14v2a3 3 0 0 1-6 0v-4a3 3 0 0 1 3-3M10 6v8"/></svg>';lock.disabled=!initial.box.width||!initial.box.height;section.append(lock);
  const flips=root.RetouchFlip.mount(elements[0],()=>{});for(const button of flips.querySelectorAll('button')){button.disabled=false;button.onclick=()=>{try{apply('flip-'+button.dataset.flipAxis);}catch(error){I.note(section,error.message,'refused');}};}section.append(flips);I.note(section,'Bounds in document pixels. Rotation and flips use the selection center. Changes apply to all screen sizes.');return section;
 }
 const api={inverse,transform,matricesFor,resizeBounds,selectionKey,capture,nudge,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGSelection=api;
})(typeof window==='object'?window:globalThis);
