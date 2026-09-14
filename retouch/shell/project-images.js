(function(root){
 'use strict';
 async function thumbnail(blob,signal){
  if(signal.aborted)throw Error('Preview canceled');
  const raw=URL.createObjectURL(blob),image=new Image();let timer,abort;
  try{await new Promise((resolve,reject)=>{abort=()=>{image.src='';reject(Error('Preview canceled'));};signal.addEventListener('abort',abort,{once:true});timer=setTimeout(abort,15000);image.onload=resolve;image.onerror=()=>reject(Error('Preview unavailable'));image.src=raw;});const scale=Math.min(1,128/image.naturalWidth,96/image.naturalHeight),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);const small=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!small)throw Error('Preview unavailable');return URL.createObjectURL(small);}finally{clearTimeout(timer);signal.removeEventListener('abort',abort);URL.revokeObjectURL(raw);}
 }
 async function open({list,preview,current,onSelect}){
  if(document.querySelector('dialog[open]'))return;
  const I=root.RetouchInspector,opener=document.activeElement,dialog=document.createElement('dialog'),header=document.createElement('header'),heading=document.createElement('h2'),search=document.createElement('input'),grid=document.createElement('div'),status=document.createElement('p'),controller=new AbortController(),urls=new Set();
  dialog.className='quick-actions project-images-dialog';dialog.setAttribute('aria-label','Project images');heading.textContent='Project images';search.type='search';search.placeholder='Find an image…';search.setAttribute('aria-label','Find a project image');grid.className='project-images-grid';status.setAttribute('role','status');status.textContent='Loading images…';let saving=false,items=[],queue=[],active=0;
  const close=I.button('Close',()=>{if(!saving)dialog.close();});header.append(heading,close);dialog.append(header,search,grid,status);document.body.append(dialog);
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){const item=entry.target.imageEntry;if(entry.isIntersecting&&!item.started){item.started=true;queue.push(item);}}pump();},{root:grid,rootMargin:'100px'});
  function pump(){while(active<3&&queue.length&&dialog.open){const item=queue.shift();if(item.button.hidden){item.started=false;continue;}active++;(async()=>{try{const blob=await preview(item.src,controller.signal),url=await thumbnail(blob,controller.signal);if(!dialog.open){URL.revokeObjectURL(url);return;}urls.add(url);item.image.src=url;}catch(error){if(dialog.open&&!controller.signal.aborted)item.image.alt='Preview unavailable';}finally{active--;pump();}})();}}
  function filter(){const query=search.value.trim().toLocaleLowerCase();let count=0;for(const item of items){item.button.hidden=!item.path.includes(query);if(!item.button.hidden)count++;if(!item.started){observer.unobserve(item.button);observer.observe(item.button);}}status.textContent=count?count+' image'+(count===1?'':'s'):items.length?'No matching images.':'No project images found. Choose a file to upload.';}
  search.oninput=filter;
  const retry=I.button('Retry loading images',()=>load());retry.hidden=true;dialog.append(retry);
  async function load(){retry.hidden=true;status.textContent='Loading images…';try{
   const result=await list(controller.signal);if(!dialog.open)return;if(!result?.ok)throw Error(result?.reason||result?.error||'Images could not be loaded.');
   items=result.images.map(asset=>{const button=I.button('',async()=>{if(saving)return;if(!current()){status.textContent='The selected layer or screen size changed. Close this picker and try again.';return;}saving=true;close.disabled=search.disabled=true;for(const item of items)item.button.disabled=true;try{await onSelect(asset.src);dialog.close();}catch(error){status.textContent=error.message;}finally{saving=false;close.disabled=search.disabled=false;for(const item of items)item.button.disabled=false;}}),image=document.createElement('img'),label=document.createElement('span');image.alt='';label.textContent=asset.name.replace(/^rt-[a-f0-9]{12}-/,'');button.title=asset.src;button.setAttribute('aria-label','Use project image '+asset.src);button.append(image,label);const item={...asset,button,image,path:decodeURIComponent(asset.src).toLocaleLowerCase(),started:false};button.imageEntry=item;grid.append(button);observer.observe(button);return item;});filter();
  }catch(error){if(dialog.open){status.textContent=error.message;retry.hidden=false;}}}
  dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});dialog.addEventListener('close',()=>{controller.abort();observer.disconnect();queue=[];for(const url of urls)URL.revokeObjectURL(url);dialog.remove();if(opener?.isConnected)opener.focus({preventScroll:true});});dialog.showModal();search.focus();await load();
 }
 root.RetouchProjectImages={open};
})(window);
