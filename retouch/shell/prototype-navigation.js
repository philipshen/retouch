(function(root){
 'use strict';
 const frame=document.getElementById('app'),stage=document.getElementById('siteStage'),M=root.RetouchPrototypeMotion;let current=null;
 function clear(){const entry=current;if(!entry)return;current=null;entry.controller.abort();entry.motion?.cancel();entry.copy.remove();entry.status.remove();frame.inert=entry.inert;frame.style.visibility=entry.visibility;stage.style.overflow=entry.overflow;}
 // Canvas needs scripting-enabled rendering; the inserted CSP forbids script execution.
 function snapshot(){
  const source=frame.contentDocument,copy=document.createElement('iframe');copy.className='prototype-navigation-snapshot';copy.title='Outgoing prototype page';copy.setAttribute('aria-hidden','true');copy.setAttribute('sandbox','allow-same-origin allow-scripts');copy.inert=true;stage.append(copy);
  try{
   const d=copy.contentDocument,tree=d.importNode(source.documentElement,true),scroll=[],paint=[];let frozenId=0;
   function styles(from,to){for(const sheet of from.adoptedStyleSheets||[])try{const style=d.createElement('style');style.textContent=[...sheet.cssRules].map(rule=>rule.cssText).join('\n');to.append(style);}catch{}}
   function state(fromRoot,toRoot){const rules=[],animations=new Map();for(const animation of fromRoot.getAnimations?.({subtree:true})||[]){const target=animation.effect?.target,list=animations.get(target)||[];list.push(animation);animations.set(target,list);}const original=[...(fromRoot.nodeType===1?[fromRoot]:[]),...fromRoot.querySelectorAll('*')],cloned=[...(toRoot.nodeType===1?[toRoot]:[]),...toRoot.querySelectorAll('*')];
    for(let i=0;i<original.length;i++){const from=original[i];let to=cloned[i];if(!to)continue;for(const attribute of [...to.attributes])if(/^on/i.test(attribute.name))to.removeAttribute(attribute.name);if(from.scrollLeft||from.scrollTop)scroll.push([to,from.scrollLeft,from.scrollTop]);
     if(from.localName==='input'){to.value=from.value;to.checked=from.checked;}else if(from.localName==='textarea')to.value=from.value;else if(from.localName==='option')to.selected=from.selected;
     if(from.localName==='canvas')paint.push([from,to]);
     if(from.localName==='video'&&from.readyState>=2)try{const canvas=d.createElement('canvas'),css=source.defaultView.getComputedStyle(from);for(const attr of to.attributes)if(!/^on/i.test(attr.name)&&!['src','autoplay'].includes(attr.name))canvas.setAttribute(attr.name,attr.value);canvas.width=from.videoWidth;canvas.height=from.videoHeight;for(const property of css)canvas.style.setProperty(property,css.getPropertyValue(property),'important');paint.push([from,canvas]);to.replaceWith(canvas);to=canvas;}catch{}
     for(const animation of animations.get(from)||[]){const effect=animation.effect;if(effect?.target!==from)continue;const pseudo=effect.pseudoElement||null,css=source.defaultView.getComputedStyle(from,pseudo),properties=new Set(effect.getKeyframes().flatMap(keyframe=>Object.keys(keyframe)).filter(key=>!['offset','computedOffset','easing','composite'].includes(key))),frozen=d.createElement('span').style;
      for(const key of properties){const property=key.startsWith('--')?key:key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());frozen.setProperty(property,css.getPropertyValue(property),'important');}frozen.setProperty('animation','none','important');frozen.setProperty('transition','none','important');
      if(pseudo){const id=to.getAttribute('data-rt-snapshot-freeze')||String(++frozenId);to.setAttribute('data-rt-snapshot-freeze',id);rules.push('[data-rt-snapshot-freeze="'+id+'"]'+pseudo+'{'+frozen.cssText+'}');}else for(const property of frozen)to.style.setProperty(property,frozen.getPropertyValue(property),'important');
     }
     if(from.shadowRoot)try{const shadow=to.shadowRoot||to.attachShadow({mode:'open'});shadow.replaceChildren(...[...from.shadowRoot.childNodes].map(node=>d.importNode(node,true)));state(from.shadowRoot,shadow);styles(from.shadowRoot,shadow);}catch{}
    }
    toRoot.querySelectorAll('script,iframe,object,embed,meta[http-equiv],base').forEach(el=>el.remove());if(rules.length){const style=d.createElement('style');style.textContent=rules.join('\n');toRoot.append(style);}
   }
   state(source.documentElement,tree);const base=d.createElement('base'),policy=d.createElement('meta');base.href=source.baseURI;policy.httpEquiv='Content-Security-Policy';policy.content="script-src 'none'; object-src 'none'; frame-src 'none'";tree.querySelector('head')?.prepend(policy,base);styles(source,tree.querySelector('head')||tree);d.replaceChild(tree,d.documentElement);for(const [from,to]of paint)try{to.getContext('2d').drawImage(from,0,0);}catch{}
   for(const [el,x,y]of scroll)el.scrollTo({left:x,top:y,behavior:'instant'});copy.contentWindow.scrollTo({left:frame.contentWindow.scrollX,top:frame.contentWindow.scrollY,behavior:'instant'});
   return copy;
  }catch(error){copy.remove();throw error;}
 }
 function begin(config,scroll){clear();if(!config||config.type==='instant'||root.matchMedia('(prefers-reduced-motion: reduce)').matches)return;try{const copy=snapshot(),status=document.createElement('div');status.className='prototype-navigation-loading';status.setAttribute('role','status');status.textContent='Loading page…';stage.append(status);current={copy,status,config,scroll,controller:new AbortController(),motion:null,inert:frame.inert,visibility:frame.style.visibility,overflow:stage.style.overflow};frame.inert=true;frame.style.visibility='hidden';stage.style.overflow='hidden';}catch{clear();}}
 async function loaded(prepare){const entry=current;if(!entry){await prepare?.();return;}const ready=await M.ready(frame,entry.controller.signal);if(!ready||current!==entry)return;await prepare?.();if(current!==entry)return;
  try{frame.contentWindow.scrollTo({left:entry.scroll?.x||0,top:entry.scroll?.y||0,behavior:'instant'});}catch{}
  entry.status.hidden=true;frame.style.visibility=entry.visibility;const direction=entry.config.direction,vector=direction==='left'?[-stage.clientWidth,0]:direction==='top'?[0,-stage.clientHeight]:direction==='bottom'?[0,stage.clientHeight]:[stage.clientWidth,0];
  entry.motion=entry.config.type==='smart-animate'?root.RetouchPrototypeSmart.play({old:entry.copy,next:frame,config:entry.config}):M.play({old:entry.copy,next:frame,config:entry.config,vector});await entry.motion.finished;if(current===entry){clear();frame.focus({preventScroll:true});}
 }
 root.RetouchPrototypeNavigation={begin,loaded,clear,get busy(){return !!current;},get animations(){return current?.motion?.animations||[];}};
})(window);
