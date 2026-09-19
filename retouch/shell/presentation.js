(function(root){
 'use strict';
 const frame=document.getElementById('app'),canvas=document.getElementById('frameWrap'),button=document.getElementById('presentBtn'),bar=document.getElementById('presentationBar'),exit=document.getElementById('exitPresentation'),restart=document.getElementById('restartPresentation'),fit=document.getElementById('fitPresentation'),title=document.getElementById('presentationTitle'),size=document.getElementById('presentationSize'),host=root.RetouchPresentationHost;
 const hooked=new WeakSet();let state=null,pending=false;
 const settled=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 function route(){try{const location=frame.contentWindow.location;return location.origin===root.location.origin?location.pathname+location.search+location.hash:null;}catch{return null;}}
 function update(){if(!state)return;try{title.textContent=frame.contentDocument?.title||route()||'Presentation';}catch{title.textContent='Presentation';}size.textContent=state.width+' × '+state.height;}
 function hook(){try{const w=frame.contentWindow;if(!frame.contentDocument||hooked.has(frame.contentDocument))return;hooked.add(frame.contentDocument);w.addEventListener('keydown',escape);}catch{}}
 function escape(event){if(!state||event.defaultPrevented||event.isComposing||event.key!=='Escape'||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;event.preventDefault();event.stopPropagation();void close();}
 async function open(){
  if(state||pending)return;pending=true;button.disabled=true;
  try{
   const start=route();if(!start)throw Error('Open a project page before presenting.');
   const previous=await host.prepare(),viewport=root.RetouchZoom.beginPresentation();
   if(!viewport?.width||!viewport.height){host.restore(previous);throw Error('The preview is not ready yet.');}
   state={...viewport,previous,start,opener:button};root.document.body.classList.add('presenting');bar.hidden=false;button.setAttribute('aria-pressed','true');
   for(const node of document.querySelectorAll('#toolbar,#screenToolbar,#layersPanel,#panel,#screenComparisons,.design-tool-dock')){node.dataset.presentationInert=String(node.inert);node.inert=true;}
   root.RetouchActions?.closeContext();root.RetouchPrototypeRuntime?.start();hook();update();await settled();if(state){root.RetouchZoom.fitPresentation();exit.focus({preventScroll:true});}
  }catch(error){host.error(error.message);}finally{pending=false;button.disabled=false;}
 }
 async function close(){
  if(!state||pending)return;pending=true;const before=state;state=null;
  try{
   root.RetouchPrototypeRuntime?.stop();document.body.classList.remove('presenting');bar.hidden=true;button.setAttribute('aria-pressed','false');
   for(const node of document.querySelectorAll('[data-presentation-inert]')){node.inert=node.dataset.presentationInert==='true';delete node.dataset.presentationInert;}
   await settled();root.RetouchZoom.endPresentation();host.restore(before.previous);before.opener.focus({preventScroll:true});
  }finally{pending=false;}
 }
 button.addEventListener('pointerdown',event=>event.preventDefault());button.addEventListener('click',open);exit.addEventListener('click',()=>void close());fit.addEventListener('click',()=>root.RetouchZoom.fitPresentation());restart.addEventListener('click',()=>{if(state){root.RetouchPrototypeRuntime?.restart();frame.src=state.start;}});
 frame.addEventListener('load',()=>{hook();update();});root.addEventListener('retouch:route',update);root.addEventListener('keydown',escape);hook();
 root.RetouchPresentation={open,close,get active(){return !!state;}};
})(window);
