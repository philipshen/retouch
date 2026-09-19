(function(root){
 'use strict';
 let current=null;const dialogs=new Set(),positions=new WeakMap();
 function place(){
  if(!current?.dialog.matches(':popover-open'))return;
  const {dialog,row}=current,anchor=row.getBoundingClientRect(),width=Math.min(320,innerWidth-24),minTop=Math.max(12,Math.max(...['toolbar','screenToolbar'].map(id=>document.getElementById(id).getBoundingClientRect().bottom))+8),dock=document.querySelector('.design-tool-dock')?.getBoundingClientRect(),bottom=dock?.height?Math.min(innerHeight-12,dock.top-8):innerHeight-12,maxHeight=Math.max(80,bottom-minTop),left=anchor.left-width-12;
  Object.assign(dialog.style,{width:width+'px',maxHeight:maxHeight+'px'});
  const height=dialog.getBoundingClientRect().height,position=positions.get(dialog),x=position?.x??(left>=12?left:innerWidth-width-12),y=position?.y??anchor.top;
  Object.assign(dialog.style,{left:Math.max(12,Math.min(x,innerWidth-width-12))+'px',top:Math.max(minTop,Math.min(y,bottom-height))+'px'});
 }
 function dismiss(focus=false,notify=false){if(!current)return;const old=current;current=null;old.dialog.hidePopover();old.row.setAttribute('aria-expanded','false');if(notify)old.close();if(focus&&old.row.isConnected)old.row.focus({preventScroll:true});}
 function open(dialog,row,close,focus=false){dismiss();current={dialog,row,close};dialog.showPopover();row.setAttribute('aria-expanded','true');place();if(focus)dialog.querySelector('select,input,button')?.focus({preventScroll:true});}
 function movable(header,dialog){
  let gesture=null;
  header.tabIndex=0;header.setAttribute('aria-label','Move interaction details');header.title='Drag to move. Arrow keys move; Shift moves faster. Home restores the default position. Escape cancels a drag.';
  function move(x,y){positions.set(dialog,{x,y});place();}
  function end(cancel=false){if(!gesture)return;const previous=gesture;gesture=null;if(cancel){positions.set(dialog,previous.position);place();}header.classList.remove('dragging');if(previous.pointer!==undefined&&header.hasPointerCapture(previous.pointer))header.releasePointerCapture(previous.pointer);}
  header.addEventListener('pointerdown',event=>{
   if(event.button!==0||event.target.closest('select,input,button')||current?.dialog!==dialog)return;
   event.preventDefault();header.focus({preventScroll:true});const rect=dialog.getBoundingClientRect();gesture={pointer:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top,position:positions.get(dialog)};header.setPointerCapture(event.pointerId);header.classList.add('dragging');
  });
  header.addEventListener('pointermove',event=>{if(gesture?.pointer===event.pointerId)move(gesture.left+event.clientX-gesture.x,gesture.top+event.clientY-gesture.y);});
  header.addEventListener('pointerup',event=>{if(gesture?.pointer===event.pointerId)end();});
  header.addEventListener('pointercancel',()=>end(true));header.addEventListener('lostpointercapture',()=>end(true));
  header.addEventListener('keydown',event=>{
   if(event.target!==header)return;
   if(event.key==='Escape'&&gesture){event.preventDefault();event.stopPropagation();end(true);return;}
   if(event.key==='Home'){event.preventDefault();end();positions.delete(dialog);place();return;}
   const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!delta||event.altKey||event.ctrlKey||event.metaKey)return;
   event.preventDefault();if(!gesture)gesture={position:positions.get(dialog)};const rect=dialog.getBoundingClientRect(),step=event.shiftKey?10:1;move(rect.left+delta[0]*step,rect.top+delta[1]*step);
  });
  header.addEventListener('keyup',event=>{if(event.key.startsWith('Arrow')&&gesture?.pointer===undefined)end();});header.addEventListener('blur',()=>end());
 }
 function create(row,content,close){const dialog=document.createElement('div');dialog.className='prototype-details';dialog.setAttribute('popover','manual');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-label','Interaction details '+row.dataset.index);dialog.id='prototype-details-'+row.dataset.index;
  row.setAttribute('aria-haspopup','dialog');row.setAttribute('aria-controls',dialog.id);row.setAttribute('aria-expanded','false');
  const header=document.createElement('header'),title=document.createElement('strong'),button=document.createElement('button');title.textContent='Interaction details';button.type='button';button.textContent='×';button.setAttribute('aria-label','Close interaction details');button.onclick=()=>dismiss(true,true);header.append(title,button);dialog.append(header,content);movable(header,dialog);
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.defaultPrevented){event.preventDefault();event.stopPropagation();dismiss(true,true);}});
  document.body.append(dialog);dialogs.add(dialog);return {dialog,open:focus=>open(dialog,row,close,focus)};
 }
 root.addEventListener('resize',place);new ResizeObserver(place).observe(document.getElementById('panel'));
 let presenting=false;new MutationObserver(()=>{const next=document.body.classList.contains('presenting');if(next)dismiss();else if(presenting)root.RetouchPrototypePanel?.refresh();presenting=next;}).observe(document.body,{attributes:true,attributeFilter:['class']});
 root.RetouchPrototypeDetails={create,dismiss,place,reset(){dismiss();for(const dialog of dialogs)dialog.remove();dialogs.clear();},setBusy(value){for(const dialog of dialogs)dialog.inert=value;},snapshot:()=>current?{index:current.row.dataset.index,scroll:current.dialog.scrollTop,position:positions.get(current.dialog)}:null,restore(state){if(state&&current?.row.dataset.index===state.index){positions.set(current.dialog,state.position);place();current.dialog.scrollTop=state.scroll;}}};
})(window);
