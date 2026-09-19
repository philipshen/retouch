(function(root){
 'use strict';
 const properties=['width','height','backgroundColor','color','opacity','borderTopLeftRadius','borderTopRightRadius','borderBottomLeftRadius','borderBottomRightRadius','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','borderTopColor','borderRightColor','borderBottomColor','borderLeftColor','paddingTop','paddingRight','paddingBottom','paddingLeft','fontSize','fontWeight','lineHeight','letterSpacing','transform','rotate','scale'];
 const label=el=>el.getAttribute('data-rt-layer-name')||el.getAttribute('data-rt-name')||el.id;
 function key(el){const path=[];for(let p=el;p&&p!==el.ownerDocument.body;p=p.parentElement)if(p.hasAttribute('data-rt'))path.unshift([p.localName,label(p)||'']);return JSON.stringify(path);}
 function scan(d){const map=new Map();for(const el of d.querySelectorAll('[data-rt]')){if(el.namespaceURI!=='http://www.w3.org/1999/xhtml'||!label(el)||!el.getClientRects().length)continue;const css=d.defaultView.getComputedStyle(el);if(css.display==='contents'||css.visibility==='hidden')continue;const k=key(el),items=map.get(k)||[];items.push({el,rect:el.getBoundingClientRect(),values:Object.fromEntries(properties.map(p=>[p,css[p]])),translate:css.translate});map.set(k,items);}return map;}
 function supported(el){for(let p=el.parentElement;p;p=p.parentElement){const css=el.ownerDocument.defaultView.getComputedStyle(p);if(css.perspective!=='none'||css.rotate!=='none'||css.scale!=='none')return false;if(css.transform!=='none'){const m=new DOMMatrix(css.transform);if(!m.is2D||m.a!==1||m.d!==1||m.b||m.c)return false;}}return true;}
 const cssName=name=>name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
 function play({old,next,config}){
  if(root.matchMedia('(prefers-reduced-motion: reduce)').matches)return root.RetouchPrototypeMotion.play({old,next,config:{type:'instant'},vector:[0,0]});
  if(!old.contentDocument?.body||!next.contentDocument?.body)return root.RetouchPrototypeMotion.play({old,next,config:{...config,type:'dissolve'},vector:[0,0]});
  const oldMap=scan(old.contentDocument),nextMap=scan(next.contentDocument),pairs=[];
  for(const [key,from]of oldMap){const to=nextMap.get(key);if(from.length===1&&to?.length===1&&supported(from[0].el)&&supported(to[0].el))pairs.push({from:from[0],to:to[0]});}
  const animations=[],priorities=[],z=[old.style.zIndex,next.style.zIndex],timing={duration:config.duration,easing:root.RetouchPrototypeValues.easingCss(config.easing),fill:'both'};let canceled=false;
  const cleanup=()=>{for(const animation of animations)animation.cancel();for(const {el,name,value}of priorities)if(el.style.getPropertyValue(name)===value&&!el.style.getPropertyPriority(name))el.style.setProperty(name,value,'important');old.style.zIndex=z[0];next.style.zIndex=z[1];};
  const add=(el,frames)=>{for(const p of new Set(frames.flatMap(f=>Object.keys(f)))){const name=cssName(p);if(el.style.getPropertyPriority(name)==='important'){const value=el.style.getPropertyValue(name);priorities.push({el,name,value});el.style.setProperty(name,value);}}const animation=el.animate(frames,timing);animation.pause();animation.currentTime=0;animations.push(animation);return animation;};
  // Measure endpoint layout with interpolated sizes before adding movement. This
  // lets nested layout participate without applying the parent displacement twice.
  try{for(const forward of [true,false]){
   const rows=pairs.map(pair=>({pair,here:forward?pair.from:pair.to,there:forward?pair.to:pair.from})),motions=new Map();
   for(const row of rows){const start=row.pair.from.values,end=row.pair.to.values;row.animation=add(row.here.el,[{...start,translate:row.here.translate},{...end,translate:row.here.translate}]);row.animation.currentTime=forward?config.duration:0;}
   for(const row of rows){const rect=row.here.el.getBoundingClientRect(),target=row.there.rect;row.delta={x:target.left-rect.left,y:target.top-rect.top};motions.set(row.here.el,row);}
   for(const row of rows){let parent=row.here.el.parentElement;while(parent&&!motions.has(parent))parent=parent.parentElement;const inherited=motions.get(parent)?.delta||{x:0,y:0},delta={x:row.delta.x-inherited.x,y:row.delta.y-inherited.y},base=row.here.translate==='none'?['0px','0px']:row.here.translate.split(/\s+/),shift=`calc(${base[0]} + ${delta.x}px) calc(${base[1]||'0px'} + ${delta.y}px)`;row.animation.effect.setKeyframes([{...row.pair.from.values,translate:forward?row.here.translate:shift},{...row.pair.to.values,translate:forward?shift:row.here.translate}]);row.animation.currentTime=0;}
  }
  old.style.zIndex='1';next.style.zIndex='2';add(next,[{opacity:0},{opacity:1}]);
  const started=document.timeline.currentTime;for(const animation of animations){animation.play();animation.startTime=animation.effect.target.ownerDocument.timeline===document.timeline?started:animation.effect.target.ownerDocument.timeline.currentTime;}
  }catch{cleanup();return root.RetouchPrototypeMotion.play({old,next,config:{...config,type:'dissolve'},vector:[0,0]});}
  const finished=Promise.all(animations.map(animation=>animation.finished.catch(()=>{}))).then(()=>{cleanup();return !canceled;});return {finished,animations,matches:pairs.length,cancel(){canceled=true;cleanup();}};
 }
 root.RetouchPrototypeSmart={play};
})(window);
