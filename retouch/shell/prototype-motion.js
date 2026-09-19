(function(root){
 'use strict';
 const reduced=()=>root.matchMedia('(prefers-reduced-motion: reduce)').matches;
 function reverse(config){if(!config)return {type:'instant'};return {...config,type:({'move-in':'move-out','slide-in':'slide-out'})[config.type]||config.type};}
 function frames(config,vector){
  const [x,y]=vector,at=(x,y,opacity=1)=>({translate:x+'px '+y+'px',opacity}),zero=at(0,0);
  switch(config.type){
   case 'dissolve':return {old:[zero,zero],next:[at(0,0,0),zero]};
   case 'move-in':return {old:[zero,zero],next:[at(x,y),zero]};
   case 'move-out':return {old:[zero,at(x,y)],next:[zero,zero],oldAbove:true};
   case 'push':return {old:[zero,at(-x,-y)],next:[at(x,y),zero]};
   case 'slide-in':return {old:[zero,at(-x/4,-y/4,0)],next:[at(x,y),zero]};
   case 'slide-out':return {old:[zero,at(x,y)],next:[at(-x/4,-y/4,0),zero],oldAbove:true};
   default:return {old:[zero,zero],next:[zero,zero]};
  }
 }
 function play({old,next,backdrop,config,vector,closing=false}){
  config=config||{type:'instant'};let canceled=false;const animations=[],styles=[];
  const save=el=>{if(!el||styles.some(row=>row.el===el))return;styles.push({el,z:el.style.zIndex});};
  const plan=frames(config,vector),duration=reduced()||config.type==='instant'?0:config.duration;
  if(old&&next){save(old);save(next);old.style.zIndex=plan.oldAbove?'2':'1';next.style.zIndex=plan.oldAbove?'1':'2';}
  const add=(el,keyframes)=>{if(el&&duration)animations.push(el.animate(keyframes,{duration,easing:config.easing,fill:'both'}));};
  if(closing)add(old,config.type==='dissolve'?[{opacity:1},{opacity:0}]:config.type==='slide-out'?[plan.old[0],{...plan.old[1],opacity:0}]:plan.old);else{add(old,plan.old);add(next,!old&&config.type==='slide-in'?[{...plan.next[0],opacity:0},plan.next[1]]:plan.next);}
  if(backdrop)add(backdrop,[{opacity:closing?1:0},{opacity:closing?0:1}]);
  const cleanup=()=>{animations.forEach(animation=>animation.cancel());for(const row of styles)row.el.style.zIndex=row.z;};
  const finished=Promise.all(animations.map(animation=>animation.finished.catch(()=>{}))).then(()=>{cleanup();return !canceled;});
  return {finished,cancel(){canceled=true;cleanup();},get animations(){return animations;}};
 }
 function ready(frame,signal){return new Promise(resolve=>{
  let timer,job,done=false;const began=performance.now();
  const finish=value=>{if(done)return;done=true;clearTimeout(timer);cancelAnimationFrame(job);signal?.removeEventListener('abort',abort);resolve(value);},abort=()=>finish(false);
  if(signal?.aborted)return finish(false);signal?.addEventListener('abort',abort,{once:true});
  function check(){if(!frame.isConnected)return finish(false);try{const d=frame.contentDocument;if(d?.readyState==='complete'&&d.body){const stamped=d.querySelector('[data-rt]');if((stamped&&(!root.RetouchClientMount||root.RetouchClientMount.ready(d)))||performance.now()-began>1500)return finish(true);}}catch{return finish(true);}job=requestAnimationFrame(check);}
  timer=setTimeout(()=>finish(true),2000);job=requestAnimationFrame(check);
 });}
 const api={reverse,frames,play,ready};if(typeof module==='object'&&module.exports)module.exports=api;else root.RetouchPrototypeMotion=api;
})(typeof window==='object'?window:globalThis);
