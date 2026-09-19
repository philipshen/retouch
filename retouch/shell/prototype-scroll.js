(function(root){
 'use strict';
 const running=new Set();
 function ancestors(target){const result=[];for(let el=target.parentElement;el;el=el.parentElement)result.push(el);const scrolling=target.ownerDocument.scrollingElement;if(scrolling&&!result.includes(scrolling))result.push(scrolling);return result;}
 function play(target,config={type:'instant'},offset={x:0,y:0}){
  const d=target.ownerDocument,w=d.defaultView,inside=ancestors(target),outside=[];
  // Native layout resolves writing modes, scroll padding/margins and transforms.
  // Measure synchronously, restoring every parent before the next paint. The
  // editor's ancestor scroll positions must never become part of the animation.
  for(let parent=w;parent!==parent.parent;parent=parent.parent){try{const frame=parent.frameElement;if(!frame)break;outside.push(...ancestors(frame));}catch{break;}}
  const rows=[...new Set([...inside,...outside])].map(el=>({el,x:el.scrollLeft,y:el.scrollTop})),styles=[],originalStyles=new Map(inside.map(el=>[el,el.getAttribute('style')]));
  for(const el of inside)for(const name of ['scroll-behavior','scroll-snap-type','overflow-anchor']){const value=name==='scroll-behavior'?'auto':'none';styles.push({el,name,value,before:el.style.getPropertyValue(name),priority:el.style.getPropertyPriority(name)});el.style.setProperty(name,value,'important');}
  const injectedStyles=new Map(inside.map(el=>[el,el.getAttribute('style')]));
  const write=(el,x,y)=>el.scrollTo({left:x,top:y,behavior:'instant'});
  const restoreStyles=()=>{const exact=new Set();for(const [el,original]of originalStyles)if(el.getAttribute('style')===injectedStyles.get(el)){if(original===null)el.removeAttribute('style');else el.setAttribute('style',original);exact.add(el);}for(const row of styles)if(!exact.has(row.el)&&row.el.style.getPropertyValue(row.name)===row.value&&row.el.style.getPropertyPriority(row.name)==='important'){if(row.before)row.el.style.setProperty(row.name,row.before,row.priority);else row.el.style.removeProperty(row.name);}};

  let plan=[];
  try{
   target.scrollIntoView({behavior:'instant',block:'start',inline:'nearest'});
   for(const axis of ['x','y']){const el=inside.find(el=>{const css=w.getComputedStyle(el);return el===d.scrollingElement||(axis==='x'?el.scrollWidth>el.clientWidth&& !['visible','clip'].includes(css.overflowX):el.scrollHeight>el.clientHeight&&!['visible','clip'].includes(css.overflowY));});if(el)write(el,el.scrollLeft+(axis==='x'?offset.x:0),el.scrollTop+(axis==='y'?offset.y:0));}
   plan=rows.filter(row=>inside.includes(row.el)).map(row=>({...row,toX:row.el.scrollLeft,toY:row.el.scrollTop})).filter(row=>row.x!==row.toX||row.y!==row.toY);
  }catch(error){restoreStyles();throw error;}finally{for(const row of rows)write(row.el,row.x,row.y);}
  let job=null,done=false,resolve,animation=null;const listeners=[],finished=new Promise(r=>{resolve=r;}),media=root.matchMedia('(prefers-reduced-motion: reduce)');
  const listen=(target,type,handler)=>{target.addEventListener(type,handler,{capture:true,passive:true});listeners.push(()=>target.removeEventListener(type,handler,true));};
  function apply(progress){for(const row of plan){write(row.el,row.x+(row.toX-row.x)*progress,row.y+(row.toY-row.y)*progress);row.lastX=row.el.scrollLeft;row.lastY=row.el.scrollTop;}}
  function finish(completed){if(done)return;done=true;if(job!==null)root.cancelAnimationFrame(job);if(completed)apply(1);animation?.cancel();listeners.forEach(remove=>remove());restoreStyles();running.delete(controller);resolve(completed);}
  const controller={finished,cancel:()=>finish(false),get animation(){return animation;}};running.add(controller);
  if(!plan.length||config.type==='instant'||media.matches){finish(true);return controller;}
  try{animation=new w.Animation(new w.KeyframeEffect(null,[],{duration:config.duration,easing:root.RetouchPrototypeValues.easingCss(config.easing),fill:'both'}),d.timeline);animation.play();}catch(error){finish(false);throw error;}
  function tick(){job=null;if(done)return;if(!target.isConnected||d.hidden||document.hidden||plan.some(row=>!row.el.isConnected||row.lastX!==undefined&&(Math.abs(row.el.scrollLeft-row.lastX)>2||Math.abs(row.el.scrollTop-row.lastY)>2))){finish(false);return;}
   if(animation.playState==='finished'){finish(true);return;}const progress=animation.effect.getComputedTiming().progress;if(progress!==null)apply(progress);job=root.requestAnimationFrame(tick);
  }
  for(const type of ['wheel','pointerdown','touchstart','keydown'])listen(d,type,()=>finish(false));
  listen(d,'visibilitychange',()=>{if(d.hidden)finish(false);});listen(document,'visibilitychange',()=>{if(document.hidden)finish(false);});listen(w,'pagehide',()=>finish(false));listen(media,'change',()=>{if(media.matches)finish(true);});
  job=root.requestAnimationFrame(tick);return controller;
 }
 root.RetouchPrototypeScroll={play,get animations(){return [...running].map(item=>item.animation).filter(Boolean);}};
})(window);
