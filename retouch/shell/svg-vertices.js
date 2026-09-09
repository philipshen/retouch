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
    preview.dataset.vectorPreview='true';
    preview.style.cssText='fill:none!important;stroke:#6366f1!important;stroke-width:1.5!important;';
    preview.setAttribute('vector-effect','non-scaling-stroke');drawing.append(preview);surface.append(drawing);
    const contourHit=root.document.createElementNS(ns,'path');contourHit.dataset.moveContour='true';contourHit.setAttribute('aria-label','Move selected contour');contourHit.setAttribute('role','button');contourHit.setAttribute('vector-effect','non-scaling-stroke');contourHit.style.cssText='fill:none!important;stroke:transparent!important;stroke-width:14!important;pointer-events:stroke;cursor:move;outline:none;';drawing.append(contourHit);
    let ended=false,drag=null,active=0,activeHandle=null,raf,cancelPen=null,moveContourMode=false;
    const initialMatrix=target.getScreenCTM(),matrixValues=m=>m&&[m.a,m.b,m.c,m.d,m.e,m.f];
    const initial=matrixValues(initialMatrix);
    function listen(el,type,fn,options){el.addEventListener(type,fn,options);cleanup.push(()=>el.removeEventListener(type,fn,options));}
    function cancel(){if(ended)return;ended=true;cancelPen?.();root.cancelAnimationFrame(raf);cleanup.forEach(f=>f());surface.remove();onEnd();}
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
    let handleMode,contourPicker,deleteContourButton,duplicateContourButton,closureButton,drawContourButton,moveContourButton,cornerButton,smoothButton;
    if(subpaths){
      const label=root.document.createElement('label');label.textContent='Contour ';label.style.cssText='font:12px system-ui;color:#e5e7eb;';
      contourPicker=root.document.createElement('select');contourPicker.setAttribute('aria-label','Path contour');contourPicker.style.cssText='padding:6px;background:#2b2e33;color:#e5e7eb;border:1px solid #454951;border-radius:4px;';

      contourPicker.onchange=()=>selectContour(Number(contourPicker.value));label.append(contourPicker);toolbar.append(label);
    }
    function selectContour(index){
      if(drag||!verify())return;contour=index;vertices=subpaths[index].nodes;closed=subpaths[index].closed;active=0;activeHandle=null;
      if(contourPicker)contourPicker.value=String(index);rebuild();(moveContourMode?contourHit:handles[0]).focus({preventScroll:true});
    }
    if(pathData){
      cornerButton=action('Make corner',()=>reshape('corner'));cornerButton.title='Remove the selected anchor’s handles';
      smoothButton=action('Make smooth',()=>reshape('smooth'));smoothButton.title='Create aligned handles along the neighboring anchors';
      const label=root.document.createElement('label');label.textContent='Move handles ';label.style.cssText='font:12px system-ui;color:#e5e7eb;';
      handleMode=root.document.createElement('select');handleMode.setAttribute('aria-label','Handle movement');handleMode.title='Applies to paired handles while editing. Independent moves one; aligned keeps the opposite length; mirrored keeps equal lengths.';
      for(const [value,text] of [['independent','Independent'],['aligned','Aligned'],['mirrored','Mirrored']]){const option=root.document.createElement('option');option.value=value;option.textContent=text;handleMode.append(option);}
      handleMode.value=handleMovement;handleMode.style.cssText='padding:6px;background:#2b2e33;color:#e5e7eb;border:1px solid #454951;border-radius:4px;';handleMode.onchange=()=>{handleMovement=handleMode.value;};label.append(handleMode);toolbar.append(label);
    }
    if(subpaths){
      moveContourButton=action('Move contour',()=>{if(drag||!verify())return;moveContourMode=!moveContourMode;activeHandle=null;rebuild();(moveContourMode?contourHit:handles[active]).focus({preventScroll:true});});moveContourButton.title='Move every anchor and handle in the selected contour. Drag its outline or use arrow keys; Shift constrains movement.';
      drawContourButton=action('Draw contour',drawContour);drawContourButton.title='Draw a new outline in this path. Finish drawing, then Done saves the path.';
      duplicateContourButton=action('Duplicate contour',()=>restructure('duplicate'));duplicateContourButton.title='Copy this contour with a 10-unit SVG offset';
      deleteContourButton=action('Delete contour',()=>restructure('delete'));deleteContourButton.title='Remove this contour, keeping the rest of the path';
      action('Reverse contour',()=>restructure('reverse')).title='Reverse drawing direction. This can change holes with the nonzero fill rule.';
      closureButton=action('Close contour',()=>restructure(closed?'open':'close'));
    }
    function drawContour(){
      if(drag||!verify()||cancelPen)return;
      if(totalPoints()>510||subpaths.length>=128){announce('This path has no room for another contour.');return;}
      surface.style.display='none';
      cancelPen=root.RetouchSVGPen.mount({target,frame,canvas,maxPoints:512-totalPoints(),isCurrent:current,contextPath:root.RetouchSVGPath.serializeCompound({subpaths}),
        onEnd:()=>{cancelPen=null;if(!ended){surface.style.display='';rebuild();(moveContourMode?contourHit:handles[active]).focus({preventScroll:true});}},
        onError,
        onCommit:(flat,closed,nodes)=>{
          if(ended||!verify())return;
          const drawn=nodes||Array.from({length:flat.length/2},(_,i)=>({x:flat[i*2],y:flat[i*2+1]}));
          const result=root.RetouchSVGPath.appendContour({subpaths},drawn,closed);
          if(!result){announce('The new contour exceeds this path’s supported limits.');return;}
          subpaths.splice(0,subpaths.length,...result.subpaths);selectContour(result.selected);announce('Contour added to preview. Done saves; Escape cancels.');
        }});
    }
    function restructure(action){
      if(drag||!verify())return;
      const result=root.RetouchSVGPath.editContour({subpaths},contour,action);
      if(!result){announce('This contour change would exceed path limits or leave an invalid path.');return;}
      subpaths.splice(0,subpaths.length,...result.subpaths);selectContour(result.selected);
      announce({duplicate:'Contour duplicated. Done saves; Escape cancels.',delete:'Contour removed from preview. Done saves; Escape cancels.',reverse:'Contour direction reversed. Done saves; Escape cancels.',open:'Closing edge removed. Done saves; Escape cancels.',close:'Endpoints joined. Done saves; Escape cancels.'}[action]);
    }
    const removeButton=action('Delete point',removePoint);
    action('Done',commit);action('Cancel',cancel);surface.append(toolbar);
    function adjacentArc(){return !!(vertices[active]?.arc||(vertices[active+1]||(closed?vertices[0]:null))?.arc);}
    function announce(message){if(cornerButton){const arcEndpoint=adjacentArc(),disabled=moveContourMode||arcEndpoint;cornerButton.title=arcEndpoint?'Arc endpoints retain arc geometry. Move them or edit the path data.':'Remove the selected anchor’s handles';smoothButton.title=arcEndpoint?'Arc endpoints retain arc geometry. Move them or edit the path data.':'Create aligned handles along the neighboring anchors';cornerButton.disabled=disabled;smoothButton.disabled=disabled;for(const button of [cornerButton,smoothButton])button.style.opacity=disabled?'.5':'1';}status.textContent=message||`${activeHandle?activeHandle==='in'?'Incoming handle on point':'Outgoing handle on point':'Point'} ${active+1} of ${vertices.length}`;removeButton.disabled=moveContourMode||vertices.length<=minimum;removeButton.style.opacity=removeButton.disabled?'.5':'1';}
    const totalPoints=()=>subpaths?subpaths.reduce((sum,part)=>sum+part.nodes.length,0):vertices.length;
    function refreshContours(){
      if(!contourPicker)return;contourPicker.replaceChildren();
      subpaths.forEach((part,i)=>{const option=root.document.createElement('option');option.value=String(i);option.textContent=`${i+1} of ${subpaths.length} · ${part.closed?'Closed':'Open'}`;contourPicker.append(option);});contourPicker.value=String(contour);
      drawContourButton.disabled=subpaths.length>=128||totalPoints()>510;deleteContourButton.disabled=subpaths.length===1;duplicateContourButton.disabled=subpaths.length>=128||totalPoints()+vertices.length>512;
      closureButton.textContent=closed?'Open contour':'Close contour';closureButton.title=closed?'Remove the edge from the last anchor to the first':'Join the last anchor to the first with a straight edge';
      moveContourButton.setAttribute('aria-pressed',String(moveContourMode));moveContourButton.style.background=moveContourMode?'#4338ca':'#2b2e33';cornerButton.disabled=moveContourMode;smoothButton.disabled=moveContourMode;handleMode.disabled=moveContourMode;
      for(const button of [deleteContourButton,duplicateContourButton,drawContourButton,cornerButton,smoothButton])button.style.opacity=button.disabled?'.5':'1';
    }
    function rebuild(){
      refreshContours();
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
      for(const button of [...handles,...insertions,...curveHandles.map(h=>h.button)])button.hidden=moveContourMode;
      tangentLines.style.display=moveContourMode?'none':'';preview.style.setProperty('stroke',moveContourMode?'#2563eb':'#6366f1','important');preview.style.setProperty('stroke-width',moveContourMode?'2.5':'1.5','important');
      contourHit.style.display=moveContourMode?'':'none';contourHit.setAttribute('tabindex',moveContourMode?'0':'-1');
      announce(moveContourMode?'Drag this contour or use arrows. Shift: 10 units. Done or Enter saves.':undefined);paint();
    }
    function reshape(kind){
      if(drag||!verify())return;
      if(adjacentArc()){announce('Arc endpoints support moving and subdivision. Edit path data to change arc parameters.');return;}
      const next=kind==='corner'?root.RetouchSVGPath.corner(vertices[active]):root.RetouchSVGPath.smooth(vertices,active,closed);
      const candidate=vertices.map((p,i)=>i===active?next:p);
      if(!next||!root.RetouchSVGPath.serialize(candidate,closed)){announce('This point cannot use that shape. Keep a valid path.');return;}
      vertices[active]=next;activeHandle=null;rebuild();(moveContourMode?contourHit:handles[active]).focus({preventScroll:true});
    }
    function changeHandle(node,key,point){
      const next=root.RetouchSVGPath.moveHandle(node,key,point,handleMovement);
      if(next)vertices[active]=next;else announce('Keep handles within supported SVG coordinates.');
    }
    function insertPoint(index){
      if(drag||!verify())return;
      if(totalPoints()>=512){announce('This vector has reached 512 points.');return;}
      const a=vertices[index],b=vertices[(index+1)%vertices.length];
      if(pathData){const next=root.RetouchSVGPath.split(vertices,index,closed);if(!next)return;vertices.splice(0,vertices.length,...next);}else vertices.splice(index+1,0,{x:(a.x+b.x)/2,y:(a.y+b.y)/2});activeHandle=null;active=index+1;rebuild();(moveContourMode?contourHit:handles[active]).focus({preventScroll:true});
    }
    function removePoint(){
      if(drag||!verify())return;
      if(vertices.length<=minimum){announce(`Keep at least ${minimum} points in this ${closed?'polygon':'line'}.`);return;}
      if(pathData&&!root.RetouchSVGPath.serialize(vertices.filter((_,i)=>i!==active),closed)){announce('Keep a valid contour with distinct anchors.');return;}
      vertices.splice(active,1);activeHandle=null;active=Math.min(active,vertices.length-1);rebuild();(moveContourMode?contourHit:handles[active]).focus({preventScroll:true});
    }
    listen(surface,'focusin',e=>{if(e.target.dataset.vertex!==undefined){active=Number(e.target.dataset.vertex);activeHandle=e.target.dataset.curveHandle||null;announce();}});
    listen(surface,'click',e=>{if(e.target.dataset.contour!==undefined){e.preventDefault();e.stopImmediatePropagation();selectContour(Number(e.target.dataset.contour));return;}if(e.target.dataset.insertVertex!==undefined){e.preventDefault();e.stopImmediatePropagation();insertPoint(Number(e.target.dataset.insertVertex));}});
    function paint(){
      const f=frame.getBoundingClientRect(),r=surface.getBoundingClientRect(),scale=f.width/w.innerWidth,m=initialMatrix;
      preview.setAttribute(property,pathData?root.RetouchSVGPath.serialize(vertices,closed)||'':root.RetouchSVGPoints.format(vertices));
      preview.setAttribute('transform',`matrix(${m.a*scale} ${m.b*scale} ${m.c*scale} ${m.d*scale} ${m.e*scale+f.left-r.left} ${m.f*scale+f.top-r.top})`);
      contourHit.setAttribute('d',preview.getAttribute('d')||'');contourHit.setAttribute('transform',preview.getAttribute('transform'));
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
        if(drag.contour){const translated=root.RetouchSVGPath.translateContour(drag.contour,dx,dy);if(translated)vertices.splice(0,vertices.length,...translated.nodes);else announce('Keep the contour within supported SVG coordinates.');}else if(activeHandle)changeHandle(drag.node,activeHandle,{x:drag.point.x+dx,y:drag.point.y+dy});else vertices[active]=root.RetouchSVGPath.translate(drag.point,dx,dy);paint();
      }catch(error){cancel();onError(error.message);}
    }
    listen(surface,'pointerdown',e=>{
      const b=e.target;if(e.button!==0||drag)return;
      if(moveContourMode&&b===contourHit){e.preventDefault();e.stopImmediatePropagation();if(!verify())return;try{contourHit.focus({preventScroll:true});drag={id:e.pointerId,pointer:local(e),point:{...vertices[0]},contour:{closed,nodes:vertices.map(p=>root.RetouchSVGPath.translate(p,0,0))}};contourHit.setPointerCapture(e.pointerId);}catch(error){cancel();onError(error.message);}return;}
      if(b.dataset.vertex===undefined)return;
      e.preventDefault();e.stopImmediatePropagation();if(!verify())return;
      try{active=Number(b.dataset.vertex);activeHandle=b.dataset.curveHandle||null;b.focus({preventScroll:true});drag={id:e.pointerId,pointer:local(e),node:root.RetouchSVGPath.translate(vertices[active],0,0),point:root.RetouchSVGPath.translate(activeHandle?vertices[active][activeHandle]:vertices[active],0,0)};b.setPointerCapture(e.pointerId);}catch(error){cancel();onError(error.message);}
    });
    listen(surface,'pointermove',move);
    listen(surface,'pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();move(e);if(!ended){const selected=drag.contour?vertices[0]:activeHandle?vertices[active][activeHandle]:vertices[active],moved=Math.hypot(selected.x-drag.point.x,selected.y-drag.point.y)>1e-9;drag=null;if(moved)commit();}});
    listen(surface,'pointercancel',cancel);listen(surface,'lostpointercapture',()=>{if(drag)cancel();});
    listen(surface,'keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();return;}
      if(e.target===handleMode||e.target===contourPicker)return;
      if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();e.stopImmediatePropagation();if(moveContourMode)restructure('delete');else removePoint();return;}
      if(e.key==='Enter'&&(e.target.dataset.vertex!==undefined||e.target===contourHit)){e.preventDefault();e.stopImmediatePropagation();commit();return;}
      const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
      if(!delta||e.metaKey||e.ctrlKey||e.altKey)return;e.preventDefault();e.stopImmediatePropagation();if(!verify())return;
      const step=e.shiftKey?10:1;if(moveContourMode){const translated=root.RetouchSVGPath.translateContour({nodes:vertices,closed},delta[0]*step,delta[1]*step);if(translated)vertices.splice(0,vertices.length,...translated.nodes);else announce('Keep the contour within supported SVG coordinates.');}else if(activeHandle)changeHandle(vertices[active],activeHandle,root.RetouchSVGPath.translate(vertices[active][activeHandle],delta[0]*step,delta[1]*step));else vertices[active]=root.RetouchSVGPath.translate(vertices[active],delta[0]*step,delta[1]*step);paint();
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
