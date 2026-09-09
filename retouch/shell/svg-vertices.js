(function(root){
  'use strict';
  const ns='http://www.w3.org/2000/svg';
  let handleMovement='independent';
  function mount({target,frame,canvas,points,pathData=null,onCommit,onEnd,onError}){
    const w=target.ownerDocument.defaultView,property=pathData?'d':'points',original=target.getAttribute(property);
    const initialCSS=pathData?w.getComputedStyle(target).getPropertyValue('d'):null;
    const subpaths=pathData?.subpaths.map(part=>({closed:part.closed,nodes:part.nodes.map(p=>root.RetouchSVGPath.translate(p,0,0))}));
    let contour=0,vertices=subpaths?subpaths[0].nodes:points.map(p=>root.RetouchSVGPath.translate(p,0,0));const cleanup=[];
    const surface=root.document.createElement('div');surface.className='svg-vertex-surface';
    surface.setAttribute('role','group');surface.setAttribute('aria-label','Edit vector points');
    Object.assign(surface.style,{position:'fixed',zIndex:40,overflow:'hidden',touchAction:'none'});
    const drawing=root.document.createElementNS(ns,'svg');
    Object.assign(drawing.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none'});
    const otherContours=root.document.createElementNS(ns,'g');drawing.append(otherContours);
    const preview=root.document.createElementNS(ns,target.tagName.toLowerCase());
    preview.style.cssText='fill:none!important;stroke:#6366f1!important;stroke-width:1.5!important;';
    preview.setAttribute('vector-effect','non-scaling-stroke');drawing.append(preview);surface.append(drawing);
    let ended=false,drag=null,active=0,activeHandle=null,raf;
    const initialMatrix=target.getScreenCTM(),matrixValues=m=>m&&[m.a,m.b,m.c,m.d,m.e,m.f];
    const initial=matrixValues(initialMatrix);
    function listen(el,type,fn,options){el.addEventListener(type,fn,options);cleanup.push(()=>el.removeEventListener(type,fn,options));}
    function cancel(){if(ended)return;ended=true;root.cancelAnimationFrame(raf);cleanup.forEach(f=>f());surface.remove();onEnd();}
    function animated(){
      // WebKit can cache animatedPoints across React attribute updates. Inspect
      // SMIL targets instead of treating that stale list as the rendered geometry.
      return [...target.ownerDocument.querySelectorAll(`animate[attributeName="${property}"],set[attributeName="${property}"]`)].some(animation=>{
        if(animation.targetElement)return animation.targetElement===target;
        const href=animation.getAttribute('href')||animation.getAttributeNS('http://www.w3.org/1999/xlink','href');
        return href?!!target.id&&href==='#'+target.id:animation.parentElement===target;
      });
    }
    function current(){
      const m=matrixValues(target.getScreenCTM());
      return target.isConnected&&!animated()&&target.getAttribute(property)===original&&m&&initial&&m.every((n,i)=>Math.abs(n-initial[i])<1e-6)&&
        (pathData?w.getComputedStyle(target).getPropertyValue('d')===initialCSS:target.points.numberOfItems===points.length);
    }
    function verify(){if(current())return true;const message=animated()?(pathData?'This path has a geometry animation. Remove the animation before editing.':'This vector has a points animation. Remove the animation before editing its points.'):'The vector changed while editing. Select it again.';cancel();onError(message);return false;}
    function local(e){
      const f=frame.getBoundingClientRect(),scale=f.width/w.innerWidth;
      const p=new w.DOMPoint((e.clientX-f.left)/scale,(e.clientY-f.top)/scale).matrixTransform(initialMatrix.inverse());
      if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('This vector transform cannot be edited.');return p;
    }
    let closed=subpaths?subpaths[0].closed:target.tagName.toLowerCase()==='polygon';const minimum=pathData?2:closed?3:2;
    let handles=[],insertions=[],curveHandles=[];
    const tangentLines=root.document.createElementNS(ns,'g');drawing.append(tangentLines);
    const toolbar=root.document.createElement('div');
    toolbar.className='svg-vertex-toolbar';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Vector editing actions');
    Object.assign(toolbar.style,{position:'absolute',left:'12px',bottom:'72px',maxWidth:'calc(100% - 24px)',display:'flex',flexWrap:'wrap',gap:'8px',alignItems:'center',padding:'8px',background:'#202226',border:'1px solid #6366f1',borderRadius:'6px',zIndex:2});
    const status=root.document.createElement('span');status.setAttribute('role','status');
    status.style.cssText='font:12px system-ui;color:#e5e7eb;';toolbar.append(status);
    function action(label,fn){const b=root.document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;Object.assign(b.style,{padding:'6px 10px',minHeight:'28px',border:'1px solid #454951',borderRadius:'4px',background:'#2b2e33',color:'#e5e7eb',font:'12px system-ui',cursor:'pointer'});toolbar.append(b);return b;}
    let handleMode,contourPicker;
    if(subpaths?.length>1){
      const label=root.document.createElement('label');label.textContent='Contour ';label.style.cssText='font:12px system-ui;color:#e5e7eb;';
      contourPicker=root.document.createElement('select');contourPicker.setAttribute('aria-label','Path contour');contourPicker.style.cssText='padding:6px;background:#2b2e33;color:#e5e7eb;border:1px solid #454951;border-radius:4px;';
      subpaths.forEach((part,i)=>{const option=root.document.createElement('option');option.value=String(i);option.textContent=`${i+1} of ${subpaths.length} · ${part.closed?'Closed':'Open'}`;contourPicker.append(option);});
      contourPicker.onchange=()=>selectContour(Number(contourPicker.value));label.append(contourPicker);toolbar.append(label);
    }
    function selectContour(index){
      if(drag||!verify())return;contour=index;vertices=subpaths[index].nodes;closed=subpaths[index].closed;active=0;activeHandle=null;
      if(contourPicker)contourPicker.value=String(index);rebuild();handles[0].focus({preventScroll:true});
    }
    if(pathData){
      action('Make corner',()=>reshape('corner')).title='Remove the selected anchor’s handles';
      action('Make smooth',()=>reshape('smooth')).title='Create aligned handles along the neighboring anchors';
      const label=root.document.createElement('label');label.textContent='Move handles ';label.style.cssText='font:12px system-ui;color:#e5e7eb;';
      handleMode=root.document.createElement('select');handleMode.setAttribute('aria-label','Handle movement');handleMode.title='Applies to paired handles while editing. Independent moves one; aligned keeps the opposite length; mirrored keeps equal lengths.';
      for(const [value,text] of [['independent','Independent'],['aligned','Aligned'],['mirrored','Mirrored']]){const option=root.document.createElement('option');option.value=value;option.textContent=text;handleMode.append(option);}
      handleMode.value=handleMovement;handleMode.style.cssText='padding:6px;background:#2b2e33;color:#e5e7eb;border:1px solid #454951;border-radius:4px;';handleMode.onchange=()=>{handleMovement=handleMode.value;};label.append(handleMode);toolbar.append(label);
    }
    const removeButton=action('Delete point',removePoint);
    action('Done',commit);action('Cancel',cancel);surface.append(toolbar);
    function announce(message){status.textContent=message||`${activeHandle?activeHandle==='in'?'Incoming handle on point':'Outgoing handle on point':'Point'} ${active+1} of ${vertices.length}`;removeButton.disabled=vertices.length<=minimum;removeButton.style.opacity=removeButton.disabled?'.5':'1';}
    const totalPoints=()=>subpaths?subpaths.reduce((sum,part)=>sum+part.nodes.length,0):vertices.length;
    function rebuild(){
      for(const b of [...handles,...insertions,...curveHandles.map(h=>h.button)])b.remove();handles=[];insertions=[];curveHandles=[];
      vertices.forEach((_,i)=>{
        const b=root.document.createElement('button');b.type='button';b.dataset.vertex=String(i);b.setAttribute('aria-label','Vector point '+(i+1));
        Object.assign(b.style,{position:'absolute',width:'12px',height:'12px',padding:'0',border:'2px solid #6366f1',background:'white',borderRadius:'2px',cursor:'move',touchAction:'none',zIndex:1});
        surface.append(b);handles.push(b);
        if(pathData)for(const key of ['in','out'])if(vertices[i][key]&&Math.hypot(vertices[i][key].x-vertices[i].x,vertices[i][key].y-vertices[i].y)>1e-9){const control=root.document.createElement('button');control.type='button';control.dataset.vertex=String(i);control.dataset.curveHandle=key;control.setAttribute('aria-label',(key==='in'?'Incoming':'Outgoing')+' handle '+(i+1));Object.assign(control.style,{position:'absolute',width:'10px',height:'10px',padding:'0',border:'2px solid #8b5cf6',background:'white',borderRadius:'50%',cursor:'move',touchAction:'none',zIndex:1});surface.append(control);curveHandles.push({button:control,index:i,key});}

        if(closed||i<vertices.length-1){
          const add=root.document.createElement('button');add.type='button';add.dataset.insertVertex=String(i);add.setAttribute('aria-label','Add point after '+(i+1));add.title='Add a point on this edge';add.textContent='+';add.disabled=totalPoints()>=512;
          Object.assign(add.style,{position:'absolute',width:'18px',height:'18px',padding:'0',border:'1px solid #6366f1',background:'white',color:'#4338ca',borderRadius:'50%',font:'14px/16px system-ui',cursor:'copy'});
          surface.append(add);insertions.push(add);
        }
      });
      announce();paint();
    }
    function reshape(kind){
      if(drag||!verify())return;
      const next=kind==='corner'?root.RetouchSVGPath.corner(vertices[active]):root.RetouchSVGPath.smooth(vertices,active,closed);
      const candidate=vertices.map((p,i)=>i===active?next:p);
      if(!next||!root.RetouchSVGPath.serialize(candidate,closed)){announce('This point cannot use that shape. Keep a valid path.');return;}
      vertices[active]=next;activeHandle=null;rebuild();handles[active].focus({preventScroll:true});
    }
    function changeHandle(node,key,point){
      const next=root.RetouchSVGPath.moveHandle(node,key,point,handleMovement);
      if(next)vertices[active]=next;else announce('Keep handles within supported SVG coordinates.');
    }
    function insertPoint(index){
      if(drag||!verify())return;
      if(totalPoints()>=512){announce('This vector has reached 512 points.');return;}
      const a=vertices[index],b=vertices[(index+1)%vertices.length];
      if(pathData){const next=root.RetouchSVGPath.split(vertices,index,closed);if(!next)return;vertices.splice(0,vertices.length,...next);}else vertices.splice(index+1,0,{x:(a.x+b.x)/2,y:(a.y+b.y)/2});activeHandle=null;active=index+1;rebuild();handles[active].focus({preventScroll:true});
    }
    function removePoint(){
      if(drag||!verify())return;
      if(vertices.length<=minimum){announce(`Keep at least ${minimum} points in this ${closed?'polygon':'line'}.`);return;}
      if(pathData&&!root.RetouchSVGPath.serialize(vertices.filter((_,i)=>i!==active),closed)){announce('Keep a valid contour with distinct anchors.');return;}
      vertices.splice(active,1);activeHandle=null;active=Math.min(active,vertices.length-1);rebuild();handles[active].focus({preventScroll:true});
    }
    listen(surface,'focusin',e=>{if(e.target.dataset.vertex!==undefined){active=Number(e.target.dataset.vertex);activeHandle=e.target.dataset.curveHandle||null;announce();}});
    listen(surface,'click',e=>{if(e.target.dataset.contour!==undefined){e.preventDefault();e.stopImmediatePropagation();selectContour(Number(e.target.dataset.contour));return;}if(e.target.dataset.insertVertex!==undefined){e.preventDefault();e.stopImmediatePropagation();insertPoint(Number(e.target.dataset.insertVertex));}});
    function paint(){
      const f=frame.getBoundingClientRect(),r=surface.getBoundingClientRect(),scale=f.width/w.innerWidth,m=initialMatrix;
      preview.setAttribute(property,pathData?root.RetouchSVGPath.serialize(vertices,closed)||'':root.RetouchSVGPoints.format(vertices));
      preview.setAttribute('transform',`matrix(${m.a*scale} ${m.b*scale} ${m.c*scale} ${m.d*scale} ${m.e*scale+f.left-r.left} ${m.f*scale+f.top-r.top})`);
      otherContours.replaceChildren();
      subpaths?.forEach((part,i)=>{if(i===contour)return;const outline=root.document.createElementNS(ns,'path');outline.setAttribute('d',root.RetouchSVGPath.serialize(part.nodes,part.closed));outline.setAttribute('transform',preview.getAttribute('transform'));outline.setAttribute('vector-effect','non-scaling-stroke');outline.style.cssText='fill:none!important;stroke:#a78bfa!important;stroke-width:1.5!important;';otherContours.append(outline);
        const hit=outline.cloneNode();hit.dataset.contour=String(i);hit.style.cssText='fill:none!important;stroke:transparent!important;stroke-width:12!important;pointer-events:stroke;cursor:pointer;';const title=root.document.createElementNS(ns,'title');title.textContent='Edit contour '+(i+1);hit.append(title);otherContours.append(hit);});
      function position(b,p,half){const q=new w.DOMPoint(p.x,p.y).matrixTransform(m);Object.assign(b.style,{left:f.left+q.x*scale-r.left-half+'px',top:f.top+q.y*scale-r.top-half+'px'});}
      vertices.forEach((p,i)=>position(handles[i],p,6));
      insertions.forEach((b,i)=>{const a=vertices[i],next=vertices[(i+1)%vertices.length];position(b,pathData?root.RetouchSVGPath.segmentMiddle(a,next):{x:(a.x+next.x)/2,y:(a.y+next.y)/2},9);});
      tangentLines.replaceChildren();curveHandles.forEach(h=>{const a=vertices[h.index],b=a[h.key];position(h.button,b,5);const line=root.document.createElementNS(ns,'line'),p=new w.DOMPoint(a.x,a.y).matrixTransform(m),q=new w.DOMPoint(b.x,b.y).matrixTransform(m);line.setAttribute('x1',f.left+p.x*scale-r.left);line.setAttribute('y1',f.top+p.y*scale-r.top);line.setAttribute('x2',f.left+q.x*scale-r.left);line.setAttribute('y2',f.top+q.y*scale-r.top);line.style.cssText='stroke:#8b5cf6!important;stroke-width:1!important;';tangentLines.append(line);});

    }
    function commit(){
      if(!verify())return;
      const value=pathData?root.RetouchSVGPath.serializeCompound({subpaths}):root.RetouchSVGPoints.format(vertices),changed=pathData?JSON.stringify(subpaths)!==JSON.stringify(pathData.subpaths):JSON.stringify(vertices)!==JSON.stringify(points);
      if(pathData?!value:!root.RetouchSVGPoints.parse(value)){cancel();onError('Vector points must stay within supported SVG coordinates.');return;}
      cancel();if(changed)onCommit(value);
    }
    function move(e){
      if(!drag||e.pointerId!==drag.id||!verify())return;
      try{const p=local(e);let dx=p.x-drag.pointer.x,dy=p.y-drag.pointer.y;
        if(e.shiftKey){if(Math.abs(dx)>Math.abs(dy))dy=0;else dx=0;}
        if(activeHandle)changeHandle(drag.node,activeHandle,{x:drag.point.x+dx,y:drag.point.y+dy});else vertices[active]=root.RetouchSVGPath.translate(drag.point,dx,dy);paint();
      }catch(error){cancel();onError(error.message);}
    }
    listen(surface,'pointerdown',e=>{
      const b=e.target;if(b.dataset.vertex===undefined||e.button!==0||drag)return;
      e.preventDefault();e.stopImmediatePropagation();if(!verify())return;
      try{active=Number(b.dataset.vertex);activeHandle=b.dataset.curveHandle||null;b.focus({preventScroll:true});drag={id:e.pointerId,pointer:local(e),node:root.RetouchSVGPath.translate(vertices[active],0,0),point:root.RetouchSVGPath.translate(activeHandle?vertices[active][activeHandle]:vertices[active],0,0)};b.setPointerCapture(e.pointerId);}catch(error){cancel();onError(error.message);}
    });
    listen(surface,'pointermove',move);
    listen(surface,'pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();move(e);if(!ended){const selected=activeHandle?vertices[active][activeHandle]:vertices[active],moved=Math.hypot(selected.x-drag.point.x,selected.y-drag.point.y)>1e-9;drag=null;if(moved)commit();}});
    listen(surface,'pointercancel',cancel);listen(surface,'lostpointercapture',()=>{if(drag)cancel();});
    listen(surface,'keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();return;}
      if(e.target===handleMode||e.target===contourPicker)return;
      if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();e.stopImmediatePropagation();removePoint();return;}
      if(e.key==='Enter'&&e.target.dataset.vertex!==undefined){e.preventDefault();e.stopImmediatePropagation();commit();return;}
      const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
      if(!delta||e.metaKey||e.ctrlKey||e.altKey)return;e.preventDefault();e.stopImmediatePropagation();if(!verify())return;
      const step=e.shiftKey?10:1;if(activeHandle)changeHandle(vertices[active],activeHandle,root.RetouchSVGPath.translate(vertices[active][activeHandle],delta[0]*step,delta[1]*step));else vertices[active]=root.RetouchSVGPath.translate(vertices[active],delta[0]*step,delta[1]*step);paint();
    },true);
    for(const event of ['retouch:before-zoom','retouch:screen','retouch:viewport','resize','blur','pagehide'])listen(root,event,cancel);
    listen(frame,'load',cancel);listen(w,'scroll',cancel,true);listen(canvas,'scroll',cancel);
    if(pathData&&initialCSS){
      // Compare values normalized by the same browser CSS parser: computed d can
      // round coordinates even when the source attribute supplies all geometry.
      const style=root.document.createElement('span').style;style.setProperty('d','path("'+original.replace(/\s+/g,' ')+'")');
      const parseCSS=value=>{const match=/^path\(["']([\s\S]*)["']\)$/.exec(value);return match&&root.RetouchSVGPath.parseCompound(match[1]);};
      if(!root.RetouchSVGPath.equivalentCompound(parseCSS(style.getPropertyValue('d'))||pathData,parseCSS(initialCSS))){cancel();onError('This path has a CSS geometry override. Edit that style before changing its source points.');return null;}
    }
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
