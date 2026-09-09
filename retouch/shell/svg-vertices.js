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
    function animated(){
      // WebKit can cache animatedPoints across React attribute updates. Inspect
      // SMIL targets instead of treating that stale list as the rendered geometry.
      return [...target.ownerDocument.querySelectorAll('animate[attributeName="points"],set[attributeName="points"]')].some(animation=>{
        if(animation.targetElement)return animation.targetElement===target;
        const href=animation.getAttribute('href')||animation.getAttributeNS('http://www.w3.org/1999/xlink','href');
        return href?!!target.id&&href==='#'+target.id:animation.parentElement===target;
      });
    }
    function current(){
      const m=matrixValues(target.getScreenCTM());
      return target.isConnected&&!animated()&&target.getAttribute('points')===original&&m&&initial&&m.every((n,i)=>Math.abs(n-initial[i])<1e-6)&&
        target.points.numberOfItems===points.length;
    }
    function verify(){if(current())return true;const message=animated()?'This vector has a points animation. Remove the animation before editing its points.':'The vector changed while editing. Select it again.';cancel();onError(message);return false;}
    function local(e){
      const f=frame.getBoundingClientRect(),scale=f.width/w.innerWidth;
      const p=new w.DOMPoint((e.clientX-f.left)/scale,(e.clientY-f.top)/scale).matrixTransform(initialMatrix.inverse());
      if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('This vector transform cannot be edited.');return p;
    }
    const closed=target.tagName.toLowerCase()==='polygon',minimum=closed?3:2;
    let handles=[],insertions=[];
    const toolbar=root.document.createElement('div');
    toolbar.className='svg-vertex-toolbar';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Vector editing actions');
    Object.assign(toolbar.style,{position:'absolute',left:'12px',bottom:'72px',maxWidth:'calc(100% - 24px)',display:'flex',flexWrap:'wrap',gap:'8px',alignItems:'center',padding:'8px',background:'#202226',border:'1px solid #6366f1',borderRadius:'6px',zIndex:2});
    const status=root.document.createElement('span');status.setAttribute('role','status');
    status.style.cssText='font:12px system-ui;color:#e5e7eb;';toolbar.append(status);
    function action(label,fn){const b=root.document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;Object.assign(b.style,{padding:'6px 10px',minHeight:'28px',border:'1px solid #454951',borderRadius:'4px',background:'#2b2e33',color:'#e5e7eb',font:'12px system-ui',cursor:'pointer'});toolbar.append(b);return b;}
    const removeButton=action('Delete point',removePoint);
    action('Done',commit);action('Cancel',cancel);surface.append(toolbar);
    function announce(message){status.textContent=message||`Point ${active+1} of ${vertices.length}`;removeButton.disabled=vertices.length<=minimum;removeButton.style.opacity=removeButton.disabled?'.5':'1';}
    function rebuild(){
      for(const b of [...handles,...insertions])b.remove();handles=[];insertions=[];
      vertices.forEach((_,i)=>{
        const b=root.document.createElement('button');b.type='button';b.dataset.vertex=String(i);b.setAttribute('aria-label','Vector point '+(i+1));
        Object.assign(b.style,{position:'absolute',width:'12px',height:'12px',padding:'0',border:'2px solid #6366f1',background:'white',borderRadius:'2px',cursor:'move',touchAction:'none',zIndex:1});
        surface.append(b);handles.push(b);
        if(closed||i<vertices.length-1){
          const add=root.document.createElement('button');add.type='button';add.dataset.insertVertex=String(i);add.setAttribute('aria-label','Add point after '+(i+1));add.title='Add a point on this edge';add.textContent='+';add.disabled=vertices.length>=512;
          Object.assign(add.style,{position:'absolute',width:'18px',height:'18px',padding:'0',border:'1px solid #6366f1',background:'white',color:'#4338ca',borderRadius:'50%',font:'14px/16px system-ui',cursor:'copy'});
          surface.append(add);insertions.push(add);
        }
      });
      announce();paint();
    }
    function insertPoint(index){
      if(drag||!verify())return;
      if(vertices.length>=512){announce('This vector has reached 512 points.');return;}
      const a=vertices[index],b=vertices[(index+1)%vertices.length];
      vertices.splice(index+1,0,{x:(a.x+b.x)/2,y:(a.y+b.y)/2});active=index+1;rebuild();handles[active].focus({preventScroll:true});
    }
    function removePoint(){
      if(drag||!verify())return;
      if(vertices.length<=minimum){announce(`Keep at least ${minimum} points in this ${closed?'polygon':'line'}.`);return;}
      vertices.splice(active,1);active=Math.min(active,vertices.length-1);rebuild();handles[active].focus({preventScroll:true});
    }
    listen(surface,'focusin',e=>{if(e.target.dataset.vertex!==undefined){active=Number(e.target.dataset.vertex);announce();}});
    listen(surface,'click',e=>{if(e.target.dataset.insertVertex!==undefined){e.preventDefault();e.stopImmediatePropagation();insertPoint(Number(e.target.dataset.insertVertex));}});
    function paint(){
      const f=frame.getBoundingClientRect(),r=surface.getBoundingClientRect(),scale=f.width/w.innerWidth,m=initialMatrix;
      preview.setAttribute('points',root.RetouchSVGPoints.format(vertices));
      preview.setAttribute('transform',`matrix(${m.a*scale} ${m.b*scale} ${m.c*scale} ${m.d*scale} ${m.e*scale+f.left-r.left} ${m.f*scale+f.top-r.top})`);
      function position(b,p,half){const q=new w.DOMPoint(p.x,p.y).matrixTransform(m);Object.assign(b.style,{left:f.left+q.x*scale-r.left-half+'px',top:f.top+q.y*scale-r.top-half+'px'});}
      vertices.forEach((p,i)=>position(handles[i],p,6));
      insertions.forEach((b,i)=>{const a=vertices[i],next=vertices[(i+1)%vertices.length];position(b,{x:(a.x+next.x)/2,y:(a.y+next.y)/2},9);});
    }
    function commit(){
      if(!verify())return;
      const value=root.RetouchSVGPoints.format(vertices),changed=vertices.length!==points.length||vertices.some((p,i)=>p.x!==points[i].x||p.y!==points[i].y);
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
    listen(surface,'pointerdown',e=>{
      const b=e.target;if(b.dataset.vertex===undefined||e.button!==0||drag)return;
      e.preventDefault();e.stopImmediatePropagation();if(!verify())return;
      try{active=Number(b.dataset.vertex);b.focus({preventScroll:true});drag={id:e.pointerId,pointer:local(e),point:{...vertices[active]}};b.setPointerCapture(e.pointerId);}catch(error){cancel();onError(error.message);}
    });
    listen(surface,'pointermove',move);
    listen(surface,'pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();move(e);if(!ended){const moved=Math.hypot(vertices[active].x-drag.point.x,vertices[active].y-drag.point.y)>1e-9;drag=null;if(moved)commit();}});
    listen(surface,'pointercancel',cancel);listen(surface,'lostpointercapture',()=>{if(drag)cancel();});
    listen(surface,'keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();return;}
      if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();e.stopImmediatePropagation();removePoint();return;}
      if(e.key==='Enter'&&e.target.dataset.vertex!==undefined){e.preventDefault();e.stopImmediatePropagation();commit();return;}
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
    if(bottom-top<180)toolbar.style.bottom='12px';
    root.document.body.append(surface);rebuild();handles[0].focus({preventScroll:true});
    function watch(){if(!ended&&verify())raf=root.requestAnimationFrame(watch);}raf=root.requestAnimationFrame(watch);
    return cancel;
  }
  root.RetouchSVGVertices={mount};
})(window);
