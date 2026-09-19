(function(root){
 'use strict';
 const V=root.RetouchPrototypeValues,frame=document.getElementById('app'),contexts=new Map(),main={frame,release:null,pendingScroll:null},overlays=root.RetouchPrototypeOverlays;contexts.set(frame,main);let running=false,trail=[];
 function current(target=frame){try{const w=target.contentWindow;if(w.location.origin!==location.origin)return null;return {url:w.location.pathname+w.location.search+w.location.hash,x:w.scrollX,y:w.scrollY};}catch{return null;}}
 function navigate(destination,scroll){const url=new URL(destination,location.href);main.pendingScroll={...scroll,url:url.href};frame.src=url.pathname+url.search+url.hash;}
 function perform(item,context,opener){const before=current();if(!before)return;
  if(item.action==='open-overlay'){overlays.open(item.destination,item.overlay,opener);return;}
  if(item.action==='close-overlay'){overlays.close();return;}
  if(item.action==='swap-overlay'&&overlays.swap(item.destination,opener))return;
  if(item.action==='navigate'||item.action==='swap-overlay'){if(!V.route(item.destination))return;trail.push(before);if(trail.length>100)trail.shift();overlays.clear();navigate(item.destination,item.preserveScroll?before:{x:0,y:0});}
  else if(item.action==='back'){if(overlays.close())return;const previous=trail.pop();if(previous)navigate(previous.url,previous);}
  else if(item.action==='scroll'){const d=context.frame.contentDocument,targets=[...d.querySelectorAll('[id]')].filter(el=>el.id===item.destination);if(targets.length!==1){root.RetouchPresentationHost.error('The scroll destination is missing or duplicated.');return;}targets[0].scrollIntoView({behavior:'instant',block:'start'});}
 }
 function overlayEscape(event){if(event.defaultPrevented||event.isComposing||event.key!=='Escape'||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;if(overlays.close()){event.preventDefault();event.stopPropagation();}}
 function mount(context=main){const frame=context.frame;context.release?.();context.release=null;if(!running)return;
  let d;try{d=frame.contentDocument;if(!d?.body)return;}catch{return;}
  const listeners=[],changed=new Map();let scrollJob=null;
  const cancelScroll=()=>{if(scrollJob!==null){cancelAnimationFrame(scrollJob);scrollJob=null;}};
  const listen=(type,fn)=>{d.addEventListener(type,fn,true);listeners.push(()=>d.removeEventListener(type,fn,true));};
  function interactions(el){try{return V.parse(el.getAttribute(V.attribute));}catch{return [];}}
  const native='a[href],button,input,textarea,select,[contenteditable]:not([contenteditable="false"])';
  function restore(el,before){if(before.tabindex&&el.getAttribute('tabindex')==='0')el.removeAttribute('tabindex');if(before.role&&el.getAttribute('role')==='button')el.removeAttribute('role');}
  function decorate(){
   for(const [el,before]of changed)if(!el.isConnected||!interactions(el).some(i=>i.trigger==='click')){restore(el,before);changed.delete(el);}
   for(const el of d.querySelectorAll('['+V.attribute+']'))if(interactions(el).some(i=>i.trigger==='click')&&!el.matches(native)&&!changed.has(el)){const before={tabindex:!el.hasAttribute('tabindex'),role:!el.hasAttribute('role')};changed.set(el,before);if(before.tabindex)el.setAttribute('tabindex','0');if(before.role)el.setAttribute('role','button');}
  }
  function find(event,trigger){for(let el=event.target?.nodeType===1?event.target:event.target?.parentElement;el;el=el.parentElement){if(!el.hasAttribute(V.attribute))continue;const item=interactions(el).find(i=>i.trigger===trigger);if(item)return {el,item};}return null;}
  function handle(event,trigger){if(!running||context.frame!==(overlays.topFrame||main.frame)||event.isComposing||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.type==='click'&&event.button!==0)return;const match=find(event,trigger);if(!match)return;if(trigger!=='click'&&match.el.contains(event.relatedTarget))return;event.preventDefault();event.stopImmediatePropagation();perform(match.item,context,match.el);}
  listen('click',event=>handle(event,'click'));listen('mouseover',event=>handle(event,'mouseenter'));listen('mouseout',event=>handle(event,'mouseleave'));
  listen('keydown',event=>{if(!['Enter',' '].includes(event.key)||event.repeat||!changed.has(event.target))return;handle(event,'click');});
  const style=d.createElement('style');style.textContent='['+V.attribute+']{cursor:pointer}';d.head?.append(style);
  const observer=new MutationObserver(decorate);observer.observe(d.body,{childList:true,subtree:true,attributes:true,attributeFilter:[V.attribute]});decorate();
  if(context!==main){d.defaultView.addEventListener('keydown',overlayEscape);listeners.push(()=>d.defaultView?.removeEventListener('keydown',overlayEscape));}
  context.release=()=>{cancelScroll();observer.disconnect();listeners.forEach(fn=>fn());style.remove();for(const [el,before]of changed)restore(el,before);};
  if(context.pendingScroll){const scroll=context.pendingScroll;context.pendingScroll=null;if(d.URL===scroll.url){
   // Client-rendered destinations may mount after iframe load. Wait for enough
   // page extent, but stop restoring as soon as the user interacts.
   const began=performance.now();const restoreScroll=()=>{scrollJob=null;if(!running||frame.contentDocument!==d)return;const scroller=d.scrollingElement;if(!scroller)return;
    if(scroller.scrollHeight-scroller.clientHeight>=scroll.y&&scroller.scrollWidth-scroller.clientWidth>=scroll.x||performance.now()-began>2000)d.defaultView.scrollTo({left:scroll.x,top:scroll.y,behavior:'instant'});else scrollJob=requestAnimationFrame(restoreScroll);
   };for(const type of ['wheel','pointerdown','keydown'])listen(type,cancelScroll);scrollJob=requestAnimationFrame(restoreScroll);
  }}
 }
 frame.addEventListener('load',()=>{if(running)overlays.clear();mount(main);});
 root.RetouchPrototypeRuntime={
  start(){running=true;trail=[];main.pendingScroll=null;mount(main);},
  stop(){overlays.clear();running=false;main.release?.();main.release=null;trail=[];main.pendingScroll=null;},
  restart(){overlays.clear();trail=[];main.pendingScroll=null;},
  dismissOverlay:()=>overlays.close(),
  attachFrame(frame){const context={frame,release:null,pendingScroll:null};context.loaded=()=>mount(context);contexts.set(frame,context);frame.addEventListener('load',context.loaded);},
  detachFrame(frame){const context=contexts.get(frame);if(!context||context===main)return;context.release?.();frame.removeEventListener('load',context.loaded);contexts.delete(frame);},
  resetFrame(frame){const context=contexts.get(frame);if(context){context.release?.();context.release=null;context.pendingScroll=null;}}
 };
})(window);
