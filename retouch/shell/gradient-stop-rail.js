(function(root){
 'use strict';
 const {serializeGradients}=root.RetouchHTMLCSSValues;
 function stopRail({gradient,index,info,el,preview,gradients,update,label='Fill'}){
  const rail=document.createElement('div');rail.className='gradient-stop-rail';rail.dataset.gradientSource=info.id;rail.dataset.gradientIndex=index;
  rail.setAttribute('role','group');rail.setAttribute('aria-label',label+' '+(index+1)+' stop positions');
  const strip=document.createElement('div');strip.className='gradient-stop-strip';strip.style.backgroundImage=serializeGradients([{...gradient,type:'linear',angle:90}]);rail.append(strip);
  gradient.stops.forEach((stop,stopIndex)=>{
   const handle=document.createElement('button');handle.type='button';handle.tabIndex=0;handle.className='gradient-stop-handle';handle.dataset.stopIndex=stopIndex;handle.style.left=stop.position+'%';handle.style.backgroundColor=stop.color;
   handle.setAttribute('role','slider');handle.setAttribute('aria-label',label+' '+(index+1)+' stop '+(stopIndex+1)+' handle');handle.setAttribute('aria-valuemin','0');handle.setAttribute('aria-valuemax','100');handle.setAttribute('aria-valuenow',stop.position);handle.title='Drag to position. Arrow keys move 1%; Shift moves 10%.';
   function changed(position){const moved={...stop,position};const stops=gradient.stops.map((s,i)=>i===stopIndex?moved:s).sort((a,b)=>a.position-b.position);return {next:{...gradient,stops},newIndex:stops.indexOf(moved)};}
   function commit(position){
    if(position===stop.position)return;const {next,newIndex}=changed(position);
    root.RetouchPanelFocus?.queue(handle,label+' '+(index+1)+' stop '+(newIndex+1)+' handle');
    Promise.resolve(update(next)).then(()=>{if(root.RetouchPanelFocus)return;document.querySelector(`[data-gradient-source="${CSS.escape(info.id)}"][data-gradient-index="${index}"] [data-stop-index="${newIndex}"]`)?.focus({preventScroll:true});});
   }
   handle.onkeydown=e=>{
    const delta=e.shiftKey?10:1;let position;
    if(e.key==='ArrowLeft'||e.key==='ArrowDown')position=stop.position-delta;
    else if(e.key==='ArrowRight'||e.key==='ArrowUp')position=stop.position+delta;
    else if(e.key==='Home')position=0;else if(e.key==='End')position=100;else return;
    e.preventDefault();e.stopPropagation();commit(Math.max(0,Math.min(100,position)));
   };
   handle.onpointerdown=e=>{
    if(e.button!==0)return;e.preventDefault();e.stopPropagation();handle.focus({preventScroll:true});
    const box=rail.getBoundingClientRect(),pointerId=e.pointerId,interruptions=['blur','resize','retouch:screen','retouch:viewport','retouch:before-zoom'],propertyPreview=root.RetouchPaintPicker.propertyPreview({el,input:rail,property:'background-image',respectScope:true});
    let position=stop.position,active=true;
    const render=()=>{const {next}=changed(position);preview.style.backgroundImage=serializeGradients([next]);strip.style.backgroundImage=serializeGradients([{...next,type:'linear',angle:90}]);handle.style.left=position+'%';handle.setAttribute('aria-valuenow',position);propertyPreview.update(serializeGradients(gradients.map((g,i)=>i===index?next:g)));};
    const move=event=>{if(event.pointerId!==pointerId||!active)return;position=Math.max(0,Math.min(100,Math.round(stop.position+(event.clientX-e.clientX)/box.width*100)));render();};
    const finish=save=>{
     if(!active)return;active=false;observer.disconnect();window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',cancel,true);for(const type of interruptions)window.removeEventListener(type,cancel);document.removeEventListener('keydown',escape,true);handle.removeEventListener('lostpointercapture',cancel);
     if(handle.hasPointerCapture(pointerId))handle.releasePointerCapture(pointerId);
     propertyPreview.restore();
     preview.style.backgroundImage=serializeGradients([gradient]);strip.style.backgroundImage=serializeGradients([{...gradient,type:'linear',angle:90}]);handle.style.left=stop.position+'%';handle.setAttribute('aria-valuenow',stop.position);
     if(save&&rail.isConnected&&el.isConnected)commit(position);
    };
    const up=event=>{if(event.pointerId===pointerId){move(event);finish(true);}};
    const cancel=()=>finish(false),escape=event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancel();}};
    const observer=new MutationObserver(()=>{if(!rail.isConnected||!el.isConnected)cancel();});observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',cancel,true);for(const type of interruptions)window.addEventListener(type,cancel);document.addEventListener('keydown',escape,true);handle.addEventListener('lostpointercapture',cancel);handle.setPointerCapture(pointerId);
   };
   rail.append(handle);
  });
  return rail;
 }
 root.RetouchGradientStopRail=stopRail;
})(window);
