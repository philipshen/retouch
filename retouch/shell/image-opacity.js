(function(root){
 'use strict';
 function mount({popup,group,source,index,current,upload,replace}){
  const I=root.RetouchInspector,C=root.RetouchImageCrop,controls=document.createElement('div'),status=document.createElement('p');controls.className='image-opacity-controls';status.className='image-fill-status';status.setAttribute('role','status');group.append(controls);
  let model=null,loading=null,saving=false;
  const input=I.number(controls,'Paint '+(index+1)+' opacity (%)',NaN,0,100,async value=>{
   if(!model||saving||!current()||value===(model.opacity??1)*100)return;
   saving=true;input.disabled=true;status.textContent='Applying opacity…';
   try{const blob=new Blob([C.markup({...model,opacity:value/100})],{type:'image/svg+xml'}),url=await upload(new File([blob],'opacity-paint.svg',{type:'image/svg+xml'}));if(!current())throw Error('The paint changed before opacity could be applied.');await replace(url,true);status.textContent='';}
   catch(error){status.textContent=error.message;input.value=String((model.opacity??1)*100);}
   finally{saving=false;input.disabled=!model;}
  });input.disabled=true;input.placeholder='Loading';input.closest('label').querySelector('span').textContent='Opacity (%)';
  const retry=I.button('Retry paint '+(index+1)+' opacity',()=>load());retry.textContent='Retry opacity';retry.setAttribute('aria-label','Retry paint '+(index+1)+' opacity');retry.hidden=true;controls.append(status,retry);
  async function load(){
   if(model||loading||!current())return;const controller=new AbortController();loading=controller;let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},15000),observer=new MutationObserver(()=>{if(!current())controller.abort();});observer.observe(document.body,{childList:true,subtree:true});retry.hidden=true;status.textContent='';input.placeholder='Loading';
   let cancel;const aborted=new Promise((_,reject)=>{cancel=()=>reject(new DOMException('Image loading canceled','AbortError'));controller.signal.addEventListener('abort',cancel,{once:true});});
   try{await Promise.race([source.decode(),aborted]);controller.signal.removeEventListener('abort',cancel);const next=await C.load(source,controller.signal);if(!current()||controller.signal.aborted)return;model=next;input.value=String((model.opacity??1)*100);input.disabled=false;input.placeholder='';}
   catch(error){if(current()){status.textContent=timedOut?'Image opacity took too long to load. Try again.':error.message;input.placeholder='Unavailable';retry.hidden=false;}}
   finally{clearTimeout(timer);observer.disconnect();controller.signal.removeEventListener('abort',cancel);if(loading===controller)loading=null;}
  }
  popup.addEventListener('beforetoggle',event=>{if(event.newState==='open')load();});
 }
 root.RetouchImageOpacity={mount};
})(window);
