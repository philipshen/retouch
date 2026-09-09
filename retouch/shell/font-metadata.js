(function(root){
 'use strict';
 const cache=new Map(),choices=new Map(),limit=16*1024*1024;
 function sources(d,family){
  const match=/^\s*(?:"([^"]*)"|'([^']*)'|([^,]+))/.exec(family||''),primary=(match?.[1]??match?.[2]??match?.[3]??'').trim(),found=new Map(),seen=new Set();let visited=0,partial=false;
  const normalize=value=>value.trim().replace(/^["']|["']$/g,'').toLowerCase();
  function rules(list,depth=0){
   if(depth>32){partial=true;return;}
   for(const rule of list){
    if(++visited>30000){partial=true;return;}
    if(rule.type===5&&normalize(rule.style.getPropertyValue('font-family'))===primary.toLowerCase()){
     const src=rule.style.getPropertyValue('src');
     for(const match of src.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/g)){
      let url;try{url=new URL(match[1]??match[2]??match[3],rule.parentStyleSheet?.href||d.baseURI);}catch{continue;}
      if(!['http:','https:','data:','blob:'].includes(url.protocol))continue;
      const file=url.protocol==='data:'?'Embedded font':url.protocol==='blob:'?'Page font':url.pathname.split('/').pop()||'Font file';
      if(!found.has(url.href)){if(found.size>=32){partial=true;continue;}found.set(url.href,{url:url.href,label:primary+' · '+(rule.style.getPropertyValue('font-weight')||'normal')+' · '+file});}
     }
    }else if(rule.type===3){if(!rule.media.mediaText||d.defaultView.matchMedia(rule.media.mediaText).matches)sheet(rule.styleSheet,depth+1);}
    else if(rule.cssRules){if(rule.type===4&&!d.defaultView.matchMedia(rule.conditionText).matches)continue;if(rule.type===12&&!d.defaultView.CSS.supports(rule.conditionText))continue;rules(rule.cssRules,depth+1);}
   }
  }
  function sheet(value,depth=0){if(!value||seen.has(value)||value.disabled)return;seen.add(value);if(value.media?.mediaText&&!d.defaultView.matchMedia(value.media.mediaText).matches)return;try{rules(value.cssRules,depth);}catch{partial=true;}}
  for(const value of [...d.styleSheets,...(d.adoptedStyleSheets||[])])sheet(value);
  return {family:primary,files:[...found.values()].slice(0,32),partial:partial||found.size>32};
 }
 const key=(d,value)=>d.location.origin+'\n'+value;
 function selection(d,family,url){const id=key(d,family);if(url!==undefined){if(choices.size>=32&&!choices.has(id))choices.delete(choices.keys().next().value);choices.set(id,url);}return choices.get(id);}
 async function cacheKey(d,url){const value=key(d,url);if(value.length<=2048)return value;if(root.crypto?.subtle){try{const digest=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return 'sha256:'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');}catch{}}return value;}
 async function peek(d,url){const id=await cacheKey(d,url),entry=cache.get(id);if(entry&&Date.now()-entry.time<300000)return entry.details;cache.delete(id);}

 async function inspect(d,url){
  const id=await cacheKey(d,url);cache.delete(id);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
   const response=await d.defaultView.fetch(url,{signal:controller.signal,credentials:'same-origin'});if(!response.ok)throw Error('Could not read font file (HTTP '+response.status+').');
   const reader=response.body.getReader(),chunks=[];let size=0;
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('Font files must be 16 MB or smaller.');}chunks.push(value);}
   const result=await root.fetch('/rt/__api/font-axes',{method:'POST',headers:{'x-retouch-token':root.__RT_TOKEN,'content-type':'application/octet-stream'},body:new Blob(chunks),signal:controller.signal});
   const metadata=await result.json();if(!result.ok||!metadata.ok)throw Error(metadata.reason||'Could not inspect font axes.');
   const details={axes:metadata.axes,instances:metadata.instances||[]};
   if(id.length<=2*1024*1024){while(cache.size>=32||[...cache.keys()].reduce((sum,value)=>sum+value.length,0)+id.length>2*1024*1024)cache.delete(cache.keys().next().value);cache.set(id,{details,time:Date.now()});}return details;
  }catch(error){if(error.name==='AbortError')throw Error('Font inspection timed out.');throw error;}finally{clearTimeout(timer);controller.abort();}
 }
 root.RetouchFontMetadata={sources,peek,inspect,selection};
})(window);
