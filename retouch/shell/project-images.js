(function(root){
 'use strict';
 async function thumbnail(blob,signal){
  if(signal.aborted)throw Error('Preview canceled');
  const raw=URL.createObjectURL(blob),image=new Image();let timer,abort;
  try{await new Promise((resolve,reject)=>{abort=()=>{image.src='';reject(Error('Preview canceled'));};signal.addEventListener('abort',abort,{once:true});timer=setTimeout(abort,15000);image.onload=resolve;image.onerror=()=>reject(Error('Preview unavailable'));image.src=raw;});const scale=Math.min(1,128/image.naturalWidth,96/image.naturalHeight),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const small=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!small)throw Error('Preview unavailable');return URL.createObjectURL(small);}finally{clearTimeout(timer);signal.removeEventListener('abort',abort);URL.revokeObjectURL(raw);}
 }
 async function open({list,preview,current,onSelect}){
  if(document.querySelector('dialog[open]'))return;
  const I=root.RetouchInspector,opener=document.activeElement,dialog=document.createElement('dialog'),header=document.createElement('header'),heading=document.createElement('h2'),search=document.createElement('input'),grid=document.createElement('div'),status=document.createElement('p'),urls=new Set();
  dialog.className='quick-actions project-images-dialog';dialog.setAttribute('aria-label','Project images');heading.textContent='Project images';search.type='search';search.maxLength=256;search.placeholder='Find an image…';search.setAttribute('aria-label','Find a project image');grid.className='project-images-grid';status.setAttribute('role','status');
  let saving=false,items=[],queue=[],active=0,generation=0,request=null,previews=new AbortController(),timer,nextOffset=0,query='',loading=false;
  const close=I.button('Close',()=>{if(!saving)dialog.close();}),more=I.button('Load more images',()=>load()),retry=I.button('Retry loading images',()=>load());more.hidden=retry.hidden=true;header.append(heading,close);dialog.append(header,search,grid,status,more,retry);document.body.append(dialog);
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){const item=entry.target.imageEntry;if(entry.isIntersecting&&!item.started&&item.generation===generation){item.started=true;queue.push(item);}}pump();},{root:grid,rootMargin:'100px'});
  function pump(){while(active<3&&queue.length&&dialog.open){const item=queue.shift(),signal=previews.signal;if(item.generation!==generation)continue;active++;(async()=>{try{const blob=await preview(item.src,signal),url=await thumbnail(blob,signal);if(!dialog.open||item.generation!==generation){URL.revokeObjectURL(url);return;}urls.add(url);item.image.src=url;}catch(error){if(dialog.open&&!signal.aborted)item.image.alt='Preview unavailable';}finally{active--;pump();}})();}}
  function card(asset){
   const button=I.button('',async()=>{if(saving)return;if(!current()){status.textContent='The selected layer or screen size changed. Close this picker and try again.';return;}saving=true;close.disabled=search.disabled=more.disabled=true;for(const item of items)item.button.disabled=true;try{await onSelect(asset.src);dialog.close();}catch(error){status.textContent=error.message;}finally{saving=false;close.disabled=search.disabled=more.disabled=false;for(const item of items)item.button.disabled=false;}}),image=document.createElement('img'),label=document.createElement('span');image.alt='';label.textContent=asset.name.replace(/^rt-[a-f0-9]{12}-/,'');button.title=asset.src;button.setAttribute('aria-label','Use project image '+asset.src);button.disabled=saving;button.append(image,label);const item={...asset,button,image,started:false,generation};button.imageEntry=item;grid.append(button);observer.observe(button);return item;
  }
  function searchImages(delay=0){
   generation++;clearTimeout(timer);request?.abort();previews.abort();previews=new AbortController();observer.disconnect();queue=[];items=[];grid.replaceChildren();for(const url of urls)URL.revokeObjectURL(url);urls.clear();query=search.value.trim();nextOffset=0;loading=false;more.hidden=retry.hidden=true;status.textContent='Loading images…';if(delay)timer=setTimeout(()=>load(),delay);else return load();
  }
  search.oninput=()=>searchImages(150);
  dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(!saving)dialog.close();}});
  async function load(){if(loading||!dialog.open||nextOffset===null)return;const epoch=generation;request=new AbortController();const signal=request.signal;loading=true;retry.hidden=true;more.disabled=true;status.textContent='Loading images…';try{
   const result=await list({query,offset:nextOffset,signal});if(!dialog.open||epoch!==generation)return;if(!result?.ok)throw Error(result?.reason||result?.error||'Images could not be loaded.');
   const known=new Set(items.map(item=>item.src));for(const asset of result.images)if(!known.has(asset.src)){known.add(asset.src);items.push(card(asset));}nextOffset=result.nextOffset??null;more.hidden=nextOffset===null;
   status.textContent=result.total?items.length+' of '+result.total+' image'+(result.total===1?'':'s'):query?'No matching images.':'No project images found. Choose a file to upload.';
  }catch(error){if(dialog.open&&epoch===generation&&!signal.aborted){status.textContent=error.message;retry.hidden=false;}}finally{if(epoch===generation){loading=false;more.disabled=saving;}}}
  dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});dialog.addEventListener('close',()=>{clearTimeout(timer);request?.abort();previews.abort();observer.disconnect();queue=[];for(const url of urls)URL.revokeObjectURL(url);dialog.remove();if(opener?.isConnected){opener.closest('[popover]')?.retouchOpen?.();opener.focus({preventScroll:true});}});dialog.showModal();search.focus();await searchImages();
 }
 root.RetouchProjectImages={open};
})(window);
