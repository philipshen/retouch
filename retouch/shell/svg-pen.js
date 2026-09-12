(function(root){
  'use strict';
  const ns='http://www.w3.org/2000/svg';
  function mount({target,frame,canvas,onCommit,onEnd,onError,maxPoints=512,isCurrent=()=>true,contextPath=null}){
    const w=target.ownerDocument.defaultView,viewport=target.tagName.toLowerCase()==='svg'?target:target.ownerSVGElement;
    const surface=root.document.createElement('div');surface.className='svg-pen-surface';surface.setAttribute('role','group');surface.setAttribute('aria-label','Draw vector');surface.tabIndex=0;
    Object.assign(surface.style,{position:'fixed',zIndex:40,cursor:'crosshair',touchAction:'none',overflow:'hidden'});
    const drawing=root.document.createElementNS(ns,'svg'),preview=root.document.createElementNS(ns,'path');
    Object.assign(drawing.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
    const context=root.document.createElementNS(ns,'g'),contextOutline=root.document.createElementNS(ns,'path');context.classList.add('svg-pen-context');contextOutline.style.cssText='fill:none!important;stroke:#99d6ff!important;stroke-width:1.5!important;';contextOutline.setAttribute('vector-effect','non-scaling-stroke');if(contextPath){contextOutline.setAttribute('d',contextPath);context.append(contextOutline);drawing.append(context);}
    preview.style.cssText='fill:none!important;stroke:var(--accent, #0d99ff)!important;stroke-width:2!important;';preview.setAttribute('vector-effect','non-scaling-stroke');const tangents=root.document.createElementNS(ns,'g');drawing.append(preview,tangents);surface.append(drawing);
    const toolbar=root.document.createElement('div');toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Pen actions');
    Object.assign(toolbar.style,{position:'absolute',left:'12px',bottom:'72px',maxWidth:'calc(100% - 24px)',display:'flex',flexWrap:'wrap',gap:'8px',alignItems:'center',padding:'8px',background:'#ffffff',border:'1px solid var(--line, #e6e6e6)',borderRadius:'8px',boxShadow:'0 4px 16px #0002',zIndex:2,cursor:'default'});
    const status=root.document.createElement('span');status.setAttribute('role','status');status.style.cssText='font:12px Inter,system-ui;color:var(--ink, #1e1e1e);';toolbar.append(status);surface.append(toolbar);
    const points=[],dots=[],cleanup=[],initial=target.getScreenCTM(),revision=target.getAttribute('data-rt-revision');let hover=null,ended=false,raf,drag=null;
    function listen(el,type,fn,options){el.addEventListener(type,fn,options);cleanup.push(()=>el.removeEventListener(type,fn,options));}
    function cancel(){if(ended)return;ended=true;root.cancelAnimationFrame(raf);cleanup.forEach(fn=>fn());surface.remove();onEnd();}
    function current(){const m=target.getScreenCTM();return isCurrent()&&target.isConnected&&target.getAttribute('data-rt-revision')===revision&&m&&initial&&['a','b','c','d','e','f'].every(key=>Math.abs(m[key]-initial[key])<1e-6);}
    function verify(){if(current())return true;cancel();onError('The SVG canvas changed while drawing. Select it again.');return false;}
    function action(label,fn){const b=root.document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;Object.assign(b.style,{padding:'0 8px',minHeight:'28px',border:'1px solid var(--line, #e6e6e6)',borderRadius:'4px',background:'var(--control, #f5f5f5)',color:'var(--ink, #1e1e1e)',font:'12px Inter,system-ui',cursor:'pointer'});toolbar.append(b);return b;}
    const finishButton=action('Finish line',()=>finish(false)),closeButton=action('Close shape',()=>finish(true)),backButton=action('Remove last point',back);action('Cancel',cancel);
    function update(){
      status.textContent=points.length+' points · Click or drag';
      finishButton.textContent=root.RetouchSVGPath.curved(points)?'Finish path':'Finish line';
      for(const [button,disabled]of [[finishButton,points.length<2],[closeButton,!root.RetouchSVGPath.serialize(points,true)],[backButton,!points.length]]){button.disabled=disabled;button.style.opacity=disabled?'.5':'1';}
      for(const dot of dots)dot.remove();dots.length=0;
      points.forEach((_,i)=>{const dot=root.document.createElement(i?'span':'button');
        if(!i){dot.type='button';dot.setAttribute('aria-label','Close vector at first point');dot.title='Close the shape';dot.disabled=!root.RetouchSVGPath.serialize(points,true);dot.onclick=()=>finish(true);}
        Object.assign(dot.style,{position:'absolute',width:'12px',height:'12px',padding:'0',boxSizing:'border-box',border:'2px solid var(--accent, #0d99ff)',background:'white',borderRadius:'50%',pointerEvents:i?'none':'auto',cursor:'crosshair'});surface.append(dot);dots.push(dot);
      });paint();
    }
    function point(event,last=points.at(-1)){
      const f=frame.getBoundingClientRect(),scale=f.width/w.innerWidth;
      let p=new w.DOMPoint((event.clientX-f.left)/scale,(event.clientY-f.top)/scale).matrixTransform(initial.inverse());
      if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>100000||Math.abs(p.y)>100000)throw Error('Keep points within supported SVG coordinates.');
      if(event.shiftKey&&last){const dx=p.x-last.x,dy=p.y-last.y,angle=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*Math.PI/4,length=Math.hypot(dx,dy);p={x:last.x+Math.cos(angle)*length,y:last.y+Math.sin(angle)*length};}
      return {x:Math.round(p.x*1e6)/1e6,y:Math.round(p.y*1e6)/1e6};
    }
    function paint(){
      const f=frame.getBoundingClientRect(),r=surface.getBoundingClientRect(),scale=f.width/w.innerWidth,m=initial;
      preview.setAttribute('d',root.RetouchSVGPath.serialize(hover&&points.length&&!drag?[...points,hover]:points)||'');
      preview.setAttribute('transform',`matrix(${m.a*scale} ${m.b*scale} ${m.c*scale} ${m.d*scale} ${m.e*scale+f.left-r.left} ${m.f*scale+f.top-r.top})`);
      if(contextPath)contextOutline.setAttribute('transform',preview.getAttribute('transform'));
      points.forEach((p,i)=>{const q=new w.DOMPoint(p.x,p.y).matrixTransform(m);Object.assign(dots[i].style,{left:f.left+q.x*scale-r.left-6+'px',top:f.top+q.y*scale-r.top-6+'px'});});
      tangents.replaceChildren();const anchor=points.at(-1);
      if(anchor){
        const screen=p=>{const q=new w.DOMPoint(p.x,p.y).matrixTransform(m);return{x:f.left+q.x*scale-r.left,y:f.top+q.y*scale-r.top};},a=screen(anchor);
        for(const key of ['in','out'])if(anchor[key]){const b=screen(anchor[key]),line=root.document.createElementNS(ns,'line'),dot=root.document.createElementNS(ns,'circle');line.setAttribute('x1',a.x);line.setAttribute('y1',a.y);line.setAttribute('x2',b.x);line.setAttribute('y2',b.y);line.style.cssText='stroke:var(--accent, #0d99ff)!important;stroke-width:1!important;';dot.setAttribute('cx',b.x);dot.setAttribute('cy',b.y);dot.setAttribute('r','4');dot.setAttribute('data-pen-handle',key);dot.style.cssText='fill:white!important;stroke:var(--accent, #0d99ff)!important;stroke-width:1.5!important;';tangents.append(line,dot);}
      }
    }
    function finish(closed){
      if(!verify())return;
      if(drag)return;
      if(!root.RetouchSVGPath.serialize(points,closed)){status.textContent=closed?'Place at least three different points.':'Place at least two different points.';return;}
      const value=points.flatMap(p=>[p.x,p.y]),nodes=root.RetouchSVGPath.curved(points)?points.map(p=>({...p})):null;cancel();onCommit(value,closed,nodes);
    }
    function back(){if(drag||!points.length||!verify())return;points.pop();hover=null;update();surface.focus({preventScroll:true});}
    listen(surface,'pointerdown',event=>{
      if(event.target.closest('button')||toolbar.contains(event.target)||event.button!==0||drag)return;
      event.preventDefault();event.stopImmediatePropagation();if(!inside(event)||!verify())return;
      if(points.length>=maxPoints){status.textContent='Finish this vector before adding more points.';return;}
      try{const p=point(event),last=points.at(-1);if(last&&Math.hypot(p.x-last.x,p.y-last.y)<1e-6)return;points.push(p);drag={id:event.pointerId,x:event.clientX,y:event.clientY,curved:false};hover=null;surface.setPointerCapture(event.pointerId);update();surface.focus({preventScroll:true});}catch(error){onError(error.message);}
    });
    function move(event){
      if(drag){
        if(event.pointerId!==drag.id||!verify())return;
        try{const anchor=points.at(-1),p=point(event,anchor);drag.curved ||= Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>=3;
          if(drag.curved){const incoming={x:2*anchor.x-p.x,y:2*anchor.y-p.y};if(Math.abs(incoming.x)>100000||Math.abs(incoming.y)>100000)throw Error('Keep curve handles within supported SVG coordinates.');anchor.out=p;anchor.in=incoming;update();}
        }catch(error){cancel();onError(error.message);}return;
      }
      if(toolbar.contains(event.target))return;if(!inside(event)){hover=null;paint();return;}try{hover=point(event);paint();}catch{hover=null;}
    }
    listen(surface,'pointermove',move);
    listen(surface,'pointerup',event=>{if(!drag||event.pointerId!==drag.id)return;event.preventDefault();event.stopImmediatePropagation();move(event);if(ended)return;drag=null;hover=null;if(surface.hasPointerCapture(event.pointerId))surface.releasePointerCapture(event.pointerId);paint();});
    listen(surface,'pointercancel',cancel);listen(surface,'lostpointercapture',()=>{if(drag)cancel();});
    listen(surface,'dblclick',event=>{if(event.target.closest('button')||toolbar.contains(event.target))return;event.preventDefault();event.stopImmediatePropagation();finish(false);});
    listen(surface,'keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancel();}
      else if(event.key==='Backspace'||event.key==='Delete'){event.preventDefault();event.stopImmediatePropagation();back();}
      else if(event.key==='Enter'&&event.target===surface){event.preventDefault();event.stopImmediatePropagation();finish(false);}
    },true);
    for(const event of ['retouch:before-zoom','retouch:screen','retouch:viewport','resize','blur','pagehide'])listen(root,event,cancel);
    listen(frame,'load',cancel);listen(w,'scroll',cancel,true);listen(canvas,'scroll',cancel);
    if(!initial||Math.abs(initial.a*initial.d-initial.b*initial.c)<1e-12){cancel();onError('This SVG transform cannot be drawn into.');return null;}
    const f=frame.getBoundingClientRect(),r=viewport.getBoundingClientRect(),c=canvas.getBoundingClientRect(),scale=f.width/w.innerWidth;
    const area={left:Math.max(f.left+r.left*scale,f.left,c.left),top:Math.max(f.top+r.top*scale,f.top,c.top),right:Math.min(f.left+r.right*scale,f.right,c.right),bottom:Math.min(f.top+r.bottom*scale,f.bottom,c.bottom)};
    function inside(event){return event.clientX>=area.left&&event.clientX<=area.right&&event.clientY>=area.top&&event.clientY<=area.bottom;}
    const left=Math.max(f.left,c.left),top=Math.max(f.top,c.top),right=Math.min(f.right,c.right),bottom=Math.min(f.bottom,c.bottom);
    if(right<=left||bottom<=top||area.right<=area.left||area.bottom<=area.top){cancel();onError('Bring the SVG canvas into view before drawing.');return null;}
    Object.assign(surface.style,{left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px'});if(bottom-top<180)toolbar.style.bottom='12px';
    root.document.body.append(surface);update();surface.focus({preventScroll:true});
    function watch(){if(!ended&&verify())raf=root.requestAnimationFrame(watch);}raf=root.requestAnimationFrame(watch);
    return cancel;
  }
  root.RetouchSVGPen={mount};
})(window);
