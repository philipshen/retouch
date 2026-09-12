(function(root){
 'use strict';
 const serialize=root.RetouchHTMLCSSValues.serializeGradients,clamp=value=>Math.max(0,Math.min(100,Math.round(value)));
 root.RetouchGradientNumeric=function({element,group,preview,gradient,gradients,index,paintGeometry}){
  return (input,changed,stopIndex=null)=>root.RetouchInspector.numericPreview(input,element,'background-image',value=>serialize(gradients.map((item,i)=>i===index?changed(value):item)),value=>{
     const next=value===null?gradient:changed(value);paintGeometry(next);preview.style.backgroundImage=serialize([next]);const strip=group.querySelector('.gradient-stop-strip');if(strip)strip.style.backgroundImage=serialize([{...next,type:'linear',angle:90}]);
     if(stopIndex!==null){const handle=group.querySelector('[data-stop-index="'+stopIndex+'"]'),position=value===null?gradient.stops[stopIndex].position:value;if(handle){handle.style.left=position+'%';handle.setAttribute('aria-valuenow',position);}}
    });
 };
 root.RetouchGradientGeometry=function({gradient,index,el,preview,gradients,update,label='Fill'}){
  const positions=[];const position=next=>positions.forEach(render=>render(next));
  for(const mode of gradient.type==='linear'?['angle']:gradient.type==='radial'?['center']:['center','angle']){
  const rotation=mode==='angle';
  const handle=document.createElement('button');handle.type='button';handle.tabIndex=0;handle.className=rotation?'gradient-angle-handle':'gradient-center-handle';handle.setAttribute('aria-label',label+' '+(index+1)+' '+mode);handle.title=rotation?'Drag to rotate. Shift snaps to 15°. Arrow keys rotate 1°; Shift rotates 15°.':'Drag the center. Arrow keys move 1%; Shift moves 10%.';if(rotation){handle.setAttribute('role','slider');handle.setAttribute('aria-valuemin','0');handle.setAttribute('aria-valuemax','360');}preview.append(handle);
  const line=rotation?document.createElement('span'):null;if(line){line.className='gradient-angle-line';preview.append(line);}
  const render=next=>{
   const x=next.type==='linear'?50:next.x,y=next.type==='linear'?50:next.y;
   if(rotation){const angle=((next.angle%360)+360)%360,radians=angle*Math.PI/180;handle.style.left=`calc(${x}% + ${Math.sin(radians)*26}px)`;handle.style.top=`calc(${y}% - ${Math.cos(radians)*26}px)`;handle.setAttribute('aria-valuenow',angle);handle.setAttribute('aria-valuetext',angle+' degrees');line.style.left=x+'%';line.style.top=y+'%';line.style.transform='rotate('+angle+'deg)';}
   else{handle.style.left=next.x+'%';handle.style.top=next.y+'%';handle.setAttribute('aria-description','Center X '+next.x+'%, Y '+next.y+'%');handle.dataset.x=next.x;handle.dataset.y=next.y;}
  };positions.push(render);render(gradient);
  const commit=next=>{if(next.x===gradient.x&&next.y===gradient.y&&next.angle===gradient.angle)return;root.RetouchPanelFocus?.queue(handle);update(next);};
  handle.onkeydown=event=>{
   const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},direction=directions[event.key];if(!direction)return;
   event.preventDefault();event.stopPropagation();if(rotation){const step=event.shiftKey?15:1;commit({...gradient,angle:(gradient.angle+(event.key==='ArrowLeft'||event.key==='ArrowDown'?-step:step)+360)%360});return;}const step=event.shiftKey?10:1;commit({...gradient,x:clamp(gradient.x+direction[0]*step),y:clamp(gradient.y+direction[1]*step)});
  };
  handle.onpointerdown=event=>{
   if(event.button!==0)return;event.preventDefault();event.stopPropagation();handle.focus({preventScroll:true});
   const box=preview.getBoundingClientRect(),pointerId=event.pointerId,interruptions=['blur','resize','retouch:screen','retouch:viewport','retouch:before-zoom'],propertyPreview=root.RetouchPaintPicker.propertyPreview({el,input:preview,property:'background-image',respectScope:true});
   let next=gradient,active=true,moved=false;
   const move=e=>{if(!active||e.pointerId!==pointerId)return;if(!moved&&Math.hypot(e.clientX-event.clientX,e.clientY-event.clientY)<2)return;moved=true;if(rotation){const cx=box.left+box.width*(gradient.type==='linear'?.5:gradient.x/100),cy=box.top+box.height*(gradient.type==='linear'?.5:gradient.y/100);const angle=(Math.atan2(e.clientX-cx,cy-e.clientY)*180/Math.PI+360)%360;next={...gradient,angle:Math.round(angle/(e.shiftKey?15:1))*(e.shiftKey?15:1)%360};}else next={...gradient,x:clamp(gradient.x+(e.clientX-event.clientX)/box.width*100),y:clamp(gradient.y+(e.clientY-event.clientY)/box.height*100)};position(next);preview.style.backgroundImage=serialize([next]);propertyPreview.update(serialize(gradients.map((g,i)=>i===index?next:g)));};
   const finish=save=>{
    if(!active)return;active=false;observer.disconnect();window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',cancel,true);for(const type of interruptions)window.removeEventListener(type,cancel);document.removeEventListener('keydown',escape,true);handle.removeEventListener('lostpointercapture',cancel);
    if(handle.hasPointerCapture(pointerId))handle.releasePointerCapture(pointerId);
    propertyPreview.restore();
    position(gradient);preview.style.backgroundImage=serialize([gradient]);if(save&&preview.isConnected&&el.isConnected)commit(next);
   };
   const up=e=>{if(e.pointerId===pointerId){move(e);finish(true);}},cancel=()=>finish(false),escape=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();}};
   const observer=new MutationObserver(()=>{if(!preview.isConnected||!el.isConnected)cancel();});observer.observe(document.body,{childList:true,subtree:true});
   window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',cancel,true);for(const type of interruptions)window.addEventListener(type,cancel);document.addEventListener('keydown',escape,true);handle.addEventListener('lostpointercapture',cancel);handle.setPointerCapture(pointerId);
  };
  }
  return position;
 };
})(window);
