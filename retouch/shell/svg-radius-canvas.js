(function(root){
 'use strict';
 const names=['top left','top right','bottom right','bottom left'],signs=[[1,1],[-1,1],[-1,-1],[1,-1]];
 const clamp=(value,limit)=>Math.max(0,Math.min(limit,Math.round(value*100)/100));
 function delta(start,a,b,corner,limit,snap=false){const [x,y]=signs[corner],value=start+((b.x-a.x)*x+(b.y-a.y)*y)/2;return clamp(snap?Math.round(value/10)*10:value,limit);}
 function measure(target){
  const w=target.ownerDocument.defaultView,g=target.getBBox(),m=target.getScreenCTM(),r=target.getBoundingClientRect();
  if(!m||m.is2D===false||![g.x,g.y,g.width,g.height,m.a,m.b,m.c,m.d,m.e,m.f].every(Number.isFinite)||g.width<=0||g.height<=0||Math.abs(m.a*m.d-m.b*m.c)<1e-9)throw Error('Choose a visible rectangle with an invertible transform.');
  const points=[[g.x,g.y],[g.x+g.width,g.y],[g.x+g.width,g.y+g.height],[g.x,g.y+g.height]].map(([x,y])=>new w.DOMPoint(x,y).matrixTransform(m)),xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  if(Math.abs(Math.min(...xs)-r.left)>.75||Math.abs(Math.max(...xs)-r.right)>.75||Math.abs(Math.min(...ys)-r.top)>.75||Math.abs(Math.max(...ys)-r.bottom)>.75)throw Error('This rectangle’s transform cannot be measured accurately for corner handles.');
  let rx=target.rx.baseVal.value,ry=target.ry.baseVal.value;if(!target.hasAttribute('rx'))rx=ry;if(!target.hasAttribute('ry'))ry=rx;if(!Number.isFinite(rx)||!Number.isFinite(ry))throw Error('Choose finite rectangle radii.');
  return {g,m,rx:Math.min(g.width/2,Math.max(0,rx)),ry:Math.min(g.height/2,Math.max(0,ry)),limit:Math.min(100000,g.width/2,g.height/2)};
 }
 function points({g,m,rx,ry},scale){
  const x=Math.min(g.width/2,Math.max(rx,10/(Math.hypot(m.a,m.b)*scale))),y=Math.min(g.height/2,Math.max(ry,10/(Math.hypot(m.c,m.d)*scale)));
  return [[g.x+x,g.y+y],[g.x+g.width-x,g.y+y],[g.x+g.width-x,g.y+g.height-y],[g.x+x,g.y+g.height-y]].map(([x,y])=>({x:(m.a*x+m.c*y+m.e)*scale,y:(m.b*x+m.d*y+m.f)*scale}));
 }
 function button(name){const el=root.document.createElement('button');el.type='button';el.tabIndex=-1;el.setAttribute('aria-label','Round corners from '+name);el.title='Drag to round all corners · Shift: 10 units';Object.assign(el.style,{position:'absolute',width:'12px',height:'12px',padding:'0',border:'2px solid var(--accent)',borderRadius:'50%',background:'white',transform:'translate(-50%,-50%)',pointerEvents:'auto',touchAction:'none',cursor:'nwse-resize'});return el;}
 function clip(frame,canvas){const f=frame.getBoundingClientRect(),c=canvas.getBoundingClientRect();return {left:Math.max(f.left,c.left),top:Math.max(f.top,c.top),right:Math.min(f.right,c.right),bottom:Math.min(f.bottom,c.bottom),f,scale:f.width/frame.contentWindow.innerWidth};}
 function controls({frame,canvas,onStart}){
  const container=root.document.createElement('div');container.className='svg-radius-handles';Object.assign(container.style,{position:'fixed',pointerEvents:'none',zIndex:31,overflow:'hidden'});container.hidden=true;root.document.body.append(container);let active;
  const buttons=names.map((name,i)=>{const el=button(name);el.onpointerdown=e=>{if(e.button!==0||!active)return;e.preventDefault();e.stopPropagation();onStart(active.target,active.input,e,i);};el.onclick=e=>{if(e.detail===0&&active)onStart(active.target,active.input,null,i);};container.append(el);return el;});
  return {update(target,input){active=null;container.hidden=true;if(!target?.isConnected||!input?.isConnected||input.disabled||input.closest('[inert]'))return;try{const data=measure(target),c=clip(frame,canvas),ps=points(data,c.scale),seen=[];Object.assign(container.style,{left:c.left+'px',top:c.top+'px',width:c.right-c.left+'px',height:c.bottom-c.top+'px'});buttons.forEach((el,i)=>{const x=c.f.left+ps[i].x-c.left,y=c.f.top+ps[i].y-c.top;el.hidden=x<7||y<7||x>c.right-c.left-7||y>c.bottom-c.top-7||seen.some(p=>Math.hypot(p.x-x,p.y-y)<16);if(!el.hidden)seen.push({x,y});el.style.left=x+'px';el.style.top=y+'px';});active={target,input};container.hidden=false;}catch{}}};
 }
 function mount({target,input,frame,canvas,current,onEnd,onError,initialPointer=null,corner=0}){
  let data;try{const reason=root.RetouchSVGRadius.cssReason(target);if(reason)throw Error(reason);data=measure(target);}catch(error){onError(error.message);return null;}
  const w=target.ownerDocument.defaultView,c=clip(frame,canvas),original={rx:target.getAttribute('rx'),ry:target.getAttribute('ry')},initialValue=input.value,start=clamp((data.rx+data.ry)/2,data.limit);
  if(c.right-c.left<20||c.bottom-c.top<20){onError('Bring the rectangle into view before rounding it.');return null;}
  const surface=root.document.createElement('div');surface.className='svg-radius-surface';surface.tabIndex=-1;surface.setAttribute('aria-label','Round rectangle corners on canvas');Object.assign(surface.style,{position:'fixed',left:c.left+'px',top:c.top+'px',width:c.right-c.left+'px',height:c.bottom-c.top+'px',zIndex:40,overflow:'hidden',touchAction:'none'});
  const handle=button(names[corner]),hint=root.document.createElement('div');Object.assign(hint.style,{position:'fixed',bottom:'116px',left:'50%',transform:'translateX(-50%)',padding:'8px 12px',border:'1px solid var(--line)',borderRadius:'6px',background:'var(--panel)',color:'var(--ink)',fontSize:'11px',pointerEvents:'none'});handle.tabIndex=0;surface.append(handle,hint);root.document.body.append(surface);
  let ended=false,radius=start,drag=null,last=null,changed=false,raf;const cleanups=[];
  const listen=(el,name,fn,options)=>{el.addEventListener(name,fn,options);cleanups.push(()=>el.removeEventListener(name,fn,options));};
  function valid(){if(!current()||!target.isConnected||!input.isConnected)return false;try{const next=measure(target),f=frame.getBoundingClientRect();return ['left','top','width','height'].every(k=>Math.abs(f[k]-c.f[k])<.5)&&['x','y','width','height'].every(k=>Math.abs(next.g[k]-data.g[k])<.01)&&['a','b','c','d','e','f'].every(k=>Math.abs(next.m[k]-data.m[k])<1e-5)&&['rx','ry'].every(k=>target.getAttribute(k)===(last??original[k]));}catch{return false;}}
  function restore(){if(last!==null)for(const key of ['rx','ry'])if(target.getAttribute(key)===last){if(original[key]===null)target.removeAttribute(key);else target.setAttribute(key,original[key]);}input.value=initialValue;}
  function end(commit=false){if(ended)return;const save=commit&&changed&&valid();ended=true;root.cancelAnimationFrame(raf);cleanups.forEach(fn=>fn());surface.remove();restore();onEnd();if(save){input.value=String(radius);input.dispatchEvent(new root.Event('change',{bubbles:true}));}}
  function point(e){return new w.DOMPoint((e.clientX-c.f.left)/c.scale,(e.clientY-c.f.top)/c.scale).matrixTransform(data.m.inverse());}
  function paint(){const p=points({...data,rx:changed?radius:data.rx,ry:changed?radius:data.ry},c.scale)[corner];handle.style.left=c.f.left+p.x-c.left+'px';handle.style.top=c.f.top+p.y-c.top+'px';hint.textContent=radius+' · Drag to round all corners · Arrows: 1 · Shift: 10 · Enter applies · Escape cancels';}
  function update(value){if(!valid()){end();return;}radius=clamp(value,data.limit);changed=true;last=String(radius);target.setAttribute('rx',last);target.setAttribute('ry',last);input.value=last;paint();}
  function begin(e){if(e.button!==0)return;e.preventDefault();e.stopPropagation();drag={id:e.pointerId,a:point(e),start:radius};handle.setPointerCapture(e.pointerId);}
  listen(handle,'pointerdown',begin);listen(handle,'pointermove',e=>{if(drag&&e.pointerId===drag.id)update(delta(drag.start,drag.a,point(e),corner,data.limit,e.shiftKey));});listen(handle,'pointerup',e=>{if(drag&&e.pointerId===drag.id){drag=null;end(true);}});listen(handle,'pointercancel',()=>end());listen(handle,'lostpointercapture',()=>{if(drag)end();});
  listen(surface,'keydown',e=>{if(!['Escape','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)||e.altKey||e.ctrlKey||e.metaKey)return;e.preventDefault();e.stopImmediatePropagation();if(e.key==='Escape')end();else if(e.key==='Enter')end(true);else update(e.key==='Home'?0:e.key==='End'?data.limit:radius+(['ArrowLeft','ArrowDown'].includes(e.key)?-1:1)*(e.shiftKey?10:1));},true);
  for(const name of ['blur','resize','retouch:screen','retouch:viewport','retouch:before-zoom'])listen(root,name,()=>end());listen(w,'scroll',()=>end(),true);listen(canvas,'scroll',()=>end(),true);
  const tick=()=>{if(!valid()){end();return;}raf=root.requestAnimationFrame(tick);};paint();handle.focus({preventScroll:true});if(initialPointer)begin(initialPointer);raf=root.requestAnimationFrame(tick);return ()=>end();
 }
 const api={clamp,delta,measure,points,controls,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGRadiusCanvas=api;
})(typeof window==='object'?window:globalThis);
