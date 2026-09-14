(function(root){
 'use strict';
 function mount({popup,group,row,source,index,current,currentPaint,upload,replace}){
  const I=root.RetouchInspector,C=root.RetouchImageCrop,controls=document.createElement('div'),status=document.createElement('p');controls.className='image-opacity-controls';status.className='image-fill-status';status.setAttribute('role','status');group.append(controls);
  let model=null,loading=null,saving=false;
  const eye=I.button('Toggle image paint '+(index+1)+' visibility',async()=>{if(!model){popup.retouchOpen();await load();return;}await apply({hidden:!model.hidden});});eye.classList.add('paint-visibility');row.insertBefore(eye,row.querySelector('[aria-label="Remove paint '+(index+1)+'"]'));
  const input=I.number(controls,'Paint '+(index+1)+' opacity (%)',NaN,0,100,value=>{if(model&&value!==(model.opacity??1)*100)return apply({opacity:value/100});});input.disabled=true;input.placeholder='Loading';input.closest('label').querySelector('span').textContent='Opacity (%)';
  const inline=I.number(row,'Image paint '+(index+1)+' opacity (%)',NaN,0,100,value=>{if(model&&value!==(model.opacity??1)*100)return apply({opacity:value/100});}),inlineField=inline.closest('label');inlineField.classList.add('paint-row-opacity');inlineField.querySelector('span').textContent='%';inline.placeholder='—';row.querySelector('.paint-row-more').before(inlineField);
  const retry=I.button('Retry paint '+(index+1)+' opacity',()=>load());retry.textContent='Retry opacity';retry.setAttribute('aria-label','Retry paint '+(index+1)+' opacity');retry.hidden=true;controls.append(status,retry);
  function sync(){
   const hidden=!!model?.hidden,name=(model?(hidden?'Show':'Hide'):'Load')+' image paint '+(index+1);
   eye.setAttribute('aria-label',name);eye.title=name;eye.disabled=saving||!!loading;eye.setAttribute('aria-pressed',String(hidden));eye.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'+(hidden?'<path d="m3 3 18 18"/>':'')+'</svg>';row.classList.toggle('paint-hidden',hidden);for(const control of [input,inline]){control.disabled=!model||saving;if(model)control.value=String((model.opacity??1)*100);}
  }
  async function apply(patch){
   if(!model||saving||!current())return;
   let keepFocus=Object.hasOwn(patch,'hidden')&&document.activeElement===eye;const focusEvents=['pointerdown','keydown','input','change','blur'],cancelFocus=event=>{if(event.type!=='blur'||event.target===root)keepFocus=false;};if(keepFocus)for(const event of focusEvents)root.addEventListener(event,cancelFocus,true);
   saving=true;sync();if(Object.hasOwn(patch,'opacity'))for(const control of [input,inline])control.value=String(patch.opacity*100);status.textContent='Applying paint…';
   try{const next={...model,...patch},blob=new Blob([C.markup(next)],{type:'image/svg+xml'}),url=await upload(new File([blob],'opacity-paint.svg',{type:'image/svg+xml'}));if(!currentPaint())throw Error('The paint changed before it could be applied.');if(keepFocus)root.RetouchPanelFocus?.queue(eye.isConnected?eye:document.querySelectorAll('.paint-stack-fields > .paint-order > .paint-order-row')[index]?.querySelector('.paint-visibility'),(patch.hidden?'Show':'Hide')+' image paint '+(index+1));await replace(url,true);model=next;status.textContent='';}
   catch(error){status.textContent=error.message;if(current())popup.retouchOpen();}
   finally{for(const event of focusEvents)root.removeEventListener(event,cancelFocus,true);saving=false;sync();}
  }
  async function load(){
   if(model||loading||!current())return;const controller=new AbortController();loading=controller;sync();let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},15000),observer=new MutationObserver(()=>{if(!current())controller.abort();});observer.observe(document.body,{childList:true,subtree:true});retry.hidden=true;status.textContent='';input.placeholder='Loading';
   let cancel;const aborted=new Promise((_,reject)=>{cancel=()=>reject(new DOMException('Image loading canceled','AbortError'));controller.signal.addEventListener('abort',cancel,{once:true});});
   try{await Promise.race([source.decode(),aborted]);controller.signal.removeEventListener('abort',cancel);const next=await C.load(source,controller.signal);if(!current()||controller.signal.aborted)return;model=next;input.placeholder='';}
   catch(error){if(current()){status.textContent=timedOut?'Image opacity took too long to load. Try again.':error.message;input.placeholder='Unavailable';retry.hidden=false;}}
   finally{clearTimeout(timer);observer.disconnect();controller.signal.removeEventListener('abort',cancel);if(loading===controller)loading=null;sync();}
  }
  popup.addEventListener('beforetoggle',event=>{if(event.newState==='open'&&!retry.hidden)return;if(event.newState==='open')load();});
  sync();queueMicrotask(load);
 }
 root.RetouchImageOpacity={mount};
})(window);
