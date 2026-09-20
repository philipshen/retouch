(function(root){
 'use strict';
 const pendingActions=new Set(),V=root.RetouchPrototypeValues,K=root.RetouchPrototypeKeys,frame=document.getElementById('app'),contexts=new Map(),main={frame,release:null,pendingScroll:null},overlays=root.RetouchPrototypeOverlays;contexts.set(frame,main);let loadSerial=0,running=false,trail=[],held=null,clickBlock=null,navigationCompletion=null,navigationFinished=Promise.resolve(true);
 function cancelNavigation(){navigationCompletion?.finish(false);navigationCompletion=null;}
 function consumeClick(event){if(!clickBlock)return false;const block=clickBlock;clickBlock=null;if(performance.now()>block.until||event.detail===0)return false;event.preventDefault();event.stopImmediatePropagation();return true;}
 document.addEventListener('pointerup',event=>{if(clickBlock&&event.isPrimary!==false)clickBlock.until=performance.now()+1000;},true);
 document.addEventListener('click',consumeClick,true);document.addEventListener('pointerdown',event=>{if(event.isPrimary!==false)clickBlock=null;},true);
 function current(target=frame){try{const w=target.contentWindow;if(w.location.origin!==location.origin)return null;return {url:w.location.pathname+w.location.search+w.location.hash,x:w.scrollX,y:w.scrollY};}catch{return null;}}
 function navigate(destination,scroll,transition){cancelNavigation();navigationCompletion=root.RetouchPrototypeCompletion.create();navigationFinished=navigationCompletion.finished;root.RetouchPrototypeNavigation.begin(transition,scroll);main.release?.();main.release=null;const url=new URL(destination,location.href);main.pendingScroll={...scroll,url:url.href};frame.src=url.pathname+url.search+url.hash;}
 function perform(item,context,opener){const before=current();if(!before)return;context.scrollMotion?.cancel();context.scrollMotion=null;
  if(item.action==='set-variable-mode'){root.RetouchPrototypeVariables.setMode(item.modeChange);return;}
  if(item.action==='set-variable'){root.RetouchPrototypeVariables.assign(item.assignment);return;}
  if(item.action==='open-link'){if(!V.link(item.destination))return;const link=document.createElement('a');link.href=item.destination;link.target='_blank';link.rel='noopener noreferrer';document.body.append(link);link.click();link.remove();return;}
  if(item.action==='open-overlay'){overlays.open(item.destination,item.overlay,opener,item.transition);return;}
  if(item.action==='close-overlay'){overlays.close(true,item.transition);return;}
  if(item.action==='swap-overlay'&&overlays.swap(item.destination,opener,item.transition))return;
  if(item.action==='navigate'||item.action==='swap-overlay'){if(!V.route(item.destination))return;trail.push(before);if(trail.length>100)trail.shift();overlays.clear();navigate(item.destination,item.preserveScroll?before:{x:0,y:0},item.transition);}
  else if(item.action==='back'){if(overlays.close())return;const previous=trail.pop();if(previous)navigate(previous.url,previous,item.transition);}
  else if(item.action==='scroll'){const d=context.frame.contentDocument,targets=[...d.querySelectorAll('[id]')].filter(el=>el.id===item.destination);if(targets.length!==1){root.RetouchPresentationHost.error('The scroll destination is missing or duplicated.');return;}try{context.scrollMotion=root.RetouchPrototypeScroll.play(targets[0],item.transition,item.scrollOffset);}catch(error){root.RetouchPresentationHost.error(error.message);}}
 }
 // WebKit can crash if touch-release navigation removes the dispatching iframe.
 // Defer until input dispatch finishes and cancel work when its context closes.
 function afterRelease(item,context,opener){const doc=context.frame.contentDocument,job={context,id:null};job.id=requestAnimationFrame(()=>{pendingActions.delete(job);if(running&&contexts.get(context.frame)===context&&context.frame.contentDocument===doc&&context.frame===(overlays.topFrame||main.frame)&&!context.frame.closest('[inert]'))perform(item,context,opener);});pendingActions.add(job);}
 function overlayEscape(event){if(event.defaultPrevented||event.isComposing||event.key!=='Escape'||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;if(overlays.close()){event.preventDefault();event.stopPropagation();}}
 function mount(context=main){const frame=context.frame;context.release?.();context.release=null;if(!running)return;
  let d;try{d=frame.contentDocument;if(!d?.body)return;}catch{return;}
  const releaseVariables=root.RetouchPrototypeVariables.mount(d);
  const listeners=[],changed=new Map();let scrollJob=null,timerJob=null;
  const active=()=>running&&frame.contentDocument===d&&context.frame===(overlays.topFrame||main.frame)&&!frame.closest('[inert]')&&!document.hidden&&!d.hidden&&(context===main||overlays.phase==='idle');
  const timers=root.RetouchPrototypeTimers.create({eligible:el=>active()&&el.isConnected&&!el.closest('[inert]')&&el.getClientRects().length>0&&d.defaultView.getComputedStyle(el).visibility==='visible',perform:(item,el)=>perform(item,context,el)});
  function timerTick(time){timerJob=null;timers.tick(time);if(timers.pending)timerJob=requestAnimationFrame(timerTick);}
  function scanTimers(){timers.update([...d.querySelectorAll('['+V.attribute+']')].flatMap(el=>interactions(el).filter(item=>item.trigger==='after-delay').map(item=>({key:el,item}))));if(timers.pending&&timerJob===null)timerJob=requestAnimationFrame(timerTick);}
  const cancelScroll=()=>{if(scrollJob!==null){cancelAnimationFrame(scrollJob);scrollJob=null;}};
  const listen=(type,fn)=>{d.addEventListener(type,fn,true);listeners.push(()=>d.removeEventListener(type,fn,true));};
  function interactions(el){try{return V.parse(el.getAttribute(V.attribute));}catch{return [];}}
  const native='a[href],button,input,textarea,select,[contenteditable]:not([contenteditable="false"])';
  function restore(el,before){if(before.tabindex&&el.getAttribute('tabindex')==='0')el.removeAttribute('tabindex');if(before.role&&el.getAttribute('role')==='button')el.removeAttribute('role');}
  function decorate(){
   scanTimers();
   for(const [el,before]of changed)if(!el.isConnected||!interactions(el).some(i=>i.trigger==='click')){restore(el,before);changed.delete(el);}
   for(const el of d.querySelectorAll('['+V.attribute+']'))if(interactions(el).some(i=>i.trigger==='click')&&!el.matches(native)&&!changed.has(el)){const before={tabindex:!el.hasAttribute('tabindex'),role:!el.hasAttribute('role')};changed.set(el,before);if(before.tabindex)el.setAttribute('tabindex','0');if(before.role)el.setAttribute('role','button');}
  }
  function find(event,trigger){for(let el=event.target?.nodeType===1?event.target:event.target?.parentElement;el;el=el.parentElement){if(!el.hasAttribute(V.attribute))continue;const item=interactions(el).find(i=>i.trigger===trigger);if(item)return {el,item};}return null;}
  // A held pointer can keep delivering events to the iframe that opened the menu.
  function releaseAcrossFrames(event){
   const pointer=held;if(!pointer||pointer.id!==event.pointerId)return false;held=null;if(clickBlock?.id===event.pointerId)clickBlock.until=performance.now()+1000;const target=overlays.topFrame;if(!running||!target||target===frame||overlays.phase!=='idle'||event.button!==0||event.isPrimary===false||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return false;
   try{const from=frame.getBoundingClientRect(),to=target.getBoundingClientRect(),x=(from.left+event.clientX*from.width/frame.clientWidth-to.left)*target.clientWidth/to.width,y=(from.top+event.clientY*from.height/frame.clientHeight-to.top)*target.clientHeight/to.height;if(x<0||y<0||x>=target.clientWidth||y>=target.clientHeight)return false;const el=target.contentDocument.elementFromPoint(x,y),match=find({target:el},'mouseup'),targetContext=contexts.get(target);if(!match||!targetContext)return false;event.preventDefault();event.stopImmediatePropagation();afterRelease(match.item,targetContext,match.el);return true;}catch{return false;}
  }
  function handle(event,trigger){if(event.type==='click'&&consumeClick(event))return;if(trigger==='mousedown'&&event.isPrimary!==false)clickBlock=null;if(trigger==='mouseup'&&held&&releaseAcrossFrames(event))return;if(!active()||event.isComposing||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||['click','pointerdown','pointerup'].includes(event.type)&&event.button!==0||['pointerdown','pointerup'].includes(event.type)&&event.isPrimary===false)return;const match=find(event,trigger);if(!match)return;if(['mouseenter','mouseleave'].includes(trigger)&&match.el.contains(event.relatedTarget))return;event.preventDefault();event.stopImmediatePropagation();if(trigger==='mousedown')held={id:event.pointerId,frame};if(trigger==='mouseup'){clickBlock={id:event.pointerId,until:performance.now()+1000};afterRelease(match.item,context,match.el);}else perform(match.item,context,match.el);if(trigger==='mousedown'&&overlays.topFrame&&overlays.topFrame!==frame)clickBlock={id:event.pointerId,until:performance.now()+1000};}
  listen('visibilitychange',()=>timers.pause());const visibility=()=>timers.pause();document.addEventListener('visibilitychange',visibility);listeners.push(()=>document.removeEventListener('visibilitychange',visibility));
  listen('pointercancel',event=>{if(held?.id===event.pointerId){held=null;if(clickBlock)clickBlock.until=performance.now()+1000;}});listen('pointerdown',event=>handle(event,'mousedown'));listen('pointerup',event=>handle(event,'mouseup'));
  listen('click',event=>handle(event,'click'));listen('mouseover',event=>handle(event,'mouseenter'));listen('mouseout',event=>handle(event,'mouseleave'));
  function shortcut(event){
   if(!active()||event.isComposing||event.repeat)return false;
   const editable='input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]';
   if(event.composedPath().some(node=>node?.matches?.(editable)))return false;
   const available=el=>el.isConnected&&!el.closest('[inert]')&&el.getClientRects().length>0&&d.defaultView.getComputedStyle(el).visibility==='visible';
   const matches=el=>interactions(el).find(item=>item.trigger==='keyboard'&&K.matches(item.shortcut,event));let match=null;
   for(let el=event.target?.nodeType===1?event.target:event.target?.parentElement;el;el=el.parentElement){const item=el.hasAttribute(V.attribute)&&available(el)&&matches(el);if(item){match={el,item};break;}}
   if(!match){const choices=[...d.querySelectorAll('['+V.attribute+']')].filter(available).flatMap(el=>{const item=matches(el);return item?[{el,item}]:[];});if(!choices.length)return false;const actions=new Set(choices.map(choice=>JSON.stringify(choice.item)));if(actions.size>1){event.preventDefault();event.stopImmediatePropagation();root.RetouchPresentationHost.error('This shortcut has multiple destinations. Focus the intended hotspot to choose one.');return true;}match=choices[0];}
   event.preventDefault();event.stopImmediatePropagation();perform(match.item,context,match.el);return true;
  }
  listen('keydown',event=>{if(shortcut(event))return;if(!['Enter',' '].includes(event.key)||event.repeat||!changed.has(event.target))return;handle(event,'click');});
  const style=d.createElement('style');style.textContent='['+V.attribute+']{cursor:pointer}';d.head?.append(style);
  const observer=new MutationObserver(decorate);observer.observe(d.body,{childList:true,subtree:true,attributes:true,attributeFilter:[V.attribute]});decorate();
  if(context!==main){d.defaultView.addEventListener('keydown',overlayEscape);listeners.push(()=>d.defaultView?.removeEventListener('keydown',overlayEscape));}
  context.release=()=>{releaseVariables();context.scrollMotion?.cancel();context.scrollMotion=null;for(const job of pendingActions)if(job.context===context){cancelAnimationFrame(job.id);pendingActions.delete(job);}if(held?.frame===frame)held=null;timers.dispose();if(timerJob!==null)cancelAnimationFrame(timerJob);timerJob=null;cancelScroll();observer.disconnect();listeners.forEach(fn=>fn());style.remove();for(const [el,before]of changed)restore(el,before);};
  const pagehide=()=>context.release?.();d.defaultView.addEventListener('pagehide',pagehide);listeners.push(()=>d.defaultView?.removeEventListener('pagehide',pagehide));
  if(context.pendingScroll){const scroll=context.pendingScroll;context.pendingScroll=null;if(d.URL===scroll.url){
   // Client-rendered destinations may mount after iframe load. Wait for enough
   // page extent, but stop restoring as soon as the user interacts.
   const began=performance.now();const restoreScroll=()=>{scrollJob=null;if(!running||frame.contentDocument!==d)return;const scroller=d.scrollingElement;if(!scroller)return;
    if(scroller.scrollHeight-scroller.clientHeight>=scroll.y&&scroller.scrollWidth-scroller.clientWidth>=scroll.x||performance.now()-began>2000)d.defaultView.scrollTo({left:scroll.x,top:scroll.y,behavior:'instant'});else scrollJob=requestAnimationFrame(restoreScroll);
   };for(const type of ['wheel','pointerdown','keydown'])listen(type,cancelScroll);scrollJob=requestAnimationFrame(restoreScroll);
  }}
  return true;
 }
 frame.addEventListener('load',async()=>{const ticket=++loadSerial,completion=navigationCompletion;if(running)overlays.clear();try{await root.RetouchPrototypeNavigation.loaded();if(ticket===loadSerial){const mounted=mount(main);if(completion&&completion===navigationCompletion){completion.finish(mounted===true);navigationCompletion=null;}}}catch(error){completion?.finish(false);if(ticket===loadSerial)root.RetouchPresentationHost.error(error.message);}});
 root.RetouchPrototypeRuntime={
  get navigationFinished(){return navigationFinished;},
  start(){cancelNavigation();root.RetouchPrototypeVariables.reset();running=true;trail=[];main.pendingScroll=null;mount(main);},
  stop(){cancelNavigation();root.RetouchPrototypeVariables.reset();++loadSerial;root.RetouchPrototypeNavigation.clear();held=null;clickBlock=null;overlays.clear();running=false;main.release?.();main.release=null;trail=[];main.pendingScroll=null;},
  restart(){cancelNavigation();root.RetouchPrototypeVariables.reset();++loadSerial;root.RetouchPrototypeNavigation.clear();overlays.clear();main.release?.();main.release=null;trail=[];main.pendingScroll=null;},
  dismissOverlay:()=>overlays.close(),
  attachFrame(frame){const context={frame,release:null,pendingScroll:null};context.loaded=()=>mount(context);contexts.set(frame,context);frame.addEventListener('load',context.loaded);},
  detachFrame(frame){const context=contexts.get(frame);if(!context||context===main)return;context.release?.();frame.removeEventListener('load',context.loaded);contexts.delete(frame);},
  resetFrame(frame){const context=contexts.get(frame);if(context){context.release?.();context.release=null;context.pendingScroll=null;}}
 };
})(window);
