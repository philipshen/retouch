(function(root){
 'use strict';
 const serialize=root.RetouchHTMLCSSValues.serializeGradients,clamp=value=>Math.max(0,Math.min(100,Math.round(value)));
 root.RetouchGradientCenter=function({gradient,index,el,preview,gradients,update,label='Fill'}){
  if(gradient.type==='linear')return;
  const handle=document.createElement('button');handle.type='button';handle.tabIndex=0;handle.className='gradient-center-handle';handle.setAttribute('aria-label',label+' '+(index+1)+' center');handle.title='Drag the center. Arrow keys move 1%; Shift moves 10%.';preview.append(handle);
  const position=next=>{handle.style.left=next.x+'%';handle.style.top=next.y+'%';handle.setAttribute('aria-description','Center X '+next.x+'%, Y '+next.y+'%');handle.dataset.x=next.x;handle.dataset.y=next.y;};position(gradient);
  const commit=next=>{if(next.x===gradient.x&&next.y===gradient.y)return;root.RetouchPanelFocus?.queue(handle);update(next);};
  handle.onkeydown=event=>{
   const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},direction=directions[event.key];if(!direction)return;
   event.preventDefault();event.stopPropagation();const step=event.shiftKey?10:1;commit({...gradient,x:clamp(gradient.x+direction[0]*step),y:clamp(gradient.y+direction[1]*step)});
  };
  handle.onpointerdown=event=>{
   if(event.button!==0)return;event.preventDefault();event.stopPropagation();handle.focus({preventScroll:true});
   const box=preview.getBoundingClientRect(),pointerId=event.pointerId,originalStyle=el.getAttribute('style'),originalValue=el.style.getPropertyValue('background-image'),originalPriority=el.style.getPropertyPriority('background-image');
   let next=gradient,active=true,lastStyle=originalStyle,lastValue=originalValue;
   const move=e=>{if(!active||e.pointerId!==pointerId)return;next={...gradient,x:clamp(gradient.x+(e.clientX-event.clientX)/box.width*100),y:clamp(gradient.y+(e.clientY-event.clientY)/box.height*100)};position(next);preview.style.backgroundImage=serialize([next]);el.style.setProperty('background-image',serialize(gradients.map((g,i)=>i===index?next:g)),'important');lastStyle=el.getAttribute('style');lastValue=el.style.getPropertyValue('background-image');};
   const finish=save=>{
    if(!active)return;active=false;observer.disconnect();window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',cancel,true);window.removeEventListener('blur',cancel);document.removeEventListener('keydown',escape,true);handle.removeEventListener('lostpointercapture',cancel);
    if(handle.hasPointerCapture(pointerId))handle.releasePointerCapture(pointerId);
    if(el.getAttribute('style')===lastStyle){if(originalStyle===null)el.removeAttribute('style');else el.setAttribute('style',originalStyle);}
    else if(el.style.getPropertyValue('background-image')===lastValue){if(originalValue)el.style.setProperty('background-image',originalValue,originalPriority);else el.style.removeProperty('background-image');}
    position(gradient);preview.style.backgroundImage=serialize([gradient]);if(save&&preview.isConnected&&el.isConnected)commit(next);
   };
   const up=e=>{if(e.pointerId===pointerId){move(e);finish(true);}},cancel=()=>finish(false),escape=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();}};
   const observer=new MutationObserver(()=>{if(!preview.isConnected||!el.isConnected)cancel();});observer.observe(document.body,{childList:true,subtree:true});
   window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',cancel,true);window.addEventListener('blur',cancel);document.addEventListener('keydown',escape,true);handle.addEventListener('lostpointercapture',cancel);handle.setPointerCapture(pointerId);
  };
 };
})(window);
