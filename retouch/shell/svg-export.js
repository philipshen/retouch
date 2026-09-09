(function(root){
 'use strict';
 const properties=['x','y','width','height','cx','cy','r','rx','ry','d','color','fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','opacity','display','visibility','clip-path','clip-rule','mask','filter','marker-start','marker-mid','marker-end','stop-color','stop-opacity','flood-color','flood-opacity','lighting-color','paint-order','vector-effect','shape-rendering','text-rendering','image-rendering','font-family','font-size','font-weight','font-style','font-stretch','font-variant','font-variant-numeric','font-feature-settings','letter-spacing','word-spacing','text-anchor','dominant-baseline','alignment-baseline','text-decoration','white-space','transform','transform-origin','transform-box'];
 function snapshot(target){
  const svg=target?.closest('svg');if(!svg)throw Error('Select an SVG canvas or a shape inside it.');
  if(svg.querySelector('use'))throw Error('Export of linked SVG symbol instances is not supported yet.');
  if(svg.querySelector('animate,animateMotion,animateTransform,set'))throw Error('Export of SVG animations is not supported yet.');
  const d=svg.ownerDocument,w=d.defaultView,roots=[svg],queue=[svg,...svg.querySelectorAll('*')],styles=new Map(),links=new Map();
  function reference(href,collect=true){
   let url;try{url=new URL(href,d.baseURI);}catch{return href;}
   if(url.protocol==='javascript:')return '';
   if(url.hash&&url.href.split('#')[0]===d.URL.split('#')[0]&&collect){
    const id=decodeURIComponent(url.hash.slice(1)),definition=d.getElementById(id);
    if(!definition)throw Error('Missing SVG definition: '+id);
    if(!roots.some(root=>root.contains(definition))){
     if(definition.namespaceURI!==svg.namespaceURI||!['linearGradient','radialGradient','clipPath','mask','filter','marker','pattern'].includes(definition.localName))throw Error('Unsupported shared SVG definition: '+id);
     for(let i=roots.length-1;i>0;i--)if(definition.contains(roots[i]))roots.splice(i,1);
     roots.push(definition);queue.push(definition,...definition.querySelectorAll('*'));
    }
    return url.hash;
   }
   return url.href;
  }
  const localURL=value=>value.replace(/url\(["']?([^"')]+)["']?\)/g,(whole,href)=>{const url=reference(href);return url?'url("'+url+'")':'none';});
  for(let i=0;i<queue.length;i++){
   const original=queue[i];if(styles.has(original))continue;
   if(original.localName==='use')throw Error('Export of linked SVG symbol instances is not supported yet.');
   if(/^(animate|animateMotion|animateTransform|set)$/i.test(original.localName))throw Error('Export of SVG animations is not supported yet.');
   const css=w.getComputedStyle(original),values=[];styles.set(original,values);
   for(const property of properties){const value=css.getPropertyValue(property);if(value)values.push([property,localURL(value)]);}
   const hrefs=[];links.set(original,hrefs);
   for(const attr of original.attributes)if(attr.localName==='href'){
    const value=reference(attr.value,['linearGradient','radialGradient','pattern'].includes(original.localName));
    hrefs.push([attr.namespaceURI,attr.name,/^(?:https?:|data:|blob:|#)/.test(value)?value:null]);
   }
  }
  const copy=svg.cloneNode(true),pairs=[];
  function pair(original,clone){const a=[original,...original.querySelectorAll('*')],b=[clone,...clone.querySelectorAll('*')];for(let i=0;i<a.length;i++)pairs.push([a[i],b[i]]);}
  pair(svg,copy);
  if(roots.length>1){const defs=d.createElementNS(svg.namespaceURI,'defs');copy.prepend(defs);for(const definition of roots.slice(1)){const clone=definition.cloneNode(true);defs.append(clone);pair(definition,clone);}}
  for(const [original,node]of pairs){
   if(/^(script|style)$/i.test(node.localName)){node.remove();continue;}
   for(const attr of [...node.attributes])if(/^data-rt(?:-|$)|^on/i.test(attr.name))node.removeAttribute(attr.name);
   for(const [property,value]of styles.get(original)||[])node.style.setProperty(property,value,'important');
   for(const [namespace,name,value]of links.get(original)||[]){if(value===null)node.removeAttribute(name);else node.setAttributeNS(namespace,name,value);}
  }
  const css=w.getComputedStyle(svg),rect=svg.getBoundingClientRect(),width=parseFloat(css.width)||rect.width,height=parseFloat(css.height)||rect.height;
  if(!(width>0&&height>0))throw Error('This SVG canvas has no visible dimensions.');
  copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('width',String(width));copy.setAttribute('height',String(height));copy.style.width=width+'px';copy.style.height=height+'px';
  return {text:new XMLSerializer().serializeToString(copy),width,height,name:(svg.getAttribute('aria-label')||svg.id||'retouch-canvas').replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,80)||'retouch-canvas'};
 }
 async function embedImages(parsed,target){
  const cache=new Map();let total=0;
  for(const image of parsed.querySelectorAll('image')){
   const href=image.getAttributeNode('href')||image.getAttributeNodeNS('http://www.w3.org/1999/xlink','href');
   const attributes=href?[href]:[];for(const attr of [...image.attributes])if(attr.localName==='href'&&attr!==href)image.removeAttributeNode(attr);
   for(const attr of attributes){
    const href=attr.value;if(href.startsWith('data:')||href.startsWith('#'))continue;
    if(!cache.has(href)){
     const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
     try{
      const response=await target.ownerDocument.defaultView.fetch(href,{signal:controller.signal,credentials:'same-origin'});
      if(!response.ok)throw Error('Could not embed image (HTTP '+response.status+').');
      const type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
      if(!/^image\/(png|jpeg|webp|gif|avif)$/.test(type))throw Error('Image embedding currently supports PNG, JPEG, WebP, GIF and AVIF.');
      const reader=response.body.getReader(),chunks=[];let size=0;
      while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;total+=value.byteLength;if(size>16*1024*1024||total>64*1024*1024){await reader.cancel();throw Error('Embedded images exceed the export limit (16 MB per image, 64 MB total).');}chunks.push(value);}
      const blob=new Blob(chunks,{type}),testURL=URL.createObjectURL(blob);
      try{const bitmap=new Image();bitmap.src=testURL;await bitmap.decode();}catch{throw Error('Could not decode a linked bitmap image.');}finally{URL.revokeObjectURL(testURL);}
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not encode the embedded image.'));reader.readAsDataURL(blob);});cache.set(href,data);
     }catch(error){if(error.name==='AbortError')throw Error('Image embedding timed out. Try exporting again.');throw error;}finally{clearTimeout(timer);controller.abort();}
    }
    image.setAttributeNS(attr.namespaceURI,attr.name,cache.get(href));
   }
  }
 }
 async function prepared(target){const result=snapshot(target),parsed=new DOMParser().parseFromString(result.text,'image/svg+xml');await embedImages(parsed,target);return {...result,text:new XMLSerializer().serializeToString(parsed.documentElement)};}
 function save(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 async function download(target,embed=true){const result=embed?await prepared(target):snapshot(target);save(new Blob([result.text],{type:'image/svg+xml'}),result.name+'.svg');return result;}
 async function raster(target,scale=1,format='png',options={}){
  const {quality=92,background='#ffffff'}=options;
  if(format==='jpeg'&&(!Number.isInteger(quality)||quality<1||quality>100||!/^#[a-f0-9]{6}$/i.test(background)))throw Error('Choose JPEG quality from 1–100 and a six-digit background color.');
  if(!['png','jpeg'].includes(format))throw Error('Choose PNG or JPEG.');
  if(![1,2,3,4].includes(scale))throw Error('Choose an image scale from 1× to 4×.');
  const result=snapshot(target),parsed=new DOMParser().parseFromString(result.text,'image/svg+xml');
  if(parsed.querySelector('text,foreignObject'))throw Error('Raster export with text or embedded HTML is not supported yet.');
  const width=Math.ceil(result.width*scale),height=Math.ceil(result.height*scale);
  if(width>16384||height>16384||width*height>32000000)throw Error('Choose a smaller scale: Raster exports support up to 32 million pixels and 16,384 pixels per side.');
  await embedImages(parsed,target);result.text=new XMLSerializer().serializeToString(parsed.documentElement);
  for(const node of parsed.querySelectorAll('*')){
   const urls=[...(node.getAttribute('style')||'').matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(match=>match[1]);
   if(node.localName!=='a')for(const attr of node.attributes)if(attr.localName==='href')urls.push(attr.value);
   if(urls.some(url=>!url.startsWith('#')&&!url.startsWith('data:')))throw Error('Embed linked images and external SVG resources before raster export.');
  }
  const url=URL.createObjectURL(new Blob([result.text],{type:'image/svg+xml'}));
  try{
   const image=new Image();image.src=url;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');if(!context)throw Error('Could not create the export canvas.');if(format==='jpeg'){context.fillStyle=background;context.fillRect(0,0,width,height);}context.drawImage(image,0,0,width,height);
   const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Could not encode the image.')),'image/'+format,quality/100));
   return {...result,width,height,blob};
  }finally{URL.revokeObjectURL(url);}
 }
 const png=(target,scale=1)=>raster(target,scale,'png');
 const jpeg=(target,scale=1,options={})=>raster(target,scale,'jpeg',options);
 async function downloadJPEG(target,scale=1,options={}){const result=await jpeg(target,scale,options);save(result.blob,result.name+(scale===1?'':'@'+scale+'x')+'.jpg');return result;}
 async function downloadPNG(target,scale=1){const result=await png(target,scale);save(result.blob,result.name+(scale===1?'':'@'+scale+'x')+'.png');return result;}
 root.RetouchSVGExport={snapshot,prepared,download,png,jpeg,downloadPNG,downloadJPEG};
})(window);
