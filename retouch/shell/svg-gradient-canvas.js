(function(root){
 'use strict';
 const round=n=>Math.round(n*1e6)/1e6;
 function coordinate(raw,fallback,extent,bounds){if(raw===null)return fallback;const match=/^([-+]?(?:\d+\.?\d*|\.\d+))(px|%)?$/.exec(raw.trim());if(!match)throw Error('Use numeric or percentage gradient coordinates for canvas editing.');const value=Number(match[1])*(match[2]==='%'?(bounds?1:extent)/100:1);if(!Number.isFinite(value)||Math.abs(value)>100000)throw Error('Keep gradient coordinates within 100000 units.');return value;}
 function measure(target,gradient){
  const w=target.ownerDocument.defaultView,node=target.ownerDocument.getElementById(gradient.id),g=target.getBBox(),screen=target.getScreenCTM();if(!node||!screen||node.localName!==gradient.type||gradient.reason)throw Error(gradient.reason||'Re-select the gradient layer.');
  if(node.querySelector('animate,set,animateTransform')||target.getAnimations?.().length)throw Error('Pause animations before editing the gradient on canvas.');
  const paint=w.getComputedStyle(target).getPropertyValue(gradient.paint),reference=/url\(["']?([^"')]+)["']?\)/.exec(paint);if(!reference||new URL(reference[1],target.ownerDocument.baseURI).hash!=='#'+gradient.id)throw Error('Page styles override this gradient paint.');
  const bounds=node.getAttribute('gradientUnits')!=='userSpaceOnUse',viewport=target.ownerSVGElement,box=viewport?.viewBox?.baseVal,width=box?.width||viewport?.width?.baseVal.value,height=box?.height||viewport?.height?.baseVal.value;
  if(!bounds&&(!width||!height)||bounds&&(!g.width||!g.height))throw Error('Choose a gradient with a measurable viewport and painted bounds.');
  let m=new w.DOMMatrix([screen.a,screen.b,screen.c,screen.d,screen.e,screen.f]);if(bounds)m=m.translate(g.x,g.y).scale(g.width,g.height);
  const transforms=node.gradientTransform.baseVal;for(let i=0;i<transforms.numberOfItems;i++)m=m.multiply(transforms.getItem(i).matrix);
  if(![m.a,m.b,m.c,m.d,m.e,m.f].every(Number.isFinite)||Math.abs(m.a*m.d-m.b*m.c)<1e-12)throw Error('This gradient transform cannot be edited on canvas.');
  const diagonal=Math.hypot(width||0,height||0)/Math.SQRT2,read=(name,fallback,extent)=>coordinate(node.getAttribute(name),fallback,extent,bounds),values=gradient.type==='linearGradient'?{x1:read('x1',0,width),y1:read('y1',0,height),x2:read('x2',bounds?1:width,width),y2:read('y2',0,height)}:{cx:read('cx',(bounds?1:width)/2,width),cy:read('cy',(bounds?1:height)/2,height),r:read('r',(bounds?1:diagonal)/2,diagonal)};
  if(gradient.type==='radialGradient'){values.fx=read('fx',values.cx,width);values.fy=read('fy',values.cy,height);values.fr=read('fr',0,diagonal);}
  return {node,g,m,values,bounds,width,height};
 }
 function positions(type,v){return type==='linearGradient'?[{x:v.x1,y:v.y1},{x:v.x2,y:v.y2}]:[{x:v.cx,y:v.cy},{x:v.cx+v.r,y:v.cy},{x:v.fx,y:v.fy},{x:v.fx+(v.fr||0),y:v.fy}];}
 function change(type,values,index,p){const v={...values};if(type==='linearGradient'){v[index?'x2':'x1']=p.x;v[index?'y2':'y1']=p.y;}else if(index===0){v.fx+=p.x-v.cx;v.fy+=p.y-v.cy;v.cx=p.x;v.cy=p.y;}else if(index===1)v.r=Math.hypot(p.x-v.cx,p.y-v.cy);else if(index===3)v.fr=Math.hypot(p.x-v.fx,p.y-v.fy);else{v.fx=p.x;v.fy=p.y;}return Object.fromEntries(Object.entries(v).map(([key,value])=>[key,Math.abs(value-values[key])<1e-9?values[key]:round(value)]));}
 function translate(values,dx,dy){dx=Math.abs(dx)<1e-9?0:round(dx);dy=Math.abs(dy)<1e-9?0:round(dy);return Object.fromEntries(Object.entries(values).map(([key,value])=>[key,value+(['x1','x2','cx','fx'].includes(key)?dx:['y1','y2','cy','fy'].includes(key)?dy:0)]));}
 function visiblePoint(p,width,height){return {x:Math.max(8,Math.min(width-8,p.x)),y:Math.max(8,Math.min(height-8,p.y))};}
 function stopDisplay(anchor,width,height,occupied){
  const base=visiblePoint({x:anchor.x,y:anchor.y+26},width,height),free=p=>occupied.every(other=>Math.hypot(p.x-other.x,p.y-other.y)>=22);
  if(free(base))return base;
  for(let ring=1;ring<=32;ring++)for(let y=-ring;y<=ring;y++)for(let x=-ring;x<=ring;x++){
   if(Math.max(Math.abs(x),Math.abs(y))!==ring)continue;
   const p=visiblePoint({x:base.x+x*22,y:base.y+y*22},width,height);if(free(p))return p;
  }
  return base;
 }
 function stopLine(type,v){const p=positions(type,v);return type==='linearGradient'?p:[p[3],p[1]];}
 function stopPosition(type,v,offset){const [a,b]=stopLine(type,v);return {x:a.x+(b.x-a.x)*offset,y:a.y+(b.y-a.y)*offset};}
 function stopDelta(type,v,dx,dy){const [a,b]=stopLine(type,v),x=b.x-a.x,y=b.y-a.y,length=x*x+y*y;return length<1e-12?0:(dx*x+dy*y)/length;}
 function mount({target,gradient,frame,canvas,current,save,saveStop,addStop,removeStop,editStopColor,onEnd,onError,focusLabel=null}){
  let data;try{data=measure(target,gradient);}catch(error){onError(error.message);return null;}
  const w=target.ownerDocument.defaultView,f=frame.getBoundingClientRect(),c=canvas.getBoundingClientRect(),scale=f.width/frame.contentWindow.innerWidth,left=Math.max(f.left,c.left),top=Math.max(f.top,c.top),right=Math.min(f.right,c.right),bottom=Math.min(f.bottom,c.bottom);
  if(right-left<20||bottom-top<20){onError('Bring the SVG canvas into view before editing its gradient.');return null;}
  const host=root.document.createElement('div');host.className='svg-gradient-canvas';host.tabIndex=-1;host.setAttribute('aria-label','Edit gradient on canvas');Object.assign(host.style,{position:'fixed',left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px',overflow:'hidden',zIndex:40,touchAction:'none'});
  const line=root.document.createElementNS('http://www.w3.org/2000/svg','svg');Object.assign(line.style,{position:'absolute',width:'100%',height:'100%',pointerEvents:'none',overflow:'visible'});const path=root.document.createElementNS(line.namespaceURI,'path');path.setAttribute('fill','none');path.setAttribute('stroke','var(--accent)');path.setAttribute('stroke-width','2');line.append(path);const move=root.document.createElementNS(line.namespaceURI,'path');move.setAttribute('fill','none');move.setAttribute('stroke','transparent');move.setAttribute('stroke-width','16');move.setAttribute('tabindex','0');move.setAttribute('role','button');move.setAttribute('aria-label','Move entire gradient');move.style.pointerEvents='stroke';move.style.cursor='move';line.append(move);host.append(line);const innerLine=root.document.createElementNS(line.namespaceURI,'path');innerLine.setAttribute('fill','none');innerLine.setAttribute('stroke','var(--accent)');innerLine.setAttribute('stroke-width','1');innerLine.setAttribute('stroke-dasharray','3 3');line.append(innerLine);
  const names=gradient.type==='linearGradient'?['start','end']:['center','radius','focus','inner radius'],buttons=names.map(name=>{const b=root.document.createElement('button');b.type='button';b.setAttribute('aria-label','Gradient '+name+' handle');b.title='Drag gradient '+name+' · Arrows move · Enter applies · Escape cancels';Object.assign(b.style,{position:'absolute',zIndex:name==='focus'?1:2,width:'14px',height:'14px',padding:'0',border:'2px solid var(--accent)',borderRadius:['focus','inner radius'].includes(name)?'2px':'50%',background:'white',transform:'translate(-50%,-50%)',touchAction:'none',cursor:'move'});host.append(b);return b;});
  const stopNodes=[...data.node.children].filter(node=>node.localName==='stop'),stopOffsets=stopNodes.map(node=>node.getAttribute('offset')),orderAPI=root.RetouchSVGGradientOrder;
  const stopOriginal=orderAPI?.move(stopOffsets.map(offset=>({offset})),0,'0')?.original||[],stopButtons=saveStop?stopNodes.map((node,index)=>{
   const button=root.document.createElement('button');button.type='button';button.setAttribute('aria-label','Gradient color stop '+(index+1));button.title='Double-click or F2 to edit color · Drag to move · Delete removes · Arrows: 1% · Shift: 10% · Option: 0.1% · Enter applies · Escape cancels';
   Object.assign(button.style,{position:'absolute',zIndex:3,width:'14px',height:'18px',padding:'0',border:'2px solid var(--accent)',borderRadius:'3px',background:w.getComputedStyle(node).stopColor,boxShadow:'0 0 0 1px white',transform:'translate(-50%,-50%)',touchAction:'none',cursor:'ew-resize'});host.append(button);return button;
  }):[];
  const stopLinks=root.document.createElementNS(line.namespaceURI,'path');stopLinks.setAttribute('fill','none');stopLinks.setAttribute('stroke','var(--accent)');stopLinks.setAttribute('stroke-width','1');stopLinks.setAttribute('stroke-dasharray','2 2');line.append(stopLinks);
  const hint=root.document.createElement('div');hint.textContent='Drag line to move · Double-click line to add stop · Delete removes stop · Enter finishes · Escape cancels';Object.assign(hint.style,{position:'fixed',bottom:'116px',left:'50%',transform:'translateX(-50%)',padding:'8px 12px',background:'var(--panel)',border:'1px solid var(--line)',borderRadius:'6px',fontSize:'11px',pointerEvents:'none'});const done=root.document.createElement('button');done.type='button';done.className='control-button';done.textContent='Done';done.setAttribute('aria-label','Finish gradient editing');Object.assign(done.style,{pointerEvents:'auto',marginLeft:'8px'});done.onclick=()=>end(true);hint.append(done);host.append(hint);root.document.body.append(host);
  const originalPaint=target.getAttribute(gradient.paint);
  const original=Object.fromEntries(Object.keys(data.values).map(key=>[key,data.node.getAttribute(key)]));let values={...data.values},last={...original},expected=data.node.outerHTML,ended=false,drag=null,raf,stopEdit=null;const cleanups=[];
  const listen=(el,name,fn,options)=>{el.addEventListener(name,fn,options);cleanups.push(()=>el.removeEventListener(name,fn,options));};
  const valid=()=>{if(!current()||!target.isConnected||target.getAttribute(gradient.paint)!==originalPaint||!data.node.isConnected||data.node.outerHTML!==expected)return false;try{const next=measure(target,gradient),rect=frame.getBoundingClientRect();return next.width===data.width&&next.height===data.height&&['a','b','c','d','e','f'].every(k=>Math.abs(next.m[k]-data.m[k])<1e-6)&&['x','y','width','height'].every(k=>Math.abs(next.g[k]-data.g[k])<1e-6)&&['left','top','width','height'].every(k=>Math.abs(rect[k]-f[k])<.1);}catch{return false;}};
  function restoreStop(){if(!stopEdit)return;const {index,nextSibling,lastOffsets,lastOrder}=stopEdit,node=stopNodes[index],order=[...data.node.children].filter(child=>stopNodes.includes(child));
   if(node.parentNode===data.node&&order.length===lastOrder.length&&order.every((child,i)=>child===lastOrder[i]))data.node.insertBefore(node,nextSibling?.parentNode===data.node?nextSibling:null);
   stopNodes.forEach((node,i)=>{if(node.getAttribute('offset')===lastOffsets[i]){if(stopOffsets[i]===null)node.removeAttribute('offset');else node.setAttribute('offset',stopOffsets[i]);}});
  }
  function restore(){restoreStop();for(const key of Object.keys(last))if(data.node.getAttribute(key)===last[key]){if(original[key]===null)data.node.removeAttribute(key);else data.node.setAttribute(key,original[key]);}}
  function end(commit=false,keepEditing=false){
   if(ended)return;
   const changes=Object.fromEntries(Object.entries(values).filter(([key,value])=>Math.abs(value-data.values[key])>1e-7).map(([key,value])=>[key,String(value)])),stopChanged=stopEdit&&Math.abs(stopEdit.offset-stopOriginal[stopEdit.index])>1e-7,changed=stopChanged||Object.keys(changes).length,apply=commit&&valid()&&changed;
   if(commit&&keepEditing&&!changed&&valid()){restore();values={...data.values};last={...original};stopEdit=null;expected=data.node.outerHTML;paint();return;}
   let focus=root.document.activeElement?.getAttribute('aria-label');
   if(stopChanged&&focus==='Gradient color stop '+(stopEdit.index+1))focus='Gradient color stop '+(orderAPI.move(stopOffsets.map(offset=>({offset})),stopEdit.index,String(stopEdit.offset)).index+1);
   ended=true;root.cancelAnimationFrame(raf);cleanups.forEach(fn=>fn());host.remove();restore();onEnd();
   if(apply){if(stopChanged)saveStop(stopEdit.index,String(stopEdit.offset),focus,keepEditing);else save(changes,focus,keepEditing);}
  }
  const toScreen=p=>new w.DOMPoint(p.x,p.y).matrixTransform(data.m),toPoint=e=>new w.DOMPoint((e.clientX-f.left)/scale,(e.clientY-f.top)/scale).matrixTransform(data.m.inverse());
  function paint(){const points=positions(gradient.type,values).map(toScreen).map(p=>({x:f.left+p.x*scale-left,y:f.top+p.y*scale-top}));buttons.forEach((b,i)=>{const separated=i===3&&points.slice(0,3).some(p=>Math.hypot(p.x-points[i].x,p.y-points[i].y)<18),display=separated?{x:points[i].x,y:points[i].y+(points[i].y<28?24:-24)}:points[i],visible=visiblePoint(display,right-left,bottom-top),clipped=Math.hypot(visible.x-points[i].x,visible.y-points[i].y)>.1;if(i===3)innerLine.setAttribute('d','M'+points[2].x+','+points[2].y+' L'+points[3].x+','+points[3].y+' L'+visible.x+','+visible.y);b.style.left=visible.x+'px';b.style.top=visible.y+'px';b.dataset.clipped=String(clipped);b.style.borderStyle=clipped?'dashed':'solid';b.title=(separated?'Handle is offset to keep it reachable. ':clipped?'Handle is outside the view; drag here to move it. ':'')+'Gradient '+names[i]+' · Arrows move · Enter applies · Escape cancels';if(i===2&&Math.hypot(points[2].x-points[0].x,points[2].y-points[0].y)<10){b.style.width='8px';b.style.height='8px';}else{b.style.width='14px';b.style.height='14px';}});path.setAttribute('d','M'+points[0].x+','+points[0].y+' L'+points[1].x+','+points[1].y);move.setAttribute('d',path.getAttribute('d'));
   const links=[],placed=buttons.map(button=>({x:parseFloat(button.style.left),y:parseFloat(button.style.top)}));stopButtons.forEach((button,index)=>{const offset=stopEdit?.index===index?stopEdit.offset:stopOriginal[index],p=toScreen(stopPosition(gradient.type,values,offset)),anchor={x:f.left+p.x*scale-left,y:f.top+p.y*scale-top},display=stopDisplay(anchor,right-left,bottom-top,placed);
    // Reserve the clipped geometry handles as well as the other color stops.
    placed.push(display);button.style.left=display.x+'px';button.style.top=display.y+'px';links.push('M'+anchor.x+','+anchor.y+' L'+display.x+','+display.y);
   });stopLinks.setAttribute('d',links.join(' '));
  }
  function update(next){if(!valid()){end();return;}if(Object.values(next).some(v=>!Number.isFinite(v)||Math.abs(v)>100000))return;values=next;for(const [key,value]of Object.entries(values)){last[key]=String(value);data.node.setAttribute(key,last[key]);}expected=data.node.outerHTML;paint();}
  listen(move,'focus',()=>{move.setAttribute('stroke','var(--accent)');move.setAttribute('stroke-opacity','.18');});listen(move,'blur',()=>{move.setAttribute('stroke','transparent');});
  [...buttons,move].forEach((button,controlIndex)=>{const index=button===move?-1:controlIndex;
   listen(button,'pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();button.focus({preventScroll:true});if(stopEdit){end(true,true);return;}drag={id:e.pointerId,index,start:toPoint(e),values:{...values},point:positions(gradient.type,values)[Math.max(0,index)]};button.setPointerCapture(e.pointerId);});
   listen(button,'pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const p=toPoint(e);update(index<0?translate(drag.values,p.x-drag.start.x,p.y-drag.start.y):change(gradient.type,drag.values,index,{x:drag.point.x+p.x-drag.start.x,y:drag.point.y+p.y-drag.start.y}));});
   listen(button,'pointerup',e=>{if(drag?.id===e.pointerId){drag=null;end(true,true);}});listen(button,'pointercancel',()=>end());listen(button,'lostpointercapture',()=>{if(drag)end();});
   listen(button,'keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||e.ctrlKey||e.metaKey)return;e.preventDefault();e.stopImmediatePropagation();if(stopEdit){end(true,true);return;}const p=positions(gradient.type,values)[Math.max(0,index)],step=(data.bounds?.01:1)*(e.shiftKey?10:e.altKey?.1:1),dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;update(index<0?translate(values,dx,dy):change(gradient.type,values,index,{x:p.x+dx,y:p.y+dy}));});
  });
  function beginStop(index){
   if(!valid()){end();return false;}
   if(Object.keys(values).some(key=>Math.abs(values[key]-data.values[key])>1e-7)||stopEdit&&stopEdit.index!==index){end(true,true);return false;}
   if(!stopEdit)stopEdit={index,offset:stopOriginal[index],nextSibling:stopNodes[index].nextSibling,lastOffsets:[...stopOffsets],lastOrder:[...stopNodes]};return true;
  }
  function updateStop(offset){
   if(!valid()){end();return;}offset=round(Math.max(0,Math.min(1,offset)));const plan=orderAPI.move(stopOffsets.map(offset=>({offset})),stopEdit.index,String(offset));if(!plan)return;
   stopEdit.offset=offset;stopNodes.forEach((node,index)=>{stopEdit.lastOffsets[index]=String(plan.positions[index]);node.setAttribute('offset',stopEdit.lastOffsets[index]);});
   const next=plan.order[plan.index+1];data.node.insertBefore(stopNodes[stopEdit.index],next===undefined?null:stopNodes[next]);stopEdit.lastOrder=[...data.node.children].filter(node=>stopNodes.includes(node));expected=data.node.outerHTML;paint();
  }
  function stopAction(action,discardIndex=null){
   if(!valid()){end();return;}
   if(Object.keys(values).some(key=>Math.abs(values[key]-data.values[key])>1e-7)||stopEdit&&stopEdit.index!==discardIndex&&Math.abs(stopEdit.offset-stopOriginal[stopEdit.index])>1e-7){end(true,true);return;}
   end();action();
  }
  function insertStop(offset){
   if(!addStop)return;if(stopNodes.length>=64){onError('This gradient already has 64 stops.');return;}
   stopAction(()=>addStop(round(Math.max(0,Math.min(1,offset)))));
  }
  listen(move,'dblclick',e=>{e.preventDefault();e.stopPropagation();const p=toPoint(e),[start]=stopLine(gradient.type,values);insertStop(stopDelta(gradient.type,values,p.x-start.x,p.y-start.y));});
  listen(move,'keydown',e=>{if(e.key==='Insert'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();e.stopImmediatePropagation();insertStop(.5);}});
  move.setAttribute('aria-description','Drag to move the gradient. Double-click to add a color stop, or press Insert to add at the midpoint.');
  stopButtons.forEach((button,index)=>{
   const color=()=>{if(!editStopColor)return;const bounds=button.getBoundingClientRect();stopAction(()=>editStopColor(index,bounds));};
   listen(button,'dblclick',e=>{e.preventDefault();e.stopPropagation();color();});
   listen(button,'keydown',e=>{if(e.key==='F2'||e.key===' '){e.preventDefault();e.stopImmediatePropagation();color();}});
   listen(button,'pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();button.focus({preventScroll:true});if(!beginStop(index))return;drag={id:e.pointerId,start:toPoint(e),offset:stopEdit.offset};button.setPointerCapture(e.pointerId);});
   listen(button,'pointermove',e=>{if(!drag||drag.id!==e.pointerId||stopEdit?.index!==index)return;const p=toPoint(e);updateStop(drag.offset+stopDelta(gradient.type,values,p.x-drag.start.x,p.y-drag.start.y));});
   listen(button,'pointerup',e=>{if(drag?.id===e.pointerId){drag=null;end(true,true);}});listen(button,'pointercancel',()=>end());listen(button,'lostpointercapture',()=>{if(drag)end();});
   listen(button,'keydown',e=>{if(['Delete','Backspace'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();if(!removeStop)return;if(stopNodes.length<=2){onError('Keep at least two gradient stops.');return;}stopAction(()=>removeStop(index),index);return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||e.ctrlKey||e.metaKey)return;e.preventDefault();e.stopImmediatePropagation();if(!beginStop(index))return;const step=e.shiftKey?.1:e.altKey?.001:.01;updateStop(stopEdit.offset+(['ArrowLeft','ArrowDown'].includes(e.key)?-step:step));});
  });
  listen(host,'keydown',e=>{if(e.key==='Escape'||e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();end(e.key==='Enter');}},true);
  for(const event of ['blur','resize','retouch:screen','retouch:viewport','retouch:before-zoom'])listen(root,event,()=>end());listen(w,'scroll',()=>end(),true);listen(canvas,'scroll',()=>end(),true);
  const tick=()=>{if(!valid()){end();return;}raf=root.requestAnimationFrame(tick);};paint();([...buttons,...stopButtons,move].find(button=>button.getAttribute('aria-label')===focusLabel)||buttons[0]).focus({preventScroll:true});raf=root.requestAnimationFrame(tick);return ()=>end();
 }
 const api={coordinate,positions,change,translate,measure,visiblePoint,stopDisplay,stopLine,stopPosition,stopDelta,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchSVGGradientCanvas=api;
})(typeof window==='object'?window:globalThis);
