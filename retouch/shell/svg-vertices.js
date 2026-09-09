(function(root){
  'use strict';
  const ns='http://www.w3.org/2000/svg';
  function mount({target,frame,canvas,points,onCommit,onEnd,onError}){
    const w=target.ownerDocument.defaultView,original=target.getAttribute('points');
    const vertices=points.map(p=>({...p})),cleanup=[];
    const surface=root.document.createElement('div');surface.className='svg-vertex-surface';
    surface.setAttribute('role','group');surface.setAttribute('aria-label','Edit vector points');
    Object.assign(surface.style,{position:'fixed',zIndex:40,overflow:'hidden',touchAction:'none'});
    const drawing=root.document.createElementNS(ns,'svg');
    Object.assign(drawing.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
    const preview=root.document.createElementNS(ns,target.tagName.toLowerCase());
    preview.style.cssText='fill:none!important;stroke:#6366f1!important;stroke-width:1.5!important;';
    preview.setAttribute('vector-effect','non-scaling-stroke');drawing.append(preview);surface.append(drawing);
    let ended=false,drag=null,active=0,raf;
    const initialMatrix=target.getScreenCTM(),matrixValues=m=>m&&[m.a,m.b,m.c,m.d,m.e,m.f];
    const initial=matrixValues(initialMatrix);
    function listen(el,type,fn,options){el.addEventListener(type,fn,options);cleanup.push(()=>el.removeEventListener(type,fn,options));}
    function cancel(){if(ended)return;ended=true;root.cancelAnimationFrame(raf);cleanup.forEach(f=>f());surface.remove();onEnd();}
    function current(){
      const m=matrixValues(target.getScreenCTM());
      return target.isConnected&&target.getAttribute('points')===original&&m&&initial&&m.every((n,i)=>Math.abs(n-initial[i])<1e-6)&&
        target.points.numberOfItems===points.length&&target.animatedPoints.numberOfItems===points.length&&points.every((_,i)=>{const p=target.points.getItem(i),q=target.animatedPoints.getItem(i);return p.x===q.x&&p.y===q.y;});
    }
    function verify(){if(current())return true;cancel();onError('The vector changed while editing. Select it again.');return false;}
    function local(e){
      const f=frame.getBoundingClientRect(),scale=f.width/w.innerWidth;
      const p=new w.DOMPoint((e.clientX-f.left)/scale,(e.clientY-f.top)/scale).matrixTransform(initialMatrix.inverse());
      if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('This vector transform cannot be edited.');return p;
    }
    const handles=vertices.map((p,i)=>{
      const b=root.document.createElement('button');b.type='button';b.setAttribute('aria-label','Vector point '+(i+1));
      Object.assign(b.style,{position:'absolute',width:'12px',height:'12px',padding:'0',border:'2px solid #6366f1',background:'white',borderRadius:'2px',cursor:'move',touchAction:'none'});
      listen(b,'focus',()=>{active=i;});surface.append(b);return b;
    });
    function paint(){
      const f=frame.getBoundingClientRect(),r=surface.getBoundingClientRect(),scale=f.width/w.innerWidth,m=initialMatrix;
      preview.setAttribute('points',root.RetouchSVGPoints.format(vertices));
      preview.setAttribute('transform',`matrix(${m.a*scale} ${m.b*scale} ${m.c*scale} ${m.d*scale} ${m.e*scale+f.left-r.left} ${m.f*scale+f.top-r.top})`);
      vertices.forEach((p,i)=>{const q=new w.DOMPoint(p.x,p.y).matrixTransform(m);Object.assign(handles[i].style,{left:f.left+q.x*scale-r.left-6+'px',top:f.top+q.y*scale-r.top-6+'px'});});
    }
    function commit(){
      if(!verify())return;
      const value=root.RetouchSVGPoints.format(vertices),changed=vertices.some((p,i)=>p.x!==points[i].x||p.y!==points[i].y);
      if(!root.RetouchSVGPoints.parse(value)){cancel();onError('Vector points must stay within supported SVG coordinates.');return;}
      cancel();if(changed)onCommit(value);
    }
    function move(e){
      if(!drag||e.pointerId!==drag.id||!verify())return;
      try{const p=local(e);let dx=p.x-drag.pointer.x,dy=p.y-drag.pointer.y;
        if(e.shiftKey){if(Math.abs(dx)>Math.abs(dy))dy=0;else dx=0;}
        vertices[active]={x:drag.point.x+dx,y:drag.point.y+dy};paint();
      }catch(error){cancel();onError(error.message);}
    }
    handles.forEach((b,i)=>listen(b,'pointerdown',e=>{
      if(e.button!==0||drag)return;e.preventDefault();e.stopImmediatePropagation();if(!verify())return;
      try{active=i;b.focus({preventScroll:true});drag={id:e.pointerId,pointer:local(e),point:{...vertices[i]}};b.setPointerCapture(e.pointerId);}catch(error){cancel();onError(error.message);}
    }));
    listen(surface,'pointermove',move);
    listen(surface,'pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();move(e);if(!ended){const moved=Math.hypot(vertices[active].x-drag.point.x,vertices[active].y-drag.point.y)>1e-9;drag=null;if(moved)commit();}});
    listen(surface,'pointercancel',cancel);listen(surface,'lostpointercapture',()=>{if(drag)cancel();});
    listen(surface,'keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();return;}
      if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();commit();return;}
      const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
      if(!delta||e.metaKey||e.ctrlKey||e.altKey)return;e.preventDefault();e.stopImmediatePropagation();if(!verify())return;
      const step=e.shiftKey?10:1;vertices[active].x+=delta[0]*step;vertices[active].y+=delta[1]*step;paint();
    },true);
    for(const event of ['retouch:before-zoom','retouch:screen','retouch:viewport','resize','blur','pagehide'])listen(root,event,cancel);
    listen(frame,'load',cancel);listen(w,'scroll',cancel,true);listen(canvas,'scroll',cancel);
    if(!initial||Math.abs(initialMatrix.a*initialMatrix.d-initialMatrix.b*initialMatrix.c)<1e-12){cancel();onError('This vector transform cannot be edited.');return null;}
    const f=frame.getBoundingClientRect(),c=canvas.getBoundingClientRect();
    const left=Math.max(f.left,c.left),top=Math.max(f.top,c.top),right=Math.min(f.right,c.right),bottom=Math.min(f.bottom,c.bottom);
    if(right<=left||bottom<=top){cancel();onError('Bring the vector into view before editing.');return null;}
    Object.assign(surface.style,{left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px'});
    root.document.body.append(surface);paint();handles[0].focus({preventScroll:true});
    function watch(){if(!ended&&verify())raf=root.requestAnimationFrame(watch);}raf=root.requestAnimationFrame(watch);
    return cancel;
  }
  root.RetouchSVGVertices={mount};
})(window);
