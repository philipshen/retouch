(function(root){
 'use strict';
 const frame=document.getElementById('app'),stage=document.getElementById('siteStage'),M=root.RetouchPrototypeMotion;let current=null;
 function clear(){const entry=current;if(!entry)return;current=null;entry.controller.abort();entry.motion?.cancel();entry.copy.remove();entry.status.remove();frame.inert=entry.inert;frame.style.visibility=entry.visibility;stage.style.overflow=entry.overflow;}
 function snapshot(){
  const source=frame.contentDocument,copy=document.createElement('iframe');copy.className='prototype-navigation-snapshot';copy.title='Outgoing prototype page';copy.setAttribute('aria-hidden','true');copy.setAttribute('sandbox','allow-same-origin');copy.inert=true;stage.append(copy);
  try{
   const d=copy.contentDocument,tree=d.importNode(source.documentElement,true),scroll=[];
   function styles(from,to){for(const sheet of from.adoptedStyleSheets||[])try{const style=d.createElement('style');style.textContent=[...sheet.cssRules].map(rule=>rule.cssText).join('\n');to.append(style);}catch{}}
   function state(fromRoot,toRoot){const original=[...(fromRoot.nodeType===1?[fromRoot]:[]),...fromRoot.querySelectorAll('*')],cloned=[...(toRoot.nodeType===1?[toRoot]:[]),...toRoot.querySelectorAll('*')];
    for(let i=0;i<original.length;i++){const from=original[i],to=cloned[i];if(!to)continue;for(const attribute of [...to.attributes])if(/^on/i.test(attribute.name))to.removeAttribute(attribute.name);if(from.scrollLeft||from.scrollTop)scroll.push([to,from.scrollLeft,from.scrollTop]);
     if(from.localName==='input'){to.value=from.value;to.checked=from.checked;}else if(from.localName==='textarea')to.value=from.value;else if(from.localName==='option')to.selected=from.selected;
     if(from.localName==='canvas')try{const image=d.createElement('img');for(const attr of to.attributes)image.setAttribute(attr.name,attr.value);image.src=from.toDataURL();image.width=from.width;image.height=from.height;to.replaceWith(image);}catch{}
     if(from.shadowRoot)try{const shadow=to.shadowRoot||to.attachShadow({mode:'open'});shadow.replaceChildren(...[...from.shadowRoot.childNodes].map(node=>d.importNode(node,true)));state(from.shadowRoot,shadow);styles(from.shadowRoot,shadow);}catch{}
    }
    toRoot.querySelectorAll('script,iframe,object,embed,meta[http-equiv],base').forEach(el=>el.remove());
   }
   state(source.documentElement,tree);const base=d.createElement('base');base.href=source.baseURI;tree.querySelector('head')?.prepend(base);styles(source,tree.querySelector('head')||tree);d.replaceChild(tree,d.documentElement);
   for(const [el,x,y]of scroll)el.scrollTo({left:x,top:y,behavior:'instant'});copy.contentWindow.scrollTo({left:frame.contentWindow.scrollX,top:frame.contentWindow.scrollY,behavior:'instant'});
   return copy;
  }catch(error){copy.remove();throw error;}
 }
 function begin(config,scroll){clear();if(!config||config.type==='instant'||root.matchMedia('(prefers-reduced-motion: reduce)').matches)return;try{const copy=snapshot(),status=document.createElement('div');status.className='prototype-navigation-loading';status.setAttribute('role','status');status.textContent='Loading page…';stage.append(status);current={copy,status,config,scroll,controller:new AbortController(),motion:null,inert:frame.inert,visibility:frame.style.visibility,overflow:stage.style.overflow};frame.inert=true;frame.style.visibility='hidden';stage.style.overflow='hidden';}catch{clear();}}
 async function loaded(){const entry=current;if(!entry)return;const ready=await M.ready(frame,entry.controller.signal);if(!ready||current!==entry)return;
  try{frame.contentWindow.scrollTo({left:entry.scroll?.x||0,top:entry.scroll?.y||0,behavior:'instant'});}catch{}
  entry.status.hidden=true;frame.style.visibility=entry.visibility;const direction=entry.config.direction,vector=direction==='left'?[-stage.clientWidth,0]:direction==='top'?[0,-stage.clientHeight]:direction==='bottom'?[0,stage.clientHeight]:[stage.clientWidth,0];
  entry.motion=M.play({old:entry.copy,next:frame,config:entry.config,vector});await entry.motion.finished;if(current===entry){clear();frame.focus({preventScroll:true});}
 }
 root.RetouchPrototypeNavigation={begin,loaded,clear,get busy(){return !!current;},get animations(){return current?.motion?.animations||[];}};
})(window);
