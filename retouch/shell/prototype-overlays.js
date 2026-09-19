(function(root){
 'use strict';
 const V=root.RetouchPrototypeValues,stage=document.getElementById('siteStage'),base=document.getElementById('app'),closeButton=document.getElementById('closePrototypeOverlay'),stack=[];
 function layout(entry){
  const {config,card,frame}=entry,w=stage.clientWidth,h=stage.clientHeight,scale=Math.max(.01,Math.min(1,(w-32)/config.width,(h-32)/config.height)),width=config.width*scale,height=config.height*scale;
  const position=config.position,left=position.endsWith('left')?16:position.endsWith('right')?w-width-16:(w-width)/2,top=position.startsWith('top')?16:position.startsWith('bottom')?h-height-16:(h-height)/2;
  Object.assign(card.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});Object.assign(frame.style,{width:config.width+'px',height:config.height+'px',transform:'scale('+scale+')'});
 }
 function close(restoreFocus=true){const entry=stack.pop();if(!entry)return false;root.RetouchPrototypeRuntime.detachFrame(entry.frame);entry.surface.remove();entry.blocked.inert=entry.previousInert;closeButton.hidden=!stack.length;
  if(restoreFocus&&entry.opener?.isConnected){try{entry.opener.focus({preventScroll:true});}catch{}}
  return true;
 }
 function clear(){while(stack.length)close(false);}
 function open(destination,options,opener){
  if(!root.RetouchPresentation?.active||!V.route(destination))return;
  if(stack.length>=16){root.RetouchPresentationHost.error('Close an overlay before opening another.');return;}
  const config=V.overlay(options),surface=document.createElement('div'),card=document.createElement('section'),frame=document.createElement('iframe'),blocked=stack.at(-1)?.surface||base;
  surface.className='prototype-overlay-surface';surface.style.background=config.background;surface.style.zIndex=String(10+stack.length);card.className='prototype-overlay-card';card.setAttribute('role','dialog');card.setAttribute('aria-label','Prototype overlay');frame.title='Prototype overlay preview';frame.className='prototype-overlay-frame';
  const entry={surface,card,frame,config,opener,blocked,previousInert:blocked.inert};blocked.inert=true;stack.push(entry);card.append(frame);surface.append(card);
  surface.addEventListener('click',event=>{if(event.target===surface){event.preventDefault();event.stopPropagation();if(config.closeOutside&&stack.at(-1)===entry)close();}});
  root.RetouchPrototypeRuntime.attachFrame(frame);frame.addEventListener('load',()=>{if(stack.at(-1)!==entry)return;try{card.setAttribute('aria-label',frame.contentDocument?.title||'Prototype overlay');}catch{}frame.focus({preventScroll:true});});
  frame.src=destination;stage.append(surface);layout(entry);closeButton.hidden=false;
 }
 function swap(destination,opener){const entry=stack.at(-1);if(!entry)return false;if(!V.route(destination))return true;root.RetouchPrototypeRuntime.resetFrame(entry.frame);entry.frame.src=destination;return true;}
 closeButton.addEventListener('click',()=>close());new ResizeObserver(()=>stack.forEach(layout)).observe(stage);
 root.RetouchPrototypeOverlays={open,swap,close,clear,get topFrame(){return stack.at(-1)?.frame||null;},get count(){return stack.length;}};
})(window);
