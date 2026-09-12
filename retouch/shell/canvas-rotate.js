(function(root){
 'use strict';
 const difference=(a,b)=>((a-b+540)%360+360)%360-180;
 const angle=(x,y,pivot)=>Math.atan2(y-pivot.y,x-pivot.x)*180/Math.PI;
 function value(start,change,snap=false){const n=start+change;return Math.max(-360,Math.min(360,snap?Math.round(n/15)*15:Math.round(n*100)/100));}
 function geometry(target){
  const css=target.ownerDocument.defaultView.getComputedStyle(target.ownerDocument.documentElement);
  if(css.transform!=='none'||['rotate','scale','translate'].some(key=>css[key]&&!['none','0deg'].includes(css[key]))||css.zoom&&Number(css.zoom)!==1)throw Error('Canvas rotation requires a page root without transforms or zoom.');
  const g=root.RetouchInspector.geometry(target,{allowRotation:true,layoutOnly:true});if(g.width<=0||g.height<=0)throw Error('Choose a visible layer with a nonzero size.');return g;
 }
 function mount({target,frame,canvas,input,current,onEnd,onError,initialPointer=null}){
  const doc=root.document,w=target.ownerDocument.defaultView,measure=()=>geometry(target);let g;
  try{g=measure();}catch(error){onError(error.message);return null;}
  const origin=g.transformOrigin.split(/\s+/).map(parseFloat),f=frame.getBoundingClientRect(),c=canvas.getBoundingClientRect(),scale=f.width/w.innerWidth;
  if(origin.length<2||origin.some(n=>!Number.isFinite(n))||origin[2]||!Number.isFinite(scale)||scale<=0){onError('This layer’s rotation origin cannot be edited on canvas yet.');return null;}
  const pivot={x:f.left+(g.layoutLeft+origin[0])*scale,y:f.top+(g.layoutTop+origin[1])*scale};
  const radius=Math.max(32,Math.hypot(g.width-origin[0],-origin[1])*scale+24),base=Math.atan2(-origin[1],g.width-origin[0]);
  const surface=doc.createElement('div');surface.className='canvas-rotate-surface';surface.tabIndex=0;surface.setAttribute('aria-label','Rotate layer on canvas');
  Object.assign(surface.style,{position:'fixed',left:Math.max(c.left,f.left)+'px',top:Math.max(c.top,f.top)+'px',right:Math.max(0,root.innerWidth-Math.min(c.right,f.right))+'px',bottom:Math.max(0,root.innerHeight-Math.min(c.bottom,f.bottom))+'px',zIndex:40,overflow:'hidden',touchAction:'none'});
  const clip={left:Math.max(c.left,f.left),top:Math.max(c.top,f.top),right:Math.min(c.right,f.right),bottom:Math.min(c.bottom,f.bottom)};
  if(clip.right-clip.left<32||clip.bottom-clip.top<32){onError('Bring the layer into view before rotating it.');return null;}
  const handle=doc.createElement('button');handle.type='button';handle.setAttribute('aria-label','Drag to rotate layer');handle.textContent='↻';Object.assign(handle.style,{position:'absolute',width:'24px',height:'24px',padding:'0',border:'1px solid var(--accent)',borderRadius:'50%',background:'var(--panel)',color:'var(--accent)',transform:'translate(-50%,-50%)',cursor:'grab',touchAction:'none'});
  const marker=doc.createElement('div');Object.assign(marker.style,{position:'absolute',left:pivot.x-clip.left+'px',top:pivot.y-clip.top+'px',width:'6px',height:'6px',border:'1px solid var(--accent)',borderRadius:'50%',background:'white',transform:'translate(-50%,-50%)',pointerEvents:'none'});
  const hint=doc.createElement('div');Object.assign(hint.style,{position:'fixed',bottom:'76px',left:'50%',transform:'translateX(-50%)',padding:'8px 12px',border:'1px solid var(--line)',borderRadius:'6px',background:'var(--panel)',color:'var(--ink)',fontSize:'11px',pointerEvents:'none'});
  surface.append(marker,handle,hint);doc.body.append(surface);
  let ended=false,rotation=g.rotation,previewed=false,drag=null,raf;const preview=input.retouchNumericPreview(),cleanups=[];
  const listen=(el,name,fn,options)=>{el.addEventListener(name,fn,options);cleanups.push(()=>el.removeEventListener(name,fn,options));};
  function valid(){if(!current()||!target.isConnected||!input.isConnected)return false;try{const next=measure(),now=frame.getBoundingClientRect();if(['left','top','width','height'].some(key=>Math.abs(now[key]-f[key])>.5))return false;return ['layoutLeft','layoutTop','width','height'].every(key=>Math.abs(next[key]-g[key])<.6)&&next.transformOrigin===g.transformOrigin&&Math.abs(next.rotation-(previewed?rotation:g.rotation))<.05;}catch{return false;}}
  function end(commit=false){if(ended)return;const save=commit&&valid();ended=true;root.cancelAnimationFrame(raf);cleanups.forEach(fn=>fn());surface.remove();preview.restore();onEnd();if(save&&Math.abs(rotation-g.rotation)>.005){input.value=String(rotation);input.dispatchEvent(new root.Event('change',{bubbles:true}));}}
  function paint(){const radians=base+rotation*Math.PI/180;handle.style.left=Math.max(16,Math.min(clip.right-clip.left-16,pivot.x+Math.cos(radians)*radius-clip.left))+'px';handle.style.top=Math.max(16,Math.min(clip.bottom-clip.top-16,pivot.y+Math.sin(radians)*radius-clip.top))+'px';hint.textContent=rotation+'° · Drag to rotate · Shift: 15° · Arrows: 1° · Enter applies · Escape cancels';}
  function update(next){if(!valid()){end();return;}rotation=next;preview.update(rotation);previewed=true;paint();}
  function begin(e){if(e.button!==0)return;e.preventDefault();drag={id:e.pointerId,last:angle(e.clientX,e.clientY,pivot),change:0,start:rotation};handle.setPointerCapture(e.pointerId);}
  listen(handle,'pointerdown',begin);
  listen(handle,'pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const next=angle(e.clientX,e.clientY,pivot);drag.change+=difference(next,drag.last);drag.last=next;update(value(drag.start,drag.change,e.shiftKey));});
  listen(handle,'pointerup',e=>{if(drag&&e.pointerId===drag.id){drag=null;end(true);}});
  listen(handle,'pointercancel',()=>end());
  listen(surface,'keydown',e=>{if(!['Escape','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopImmediatePropagation();if(e.key==='Escape')end();else if(e.key==='Enter')end(true);else update(value(rotation,(['ArrowLeft','ArrowDown'].includes(e.key)?-1:1)*(e.shiftKey?15:1)));},true);
  for(const name of ['blur','resize','retouch:screen','retouch:viewport','retouch:before-zoom'])listen(root,name,()=>end());
  listen(w,'scroll',()=>end(),true);listen(canvas,'scroll',()=>end(),true);
  function tick(){if(!valid()){end();return;}raf=root.requestAnimationFrame(tick);}
  paint();surface.focus({preventScroll:true});if(initialPointer)begin(initialPointer);raf=root.requestAnimationFrame(tick);return ()=>end();
 }
 function corners(g,scale=1){
  const o=g.transformOrigin.split(/\s+/).map(parseFloat),a=g.rotation*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a);
  if(o.length<2||o.some(n=>!Number.isFinite(n))||o[2]||!Number.isFinite(scale)||scale<=0)throw Error('Unsupported rotation origin.');
  return [[0,0,-1,-1],[g.width,0,1,-1],[g.width,g.height,1,1],[0,g.height,-1,1]].map(([x,y,sx,sy])=>{
   const dx=(x-o[0])*scale+sx*10,dy=(y-o[1])*scale+sy*10;
   return {x:(g.layoutLeft+o[0])*scale+dx*cos-dy*sin,y:(g.layoutTop+o[1])*scale+dx*sin+dy*cos};
  });
 }
 function resizeHandles(g,scale=1){
  const o=g.transformOrigin.split(/\s+/).map(parseFloat),a=g.rotation*Math.PI/180;
  return [['nw',0,0],['n',.5,0],['ne',1,0],['e',1,.5],['se',1,1],['s',.5,1],['sw',0,1],['w',0,.5]].map(([handle,fx,fy])=>{
   const x=g.width*fx-o[0],y=g.height*fy-o[1];return {handle,x:(g.layoutLeft+o[0]+x*Math.cos(a)-y*Math.sin(a))*scale,y:(g.layoutTop+o[1]+x*Math.sin(a)+y*Math.cos(a))*scale};
  });
 }
 function resizeCursor(handle,rotation=0){const angles={e:0,se:45,s:90,sw:135,w:180,nw:225,n:270,ne:315},i=((Math.round((angles[handle]+rotation)/45)%4)+4)%4;return ['ew','nwse','ns','nesw'][i]+'-resize';}
 function cornerControls({frame,canvas,onStart}){
  const doc=root.document,container=doc.createElement('div');container.className='canvas-rotation-corners';container.hidden=true;doc.body.append(container);let active=null;
  const buttons=['top left','top right','bottom right','bottom left'].map(name=>{const button=doc.createElement('button');button.type='button';button.className='canvas-rotation-corner';button.setAttribute('aria-label','Rotate from '+name+' corner');button.title='Drag to rotate · Shift: 15°';button.textContent='↻';button.tabIndex=-1;
   button.addEventListener('pointerdown',e=>{if(e.button!==0||!active)return;e.preventDefault();e.stopPropagation();onStart(active.target,active.input,e);});
   button.addEventListener('click',e=>{if(e.detail===0&&active)onStart(active.target,active.input);});container.append(button);return button;});
  const names={nw:'top left',n:'top',ne:'top right',e:'right',se:'bottom right',s:'bottom',sw:'bottom left',w:'left'};
  const resizeButtons=Object.entries(names).map(([handle,name])=>{const button=doc.createElement('button');button.type='button';button.className='canvas-selection-resize';button.tabIndex=-1;button.setAttribute('aria-label','Drag '+name+' to resize selected layer');button.title='Drag to resize · Shift: keep proportions · Option / Alt: from center';button.dataset.selectionResize=handle;
   button.addEventListener('pointerdown',event=>{if(event.button!==0||!active?.resizeControl?.isConnected)return;event.preventDefault();event.stopPropagation();active.resizeControl.retouchCanvasStart({event,handle});});container.append(button);return button;});
  return {update(target,input,resizeControl){active=null;container.hidden=true;if(!target?.isConnected||!input?.isConnected||input.closest('[inert]'))return;const canRotate=!input.matches(':disabled'),canResize=resizeControl?.retouchCanvasStart&&!resizeControl.matches(':disabled')&&!resizeControl.closest('[inert]');
   try{const g=geometry(target),f=frame.getBoundingClientRect(),c=canvas.getBoundingClientRect(),scale=f.width/frame.contentWindow.innerWidth,points=corners(g,scale),left=Math.max(c.left,f.left),top=Math.max(c.top,f.top),right=Math.min(c.right,f.right),bottom=Math.min(c.bottom,f.bottom);if(g.width<=0||g.height<=0||right<=left||bottom<=top)return;
    Object.assign(container.style,{left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px'});
    buttons.forEach((button,i)=>{const x=f.left+points[i].x-left,y=f.top+points[i].y-top;button.hidden=!canRotate||x<8||y<8||x>right-left-8||y>bottom-top-8;button.style.left=x+'px';button.style.top=y+'px';});const positions=resizeHandles(g,scale),flowDirections=resizeControl?.retouchFlowHandles?.();resizeButtons.forEach((button,i)=>{const p=positions[i],x=f.left+p.x-left,y=f.top+p.y-top;button.hidden=!canResize||resizeControl.dataset.flowResize==='true'&&!flowDirections?.includes(p.handle)||x<5||y<5||x>right-left-5||y>bottom-top-5;Object.assign(button.style,{left:x+'px',top:y+'px',cursor:resizeCursor(p.handle,g.rotation),rotate:g.rotation+'deg'});});active={target,input,resizeControl};container.hidden=false;
   }catch{}
  }};
 }
 const api={difference,angle,value,mount,corners,resizeHandles,resizeCursor,cornerControls};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchCanvasRotate=api;
})(typeof window==='object'?window:globalThis);
