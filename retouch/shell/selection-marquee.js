(function(root){
 'use strict';
 function rectangle(a,b){return {left:Math.min(a.x,b.x),top:Math.min(a.y,b.y),width:Math.abs(b.x-a.x),height:Math.abs(b.y-a.y)};}
 function moved(a,b,scale=1){return Math.hypot(b.x-a.x,b.y-a.y)*scale>=4;}
 function enclosed(rect,box){return box.width>0&&box.height>0&&box.left>=rect.left&&box.top>=rect.top&&box.right<=rect.left+rect.width&&box.bottom<=rect.top+rect.height;}
 function pick(d,rect){
  const candidates=[...d.querySelectorAll('body [data-rt]')].filter(el=>{
   if(['SCRIPT','STYLE','TEMPLATE','HEAD','META','LINK'].includes(el.tagName))return false;
   const css=d.defaultView.getComputedStyle(el);return !['hidden','collapse'].includes(css.visibility)&&enclosed(rect,el.getBoundingClientRect());
  });
  return candidates.filter(el=>!candidates.some(parent=>parent!==el&&parent.contains(el)));
 }
 function clip(rect,width,height){const left=Math.max(0,rect.left),top=Math.max(0,rect.top);return {left,top,width:Math.max(0,Math.min(width,rect.left+rect.width)-left),height:Math.max(0,Math.min(height,rect.top+rect.height)-top)};}
 function background(el){
  if(el?.isContentEditable)return false;
  if(['HTML','BODY'].includes(el?.tagName))return true;
  if(!el||!['DIV','MAIN','SECTION','ARTICLE','ASIDE','HEADER','FOOTER','NAV','UL','OL','LI','FORM','FIELDSET','TABLE','THEAD','TBODY','TFOOT','TR','TD','TH'].includes(el.tagName)||!el.hasAttribute('data-rt'))return false;
  if(el.closest('[contenteditable="true"], [role="button"], [role="link"]'))return false;
  return !!el.querySelector('[data-rt], [data-rt-i]')&&![...el.childNodes].some(node=>node.nodeType===3&&node.textContent.trim());
 }
 function mount({document:d,frame,surface,enabled,onChange,onSelect,onClick}){
  const w=d.defaultView;let state=null,ignoreClick=null;const cleanup=[];
  function listen(target,type,handler,capture=false){target.addEventListener(type,handler,capture);cleanup.push(()=>target.removeEventListener(type,handler,capture));}
  function point(e,outer){if(!outer)return {x:e.clientX,y:e.clientY};const r=frame.getBoundingClientRect(),scale=r.width/w.innerWidth;return {x:(e.clientX-r.left)/scale,y:(e.clientY-r.top)/scale};}
  function finish(commit){
   if(!state)return;const current=state;state=null;
   if(current.capture.hasPointerCapture(current.pointerId))current.capture.releasePointerCapture(current.pointerId);
   onChange(null);
   if(!current.moved&&commit&&!current.outer&&!['HTML','BODY'].includes(current.target.tagName)&&current.target.isConnected&&onClick){const marker=ignoreClick={...current.rawLast,outer:false,time:Date.now()};root.setTimeout(()=>{if(ignoreClick===marker)ignoreClick=null;},0);onClick(current.target,{toggle:current.append});}
   if(current.moved){ignoreClick={...current.rawLast,outer:current.outer,time:Date.now()};if(commit)onSelect(pick(d,clip(rectangle(current.start,current.last),w.innerWidth,w.innerHeight)),{append:current.append});}
  }
  function down(e,outer){
   const allowed=outer?[surface,root.document.getElementById('canvasExtent'),root.document.getElementById('siteStage')].includes(e.target):background(e.target);
   if(state||!enabled()||e.button!==0||!allowed||(outer&&(!frame.getBoundingClientRect().width||!w.innerWidth)))return;
   e.preventDefault();e.stopImmediatePropagation();const start=point(e,outer),capture=outer?surface:e.target;
   state={pointerId:e.pointerId,target:e.target,start,last:start,rawLast:{x:e.clientX,y:e.clientY},outer,capture,scale:frame?frame.getBoundingClientRect().width/w.innerWidth:1,moved:false,append:e.shiftKey||e.metaKey||e.ctrlKey};capture.setPointerCapture(e.pointerId);
  }
  function move(e,outer){
   if(!state||outer!==state.outer||e.pointerId!==state.pointerId)return;e.preventDefault();e.stopImmediatePropagation();state.last=point(e,outer);state.rawLast={x:e.clientX,y:e.clientY};
   if(moved(state.start,state.last,state.scale))state.moved=true;
   if(state.moved)onChange(rectangle(state.start,state.last));
  }
  function up(e,outer){if(state&&outer===state.outer&&e.pointerId===state.pointerId){move(e,outer);finish(true);}}
  function cancel(){finish(false);}
  function escape(e){if(state&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancel();}}
  function click(e,outer){
   if(!ignoreClick||ignoreClick.outer!==outer)return;const previous=ignoreClick;ignoreClick=null;
   if(Date.now()-previous.time<500&&Math.abs(e.clientX-previous.x)<=2&&Math.abs(e.clientY-previous.y)<=2){e.preventDefault();e.stopImmediatePropagation();}
  }
  function blur(){if(!root.document.hasFocus())cancel();}
  function bind(eventWindow,eventDocument,outer){
   listen(outer?surface:eventDocument,'pointerdown',e=>down(e,outer),true);listen(eventDocument,'click',e=>click(e,outer),true);listen(eventWindow,'lostpointercapture',cancel,true);
   listen(eventWindow,'pointermove',e=>move(e,outer),true);listen(eventWindow,'pointerup',e=>up(e,outer),true);listen(eventWindow,'pointercancel',cancel,true);listen(eventWindow,'keydown',escape,true);listen(eventWindow,'resize',cancel);listen(eventWindow,'pagehide',cancel);listen(eventWindow,'blur',blur);
  }
  listen(root,'retouch:before-zoom',cancel);listen(root,'retouch:screen',cancel);
  bind(w,d,false);
  if(surface&&frame)bind(root,root.document,true);else{listen(root,'keydown',escape,true);listen(root,'blur',blur);}
  return ()=>{cancel();cleanup.forEach(remove=>remove());};
 }
 const api={rectangle,moved,enclosed,clip,pick,background,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchMarquee=api;
})(typeof window==='object'?window:globalThis);
