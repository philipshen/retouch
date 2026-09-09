(function(root){
 'use strict';
 const properties=['x','y','width','height','cx','cy','r','rx','ry','d','color','fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','opacity','display','visibility','clip-path','clip-rule','mask','filter','marker-start','marker-mid','marker-end','stop-color','stop-opacity','flood-color','flood-opacity','lighting-color','paint-order','vector-effect','shape-rendering','text-rendering','image-rendering','font-family','font-size','font-weight','font-style','font-stretch','font-variant','font-variant-numeric','font-feature-settings','letter-spacing','word-spacing','text-anchor','dominant-baseline','alignment-baseline','text-decoration','white-space','transform','transform-origin','transform-box'];
 function snapshot(target){
  const svg=target?.closest('svg');if(!svg)throw Error('Select an SVG canvas or a shape inside it.');
  if(svg.querySelector('use'))throw Error('Export of linked SVG symbol instances is not supported yet.');
  if(svg.querySelector('animate,animateMotion,animateTransform,set'))throw Error('Export of SVG animations is not supported yet.');
  const d=svg.ownerDocument,w=d.defaultView,copy=svg.cloneNode(true),originals=[svg,...svg.querySelectorAll('*')],copies=[copy,...copy.querySelectorAll('*')];
  const localURL=value=>value.replace(/url\(["']?([^"')]+)["']?\)/g,(whole,href)=>{try{const u=new URL(href,d.baseURI);if(u.protocol==='javascript:')return 'none';return 'url("'+(u.hash&&u.href.split('#')[0]===d.URL.split('#')[0]?u.hash:u.href)+'")';}catch{return whole;}});
  for(let i=0;i<originals.length;i++){
   const original=originals[i],node=copies[i];
   if(/^(script|style|animate|animateMotion|animateTransform|set)$/i.test(node.localName)){node.remove();continue;}
   for(const attr of [...node.attributes])if(/^data-rt(?:-|$)|^on/i.test(attr.name))node.removeAttribute(attr.name);
   const css=w.getComputedStyle(original);
   for(const property of properties){const value=css.getPropertyValue(property);if(value)node.style.setProperty(property,localURL(value),'important');}
   for(const attr of [...node.attributes]){
    if(attr.localName!=='href')continue;
    try{const url=new URL(attr.value,d.baseURI);if(['http:','https:','data:','blob:'].includes(url.protocol)||attr.value.startsWith('#'))node.setAttributeNS(attr.namespaceURI,attr.name,attr.value.startsWith('#')?attr.value:url.href);else node.removeAttributeNode(attr);}catch{node.removeAttributeNode(attr);}
   }
  }
  const css=w.getComputedStyle(svg),rect=svg.getBoundingClientRect(),width=parseFloat(css.width)||rect.width,height=parseFloat(css.height)||rect.height;
  if(!(width>0&&height>0))throw Error('This SVG canvas has no visible dimensions.');
  copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('width',String(width));copy.setAttribute('height',String(height));copy.style.width=width+'px';copy.style.height=height+'px';
  return {text:new XMLSerializer().serializeToString(copy),width,height,name:(svg.getAttribute('aria-label')||svg.id||'retouch-canvas').replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,80)||'retouch-canvas'};
 }
 function download(target){const result=snapshot(target),url=URL.createObjectURL(new Blob([result.text],{type:'image/svg+xml'})),link=document.createElement('a');link.href=url;link.download=result.name+'.svg';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);return result;}
 root.RetouchSVGExport={snapshot,download};
})(window);
