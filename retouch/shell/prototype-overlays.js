(function(root){
 'use strict';
 const V=root.RetouchPrototypeValues,M=root.RetouchPrototypeMotion,stage=document.getElementById('siteStage'),base=document.getElementById('app'),closeButton=document.getElementById('closePrototypeOverlay'),stack=[];
 function layout(entry){
  const {config,card}=entry,w=stage.clientWidth,h=stage.clientHeight,scale=Math.max(.01,Math.min(1,(w-32)/config.width,(h-32)/config.height)),width=config.width*scale,height=config.height*scale;
  const position=config.position,left=position.endsWith('left')?16:position.endsWith('right')?w-width-16:(w-width)/2,top=position.startsWith('top')?16:position.startsWith('bottom')?h-height-16:(h-height)/2;
  Object.assign(card.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});for(const frame of entry.frames)Object.assign(frame.style,{width:config.width+'px',height:config.height+'px',transform:'scale('+scale+')'});
 }
 function vector(entry,config,swapping=false){const {card}=entry;switch(config?.direction){case 'left':return [swapping?-card.offsetWidth:-card.offsetLeft-card.offsetWidth,0];case 'top':return [0,swapping?-card.offsetHeight:-card.offsetTop-card.offsetHeight];case 'bottom':return [0,swapping?card.offsetHeight:stage.clientHeight-card.offsetTop];default:return [swapping?card.offsetWidth:stage.clientWidth-card.offsetLeft,0];}}
 function removeFrame(entry,frame){root.RetouchPrototypeRuntime.detachFrame(frame);frame.remove();entry.frames.delete(frame);}
 function cancel(entry){entry.serial++;entry.controller?.abort();entry.motion?.cancel();entry.motion=null;if(entry.pending){removeFrame(entry,entry.pending);entry.pending=null;}}
 function finalize(entry,restoreFocus){cancel(entry);stack.pop();for(const frame of [...entry.frames])removeFrame(entry,frame);entry.surface.remove();entry.blocked.inert=entry.previousInert;closeButton.hidden=!stack.length;if(restoreFocus&&entry.opener?.isConnected)try{entry.opener.focus({preventScroll:true});}catch{}}
 function close(restoreFocus=true,transition=null,force=false){
  const entry=stack.at(-1);if(!entry)return false;if(force){finalize(entry,restoreFocus);return true;}if(entry.phase==='closing')return true;
  const wasLoading=entry.phase==='loading';cancel(entry);entry.phase='closing';entry.card.inert=true;entry.status.hidden=true;
  const config=wasLoading?{type:'instant'}:transition||M.reverse(entry.transition),serial=entry.serial;
  entry.motion=M.play({old:entry.card,backdrop:entry.backdrop,config,vector:vector(entry,config),closing:true});
  entry.motion.finished.then(ok=>{if(ok&&entry.serial===serial&&stack.at(-1)===entry)finalize(entry,restoreFocus);});return true;
 }
 function clear(){while(stack.length)close(false,null,true);}
 function title(entry){try{entry.card.setAttribute('aria-label',entry.frame.contentDocument?.title||'Prototype overlay');}catch{}}
 function newFrame(entry,destination,loaded){
  const frame=document.createElement('iframe');frame.title='Prototype overlay preview';frame.className='prototype-overlay-frame';entry.frames.add(frame);root.RetouchPrototypeRuntime.attachFrame(frame);let first=true;
  frame.addEventListener('load',()=>{if(!stack.includes(entry)||!entry.frames.has(frame))return;if(first){first=false;void loaded(frame);}else if(entry.frame===frame){title(entry);if(stack.at(-1)===entry)frame.focus({preventScroll:true});}});
  frame.src=destination;entry.card.append(frame);layout(entry);return frame;
 }
 async function reveal(entry,frame,transition,old=null){
  const serial=entry.serial,controller=new AbortController();entry.controller=controller;
  const ready=await M.ready(frame,controller.signal);if(!ready||entry.serial!==serial||!stack.includes(entry))return;
  entry.pending=null;entry.frame=frame;entry.phase='animating';entry.status.hidden=true;entry.card.style.visibility='';frame.style.visibility='';if(!old)entry.backdrop.style.opacity='';title(entry);
  entry.motion=old&&transition.type==='smart-animate'?root.RetouchPrototypeSmart.play({old,next:frame,config:transition}):M.play({old:old||null,next:old?frame:entry.card,backdrop:old?null:entry.backdrop,config:transition,vector:vector(entry,transition,!!old)});
  const ok=await entry.motion.finished;if(!ok||entry.serial!==serial||!stack.includes(entry))return;
  if(old)removeFrame(entry,old);entry.card.inert=false;entry.phase='idle';entry.card.removeAttribute('aria-busy');if(stack.at(-1)===entry)frame.focus({preventScroll:true});
 }
 function open(destination,options,opener,transition={type:'instant'}){
  if(!root.RetouchPresentation?.active||!V.route(destination))return;if(stack.length>=16){root.RetouchPresentationHost.error('Close an overlay before opening another.');return;}
  const config=V.overlay(options),surface=document.createElement('div'),backdrop=document.createElement('div'),card=document.createElement('section'),status=document.createElement('div'),blocked=stack.at(-1)?.surface||base;
  surface.className='prototype-overlay-surface';surface.style.zIndex=String(10+stack.length);backdrop.className='prototype-overlay-backdrop';backdrop.style.background=config.background;backdrop.style.opacity='0';card.className='prototype-overlay-card';card.style.visibility='hidden';card.inert=true;card.setAttribute('role','dialog');card.setAttribute('aria-label','Prototype overlay');card.setAttribute('aria-busy','true');status.className='prototype-overlay-loading';status.textContent='Loading overlay…';status.setAttribute('role','status');
  const entry={surface,backdrop,card,status,config,opener,blocked,previousInert:blocked.inert,frames:new Set(),serial:0,phase:'loading',transition};blocked.inert=true;stack.push(entry);surface.append(backdrop,card,status);stage.append(surface);
  surface.addEventListener('click',event=>{if(event.target===surface||event.target===backdrop){event.preventDefault();event.stopPropagation();if(config.closeOutside&&stack.at(-1)===entry)close();}});
  entry.frame=newFrame(entry,destination,frame=>reveal(entry,frame,transition));closeButton.hidden=false;
 }
 function swap(destination,opener,transition={type:'instant'}){
  const entry=stack.at(-1);if(!entry)return false;if(!V.route(destination)||entry.phase==='closing')return true;
  cancel(entry);for(const frame of [...entry.frames])if(frame!==entry.frame)removeFrame(entry,frame);const old=entry.frame;entry.phase='swapping';entry.card.inert=true;entry.card.setAttribute('aria-busy','true');entry.status.hidden=false;
  entry.pending=newFrame(entry,destination,frame=>reveal(entry,frame,transition,old));entry.pending.style.visibility='hidden';return true;
 }
 closeButton.addEventListener('click',()=>close());new ResizeObserver(()=>stack.forEach(layout)).observe(stage);
 root.RetouchPrototypeOverlays={open,swap,close,clear,get topFrame(){return stack.at(-1)?.frame||null;},get count(){return stack.length;},get phase(){return stack.at(-1)?.phase||'idle';},get animations(){return stack.at(-1)?.motion?.animations||[];}};
})(window);
