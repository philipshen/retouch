(function(root){
  'use strict';
  const ns='http://www.w3.org/2000/svg';
  function mount({target,frame,canvas,onCommit,onEnd,onError}){
    const w=target.ownerDocument.defaultView,viewport=target.tagName.toLowerCase()==='svg'?target:target.ownerSVGElement;
    const surface=root.document.createElement('div');surface.className='svg-pen-surface';surface.setAttribute('role','group');surface.setAttribute('aria-label','Draw vector');surface.tabIndex=0;
    Object.assign(surface.style,{position:'fixed',zIndex:40,cursor:'crosshair',touchAction:'none',overflow:'hidden'});
    const drawing=root.document.createElementNS(ns,'svg'),preview=root.document.createElementNS(ns,'polyline');
    Object.assign(drawing.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
    preview.style.cssText='fill:none!important;stroke:#6366f1!important;stroke-width:2!important;';preview.setAttribute('vector-effect','non-scaling-stroke');drawing.append(preview);surface.append(drawing);
    const toolbar=root.document.createElement('div');toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Pen actions');
    Object.assign(toolbar.style,{position:'absolute',left:'12px',bottom:'72px',maxWidth:'calc(100% - 24px)',display:'flex',flexWrap:'wrap',gap:'8px',alignItems:'center',padding:'8px',background:'#202226',border:'1px solid #6366f1',borderRadius:'6px',zIndex:2,cursor:'default'});
    const status=root.document.createElement('span');status.setAttribute('role','status');status.style.cssText='font:12px system-ui;color:#e5e7eb;';toolbar.append(status);surface.append(toolbar);
    const points=[],dots=[],cleanup=[],initial=target.getScreenCTM(),revision=target.getAttribute('data-rt-revision');let hover=null,ended=false,raf;
    function listen(el,type,fn,options){el.addEventListener(type,fn,options);cleanup.push(()=>el.removeEventListener(type,fn,options));}
    function cancel(){if(ended)return;ended=true;root.cancelAnimationFrame(raf);cleanup.forEach(fn=>fn());surface.remove();onEnd();}
    function current(){const m=target.getScreenCTM();return target.isConnected&&target.getAttribute('data-rt-revision')===revision&&m&&initial&&['a','b','c','d','e','f'].every(key=>Math.abs(m[key]-initial[key])<1e-6);}
    function verify(){if(current())return true;cancel();onError('The SVG canvas changed while drawing. Select it again.');return false;}
    function action(label,fn){const b=root.document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;Object.assign(b.style,{padding:'6px 10px',minHeight:'28px',border:'1px solid #454951',borderRadius:'4px',background:'#2b2e33',color:'#e5e7eb',font:'12px system-ui',cursor:'pointer'});toolbar.append(b);return b;}
    const finishButton=action('Finish line',()=>finish(false)),closeButton=action('Close shape',()=>finish(true)),backButton=action('Remove last point',back);action('Cancel',cancel);
    function update(){
      status.textContent=points.length+' points · Click to draw';
      for(const [button,disabled]of [[finishButton,points.length<2],[closeButton,points.length<3],[backButton,!points.length]]){button.disabled=disabled;button.style.opacity=disabled?'.5':'1';}
      for(const dot of dots)dot.remove();dots.length=0;
      points.forEach((_,i)=>{const dot=root.document.createElement(i?'span':'button');
        if(!i){dot.type='button';dot.setAttribute('aria-label','Close vector at first point');dot.title='Close the shape';dot.disabled=points.length<3;dot.onclick=()=>finish(true);}
        Object.assign(dot.style,{position:'absolute',width:'12px',height:'12px',padding:'0',boxSizing:'border-box',border:'2px solid #6366f1',background:'white',borderRadius:'50%',pointerEvents:i?'none':'auto',cursor:'crosshair'});surface.append(dot);dots.push(dot);
      });paint();
    }
    function point(event){
      const f=frame.getBoundingClientRect(),scale=f.width/w.innerWidth;
      let p=new w.DOMPoint((event.clientX-f.left)/scale,(event.clientY-f.top)/scale).matrixTransform(initial.inverse());
      if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>100000||Math.abs(p.y)>100000)throw Error('Keep points within supported SVG coordinates.');
      const last=points.at(-1);
      if(event.shiftKey&&last){const dx=p.x-last.x,dy=p.y-last.y,angle=Math.round(Math.atan2(dy,dx)/(Math.PI/4))*Math.PI/4,length=Math.hypot(dx,dy);p={x:last.x+Math.cos(angle)*length,y:last.y+Math.sin(angle)*length};}
      return {x:Math.round(p.x*1e6)/1e6,y:Math.round(p.y*1e6)/1e6};
    }
    function paint(){
      const f=frame.getBoundingClientRect(),r=surface.getBoundingClientRect(),scale=f.width/w.innerWidth,m=initial;
      preview.setAttribute('points',root.RetouchSVGPoints.format(hover&&points.length?[...points,hover]:points));
      preview.setAttribute('transform',`matrix(${m.a*scale} ${m.b*scale} ${m.c*scale} ${m.d*scale} ${m.e*scale+f.left-r.left} ${m.f*scale+f.top-r.top})`);
      points.forEach((p,i)=>{const q=new w.DOMPoint(p.x,p.y).matrixTransform(m);Object.assign(dots[i].style,{left:f.left+q.x*scale-r.left-6+'px',top:f.top+q.y*scale-r.top-6+'px'});});
    }
    function finish(closed){
      if(!verify())return;
      const distinct=new Set(points.map(p=>p.x+','+p.y));if(distinct.size<(closed?3:2)){status.textContent=closed?'Place at least three different points.':'Place at least two different points.';return;}
      const value=points.flatMap(p=>[p.x,p.y]);cancel();onCommit(value,closed);
    }
    function back(){if(!points.length||!verify())return;points.pop();hover=null;update();surface.focus({preventScroll:true});}
    listen(surface,'click',event=>{
      if(event.target.closest('button')||toolbar.contains(event.target)||event.button!==0)return;
      event.preventDefault();event.stopImmediatePropagation();if(!inside(event)||!verify())return;
      if(points.length>=512){status.textContent='Finish this vector before adding more points.';return;}
      try{const p=point(event),last=points.at(-1);if(last&&Math.hypot(p.x-last.x,p.y-last.y)<1e-6)return;points.push(p);hover=null;update();surface.focus({preventScroll:true});}catch(error){onError(error.message);}
    });
    listen(surface,'pointermove',event=>{if(toolbar.contains(event.target))return;if(!inside(event)){hover=null;paint();return;}try{hover=point(event);paint();}catch{hover=null;}});
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
