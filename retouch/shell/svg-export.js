(function(root){
 'use strict';
 const properties=['x','y','width','height','cx','cy','r','rx','ry','d','color','fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','opacity','display','visibility','clip-path','clip-rule','mask','filter','marker-start','marker-mid','marker-end','stop-color','stop-opacity','flood-color','flood-opacity','lighting-color','paint-order','vector-effect','shape-rendering','text-rendering','image-rendering','font-family','font-size','font-weight','font-style','font-stretch','font-variant','font-variant-numeric','font-feature-settings','font-kerning','font-variation-settings','font-optical-sizing','direction','unicode-bidi','writing-mode','text-orientation','letter-spacing','word-spacing','text-anchor','dominant-baseline','alignment-baseline','text-decoration','white-space','transform','transform-origin','transform-box'];
 function useReferences(svg){
  const d=svg.ownerDocument,definitions=new Set(),instances=new Map(),active=new Set(),visited=new Set();
  const pending=[[svg,false]];
  while(pending.length){
   const [node,leaving]=pending.pop();
   if(leaving){active.delete(node);visited.add(node);continue;}
   if(active.has(node))throw Error('Cyclic SVG symbol reference: '+(node.id||node.localName));
   if(visited.has(node))continue;
   if(visited.size+active.size>=10000)throw Error('SVG symbol references exceed the export limit.');
   active.add(node);pending.push([node,true]);
   for(const child of [...node.children].reverse())pending.push([child,false]);
   if(node.localName==='use'){
    const href=node.getAttribute('href')??node.getAttributeNS('http://www.w3.org/1999/xlink','href');
    if(href){
     let url;try{url=new URL(href,d.baseURI);}catch{throw Error('Invalid SVG symbol reference: '+href);}
     if(!url.hash||url.href.split('#')[0]!==d.URL.split('#')[0])throw Error('External SVG symbol references are not supported yet.');
     let id;try{id=decodeURIComponent(url.hash.slice(1));}catch{throw Error('Invalid SVG symbol reference: '+href);}
     const definition=d.getElementById(id);
     if(!definition)throw Error('Missing SVG definition: '+id);
     if(definition.namespaceURI!==svg.namespaceURI)throw Error('SVG symbol reference targets a non-SVG element: '+id);
     instances.set(node,definition);definitions.add(definition);pending.push([definition,false]);
    }
   }
  }
  return {definitions:[...definitions],instances};
 }
 function snapshot(target){
  const svg=target?.closest('svg');if(!svg)throw Error('Select an SVG canvas or a shape inside it.');
  const reuse=useReferences(svg),reused=new Map();
  if(reuse.definitions.some(node=>!node.closest('defs,symbol')))throw Error('Export of SVG instances that reference visible artwork is not supported yet.');
  for(const definition of reuse.definitions)for(const node of [definition,...definition.querySelectorAll('*')])if(!reused.has(node))reused.set(node,String(reused.size));
  if(svg.querySelector('animate,animateMotion,animateTransform,set'))throw Error('Export of SVG animations is not supported yet.');
  const d=svg.ownerDocument,w=d.defaultView,roots=[svg],queue=[svg,...svg.querySelectorAll('*')],styles=new Map(),links=new Map();
  function reference(href,collect=true,base=d.baseURI){
   let url;try{url=new URL(href,base);}catch{return href;}
   if(url.protocol==='javascript:')return '';
   if(url.hash&&url.href.split('#')[0]===d.URL.split('#')[0]&&collect){
    const id=decodeURIComponent(url.hash.slice(1)),definition=d.getElementById(id);
    if(!definition)throw Error('Missing SVG definition: '+id);
    if(!roots.some(root=>root.contains(definition))){
     if(definition.namespaceURI!==svg.namespaceURI||!['linearGradient','radialGradient','clipPath','mask','filter','marker','pattern','path','symbol','g','svg','use','rect','circle','ellipse','line','polyline','polygon','text','image'].includes(definition.localName))throw Error('Unsupported shared SVG definition: '+id);
     for(let i=roots.length-1;i>0;i--)if(definition.contains(roots[i]))roots.splice(i,1);
     roots.push(definition);queue.push(definition,...definition.querySelectorAll('*'));
    }
    return url.hash;
   }
   return url.href;
  }
  const localURL=(value,base=d.baseURI)=>value.replace(/url\(["']?([^"')]+)["']?\)/g,(whole,href)=>{const url=reference(href,true,base);return url?'url("'+url+'")':'none';});
  // Keep authored declarations on reused subtrees: computed values would freeze
  // fill/currentColor/custom properties before each use instance inherits them.
  function selectors(value){
   const parts=[];let part='',depth=0,quote='',escape=false;
   for(const char of value){
    if(escape){part+=char;escape=false;continue;}
    if(char==='\\'){part+=char;escape=true;continue;}
    if(quote){part+=char;if(char===quote)quote='';continue;}
    if(char==='"'||char==="'")quote=char;
    if(char==='('||char==='[')depth++;if(char===')'||char===']')depth--;
    if(char===','&&!depth){parts.push(part.trim());part='';}else part+=char;
   }
   if(part.trim())parts.push(part.trim());return parts;
  }
  const symbolCandidates=[...reused.keys()],isolated=new Map();
  if(reuse.definitions.some(node=>svg.contains(node))){
   const clone=svg.cloneNode(true),originals=[svg,...svg.querySelectorAll('*')],clones=[clone,...clone.querySelectorAll('*')];
   originals.forEach((node,i)=>isolated.set(node,clones[i]));
  }
  for(const definition of reuse.definitions){const clone=definition.cloneNode(true);symbolCandidates.push(clone,...clone.querySelectorAll('*'));}
  function symbolRules(rules){
   let text='';
   for(const rule of rules){
    if(rule.type===1){
     if(rule.cssRules?.length)throw Error('Symbol export with nested CSS is not supported yet.');
     const selected=selectors(rule.selectorText).filter(selector=>{
      for(const node of reused.keys())if(isolated.has(node)&&node.matches(selector)&&!isolated.get(node).matches(selector))throw Error('Symbol styles depending on ancestors outside this SVG canvas are not supported yet.');
      return symbolCandidates.some(node=>node.matches(selector));
     }).map(selector=>selector+':where([data-export-symbol])');
     if(selected.length)text+=selected.join(',')+'{'+localURL(rule.style.cssText,rule.parentStyleSheet?.href||d.baseURI)+'}';
    }else if(rule.type===4){if(w.matchMedia(rule.conditionText).matches)text+=symbolRules(rule.cssRules);}
    else if(rule.type===12){if(w.CSS.supports(rule.conditionText))text+=symbolRules(rule.cssRules);}
    else if(rule.constructor.name==='CSSLayerBlockRule')text+='@layer '+rule.name+'{'+symbolRules(rule.cssRules)+'}';
    else if(rule.constructor.name==='CSSLayerStatementRule')text+=rule.cssText;
    else if(rule.type===3){
     if((!rule.media.mediaText||w.matchMedia(rule.media.mediaText).matches)&&(!rule.supportsText||w.CSS.supports(rule.supportsText))){
      const imported=symbolRules(rule.styleSheet.cssRules);text+=rule.layerName===null||rule.layerName===undefined?imported:'@layer '+rule.layerName+'{'+imported+'}';
     }
    }
    else if(rule.cssRules)throw Error('Symbol export with '+rule.cssText.split('{')[0].trim()+' is not supported yet.');
   }
   return text;
  }
  let symbolCSS='';
  if(reused.size){
   for(const sheet of [...d.styleSheets,...(d.adoptedStyleSheets||[])]){
    if(sheet.disabled||(sheet.media.mediaText&&!w.matchMedia(sheet.media.mediaText).matches))continue;
    let rules;try{rules=sheet.cssRules;}catch{throw Error('Cannot read a page stylesheet needed to preserve SVG symbol styles.');}
    symbolCSS+=symbolRules(rules);
   }
  }
  for(let i=0;i<queue.length;i++){
   const original=queue[i];if(styles.has(original))continue;
   if(/^(animate|animateMotion|animateTransform|set)$/i.test(original.localName))throw Error('Export of SVG animations is not supported yet.');
   const css=w.getComputedStyle(original),values=[];styles.set(original,values);
   if(reused.has(original))for(const attr of original.attributes)if(attr.value.includes('url('))localURL(attr.value);
   for(const property of properties){const value=css.getPropertyValue(property);if(value)values.push([property,localURL(value)]);}
   const hrefs=[];links.set(original,hrefs);
   const effectiveHref=original.getAttributeNode('href')||original.getAttributeNodeNS('http://www.w3.org/1999/xlink','href');
   for(const attr of original.attributes)if(attr.localName==='href'){
    // Modern href wins even when empty; an obsolete xlink fallback must not
    // collect missing assets or become active again in the exported document.
    if(attr!==effectiveHref||!attr.value){hrefs.push([attr.namespaceURI,attr.name,null]);continue;}
    const value=reference(attr.value,['linearGradient','radialGradient','pattern','textPath','use'].includes(original.localName));
    hrefs.push([attr.namespaceURI,attr.name,/^(?:https?:|data:|blob:|#)/.test(value)?value:null]);
   }
  }
  const copy=svg.cloneNode(true),pairs=[];
  function pair(original,clone){const a=[original,...original.querySelectorAll('*')],b=[clone,...clone.querySelectorAll('*')];for(let i=0;i<a.length;i++)pairs.push([a[i],b[i]]);}
  pair(svg,copy);
  if(roots.length>1){
   const defs=d.createElementNS(svg.namespaceURI,'defs'),ancestors=new Map();copy.prepend(defs);
   for(const definition of roots.slice(1)){
    let container=defs;
    if(reused.has(definition)){
     const chain=[];for(let ancestor=definition.parentElement;ancestor;ancestor=ancestor.parentElement)chain.unshift(ancestor);
     for(const ancestor of chain){
      if(!ancestors.has(ancestor)){
       const wrapper=ancestor.cloneNode(false);
       for(const attr of [...wrapper.attributes])if(/^data-rt(?:-|$)|^on/i.test(attr.name))wrapper.removeAttribute(attr.name);
       container.append(wrapper);ancestors.set(ancestor,wrapper);
      }
      container=ancestors.get(ancestor);
     }
    }
    const clone=definition.cloneNode(true);container.append(clone);pair(definition,clone);
   }
  }
  for(const [original,node]of pairs){
   if(/^(script|style)$/i.test(node.localName)){node.remove();continue;}
   for(const attr of [...node.attributes])if(/^data-rt(?:-|$)|^on/i.test(attr.name))node.removeAttribute(attr.name);
   if(reused.has(original)){
    node.setAttribute('data-export-symbol',reused.get(original));
    for(const property of [...node.style])node.style.setProperty(property,localURL(node.style.getPropertyValue(property)),node.style.getPropertyPriority(property));
    for(const attr of [...node.attributes])if(attr.name!=='style'&&attr.value.includes('url('))attr.value=localURL(attr.value);
   }else{
    for(const [property,value]of styles.get(original)||[])node.style.setProperty(property,value,'important');
    if(reuse.instances.has(original)){const computed=w.getComputedStyle(original);for(const property of computed)if(property.startsWith('--'))node.style.setProperty(property,computed.getPropertyValue(property));}
   }
   for(const [namespace,name,value]of links.get(original)||[]){if(value===null)node.removeAttribute(name);else node.setAttributeNS(namespace,name,value);}
  }
  if(symbolCSS){const style=d.createElementNS(svg.namespaceURI,'style');style.textContent=symbolCSS;copy.prepend(style);}
  const css=w.getComputedStyle(svg),rect=svg.getBoundingClientRect(),width=parseFloat(css.width)||rect.width,height=parseFloat(css.height)||rect.height;
  if(!(width>0&&height>0))throw Error('This SVG canvas has no visible dimensions.');
  copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('width',String(width));copy.setAttribute('height',String(height));copy.style.width=width+'px';copy.style.height=height+'px';
  return {text:new XMLSerializer().serializeToString(copy),width,height,name:fileStem(svg.getAttribute('aria-label')||svg.id)};
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
 function fileStem(value,fallback='retouch-canvas'){return String(value||'').trim().replace(/\.(?:svg|png|jpe?g)$/i,'').replace(/[^\p{L}\p{N}_-]+/gu,'-').replace(/^-+|-+$/g,'').slice(0,80)||fallback;}
 function save(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 async function download(target,embed=true,options={}){const result=embed?await prepared(target):snapshot(target);result.name=fileStem(options.name,result.name);save(new Blob([result.text],{type:'image/svg+xml'}),result.name+'.svg');return result;}
 async function raster(target,scale=1,format='png',options={}){
  const {quality=92,background='#ffffff'}=options;
  if(format==='jpeg'&&(!Number.isInteger(quality)||quality<1||quality>100||!/^#[a-f0-9]{6}$/i.test(background)))throw Error('Choose JPEG quality from 1–100 and a six-digit background color.');
  if(!['png','jpeg'].includes(format))throw Error('Choose PNG or JPEG.');
  if(![1,2,3,4].includes(scale))throw Error('Choose an image scale from 1× to 4×.');
  const result=snapshot(target),parsed=new DOMParser().parseFromString(result.text,'image/svg+xml');
  if(parsed.querySelector('foreignObject'))throw Error('Raster export with embedded HTML is not supported yet.');
  const normalize=family=>family.trim().replace(/^["']|["']$/g,'').toLowerCase();
  const families=value=>{const result=[];let part='',quote='',escape=false;for(const char of value){if(escape){part+=char;escape=false;continue;}if(char==='\\'){part+=char;escape=true;continue;}if(quote){part+=char;if(char===quote)quote='';continue;}if(char==='"'||char==="'"){quote=char;part+=char;}else if(char===','){result.push(normalize(part));part='';}else part+=char;}result.push(normalize(part));return result;};
  const pageFonts=new Set([...target.ownerDocument.fonts].map(face=>normalize(face.family)));
  if(parsed.querySelector('use')&&parsed.querySelector('text,tspan,textPath')&&pageFonts.size)throw Error('Font embedding for SVG symbols with page fonts is not supported yet.');
  for(const text of parsed.querySelectorAll('text,tspan,textPath,text a')){
   const names=families(text.style.fontFamily);
   if(names.some(family=>pageFonts.has(family)))throw Error('This text references a page font. Font embedding is not supported yet.');
  }
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
 async function downloadJPEG(target,scale=1,options={}){const result=await jpeg(target,scale,options);result.name=fileStem(options.name,result.name);save(result.blob,result.name+(scale===1?'':'@'+scale+'x')+'.jpg');return result;}
 async function downloadPNG(target,scale=1,options={}){const result=await png(target,scale);result.name=fileStem(options.name,result.name);save(result.blob,result.name+(scale===1?'':'@'+scale+'x')+'.png');return result;}
 root.RetouchSVGExport={fileStem,useReferences,snapshot,prepared,download,png,jpeg,downloadPNG,downloadJPEG};
})(window);
