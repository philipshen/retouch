(function(root){
 'use strict';
 const properties=['width','height','backgroundColor','color','opacity','borderTopLeftRadius','borderTopRightRadius','borderBottomLeftRadius','borderBottomRightRadius','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','borderTopColor','borderRightColor','borderBottomColor','borderLeftColor','paddingTop','paddingRight','paddingBottom','paddingLeft','fontSize','fontWeight','lineHeight','letterSpacing','transform','transformOrigin','rotate','scale'];
 const label=el=>el.getAttribute('data-rt-layer-name')||el.getAttribute('data-rt-name')||el.id;
 function key(el){const path=[];for(let p=el;p&&p!==el.ownerDocument.body;p=p.parentElement)if(p.hasAttribute('data-rt'))path.unshift([p.localName,label(p)||'']);return JSON.stringify(path);}
 function scan(d){const map=new Map();for(const el of d.querySelectorAll('[data-rt]')){if(el.namespaceURI!=='http://www.w3.org/1999/xhtml'||!label(el)||!el.getClientRects().length)continue;const css=d.defaultView.getComputedStyle(el);if(css.display==='contents'||css.visibility==='hidden')continue;const k=key(el),items=map.get(k)||[];items.push({el,rect:el.getBoundingClientRect(),values:Object.fromEntries(properties.map(p=>[p,css[p]])),translate:css.translate});map.set(k,items);}return map;}
 // Translate keyframes live in the parent's coordinate system. Keep only the
 // linear ancestor matrix: measured rects already include origins/translations.
 function ancestorMatrix(el){let result=new DOMMatrix();for(let p=el.parentElement;p;p=p.parentElement){const css=el.ownerDocument.defaultView.getComputedStyle(p);if(css.perspective!=='none')return null;let local=new DOMMatrix();
  if(css.rotate!=='none'){const parts=css.rotate.split(/\s+/),angle=parts.pop();if(parts.length&&!(parts.length===1&&parts[0]==='z')&&!(parts.length===3&&Number(parts[0])===0&&Number(parts[1])===0&&Number(parts[2])!==0))return null;const match=angle.match(/^([-+\d.e]+)(deg|rad|grad|turn)$/i);if(!match)return null;const degrees=Number(match[1])*({deg:1,rad:180/Math.PI,grad:.9,turn:360}[match[2].toLowerCase()])*(parts.length===3&&Number(parts[2])<0?-1:1);local=local.rotate(degrees);}
  if(css.scale!=='none'){const scale=css.scale.split(/\s+/).map(Number);if(scale.length>2&&scale[2]!==1)return null;local=local.scale(scale[0],scale[1]??scale[0]);}
  if(css.transform!=='none'){const transform=new DOMMatrix(css.transform);if(!transform.is2D)return null;local=local.multiply(transform);}
  const zoom=Number(css.zoom);if(Number.isFinite(zoom)&&zoom>0)local=local.scale(zoom);
  result=local.multiply(result);
 }const determinant=result.a*result.d-result.b*result.c;return Number.isFinite(determinant)&&Math.abs(determinant)>1e-8?result:null;}
 // Offset geometry excludes CSS transforms/translates. Compare the live flow
 // against both measured endpoint flows to remove discrete flex/grid reflows.
 function layout(el){const chain=[];for(let node=el;node;node=node.offsetParent){const parent=node.offsetParent;chain.push({node,x:node.offsetLeft+(parent?.clientLeft||0),y:node.offsetTop+(parent?.clientTop||0)});}return chain;}
 function layoutDrift(row,progress){const current=layout(row.here.el),start=row.layoutStart,end=row.layoutEnd;if(current.length!==start.length||current.length!==end.length)return null;let x=0,y=0;for(let i=0;i<current.length;i++){const c=current[i],a=start[i],b=end[i];if(c.node!==a.node||c.node!==b.node)return null;let dx=a.x+(b.x-a.x)*progress-c.x,dy=a.y+(b.y-a.y)*progress-c.y;
  // offsetLeft/Top are integer CSSOM values: do not amplify rounding noise.
  if(Math.abs(dx)<=1)dx=0;if(Math.abs(dy)<=1)dy=0;if(!dx&&!dy)continue;const m=ancestorMatrix(c.node);if(!m)return null;x+=m.a*dx+m.c*dy;y+=m.b*dx+m.d*dy;
 }return {x,y};}
 function supported(el){return !!ancestorMatrix(el);}
 function play({old,next,config}){
  if(root.matchMedia('(prefers-reduced-motion: reduce)').matches)return root.RetouchPrototypeMotion.play({old,next,config:{type:'instant'},vector:[0,0]});
  if(!old.contentDocument?.body||!next.contentDocument?.body)return root.RetouchPrototypeMotion.play({old,next,config:{...config,type:'dissolve'},vector:[0,0]});
  const oldMap=scan(old.contentDocument),nextMap=scan(next.contentDocument),pairs=[];
  for(const [key,from]of oldMap){const to=nextMap.get(key);if(from.length===1&&to?.length===1&&supported(from[0].el)&&supported(to[0].el)){const a=from[0],b=to[0];if(a.rect.left!==b.rect.left||a.rect.top!==b.rect.top||a.translate!==b.translate||properties.some(property=>a.values[property]!==b.values[property]))pairs.push({from:a,to:b});}}
  const animations=[],motions=new Map(),layoutRows=[],z=[old.style.zIndex,next.style.zIndex],timing={duration:config.duration,easing:root.RetouchPrototypeValues.easingCss(config.easing),fill:'both'};let canceled=false,job=null,disposed=false;
  const cleanup=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(job);for(const animation of animations)animation.cancel();for(const motion of motions.values())motion.dispose();old.style.zIndex=z[0];next.style.zIndex=z[1];};
  const add=(el,frames)=>{let animation;if(el.ownerDocument!==document){const motion=root.RetouchPrototypeStyleMotion.create(el,frames,timing);animation=motion.animation;motions.set(animation,motion);}else{animation=el.animate(frames,timing);animation.pause();animation.currentTime=0;}animations.push(animation);return animation;};
  const render=()=>{for(const motion of motions.values())motion.render();for(const row of layoutRows)motions.get(row.animation)?.translate();const drifts=new Map();for(const row of layoutRows){const progress=row.animation.effect.getComputedTiming().progress;if(progress===null)continue;const delta=layoutDrift(row,progress);if(delta)drifts.set(row.here.el,delta);}for(const row of layoutRows){const delta=drifts.get(row.here.el);if(!delta)continue;let parent=row.here.el.parentElement;while(parent&&!drifts.has(parent))parent=parent.parentElement;const inherited=drifts.get(parent)||{x:0,y:0},x=delta.x-inherited.x,y=delta.y-inherited.y;if(!x&&!y)continue;const inverse=ancestorMatrix(row.here.el)?.inverse();if(inverse)motions.get(row.animation)?.translate(inverse.a*x+inverse.c*y,inverse.b*x+inverse.d*y);}};
  const tick=()=>{render();job=requestAnimationFrame(tick);};
  // Measure endpoint layout with interpolated sizes before adding movement. This
  // lets nested layout participate without applying the parent displacement twice.
  try{for(const forward of [true,false]){
   const rows=pairs.map(pair=>({pair,here:forward?pair.from:pair.to,there:forward?pair.to:pair.from})),offsets=new Map();
   for(const row of rows){const start=row.pair.from.values,end=row.pair.to.values;row.animation=add(row.here.el,[{...start,translate:row.here.translate},{...end,translate:row.here.translate}]);row.animation.currentTime=forward?config.duration:0;motions.get(row.animation)?.render();}
   for(const atEnd of [false,true]){for(const row of rows){row.animation.currentTime=atEnd?config.duration:0;motions.get(row.animation)?.render();}for(const row of rows)row[atEnd?'layoutEnd':'layoutStart']=layout(row.here.el);}
   for(const row of rows){row.animation.currentTime=forward?config.duration:0;motions.get(row.animation)?.render();}
   layoutRows.push(...rows);
   for(const row of rows){const rect=row.here.el.getBoundingClientRect(),target=row.there.rect;row.delta={x:target.left-rect.left,y:target.top-rect.top};row.inverse=ancestorMatrix(row.here.el)?.inverse();if(!row.inverse)throw Error("Unsupported ancestor transform");offsets.set(row.here.el,row);}
   for(const row of rows){let parent=row.here.el.parentElement;while(parent&&!offsets.has(parent))parent=parent.parentElement;const inherited=offsets.get(parent)?.delta||{x:0,y:0},world={x:row.delta.x-inherited.x,y:row.delta.y-inherited.y},delta={x:row.inverse.a*world.x+row.inverse.c*world.y,y:row.inverse.b*world.x+row.inverse.d*world.y},base=row.here.translate==='none'?['0px','0px']:row.here.translate.split(/\s+/),shift=`calc(${base[0]} + ${delta.x}px) calc(${base[1]||'0px'} + ${delta.y}px)`;row.animation.effect.setKeyframes([{...row.pair.from.values,translate:forward?row.here.translate:shift},{...row.pair.to.values,translate:forward?shift:row.here.translate}]);row.animation.currentTime=0;motions.get(row.animation)?.update();}
  }
  render();old.style.zIndex='1';next.style.zIndex='2';add(next,[{opacity:0},{opacity:1}]);
  const started=document.timeline.currentTime;for(const animation of animations){animation.play();animation.startTime=animation.effect.target.ownerDocument.timeline===document.timeline?started:animation.effect.target.ownerDocument.timeline.currentTime;}
  job=requestAnimationFrame(tick);
  }catch{cleanup();return root.RetouchPrototypeMotion.play({old,next,config:{...config,type:'dissolve'},vector:[0,0]});}
  const finished=Promise.all(animations.map(animation=>animation.finished.catch(()=>{}))).then(()=>{cleanup();return !canceled;});return {finished,animations,matches:pairs.length,cancel(){canceled=true;cleanup();}};
 }
 root.RetouchPrototypeSmart={play};
})(window);
