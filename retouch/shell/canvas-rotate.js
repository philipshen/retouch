(function(root){
 'use strict';
 const difference=(a,b)=>((a-b+540)%360+360)%360-180;
 const angle=(x,y,pivot)=>Math.atan2(y-pivot.y,x-pivot.x)*180/Math.PI;
 function value(start,change,snap=false){const n=start+change;return Math.max(-360,Math.min(360,snap?Math.round(n/15)*15:Math.round(n*100)/100));}
 function mount({target,frame,canvas,input,current,onEnd,onError}){
  const doc=root.document,w=target.ownerDocument.defaultView,measure=()=>root.RetouchInspector.geometry(target,{allowRotation:true,layoutOnly:true});let g;
  try{const css=w.getComputedStyle(target.ownerDocument.documentElement);if(css.transform!=='none'||['rotate','scale','translate'].some(key=>css[key]&&!['none','0deg'].includes(css[key]))||css.zoom&&Number(css.zoom)!==1)throw Error('Canvas rotation requires a page root without transforms or zoom.');g=measure();if(g.width<=0||g.height<=0)throw Error('Choose a visible layer with a nonzero size.');}catch(error){onError(error.message);return null;}
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
  listen(handle,'pointerdown',e=>{if(e.button!==0)return;e.preventDefault();drag={id:e.pointerId,last:angle(e.clientX,e.clientY,pivot),change:0,start:rotation};handle.setPointerCapture(e.pointerId);});
  listen(handle,'pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const next=angle(e.clientX,e.clientY,pivot);drag.change+=difference(next,drag.last);drag.last=next;update(value(drag.start,drag.change,e.shiftKey));});
  listen(handle,'pointerup',e=>{if(drag&&e.pointerId===drag.id){drag=null;end(true);}});
  listen(handle,'pointercancel',()=>end());
  listen(surface,'keydown',e=>{if(!['Escape','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopImmediatePropagation();if(e.key==='Escape')end();else if(e.key==='Enter')end(true);else update(value(rotation,(['ArrowLeft','ArrowDown'].includes(e.key)?-1:1)*(e.shiftKey?15:1)));},true);
  for(const name of ['blur','resize','retouch:screen','retouch:viewport','retouch:before-zoom'])listen(root,name,()=>end());
  listen(w,'scroll',()=>end(),true);listen(canvas,'scroll',()=>end(),true);
  function tick(){if(!valid()){end();return;}raf=root.requestAnimationFrame(tick);}
  paint();surface.focus({preventScroll:true});raf=root.requestAnimationFrame(tick);return ()=>end();
 }
 const api={difference,angle,value,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchCanvasRotate=api;
})(typeof window==='object'?window:globalThis);
